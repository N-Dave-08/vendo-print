import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaPrint } from 'react-icons/fa';
import { ezlogo } from '../assets/Icons';

import SmartPriceToggle from "../components/xerox/smart_price";
import PrinterList from "../components/xerox/printerList";
import SelectColor from "../components/usb/select_color";

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
  const [selectedSize, setSelectedSize] = useState("Short Bond");
  const [isColor, setIsColor] = useState(false);
  const [orientation, setOrientation] = useState("portrait");

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

  const handleScan = async () => {
    // Only proceed if the user explicitly initiated the scan
    if (!userInitiatedRef.current && event && event.type !== 'click') {
      console.log('Preventing automatic scan');
      return;
    }

    userInitiatedRef.current = false; // Reset the flag
    setIsLoading(true);
    setError("");
    setFilePreviewUrl("");
    setLocalPreviewUrl("");
    setUploadProgress(0);

    try {
      // First check if scanner is available
      await axios.get('http://localhost:5000/api/xerox/check-scanner');

      // Then get the preview
      const response = await axios.get('http://localhost:5000/api/xerox/preview', {
        responseType: 'blob'
      });

      // Create local preview URL for the UI
      const previewUrl = URL.createObjectURL(response.data);
      setLocalPreviewUrl(previewUrl);

      // Upload to Firebase Storage
      await uploadScanToFirebase(response.data);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to scan document. Please check if the scanner is connected and powered on.');
      console.error('Scan error:', error);
      setIsLoading(false);
    }
  };

  // Function to upload scanned document to Firebase Storage
  const uploadScanToFirebase = async (blobData) => {
    // Create a unique filename to avoid collisions
    const timestamp = new Date().getTime();
    const fileName = `scan_${timestamp}.jpg`;
    const storageRef = ref(storage, `uploads/${fileName}`);

    // Set metadata to ensure files are publicly readable
    const metadata = {
      contentType: 'image/jpeg',
      customMetadata: {
        'public': 'true',
        'source': 'scanner'
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
          console.log('Upload progress:', progress);
        },
        (error) => {
          // Handle error
          console.error("Upload failed:", error);
          setError("Failed to upload scanned document.");
          setIsLoading(false);
        },
        async () => {
          // Handle success
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            setFilePreviewUrl(url);

            // Record scan in Firebase database
            const scanRef = await push(dbRef(realtimeDb, "uploadedFiles"));
            await set(scanRef, {
              fileName: "Scanned Document",
              fileUrl: url,
              totalPages: 1,
              uploadedAt: new Date().toISOString(),
              uploadSource: "scanner"
            });

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
        orientation,
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
        fileName: "Scanned Document",
        fileUrl: filePreviewUrl, // Using the Firebase Storage URL
        printerName: selectedPrinter,
        copies: copies,
        selectedSize,
        isColor,
        orientation,
        totalPages,
        fileType: "jpg", // Explicitly set the file type as jpg for scanned documents
        contentType: "image/jpeg",  // Add MIME type information
        printMethod: "direct" // Request direct printing method
      };

      // Make API call in the background
      fetch('http://localhost:5000/api/print', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(printJob)
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
    <ClientContainer className="p-4">

      {/* Main Box Container */}
      <div className="flex flex-col w-full h-full bg-gray-200 rounded-lg shadow-md border-4 border-[#31304D] p-6 space-x-4 relative">
        {/* Top Section */}
        <div className="flex w-full space-x-6">
          {/* Left Side */}
          <div className="w-1/2 flex flex-col">
            <div className="flex items-center">
              <button
                className="w-10 h-10 bg-gray-200 text-[#31304D] flex items-center justify-center rounded-lg border-2 border-[#31304D] mr-4"
                onClick={() => navigate(-1)}
              >
                <FaArrowLeft className="text-2xl text-[#31304D]" />
              </button>
              <p className="text-3xl font-bold text-[#31304D]">Xerox</p>
            </div>

            {/* Print Settings */}
            <div className="mt-6 space-y-4">
              <p className="mt-3 font-bold text-gray-700 text-xl">
                Inserted coins: {availableCoins}
              </p>

              {/* Printer Selection */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Printer
                </label>
                <PrinterList
                  selectedPrinter={selectedPrinter}
                  setSelectedPrinter={setSelectedPrinter}
                  onPrinterCapabilities={setPrinterCapabilities}
                />
              </div>

              {/* Copies */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Copies
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={copies}
                  onChange={(e) => setCopies(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border rounded-md bg-white text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#31304D]"
                />
              </div>

              {/* Paper Size */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Paper Size
                </label>
                <select
                  value={selectedSize}
                  onChange={(e) => setSelectedSize(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-white text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#31304D]"
                >
                  <option value="Short Bond">Short Bond (8.5 x 11)</option>
                  <option value="A4">A4 (8.3 x 11.7)</option>
                  <option value="Long Bond">Long Bond (8.5 x 14)</option>
                </select>
              </div>

              {/* Orientation */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Orientation
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="orientation"
                      value="portrait"
                      checked={orientation === "portrait"}
                      onChange={() => setOrientation("portrait")}
                      className="w-4 h-4 text-[#31304D] border-gray-300 focus:ring-[#31304D]"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">Portrait</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="orientation"
                      value="landscape"
                      checked={orientation === "landscape"}
                      onChange={() => setOrientation("landscape")}
                      className="w-4 h-4 text-[#31304D] border-gray-300 focus:ring-[#31304D]"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">Landscape</span>
                  </label>
                </div>
              </div>

              {/* Color Selection */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Print Mode
                </label>
                <SelectColor
                  isColor={isColor}
                  setIsColor={setIsColor}
                  printerCapabilities={printerCapabilities}
                />
              </div>

              <SmartPriceToggle
                copies={copies}
                isSmartPriceEnabled={isSmartPriceEnabled}
                setIsSmartPriceEnabled={setIsSmartPriceEnabled}
                calculatedPrice={calculatedPrice}
                totalPages={totalPages}
                setCalculatedPrice={setCalculatedPrice}
                filePreviewUrl={filePreviewUrl || localPreviewUrl}
              />
            </div>
          </div>

          {/* Right Side - Preview */}
          <div className="w-1/2">
            <div className="bg-white rounded-lg p-4 h-full flex flex-col items-center justify-center relative">
              {error && (
                <div className="text-red-500 mb-4 text-center">
                  {error}
                </div>
              )}
              {localPreviewUrl ? (
                <>
                  <img
                    src={localPreviewUrl}
                    alt="Scanned Preview"
                    className="max-w-full max-h-[400px] object-contain"
                  />
                  {isLoading && uploadProgress < 100 && (
                    <div className="w-full mt-2">
                      <div className="bg-gray-200 rounded-full h-2 mb-1">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-center text-gray-500">Uploading scan... {Math.round(uploadProgress)}%</p>
                    </div>
                  )}
                  <div className="mt-4 flex space-x-4">
                    <button
                      onClick={initiateUserScan}
                      disabled={isLoading}
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                    >
                      {isLoading ? "Scanning..." : "Scan Again"}
                    </button>
                    <button
                      onClick={clearScannedDocument}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                    >
                      Clear
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center text-gray-500">
                  <p className="mb-4">No document scanned yet</p>
                  <button
                    onClick={initiateUserScan}
                    disabled={isLoading}
                    className="px-6 py-3 bg-[#31304D] text-white text-lg font-bold rounded-lg hover:bg-opacity-90"
                  >
                    {isLoading ? "Scanning..." : "Scan Document"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Print Button */}
        <div className="flex flex-col items-center mt-6 mb-4">
          <button
            onClick={handlePrint}
            disabled={isLoading || !filePreviewUrl || uploadProgress < 100}
            className={`px-8 py-3 text-white text-lg font-bold rounded-lg flex items-center justify-center transition-all ${isLoading || !filePreviewUrl || uploadProgress < 100
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-[#31304D] hover:bg-opacity-90 shadow-lg hover:shadow-xl"
              }`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {printStatus || "Processing..."}
              </>
            ) : (
              <>
                Print Document
                <FaPrint className="ml-2" />
              </>
            )}
          </button>

          {!isLoading && localPreviewUrl && uploadProgress < 100 && (
            <p className="text-sm text-amber-600 mt-2">Upload in progress... Please wait until complete before printing.</p>
          )}

          {/* Progress Bar */}
          {isLoading && printProgress > 0 && (
            <div className="w-full max-w-md mt-4">
              <div className="bg-gray-300 rounded-full h-2.5">
                <div
                  className="bg-[#31304D] h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${printProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 mt-1 text-center">{printStatus}</p>
            </div>
          )}
        </div>
      </div>
    </ClientContainer>
  );
};

export default Xerox;
