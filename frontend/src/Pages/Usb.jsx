import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { Printer, ArrowLeft, X } from "lucide-react";
import MiniNav from "../components/MiniNav";

import CustomPage from "../components/common/customized_page";
import DocumentPreview from "../components/common/document_preview";
import SmartPriceToggle from "../components/common/smart_price";
import PrinterList from "../components/usb/printerList";

import { realtimeDb, storage } from "../../firebase/firebase_config";
import { ref as dbRef, push, get, update, set } from "firebase/database";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { onValue } from "firebase/database";
import axios from "axios";
import { PDFDocument } from "pdf-lib";
import mammoth from "mammoth";

import { getPageIndicesToPrint } from "../utils/pageRanges";
import Header from "../components/headers/Header";
import ClientContainer from "../components/containers/ClientContainer";

// Let's update the GroupDocs viewer URL function to ensure we get a proper view
const getGroupDocsViewerUrl = (fileUrl) => {
  // Encode the file URL to be used as a parameter
  const encodedFileUrl = encodeURIComponent(fileUrl);

  // Return a direct URL to the GroupDocs viewer
  return `https://products.groupdocs.app/viewer/view?file=${encodedFileUrl}`;
};

// Let's add a direct function to open the document in GroupDocs with a more reliable approach
const openInGroupDocs = (fileUrl) => {
  const encodedFileUrl = encodeURIComponent(fileUrl);
  const groupDocsUrl = `https://products.groupdocs.app/viewer/view?file=${encodedFileUrl}`;

  // Open GroupDocs in a new tab
  window.open(groupDocsUrl, '_blank');
};

const Usb = () => {
  const navigate = useNavigate();

  const [filePreviewUrl, setFilePreviewUrl] = useState("");
  const [fileToUpload, setFileToUpload] = useState(null);
  const [copies, setCopies] = useState(1);
  const [selectedSize, setSelectedSize] = useState("Short Bond");
  const [isColor, setIsColor] = useState(false);
  const [orientation, setOrientation] = useState("portrait");
  const [selectedPageOption, setSelectedPageOption] = useState("All");
  const [customPageRange, setCustomPageRange] = useState("");
  const [totalPages, setTotalPages] = useState(1);
  const [isSmartPriceEnabled, setIsSmartPriceEnabled] = useState(false);
  const [calculatedPrice, setCalculatedPrice] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [availableCoins, setAvailableCoins] = useState(0);

  // Add print status state
  const [printStatus, setPrintStatus] = useState("");
  const [printProgress, setPrintProgress] = useState(0);

  // Guide modal state
  const [showModal, setShowModal] = useState(false);

  // Add a state variable to track if we're using an external viewer
  const [useExternalViewer, setUseExternalViewer] = useState(false);
  const [externalViewerUrl, setExternalViewerUrl] = useState("");

  const [selectedPrinter, setSelectedPrinter] = useState("");

  useEffect(() => {
    setShowModal(true);
  }, []);

  const closeModal = () => {
    setShowModal(false);
  };

  useEffect(() => {
    const coinRef = dbRef(realtimeDb, "coinCount/availableCoins");

    // Listen for real-time updates
    const unsubscribe = onValue(coinRef, (snapshot) => {
      if (snapshot.exists()) {
        setAvailableCoins(snapshot.val());
      } else {
        console.error("Error retrieving available coins.");
      }
    }, (error) => {
      console.error("Error fetching available coins:", error);
    });

    return () => unsubscribe();
  }, []);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) {
      alert("No file selected!");
      return;
    }
    setFileToUpload(file);

    // If PDF, get total pages
    if (file.type === "application/pdf") {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const pdfData = new Uint8Array(e.target.result);
        const pdfDoc = await PDFDocument.load(pdfData);
        const totalPageCount = pdfDoc.getPageCount();
        setTotalPages(totalPageCount);
      };
      reader.readAsArrayBuffer(file);
    }
    else if (
      file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const arrayBuffer = e.target.result;
        try {
          const result = await mammoth.extractRawText({ arrayBuffer });
          const textLength = result.value.length;
          const estimatedPages = Math.ceil(textLength / 1000);
          setTotalPages(estimatedPages);
        } catch (error) {
          console.error("Error reading docx file:", error);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setTotalPages(1);
    }

    uploadFileToFirebase(file);
  };

  const uploadFileToFirebase = async (file) => {
    if (!file) {
      return;
    }

    // Create a unique filename to avoid collisions
    const timestamp = new Date().getTime();
    const uniqueFileName = `${timestamp}_${file.name}`;
    const storageRef = ref(storage, `uploads/${uniqueFileName}`);

    // Set metadata to ensure files are publicly readable
    const metadata = {
      contentType: file.type,
      customMetadata: {
        'public': 'true'
      }
    };

    const uploadTask = uploadBytesResumable(storageRef, file, metadata);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        // Handle progress if needed
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log('Upload progress:', progress);
      },
      (error) => {
        console.error("Upload failed:", error);
        setFilePreviewUrl("");
        setFileToUpload(null);
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          setFilePreviewUrl(url);

          // Push file details to Firebase Realtime Database
          const fileRef = push(dbRef(realtimeDb, "uploadedFiles"));
          await set(fileRef, {
            fileName: file.name,
            fileUrl: url,
            totalPages,
            uploadedAt: new Date().toISOString(),
            uploadSource: "usb"
          });

        } catch (error) {
          console.error("Error getting download URL:", error);
          setFilePreviewUrl("");
          setFileToUpload(null);
        }
      }
    );
  };

  // Add a function to render DOCX as HTML using mammoth.js
  const renderDocxAsHtml = async () => {
    if (!fileToUpload ||
      !(fileToUpload.name.toLowerCase().endsWith('.docx') ||
        fileToUpload.name.toLowerCase().endsWith('.doc'))) {
      alert("Please upload a valid Word document.");
      return;
    }

    setIsLoading(true);

    try {
      // Read the file as an ArrayBuffer
      const arrayBuffer = await fileToUpload.arrayBuffer();

      // Use mammoth to convert to HTML
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const htmlContent = result.value;

      // Open a new window with the HTML content
      const printWindow = window.open('', '_blank', 'width=800,height=600');

      if (!printWindow) {
        alert("Please allow pop-ups to open the preview.");
        setIsLoading(false);
        return;
      }

      // Write the HTML content to the window
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>VendoPrint - ${fileToUpload?.name || 'Document'}</title>
            <style>
              body {
                margin: 0;
                padding: 20px;
                font-family: Arial, sans-serif;
              }
              .container {
                max-width: 800px;
                margin: 0 auto;
              }
              .header {
                text-align: center;
                padding: 20px;
                background-color: #f8f9fa;
                border-bottom: 1px solid #e9ecef;
                margin-bottom: 20px;
              }
              .content {
                background-color: white;
                padding: 20px;
                border: 1px solid #ddd;
                border-radius: 4px;
              }
              button {
                padding: 10px 20px;
                background-color: #31304D;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                margin-top: 10px;
              }
              @media print {
                .no-print {
                  display: none;
                }
                body {
                  padding: 0;
                }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header no-print">
                <h2>${fileToUpload?.name || 'Document'}</h2>
                <p>This is a preview of your document. Some formatting might differ from the original file.</p>
                <button onclick="window.print()">Print Document</button>
              </div>
              <div class="content">
                ${htmlContent}
              </div>
            </div>
          </body>
        </html>
      `);

      printWindow.document.close();

    } catch (error) {
      console.error("Error rendering document:", error);
      alert("Error rendering the document. Please try another option.");
    } finally {
      setIsLoading(false);
    }
  };

  // Update the handlePrint function to use our custom settings and send them to the backend
  const handlePrint = async () => {
    if (!fileToUpload) {
      alert("Please select a file to print first.");
      return;
    }

    if (!selectedPrinter) {
      alert("Please select a printer first.");
      return;
    }

    setIsLoading(true);
    setPrintStatus("Initializing print job...");
    setPrintProgress(10);

    if (availableCoins < calculatedPrice) {
      setIsLoading(false);
      setPrintStatus("");
      setPrintProgress(0);
      alert(`Insufficient coins. Please insert ${calculatedPrice - availableCoins} more coins.`);
      return;
    }

    try {
      // Get the selected pages based on page options
      setPrintStatus("Processing document...");
      setPrintProgress(20);

      const pagesToPrint = getPageIndicesToPrint({
        totalPages,
        selectedPageOption,
        customPageRange,
      });

      // Get file extension
      const fileName = fileToUpload.name;
      const fileExtension = fileName.split('.').pop().toLowerCase();

      setPrintStatus("Preparing printer settings...");
      setPrintProgress(30);

      // Create the print job object with all settings
      const printJob = {
        fileName: fileName,
        fileUrl: filePreviewUrl,
        printerName: selectedPrinter,
        copies: copies,
        selectedSize,
        isColor,
        orientation,
        selectedPageOption,
        customPageRange,
        totalPages,
        price: calculatedPrice,
        // Add additional properties that might help with debugging
        fileType: fileExtension,
        timestamp: new Date().toISOString()
      };

      // Add special handling for specific file types
      if (['doc', 'docx'].includes(fileExtension)) {
        // For Word documents, inform the user about enhanced printing
        setPrintStatus("Using enhanced Word document printing...");
        console.log("📄 Using enhanced Word document printing capabilities");
      } else if (fileExtension === 'pdf') {
        // For PDFs, apply specific settings
        setPrintStatus("Configuring PDF settings...");
        console.log("📑 Applying PDF-specific print settings");
      }

      console.log('🖨️ Print request initiated with data:', {
        fileName: fileToUpload.name,
        printerName: selectedPrinter,
        copies,
        selectedSize,
        isColor,
        orientation,
        selectedPageOption,
        totalPages,
        price: calculatedPrice,
        fileType: fileExtension
      });

      console.log('🔗 File URL:', filePreviewUrl);

      const apiUrl = 'http://localhost:5000/api/print';
      console.log(`📡 Sending POST request to: ${apiUrl}`);
      console.log('📦 Request body:', JSON.stringify(printJob, null, 2));

      setPrintStatus("Sending to printer...");
      setPrintProgress(50);

      // Send print job to backend with retry mechanism
      let response;
      let retryCount = 0;
      const maxRetries = 2;

      while (retryCount <= maxRetries) {
        try {
          response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(printJob)
          });

          if (response.ok) break;

          // If we're here, the response wasn't ok
          retryCount++;
          setPrintStatus(`Retry attempt ${retryCount}...`);
          console.log(`Retry attempt ${retryCount} of ${maxRetries}`);

          if (retryCount <= maxRetries) {
            // Wait before retrying (exponential backoff)
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retryCount)));
          }
        } catch (fetchError) {
          console.error("Fetch error:", fetchError);
          retryCount++;
          setPrintStatus(`Connection error, retrying...`);

          if (retryCount <= maxRetries) {
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retryCount)));
          } else {
            throw fetchError;
          }
        }
      }

      if (!response || !response.ok) {
        throw new Error(`Print failed after ${retryCount} retries. Server returned ${response?.status || 'unknown'}`);
      }

      console.log(`🔄 Response status: ${response.status} ${response.statusText}`);
      setPrintProgress(70);
      setPrintStatus("Processing print job...");

      const responseData = await response.json().catch(e => null);
      console.log('📥 Response data:', responseData);

      // Special handling for Word documents
      if (['doc', 'docx'].includes(fileExtension)) {
        console.log('Word document detected, checking print result...');
        setPrintStatus("Verifying Word document print job...");

        if (responseData?.details?.results) {
          const results = responseData.details.results;
          console.log('Print results:', results);

          // Check if any of the print methods succeeded
          const anySuccess = results.some(r =>
            r.result &&
            (r.result.includes('success') ||
              r.result.includes('sent to printer') ||
              r.result.includes('Print command sent'))
          );

          if (!anySuccess && responseData.success) {
            console.warn('Server reported success but no successful print results found');
            setPrintStatus("Print job sent but verification uncertain");
          } else if (anySuccess) {
            setPrintStatus("Print job verified successfully!");
          }
        }
      }

      setPrintProgress(80);
      setPrintStatus("Recording transaction...");

      // Record the print job in Firebase
      console.log('📝 Recording print job in Firebase...');
      await recordPrintJob();

      // Update coins after successful print
      const updatedCoins = availableCoins - calculatedPrice;
      console.log(`💰 Updating coins from ${availableCoins} to ${updatedCoins}`);
      await update(dbRef(realtimeDb, "coinCount"), {
        availableCoins: updatedCoins
      });
      setAvailableCoins(updatedCoins);

      setPrintProgress(100);
      setPrintStatus("Print job completed successfully!");

      // Show success message
      alert("Print job submitted successfully!");

      // Reset form
      setTimeout(() => {
        setFileToUpload(null);
        setFilePreviewUrl("");
        setIsLoading(false);
        setPrintStatus("");
        setPrintProgress(0);
      }, 2000); // Give user time to see the success status

    } catch (error) {
      console.error("❌ Error printing document:", error);
      setPrintStatus("Print job failed: " + error.message);
      setPrintProgress(0);
      alert(`Error printing document: ${error.message}`);
      setIsLoading(false);
    }
  };

  // Function to record the print job in Firebase
  const recordPrintJob = async () => {
    try {
      // Record the print job in Firebase
      const printJobsRef = dbRef(realtimeDb, "files");
      await push(printJobsRef, {
        fileName: fileToUpload?.name,
        fileUrl: filePreviewUrl,
        printerName: selectedPrinter,
        copies: copies,
        paperSize: selectedSize,
        isColor: isColor,
        orientation: orientation,
        pageOption: selectedPageOption,
        customPageRange: customPageRange,
        totalPages: totalPages,
        finalPrice: calculatedPrice,
        timestamp: new Date().toISOString(),
        status: "Pending"
      });

      // Deduct coins
      const coinRef = dbRef(realtimeDb, "coinCount");
      const updatedCoins = availableCoins - calculatedPrice;
      await update(coinRef, { availableCoins: updatedCoins });

      // Update local state
      setAvailableCoins(updatedCoins);

      return true;
    } catch (error) {
      console.error("Error recording print job:", error);
      alert("Failed to record print job. Please try again.");
      return false;
    }
  };

  // Add a function to handle printing from the GroupDocs viewer
  const handleCloseExternalViewer = () => {
    setUseExternalViewer(false);
    setExternalViewerUrl("");
  };

  // Add a function to handle direct downloading for Word docs
  const handleDocDownload = () => {
    if (!filePreviewUrl) return;

    // Create an anchor element
    const downloadLink = document.createElement('a');
    downloadLink.href = filePreviewUrl;

    // Set the download attribute with the file name
    downloadLink.download = fileToUpload?.name || 'document.docx';

    // Append to the body
    document.body.appendChild(downloadLink);

    // Trigger the download
    downloadLink.click();

    // Clean up
    document.body.removeChild(downloadLink);
  };

  return (
    <ClientContainer>
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
              <p className="text-3xl font-bold text-[#31304D]">USB</p>
            </div>

            {/* File Upload Section */}
            <div className="mt-6 space-y-4">
              {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white p-8 rounded-md shadow-md relative max-w-full">
                    {/* Close Button */}
                    <button
                      onClick={closeModal}
                      className="absolute top-2 right-2 text-2xl font-bold hover:text-red-600"
                    >
                      <X size={24} />
                    </button>

                    <h2 className="text-4xl font-bold mb-4 text-center">
                      Guide
                    </h2>

                    <ul className="list-disc list-inside mb-4 text-2xl">
                      <li><span className="font-bold text-blue-500">Please send your file via USB to VendoPrint.</span></li>
                      <li className="font-bold">Make sure you have enough coins in your account.</li>
                      <li className="font-semibold">Once your file is transferred, select or browse it below to upload.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* External Viewer Modal */}
              {useExternalViewer && externalViewerUrl && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg shadow-lg w-full h-[90vh] flex flex-col max-w-6xl">
                    <div className="flex justify-between items-center p-4 border-b">
                      <h2 className="text-xl font-semibold">Document Preview - {fileToUpload?.name}</h2>
                      <div className="flex items-center gap-4">
                        <button
                          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark flex items-center"
                          onClick={() => {
                            const printUrl = externalViewerUrl.replace('/embed?', '/view?');
                            window.open(printUrl, '_blank', 'width=800,height=600');
                          }}
                        >
                          <Printer size={18} className="mr-2" />
                          Open Print View
                        </button>
                        <button
                          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
                          onClick={handleDocDownload}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="mr-2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                          </svg>
                          Download
                        </button>
                        <button
                          onClick={handleCloseExternalViewer}
                          className="p-2 rounded-full hover:bg-gray-100"
                        >
                          <X size={24} />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <iframe
                        src={externalViewerUrl}
                        className="w-full h-full border-none"
                        title="Document Preview"
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
                        referrerpolicy="no-referrer"
                      />
                    </div>
                    <div className="p-4 bg-gray-100 border-t text-center">
                      <p className="text-sm text-gray-600 mb-2">Having trouble seeing the document?</p>
                      <a
                        href={externalViewerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Open in new tab
                      </a>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 p-6 rounded-lg shadow-sm border border-gray-200">
                <h2 className="text-xl font-bold text-primary mb-4 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="mr-2" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  Choose File
                </h2>
                <div className="relative">
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    className="w-full border-2 border-gray-300 rounded p-2 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary file:text-white hover:file:bg-primary-dark"
                  />
                  {fileToUpload && (
                    <div className="mt-2 text-sm text-gray-600">
                      Selected: <span className="font-medium">{fileToUpload.name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Print Settings Section */}
              <div className="bg-gray-50 p-6 rounded-lg shadow-sm border border-gray-200">
                <h2 className="text-xl font-bold text-primary mb-4">Print Settings</h2>

                {/* Printer Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Printer
                  </label>
                  <PrinterList
                    selectedPrinter={selectedPrinter}
                    setSelectedPrinter={setSelectedPrinter}
                  />
                </div>

                {/* Copies */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Copies
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={copies}
                    onChange={(e) => setCopies(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border rounded-md bg-white text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Paper Size */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Paper Size
                  </label>
                  <select
                    value={selectedSize}
                    onChange={(e) => setSelectedSize(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-white text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="Short Bond">Short Bond (8.5 x 11)</option>
                    <option value="A4">A4 (8.3 x 11.7)</option>
                    <option value="Long Bond">Long Bond (8.5 x 14)</option>
                  </select>
                </div>

                {/* Color Option */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Color
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="colorOption"
                        value="color"
                        checked={isColor}
                        onChange={(e) => setIsColor(e.target.value === "color")}
                        className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">Colored</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="colorOption"
                        value="bw"
                        checked={!isColor}
                        onChange={(e) => setIsColor(e.target.value === "color")}
                        className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">Black & White</span>
                    </label>
                  </div>
                </div>

                {/* Orientation */}
                <div className="mb-6">
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
                        onChange={(e) => setOrientation(e.target.value)}
                        className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">Portrait</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="orientation"
                        value="landscape"
                        checked={orientation === "landscape"}
                        onChange={(e) => setOrientation(e.target.value)}
                        className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">Landscape</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Balance and Smart Price Section */}
              <div className="bg-gray-50 p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <div className="text-right">
                    <p className="font-bold text-gray-700 text-xl">
                      Balance: <span className="text-green-600">{availableCoins}</span> coins
                    </p>
                  </div>
                </div>

                <SmartPriceToggle
                  paperSize={selectedSize}
                  isColor={isColor}
                  copies={copies}
                  totalPages={totalPages}
                  setTotalPages={setTotalPages}
                  isSmartPriceEnabled={isSmartPriceEnabled}
                  setIsSmartPriceEnabled={setIsSmartPriceEnabled}
                  calculatedPrice={calculatedPrice}
                  setCalculatedPrice={setCalculatedPrice}
                  selectedPageOption={selectedPageOption}
                  setSelectedPageOption={setSelectedPageOption}
                  customPageRange={customPageRange}
                  setCustomPageRange={setCustomPageRange}
                  filePreviewUrl={filePreviewUrl}
                />
              </div>
            </div>
          </div>

          {/* Right Side - Document Preview */}
          <div className="w-1/2">
            <div className="bg-gray-50 p-6 rounded-lg shadow-sm border border-gray-200 h-full">
              <h2 className="text-xl font-bold text-primary mb-4 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="mr-2" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                Document Preview
              </h2>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <DocumentPreview
                  fileUrl={filePreviewUrl}
                  fileName={fileToUpload?.name}
                  fileToUpload={fileToUpload}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Print Button */}
        <div className="flex flex-col items-center mt-6 mb-4">
          <button
            onClick={handlePrint}
            disabled={isLoading || !filePreviewUrl}
            className={`px-8 py-3 text-white text-lg font-bold rounded-lg flex items-center justify-center transition-all ${isLoading || !filePreviewUrl
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-primary hover:bg-primary-dark shadow-lg hover:shadow-xl"
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
                <Printer className="ml-2" />
              </>
            )}
          </button>

          {/* Progress Bar */}
          {isLoading && printProgress > 0 && (
            <div className="w-full max-w-md mt-4">
              <div className="bg-gray-300 rounded-full h-2.5">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-300"
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

export default Usb;
