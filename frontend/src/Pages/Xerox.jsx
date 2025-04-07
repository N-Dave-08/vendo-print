import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, X } from "lucide-react";
import { ezlogo } from '../assets/Icons';

import SmartPriceToggle from "../components/xerox/smart_price";
import PrinterList from "../components/xerox/printerList";
import SelectColor from "../components/usb/select_color";
import PrintSettings from "../components/common/PrintSettings";

import { realtimeDb, storage } from '../../firebase/firebase_config';
import { ref as dbRef, get, update, set, push } from "firebase/database";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import axios from "axios";
import ClientContainer from '../components/containers/ClientContainer';

const Xerox = () => {
  const navigate = useNavigate();
  const userInitiatedRef = useRef(false);

  // File at Printer states
  const [filePreviewUrl, setFilePreviewUrl] = useState(""); // Firebase Storage URL for printing
  const [localPreviewUrl, setLocalPreviewUrl] = useState(""); // Local blob URL for preview
  const [isSmartPriceEnabled, setIsSmartPriceEnabled] = useState(false);
  const [calculatedPrice, setCalculatedPrice] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [availableCoins, setAvailableCoins] = useState(0);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  // Print settings
  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [printerCapabilities, setPrinterCapabilities] = useState(null);
  const [copies, setCopies] = useState(1);
  const [selectedSize, setSelectedSize] = useState("Short Bond"); // Always use Short Bond
  const [isColor, setIsColor] = useState(false);
  const [orientation, setOrientation] = useState("portrait"); // Add orientation for PrintSettings component

  // Print status for progress tracking
  const [printStatus, setPrintStatus] = useState("");
  const [printProgress, setPrintProgress] = useState(0);

  useEffect(() => {
    const fetchAvailableCoins = async () => {
      const coinRef = dbRef(realtimeDb, "coinCount/availableCoins");
      try {
        const snapshot = await get(coinRef);
        if (snapshot.exists()) {
          setAvailableCoins(snapshot.val());
        } else {
          console.error("Error retrieving available coins.");
        }
      } catch (error) {
        console.error("Error fetching available coins:", error);
      }
    };
    fetchAvailableCoins();
  }, []);

  // Cleanup blob URLs when component unmounts
  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, []);

  // Add this useEffect for price calculation
  useEffect(() => {
    // Calculate price whenever relevant factors change
    if (!filePreviewUrl) {
      setCalculatedPrice(0);
      return;
    }

    const basePrice = isColor ? 12 : 10;
    const totalCost = basePrice * copies * totalPages;
    
    // Apply smart pricing discount if enabled
    const finalPrice = isSmartPriceEnabled ? Math.round(totalCost * 0.85) : totalCost;
    
    setCalculatedPrice(finalPrice);
  }, [filePreviewUrl, copies, totalPages, isColor, isSmartPriceEnabled]);

  const handleScan = async () => {
    // Only proceed if the user explicitly initiated the scan
    if (!userInitiatedRef.current && event && event.type !== 'click') {
      console.log('Preventing automatic scan');
      return;
    }

    userInitiatedRef.current = false; // Reset the flag
    setIsLoading(true);
    setError("");
    // Don't clear existing preview URLs until we have a new one
    const previousLocalUrl = localPreviewUrl;
    setUploadProgress(0);

    try {
      // First check if scanner is available
      await axios.get('http://localhost:5000/api/xerox/check-scanner', { timeout: 10000 });

      // Then get the preview - increase timeout to 60 seconds for large files
      console.log("Starting scan preview request...");
      const response = await axios.get('http://localhost:5000/api/xerox/preview', {
        responseType: 'blob',
        timeout: 120000, // Increase to 120 seconds for larger scans
        maxContentLength: 20971520, // 20MB max file size
        maxBodyLength: 20971520 // 20MB max body size
      });

      console.log("Scan preview received, size:", response.data.size, "bytes");
      
      // Revoke the previous object URL to prevent memory leaks
      if (previousLocalUrl) {
        URL.revokeObjectURL(previousLocalUrl);
      }
      
      // Create local preview URL for the UI
      const previewUrl = URL.createObjectURL(response.data);
      console.log("Created preview URL:", previewUrl);
      setLocalPreviewUrl(previewUrl);

      // Upload to Firebase Storage
      await uploadScanToFirebase(response.data);
    } catch (error) {
      console.error('Scan error:', error);
      
      // Handle different error types
      if (error.code === 'ECONNABORTED' || !error.response) {
        setError('Connection to the scanner timed out. The scan might be too large or the system is busy. Please try again.');
      } else if (error.message.includes('Network Error')) {
        setError('Network error. Please check if the scanner server is running and connected.');
      } else {
        setError(
          error.response?.data?.message || 
          'Failed to scan document. Please check if the scanner is connected and powered on.'
        );
      }
      
      setIsLoading(false);
    }
  };

  // Function to upload scanned document to Firebase Storage
  const uploadScanToFirebase = async (blobData) => {
    // Create a unique filename to avoid collisions
    const timestamp = new Date().getTime();
    const fileName = `scan_${timestamp}.jpg`;
    const storageRef = ref(storage, `uploads/${fileName}`);

    // Check if blob data is valid
    if (!blobData || blobData.size === 0) {
      console.error("Invalid blob data for upload");
      setError("Invalid scan data for upload.");
      setIsLoading(false);
      return;
    }

    console.log(`Uploading scan to Firebase: ${fileName}, size: ${blobData.size} bytes`);

    // Determine the correct MIME type based on the data
    const contentType = blobData.type || 'image/jpeg';
    
    // Set metadata to ensure files are publicly readable
    const metadata = {
      contentType: contentType,
      customMetadata: {
        'public': 'true',
        'source': 'scanner',
        'timestamp': timestamp.toString(),
        'fileSize': blobData.size.toString()
      }
    };

    try {
      const uploadTask = uploadBytesResumable(storageRef, blobData, metadata);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          // Handle progress
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
          console.log('Upload progress:', progress.toFixed(2) + '%');
        },
        (error) => {
          // Handle upload error
          console.error("Upload failed:", error);
          setError("Failed to upload scanned document to storage.");
          setIsLoading(false);
        },
        async () => {
          // Handle success
          try {
            console.log("Upload completed, getting download URL...");
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            setFilePreviewUrl(url);
            console.log("Download URL received:", url);

            // Record scan in Firebase database
            const scanRef = await push(dbRef(realtimeDb, "uploadedFiles"));
            await set(scanRef, {
              fileName: "Scanned Document",
              fileUrl: url,
              totalPages: 1,
              uploadedAt: new Date().toISOString(),
              uploadSource: "scanner",
              contentType: contentType,
              fileSize: blobData.size
            });

            console.log("Scan recorded in database with ID:", scanRef.key);
            setIsLoading(false);
          } catch (error) {
            console.error("Error getting download URL:", error);
            setError("Failed to process scanned document.");
            setIsLoading(false);
          }
        }
      );
    } catch (error) {
      console.error("Error uploading to Firebase:", error);
      setError("Failed to upload scanned document.");
      setIsLoading(false);
    }
  };

  // Function to explicitly set user-initiated flag
  const initiateUserScan = () => {
    userInitiatedRef.current = true;
    handleScan();
  };

  // Function to clear the scanned document
  const clearScannedDocument = () => {
    // Revoke object URL to prevent memory leaks
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }

    setLocalPreviewUrl("");
    setFilePreviewUrl("");
    setCalculatedPrice(0);
    setError("");
  };

  const handlePrint = async () => {
    if (!filePreviewUrl) {
      setError("No document scanned! Please scan a document first.");
      return;
    }

    if (uploadProgress < 100) {
      setError("Please wait for the document to finish uploading before printing.");
      return;
    }

    if (filePreviewUrl.startsWith('blob:')) {
      setError("Document is still uploading. Please wait for the upload to complete.");
      return;
    }

    if (!selectedPrinter) {
      setError("Please select a printer first.");
      return;
    }

    if (availableCoins < calculatedPrice) {
      setError(`Insufficient coins. Please insert ${calculatedPrice - availableCoins} more coins.`);
      return;
    }

    setIsLoading(true);
    setPrintStatus("Initializing print job...");
    setPrintProgress(10);

    try {
      // Create a unique ID for the print job
      const printJobId = Date.now().toString();

      // Record the print job in Firebase first
      const printJobsRef = dbRef(realtimeDb, `files/${printJobId}`);
      await set(printJobsRef, {
        fileName: "Scanned Document",
        fileUrl: filePreviewUrl, // Using the Firebase Storage URL instead of blob URL
        printerName: selectedPrinter,
        copies: copies,
        selectedSize,
        isColor,
        totalPages,
        price: calculatedPrice,
        progress: 5, // Start with 5% right away
        printStatus: "Preparing print job...",
        status: "Processing",
        fileType: "image/jpeg",
        timestamp: new Date().toISOString()
      });

      // Update coins immediately
      const updatedCoins = availableCoins - calculatedPrice;
      await update(dbRef(realtimeDb, "coinCount"), {
        availableCoins: updatedCoins
      });
      setAvailableCoins(updatedCoins);

      // Immediately redirect to printer page
      navigate('/printer');

      // Progress simulation steps for background updates
      const progressSteps = [
        { progress: 15, status: "Processing document...", delay: 800 },
        { progress: 30, status: "Configuring printer settings...", delay: 1500 },
        { progress: 45, status: "Converting document format...", delay: 2200 },
        { progress: 60, status: "Connecting to printer...", delay: 3000 },
        { progress: 75, status: "Sending to printer...", delay: 3800 },
        { progress: 85, status: "Printing in progress...", delay: 4500 },
        { progress: 95, status: "Finishing print job...", delay: 5200 },
      ];

      // Start updating progress in the background
      for (const step of progressSteps) {
        setTimeout(() => {
          update(printJobsRef, {
            progress: step.progress,
            printStatus: step.status
          });
        }, step.delay);
      }

      // Continue with API call in the background
      const printJob = {
        jobId: printJobId,
        printJobId: printJobId,
        fileName: "Scanned Document",
        fileUrl: filePreviewUrl, // Using the Firebase Storage URL
        printerName: selectedPrinter,
        copies: copies,
        selectedSize,
        isColor,
        totalPages,
        fileType: "jpeg", // Change from 'jpg' to 'jpeg' to match standard MIME type
        contentType: "image/jpeg",  // Add MIME type information
        printMethod: "direct" // Request direct printing method
      };

      // Make API call in the background
      fetch('http://localhost:5000/api/print', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(printJob),
        // Add timeout to avoid hanging requests
        signal: AbortSignal.timeout(30000)
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`Print failed. Server returned ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          // Update the print job with success status
          update(printJobsRef, {
            progress: 100,
            printStatus: "Print job completed",
            status: "Done"
          });
        })
        .catch(error => {
          console.error("Error in background print job:", error);
          // Update the print job with error status
          update(printJobsRef, {
            progress: 0,
            printStatus: `Error: ${error.message}`,
            status: "Error"
          });
        });

    } catch (err) {
      console.error("Print job error:", err);
      setError("Failed to print. Please try again.");
      setIsLoading(false);
      setPrintStatus("");
      setPrintProgress(0);
    }
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-base-200">
      <div className="container mx-auto px-4 py-4 flex flex-col h-full">
        {/* Page Header */}
        <div className="flex items-center gap-3 mb-3">
          <button
            className="btn btn-circle btn-ghost btn-sm"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-primary">Xerox</h1>
          
          {/* Balance Display - moved to header */}
          <div className="ml-auto">
            <div className="badge badge-lg badge-primary text-base-100 font-bold">
              Inserted coins: {availableCoins}
            </div>
          </div>
        </div>

        {/* Main Content Area - with proper overflow handling */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 overflow-hidden">
          {/* Left Column - Settings with own scrollbar */}
          <div className="overflow-y-auto pr-2 pb-2">
            <div className="flex flex-col gap-4">
              {/* Use the reusable PrintSettings component */}
              <PrintSettings 
                selectedPrinter={selectedPrinter}
                setSelectedPrinter={setSelectedPrinter}
                printerCapabilities={printerCapabilities}
                setPrinterCapabilities={setPrinterCapabilities}
                copies={copies}
                setCopies={setCopies}
                isColor={isColor}
                setIsColor={setIsColor}
                orientation={orientation}
                setOrientation={setOrientation}
                filePreviewUrl={filePreviewUrl}
                totalPages={totalPages}
                isSmartPriceEnabled={isSmartPriceEnabled}
                setIsSmartPriceEnabled={setIsSmartPriceEnabled}
                calculatedPrice={calculatedPrice}
                setCalculatedPrice={setCalculatedPrice}
              />
            </div>
          </div>

          {/* Right Column - Document Preview & Scan Button with own scrollbar */}
          <div className="overflow-y-auto pl-2 pb-2">
            <div className="card bg-base-100 shadow-sm h-full flex flex-col">
              <div className="card-body p-4 flex-1 flex flex-col overflow-hidden">
                {error && (
                  <div className="alert alert-error mb-2 text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex-1 flex flex-col items-center justify-center bg-base-200 rounded-lg p-4 overflow-hidden">
                  {localPreviewUrl ? (
                    <div className="relative w-full h-full flex flex-col">
                      <div className="absolute top-2 right-2 z-10">
                        <button 
                          className="btn btn-circle btn-sm btn-error" 
                          onClick={clearScannedDocument}
                          aria-label="Clear scanned document"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <div className="flex-1 overflow-hidden rounded-lg border border-base-300">
                        <img
                          src={localPreviewUrl}
                          alt="Scanned Document"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-4">
                      <p className="text-lg mb-4 text-base-content/70">No document scanned yet</p>
                      <button
                        className="btn btn-primary gap-2"
                        onClick={initiateUserScan}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <span className="loading loading-spinner"></span>
                            Scanning...
                          </>
                        ) : (
                          <>
                            Scan Document
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {localPreviewUrl && (
                  <div className="card-actions justify-end mt-3">
                    <button
                      className="btn btn-primary gap-2"
                      onClick={handlePrint}
                      disabled={isLoading || !filePreviewUrl}
                    >
                      {isLoading ? (
                        <>
                          <span className="loading loading-spinner"></span>
                          Processing...
                        </>
                      ) : (
                        <>
                          Print Document
                          <Printer className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                )}

                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="mt-2">
                    <progress
                      className="progress progress-primary w-full"
                      value={uploadProgress}
                      max="100"
                    ></progress>
                    <p className="text-xs mt-1 text-center">{uploadProgress.toFixed(0)}% uploaded</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Xerox;
