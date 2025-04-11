import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AiOutlineArrowLeft } from "react-icons/ai";
import { BsPrinterFill } from "react-icons/bs";
import { IoClose } from "react-icons/io5";
import { MdCheckCircle, MdPictureAsPdf, MdInsertDriveFile, MdImage } from "react-icons/md";
import { FaFileWord, FaQrcode, FaTrashAlt, FaUpload } from "react-icons/fa";
import { BiLoaderAlt } from "react-icons/bi";
import { ezlogo, pdf, docs, image } from "../assets/Icons";
import { realtimeDb, storage } from "../../firebase/firebase_config";
import { ref as dbRef, get, remove, update, set, push } from "firebase/database";
import { ref as storageRef, deleteObject, getDownloadURL, uploadBytesResumable } from "firebase/storage";
import { onValue } from "firebase/database";
import M_Qrcode from "../components/M_Qrcode";
import DocumentPreview from "../components/common/document_preview";
import PrintSettings from "../components/common/PrintSettings";
import axios from "axios";
import { loadPDF } from '../utils/pdfjs-init';
import SmartPriceLabel from "../components/qr/smart_price";
import { deleteFile } from '../utils/fileOperations';
import { AlertCircle, RefreshCw } from "lucide-react";

// Function to get the appropriate icon based on file type
const getFileIcon = (fileName, size = "normal") => {
  const extension = fileName.split('.').pop().toLowerCase();
  const sizeClass = size === "large" ? "w-14 h-14" : "w-11 h-11";
  const baseClass = `${sizeClass} rounded-xl flex items-center justify-center`;
  const iconClass = size === "large" ? "w-8 h-8" : "w-6 h-6";
  
  if (extension === 'pdf') {
    return (
      <div className={`${baseClass} bg-red-50 border border-red-100`}>
        <MdPictureAsPdf className={`${iconClass} text-red-500`} />
      </div>
    );
  } else if (['doc', 'docx'].includes(extension)) {
    return (
      <div className={`${baseClass} bg-blue-50 border border-blue-100`}>
        <FaFileWord className={`${iconClass} text-blue-500`} />
      </div>
    );
  } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
    return (
      <div className={`${baseClass} bg-purple-50 border border-purple-100`}>
        <MdImage className={`${iconClass} text-purple-500`} />
      </div>
    );
  } else {
    return (
      <div className={`${baseClass} bg-gray-50 border border-gray-100`}>
        <MdInsertDriveFile className={`${iconClass} text-gray-500`} />
      </div>
    );
  }
};

const QRUpload = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);

  // File states
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState({
    fileName: queryParams.get("name") || "",
    fileUrl: queryParams.get("url") || "",
    totalPages: parseInt(queryParams.get("pages")) || 1,
    hasColorPages: false,
    colorPageCount: 0,
    colorAnalysis: null
  });

  // QR Code modal state
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Print dialog state
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [printers, setPrinters] = useState([]);
  const [orientation, setOrientation] = useState("portrait");
  const [selectedSize, setSelectedSize] = useState("Short Bond");
  
  // Print settings
  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [printerCapabilities, setPrinterCapabilities] = useState(null);
  const [copies, setCopies] = useState(1);
  const [isColor, setIsColor] = useState(false);
  const [isSmartPriceEnabled, setIsSmartPriceEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [printerStatus, setPrinterStatus] = useState({});

  // Balance and price
  const [balance, setBalance] = useState(0);
  const [price, setPrice] = useState(0);

  // Custom print dialog state
  const [printDialogOpen, setPrintDialogOpen] = useState(false);

  // Error state
  const [error, setError] = useState("");

  // Fetch balance from Firebase
  useEffect(() => {
    const balanceRef = dbRef(realtimeDb, "coinCount/availableCoins");
    const unsubscribe = onValue(balanceRef, (snapshot) => {
      if (snapshot.exists()) {
        setBalance(snapshot.val());
      } else {
        setBalance(0);
      }
    });

    return () => unsubscribe();
  }, []);

  // Function to get printer status with retry
  const getPrinterStatus = async (printerName) => {
    // If we're already checking status, don't start another check
    if (printerStatus[printerName]?.loading) {
      return printerStatus[printerName]?.status || "Unknown";
    }

    // Set initial status
    setPrinterStatus(prev => ({
      ...prev,
      [printerName]: { ...prev[printerName], loading: true }
    }));

    try {
      const response = await axios.get(
        `http://localhost:5000/api/printers/${encodeURIComponent(printerName)}/capabilities`,
        { timeout: 5000 } // Reduced timeout for faster response
      );
      
      if (response.data.status === 'success' && response.data.capabilities?.capabilities?.status) {
        const status = response.data.capabilities.capabilities.status;
        setPrinterStatus(prev => ({
          ...prev,
          [printerName]: { status, loading: false }
        }));
        return status;
      }
      
      // If capabilities don't include status, assume printer is ready
      setPrinterStatus(prev => ({
        ...prev,
        [printerName]: { status: "Ready", loading: false }
      }));
      return "Ready";
    } catch (error) {
      console.error('Error getting printer status:', error);
      // On error, assume printer is ready rather than triggering retries
      setPrinterStatus(prev => ({
        ...prev,
        [printerName]: { status: "Ready", loading: false }
      }));
      return "Ready";
    }
  };

  // Modify useEffect to reduce status check frequency
  useEffect(() => {
    let isComponentMounted = true;

    const initializePrinterConnection = async () => {
      if (!isComponentMounted) return;
      
      try {
        await fetchPrinters();
      } catch (error) {
        console.error("Failed to initialize printer connection:", error);
      }
    };

    initializePrinterConnection();

    // Set up less frequent status checks
    const statusCheckInterval = setInterval(async () => {
      if (!isComponentMounted || !selectedPrinter) return;
      
      // Only check status if printer isn't already being checked
      if (!printerStatus[selectedPrinter]?.loading) {
        try {
          await getPrinterStatus(selectedPrinter);
        } catch (error) {
          console.error('Error checking printer status:', error);
        }
      }
    }, 30000); // Reduced frequency to 30 seconds

    return () => {
      isComponentMounted = false;
      clearInterval(statusCheckInterval);
    };
  }, []);

  // Function to check if a printer name is likely a virtual printer
  const isVirtualPrinter = (printerName) => {
    const virtualPrinterPatterns = [
      'microsoft', 'pdf', 'xps', 'document writer', 'onedrive', 
      'fax', 'print to', 'onenote', 'adobe pdf', 'bullzip'
    ];
    
    const lowerName = printerName.toLowerCase();
    return virtualPrinterPatterns.some(pattern => lowerName.includes(pattern));
  };

  // Function to fetch printers with retry
  const fetchPrinters = async (isRetry = false) => {
    if (isRetry) {
      setIsRetrying(true);
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.get("http://localhost:5000/api/printers", { 
        timeout: 15000
      });
      
      const printerList = response.data.printers || [];
      console.log("Received printer list:", printerList);
      setPrinters(printerList);

      // Filter out virtual printers to get physical printers
      const physicalPrinters = printerList.filter(printer => !isVirtualPrinter(printer.name));
      console.log("Physical printers found:", physicalPrinters);

      // Initialize status for all printers
      const statusObj = {};
      printerList.forEach(printer => {
        statusObj[printer.name] = { 
          status: "Ready", // Assume Ready by default
          loading: false 
        };
      });
      setPrinterStatus(statusObj);
      
      if (physicalPrinters.length > 0) {
        // Select the first physical printer found
        const selectedPhysicalPrinter = physicalPrinters[0];
        console.log("Selected physical printer:", selectedPhysicalPrinter.name);
        setSelectedPrinter(selectedPhysicalPrinter.name);
        setError(null);
      } else {
        setError("No physical printer found. Please connect a printer and try again.");
      }
    } catch (error) {
      console.error("Failed to fetch printers:", error);
      if (error.code === 'ECONNABORTED' || !error.response) {
        setError(
          "Connection to the print server timed out. Please check if:\n" +
          "1. The server is running (npm start in backend folder)\n" +
          "2. The server port 5000 is not blocked\n" +
          "3. No other application is using port 5000"
        );
      } else if (error.message.includes('Network Error')) {
        setError(
          "Network error. Please check:\n" +
          "1. Your network connection\n" +
          "2. The print server is running on localhost:5000\n" +
          "3. No firewall is blocking the connection"
        );
      } else {
        setError(`Failed to fetch printers: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  };

  // Calculate price based on settings
  useEffect(() => {
    if (!selectedFile.fileName) {
      setPrice(0);
      return;
    }

    let totalPrice = 0;
    const baseBlackAndWhitePrice = 10;
    const baseColorPrice = 12;

    if (selectedFile.colorAnalysis?.pageAnalysis) {
      // Calculate price based on color analysis of each page
      selectedFile.colorAnalysis.pageAnalysis.forEach(page => {
        // ₱12 for colored pages, ₱10 for black and white
        const pagePrice = isColor && page.hasColor ? baseColorPrice : baseBlackAndWhitePrice;
        totalPrice += pagePrice;
      });
    } else {
      // If no color analysis available, use base price
      totalPrice = selectedFile.totalPages * (isColor ? baseColorPrice : baseBlackAndWhitePrice);
    }

    // Apply volume discounts before multiplying by copies
    const totalPagesToPrint = selectedFile.totalPages * copies;
    
    // Apply volume discount based on total pages
    if (totalPagesToPrint >= 100) {
      // 15% discount for 100+ total pages
      totalPrice = Math.round(totalPrice * 0.85);
    } else if (totalPagesToPrint >= 50) {
      // 10% discount for 50+ total pages
      totalPrice = Math.round(totalPrice * 0.90);
    } else if (totalPagesToPrint >= 20) {
      // 5% discount for 20+ total pages
      totalPrice = Math.round(totalPrice * 0.95);
    }
    
    // Multiply by number of copies
    totalPrice *= copies;

    setPrice(totalPrice);
  }, [selectedFile, copies, isColor, isSmartPriceEnabled]);

  // Fetch uploaded files
  useEffect(() => {
    const uploadedFilesRef = dbRef(realtimeDb, "uploadedFiles");
    const unsubscribe = onValue(uploadedFilesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const filesArray = Object.keys(data).map((key) => {
          // Ensure totalPages is a valid number
          let fileData = {
            id: key,
            ...data[key],
            totalPages: data[key].totalPages || 1
          };

          return fileData;
        })
        // Filter to only include files that were uploaded via QR
        .filter(file => file.uploadSource === "qr");

        setUploadedFiles(filesArray);
      } else {
        setUploadedFiles([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Handle file deletion
  const handleDeleteFile = async (fileId, fileUrl) => {
    if (!window.confirm("Are you sure you want to delete this file?")) return;

    try {
      // Try to remove from database first
      await remove(dbRef(realtimeDb, `uploadedFiles/${fileId}`));

      // Then try to remove from storage if URL exists
      if (fileUrl) {
        try {
          const fileUrlObj = new URL(fileUrl);
          const pathFromUrl = decodeURIComponent(fileUrlObj.pathname.split('/o/')[1].split('?')[0]);
          const fileRef = storageRef(storage, pathFromUrl);
          await deleteObject(fileRef).catch(error => {
            // Ignore not found errors as the file might have been already deleted
            if (error.code !== 'storage/object-not-found') {
              console.error('Error deleting from storage:', error);
            }
          });
        } catch (storageError) {
          console.error('Error with storage deletion:', storageError);
          // Continue since we already deleted from database
        }
      }

      // Clear selection if deleted file was selected
      if (selectedFile.fileUrl === fileUrl) {
        setSelectedFile({
          fileName: "",
          fileUrl: "",
          totalPages: 1,
          hasColorPages: false,
          colorPageCount: 0,
          colorAnalysis: null
        });
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      alert("Error deleting file. Please try again or refresh the page.");
    }
  };

  // Handle file selection
  const handleSelectFile = async (file) => {
    console.log("Selected file:", file);
    setIsLoading(true); // Add loading state while analyzing

    try {
      // Set initial file data
      const initialFileData = {
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        totalPages: file.totalPages || 1,
        fileType: getFileType(file),
        hasColorPages: false,
        colorPageCount: 0,
        colorAnalysis: null
      };
      setSelectedFile(initialFileData);

      // Only perform color analysis for PDFs
      if (file.fileName.toLowerCase().endsWith('.pdf')) {
        try {
          // Create an iframe for color analysis
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          document.body.appendChild(iframe);
          
          // Set up message listener before loading the iframe
          const colorAnalysisPromise = new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              reject(new Error('Color analysis timed out'));
            }, 10000); // 10 second timeout

            window.addEventListener('message', function onMessage(event) {
              if (event.data.type === 'colorAnalysisComplete') {
                clearTimeout(timeoutId);
                window.removeEventListener('message', onMessage);
                resolve(event.data);
              }
            });
          });

          // Load the proxy page
          iframe.src = '/proxy-pdf.html';
          await new Promise(resolve => iframe.onload = resolve);

          // Send the PDF for analysis
          iframe.contentWindow.postMessage({
            type: 'analyzePDF',
            pdfUrl: file.fileUrl,
            filename: file.fileName
          }, '*');

          // Wait for analysis results
          const colorAnalysisResult = await colorAnalysisPromise;
          console.log('Color analysis results:', colorAnalysisResult);

          // Update file data with color analysis
          setSelectedFile(prev => ({
            ...prev,
            hasColorPages: colorAnalysisResult.results.hasColoredPages,
            colorPageCount: colorAnalysisResult.results.coloredPageCount,
            colorAnalysis: colorAnalysisResult.results
          }));

          // If there are colored pages, automatically set isColor to true
          if (colorAnalysisResult.results.hasColoredPages) {
            setIsColor(true);
          }

          // Clean up iframe
          document.body.removeChild(iframe);
        } catch (analysisError) {
          console.error('Color analysis failed:', analysisError);
          // Continue with basic file data if color analysis fails
        }
      }
    } catch (error) {
      console.error("Error handling file selection:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to determine file type
  const getFileType = (file) => {
    if (file.originalType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
        file.fileType === "application/pdf") {
      return "application/pdf";
    }
    
    const extension = file.fileName.toLowerCase().split('.').pop();
    switch (extension) {
      case 'pdf':
        return "application/pdf";
      case 'doc':
      case 'docx':
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      case 'jpg':
      case 'jpeg':
        return "image/jpeg";
      case 'png':
        return "image/png";
      case 'gif':
        return "image/gif";
      case 'webp':
        return "image/webp";
      default:
        return "application/octet-stream";
    }
  };

  // Print dialog handlers
  const handlePrintClick = () => {
    if (selectedFile.fileUrl) {
      setIsPrintDialogOpen(true);
    } else {
      alert("Please select a file to print");
    }
  };

  const handleClosePrintDialog = () => {
    setIsPrintDialogOpen(false);
  };

  // Handle print
  const handlePrint = async () => {
    if (!selectedFile.fileUrl) {
      setError("Please select a file to print");
      return;
    }

    if (balance < price) {
      setError("Not enough balance to complete this print job");
      return;
    }

    if (!selectedPrinter) {
      setError("Please select a printer");
      return;
    }

    // Close the print dialog
    setIsPrintDialogOpen(false);

    try {
      // Store all the data needed for the print job
      const printData = {
        fileUrl: selectedFile.fileUrl,
        fileName: selectedFile.fileName,
        printerName: selectedPrinter,
        copies: copies,
        isColor: isColor,
        hasColorPages: selectedFile.hasColorPages,
        colorPageCount: selectedFile.colorPageCount,
        orientation: orientation,
        selectedSize: selectedSize,
        totalPages: selectedFile.totalPages || 1,
        price: price
      };

      // Store the print data in sessionStorage to retrieve after redirect
      sessionStorage.setItem('pendingPrintJob', JSON.stringify(printData));

      // Immediately redirect to printer page
      window.location.href = '/printer';
    } catch (error) {
      console.error("Error setting up print job:", error);
      setError("Failed to set up print job. Please try again.");
    }
  };

  // Handle opening QR code modal
  const handleOpenQrModal = () => {
    setIsQrModalOpen(true);
  };

  // Handle closing QR code modal
  const handleCloseQrModal = () => {
    setIsQrModalOpen(false);
  };

  // Function to refresh Firebase URL when token expires
  const fallbackToDbRefresh = async (file) => {
    if (!file.fileName || !file.fileUrl) return;

    console.log("Using Firebase Storage method to refresh URL");
    try {
      const fileUrlObj = new URL(file.fileUrl);
      const pathFromUrl = decodeURIComponent(fileUrlObj.pathname.split('/o/')[1].split('?')[0]);

      // First try the backend endpoint
      try {
        console.log("Requesting fresh URL from backend endpoint");
        const response = await axios.get(`http://localhost:5000/api/refresh-url?path=${encodeURIComponent(pathFromUrl)}`);

        if (response.data && response.data.status === 'success' && response.data.url) {
          const freshUrl = response.data.url;
          const expiresAt = response.data.expiresAt;

          console.log("Got fresh URL from backend endpoint, expires at:", new Date(expiresAt));

          // Update the file in database if we have an ID
          if (file.id) {
            const fileRef = dbRef(realtimeDb, `uploadedFiles/${file.id}`);
            await update(fileRef, {
              fileUrl: freshUrl,
              storagePath: pathFromUrl,
              lastRefreshed: Date.now(),
              urlExpiresAt: expiresAt
            });
          }

          // Update the selected file
          setSelectedFile(prev => ({
            ...prev,
            fileUrl: freshUrl
          }));

          console.log("Successfully refreshed Firebase URL");
          return freshUrl;
        }
      } catch (backendError) {
        console.error("Error using backend endpoint:", backendError);
      }

      // Fallback to direct Firebase Storage if backend fails
      console.log("Falling back to direct Firebase Storage refresh");
      const fileStorageRef = storageRef(storage, pathFromUrl);
      const freshUrl = await getDownloadURL(fileStorageRef);

      // Update the file in database
      if (file.id) {
        const fileRef = dbRef(realtimeDb, `uploadedFiles/${file.id}`);
        await update(fileRef, {
          fileUrl: freshUrl,
          storagePath: pathFromUrl,
          lastRefreshed: Date.now()
        });
      }

      // Update the selected file
      setSelectedFile(prev => ({
        ...prev,
        fileUrl: freshUrl
      }));

      return freshUrl;
    } catch (error) {
      console.error("Error refreshing Firebase URL:", error);
      throw error;
    }
  };

  // Update printer display section
  const getCurrentPrinter = () => {
    if (!selectedPrinter) {
      return {
        name: "Connecting to printer...",
        status: "Checking connection...",
        isReady: false
      };
    }

    const status = printerStatus[selectedPrinter]?.status || "Unknown";
    const isReady = status.toLowerCase() === "ready";

    return {
      name: selectedPrinter,
      status: printerStatus[selectedPrinter]?.loading ? "Checking status..." : status,
      isReady: isReady
    };
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
            <AiOutlineArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-primary">QR Code Print</h1>
          
          {/* Balance Display - moved to header */}
          <div className="ml-auto">
            <div className="badge badge-lg badge-primary text-base-100 font-bold">
              Coins: {balance}
            </div>
          </div>
        </div>

        {/* Main Content Area with proper overflow handling */}
        <div className="flex gap-4 flex-1 overflow-hidden">
          {/* Left Column - QR Code and Page Breakdown */}
          <div className="w-[400px] overflow-y-auto pr-2 pb-2 flex flex-col gap-4">
            {/* QR Code Section */}
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body p-4">
                <h2 className="card-title text-base text-primary mb-2">QR Code Upload</h2>
                
                <div className="flex flex-col items-center justify-center p-4 bg-base-200 rounded-lg">
                  <div className="mb-4">
                    <M_Qrcode />
                  </div>
                  
                  <p className="text-center text-sm mb-4">Scan QR code to upload your files securely</p>
                  
                  <button
                    className="btn btn-primary btn-sm gap-2"
                    onClick={() => setIsQrModalOpen(true)}
                  >
                    <FaQrcode className="w-4 h-4" />
                    Show Full QR
                  </button>
                </div>
              </div>
            </div>

            {/* Page Breakdown Section */}
            {selectedFile.fileName && (
              <div className="card bg-base-100 shadow-sm">
                <div className="card-body p-4">
                  <h2 className="card-title text-base text-primary mb-2">Document Analysis</h2>
                  
                  <div className="bg-base-200 rounded-xl overflow-hidden">
                    {/* Total Pages Summary */}
                    <div className="p-3 border-b border-base-300 bg-base-100">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Total Pages</span>
                        <span className="font-medium">{selectedFile.colorAnalysis?.pageAnalysis?.length || selectedFile.totalPages || 1}</span>
                      </div>
                    </div>
                    
                    {/* Page Breakdown */}
                    <div className="max-h-[300px] overflow-y-auto divide-y divide-base-300">
                      {selectedFile.colorAnalysis?.pageAnalysis?.map((page, index) => (
                        <div 
                          key={index}
                          className="flex items-center justify-between p-3 bg-base-100 hover:bg-base-200/50"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">Page {index + 1}</span>
                            {page.hasColor && (
                              <span className="badge badge-sm badge-primary badge-outline">Color</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              {page.hasColor ? '₱12.00' : '₱10.00'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Summary Footer */}
                    <div className="p-3 border-t border-base-300 bg-base-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-600">Color Pages</span>
                          <span className="badge badge-sm badge-primary">
                            {selectedFile.colorAnalysis?.pageAnalysis?.filter(page => page.hasColor).length || 0}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-600">B&W Pages</span>
                          <span className="badge badge-sm">
                            {selectedFile.colorAnalysis?.pageAnalysis ? 
                              selectedFile.colorAnalysis.pageAnalysis.filter(page => !page.hasColor).length :
                              selectedFile.totalPages || 1}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Middle Column - Document Preview */}
          <div className="w-[600px] overflow-hidden min-w-0">
            {selectedFile.fileName ? (
              <div className="card bg-base-100 shadow-sm h-full flex flex-col">
                <div className="p-4 border-b border-base-200">
                  <div className="flex items-center gap-3">
                    {getFileIcon(selectedFile.fileName)}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{selectedFile.fileName}</h3>
                      <p className="text-sm text-gray-500">
                        {selectedFile.colorAnalysis?.pageAnalysis?.length || selectedFile.totalPages || 1} {' '}
                        {(selectedFile.colorAnalysis?.pageAnalysis?.length || selectedFile.totalPages || 1) === 1 ? 'page' : 'pages'}
                        {selectedFile.colorAnalysis?.pageAnalysis?.some(page => page.hasColor) && 
                          ` • ${selectedFile.colorAnalysis.pageAnalysis.filter(page => page.hasColor).length} color`
                        }
                      </p>
                    </div>
                    <button
                      className="btn btn-primary gap-2 shrink-0"
                      onClick={handlePrintClick}
                    >
                      <BsPrinterFill className="w-4 h-4" />
                      Print
                    </button>
                  </div>
                </div>
                <div className="flex-1 p-6 bg-base-200 overflow-hidden">
                  <div className="bg-white rounded-lg shadow-sm h-full w-full flex items-center justify-center p-4">
                    <DocumentPreview
                      fileUrl={selectedFile.fileUrl}
                      fileName={selectedFile.fileName}
                      className="max-h-[calc(100vh-250px)] w-auto"
                      style={{ height: 'auto', maxWidth: '100%' }}
                    />
                  </div>
                </div>
              </div>
            ) : (
            <div className="card bg-base-100 shadow-sm h-full">
                <div className="card-body flex items-center justify-center text-center">
                  <MdInsertDriveFile className="w-16 h-16 text-base-content/20 mb-4" />
                  <h3 className="font-medium text-base-content/70">Select a file to preview</h3>
                  <p className="text-sm text-base-content/50 mt-2">
                    Choose a file from the uploaded files list
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Uploaded Files */}
          <div className="w-[400px] overflow-y-auto pl-2 pb-2">
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body p-4">
                <h2 className="card-title text-base text-primary mb-2">
                  Uploaded Files
                  <span className="badge badge-sm">{uploadedFiles.length}</span>
                </h2>
                
                {error && (
                  <div className="alert alert-error mb-3 text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>{error}</span>
                  </div>
                )}

                {isLoading ? (
                  <div className="flex flex-col items-center justify-center flex-1 p-6">
                    <BiLoaderAlt className="w-8 h-8 text-primary animate-spin mb-3" />
                    <p className="text-base-content/70">Loading files...</p>
                  </div>
                ) : uploadedFiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
                    <MdInsertDriveFile className="w-10 h-10 text-base-content/20 mb-4" />
                    <p className="text-base-content/70">No files uploaded yet</p>
                    <p className="text-xs text-base-content/50 mt-2">
                      Upload files by scanning the QR code with your phone
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 overflow-y-auto">
                    {uploadedFiles.map((file) => (
                      <div
                        key={file.id}
                        className={`card hover:shadow-md transition-shadow cursor-pointer ${
                          selectedFile.fileName === file.fileName
                            ? "bg-primary/5 border-2 border-primary"
                            : "bg-base-100 border border-base-200"
                        }`}
                        onClick={() => handleSelectFile(file)}
                      >
                        <div className="card-body p-3">
                          <div className="flex items-center gap-3">
                                {getFileIcon(file.fileName)}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-sm truncate mb-1">
                                {file.fileName}
                              </h3>
                              <div className="flex items-center gap-2 text-xs text-base-content/60">
                                <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
                </div>
              </div>
                            <button
                              className="btn btn-ghost btn-sm btn-circle self-start"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFile(file.id, file.fileUrl);
                              }}
                              aria-label="Delete file"
                            >
                              <IoClose className="w-4 h-4 opacity-50 hover:opacity-100" />
                            </button>
            </div>
          </div>
                      </div>
                    ))}
        </div>
      )}
              </div>
            </div>
          </div>
        </div>
            </div>

      {/* QR Code Modal */}
      {isQrModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-sm p-4">
            <h3 className="font-bold text-lg mb-4 text-center">Scan to Upload Files</h3>
            <div className="flex justify-center mb-4">
              <M_Qrcode size={250} />
                      </div>
            <p className="text-sm text-center mb-6">
              Scan this QR code with your phone's camera app to access the upload page
            </p>
            <div className="modal-action">
              <button className="btn" onClick={() => setIsQrModalOpen(false)}>Close</button>
                  </div>
                </div>
          <div className="modal-backdrop" onClick={() => setIsQrModalOpen(false)}></div>
        </div>
      )}

      {/* Print Dialog */}
      {isPrintDialogOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl h-[85vh] p-0 overflow-hidden bg-white flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-base-200 flex items-center shrink-0">
              <div className="flex items-center gap-3 flex-1">
                {getFileIcon(selectedFile.fileName)}
                <div>
                  <h3 className="font-bold text-lg">Print Document</h3>
                  <p className="text-sm text-gray-600 truncate max-w-[400px]">
                    {selectedFile.fileName}
                  </p>
                </div>
              </div>
            <button
                className="btn btn-sm btn-circle"
              onClick={handleClosePrintDialog}
            >
                <IoClose size={16} />
            </button>
            </div>

            {/* Print Dialog Content */}
            <div className="flex flex-1 min-h-0">
              {/* Left side - Print settings */}
              <div className="w-[380px] min-w-[380px] border-r border-base-200 flex flex-col bg-white">
                <div className="flex-1 overflow-y-auto">
                  <div className="p-6">
                    <h4 className="text-xl font-semibold text-gray-800 mb-6">Print Settings</h4>

                    {/* Connected Printer Section */}
                    <div className="space-y-6 mb-8">
                      <div>
                        <h5 className="text-sm font-medium text-gray-600 mb-3">Connected Printer</h5>
                        <div className="flex flex-col gap-3">
                          {error && (
                            <div className="alert alert-error mb-4">
                              <AlertCircle className="w-6 h-6" />
                              <div>
                                <span>{error}</span>
                                <div>
                                  <button 
                                    className="btn btn-sm btn-outline mt-2 gap-2" 
                                    onClick={() => fetchPrinters(true)}
                                    disabled={isRetrying}
                                  >
                                    {isRetrying ? (
                                      <>
                                        <span className="loading loading-spinner loading-xs"></span>
                                        Retrying...
                                      </>
                                    ) : (
                                      <>
                                        <RefreshCw className="w-4 h-4" />
                                        Retry Connection
                                      </>
                                    )}
                                  </button>
                </div>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-3 p-4 bg-base-100 rounded-xl border border-base-200">
                            <BsPrinterFill className={`w-5 h-5 ${getCurrentPrinter().isReady ? 'text-primary' : 'text-gray-400'}`} />
                            <div className="flex-1">
                              <p className="font-medium">{getCurrentPrinter().name}</p>
                              <p className="text-xs text-gray-500">{getCurrentPrinter().status}</p>
              </div>
                            {getCurrentPrinter().isReady ? (
                              <span className="badge badge-success badge-sm">Connected</span>
                            ) : (
                              <span className="badge badge-error badge-sm">Not Ready</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Print Options Section */}
                      <div className="space-y-6 mb-8">
                        {/* Copies */}
              <div>
                          <h5 className="text-sm font-medium text-gray-600 mb-3">Number of Copies</h5>
                          <div className="flex items-center gap-3">
                            <button 
                              className="btn btn-square btn-sm bg-base-100"
                              onClick={() => setCopies(Math.max(1, copies - 1))}
                              aria-label="Decrease copies"
                            >
                              <span className="text-lg">−</span>
                            </button>
                            <input 
                              type="text" 
                              value={copies} 
                              className="input input-bordered w-20 text-center" 
                              onChange={(e) => {
                                const value = parseInt(e.target.value);
                                if (!isNaN(value) && value > 0) {
                                  setCopies(value);
                                }
                              }}
                            />
                            <button 
                              className="btn btn-square btn-sm bg-base-100"
                              onClick={() => setCopies(copies + 1)}
                              aria-label="Increase copies"
                            >
                              <span className="text-lg">+</span>
                            </button>
              </div>
            </div>

                        {/* Paper Size */}
                        <div>
                          <h5 className="text-sm font-medium text-gray-600 mb-3">Paper Size</h5>
                          <div className="bg-base-100 p-3 rounded-xl border border-base-200">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">Short Bond (8.5 x 11)</span>
                            </div>
                          </div>
                        </div>

                        {/* Print Mode */}
                        <div>
                          <h5 className="text-sm font-medium text-gray-600 mb-3">Print Mode</h5>
                          <div className="bg-base-100 p-3 rounded-xl border border-base-200">
                            <div className="flex gap-6">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                  type="radio" 
                                  name="printMode" 
                                  className="radio radio-sm radio-primary" 
                                  checked={isColor}
                                  onChange={() => setIsColor(true)}
                                />
                                <span className="text-sm">Color</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                  type="radio" 
                                  name="printMode" 
                                  className="radio radio-sm"
                                  checked={!isColor}
                                  onChange={() => setIsColor(false)}
                                />
                                <span className="text-sm">Black & White</span>
                              </label>
                            </div>
                          </div>
                        </div>

                        {/* Orientation */}
                        <div>
                          <h5 className="text-sm font-medium text-gray-600 mb-3">Page Orientation</h5>
                          <div className="bg-base-100 p-3 rounded-xl border border-base-200">
                            <div className="flex gap-6">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                  type="radio" 
                                  name="orientation" 
                                  className="radio radio-sm radio-primary" 
                                  checked={orientation === "portrait"}
                                  onChange={() => setOrientation("portrait")}
                                />
                                <span className="text-sm">Portrait</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                  type="radio" 
                                  name="orientation" 
                                  className="radio radio-sm"
                                  checked={orientation === "landscape"}
                                  onChange={() => setOrientation("landscape")}
                                />
                                <span className="text-sm">Landscape</span>
                              </label>
                            </div>
                          </div>
              </div>
            </div>

                      {/* Color Analysis Section */}
                      <div className="mb-8">
                        <h5 className="text-sm font-medium text-gray-600 mb-3">Document Analysis</h5>
                        <div className="bg-base-100 rounded-xl border border-base-200 overflow-hidden">
                          {/* Total Pages Summary */}
                          <div className="p-3 border-b border-base-200">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Total Pages</span>
                              <span className="font-medium">{selectedFile.totalPages || 1}</span>
                            </div>
                          </div>
                          
                          {/* Page Breakdown */}
                          <div className="max-h-[200px] overflow-y-auto divide-y divide-base-200">
                            {selectedFile.colorAnalysis?.pageAnalysis?.map((page, index) => (
                              <div 
                                key={index}
                                className="flex items-center justify-between p-3 hover:bg-base-200/50"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">Page {index + 1}</span>
                                  {page.hasColor && (
                                    <span className="badge badge-sm badge-primary badge-outline">Color</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500">
                                    {page.hasColor ? '₱12.00' : '₱10.00'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Summary Footer */}
                          <div className="p-3 border-t border-base-200 bg-base-200/30">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-600">Color Pages</span>
                                <span className="badge badge-sm badge-primary">{selectedFile.colorPageCount || 0}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-600">B&W Pages</span>
                                <span className="badge badge-sm">{(selectedFile.totalPages || 1) - (selectedFile.colorPageCount || 0)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Price Section */}
                    <div className="space-y-4">
                      {/* Smart Price Card */}
                      <div className="bg-blue-50 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-blue-600 text-xl font-semibold">₱</span>
                            <h5 className="font-semibold text-gray-800">Smart Price</h5>
                          </div>
                          <div className="text-2xl font-bold text-blue-600">₱{price.toFixed(2)}</div>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span>{isColor ? "Color" : "B&W"} printing</span>
                          <span className="text-gray-400">•</span>
                          <span>{copies} {copies === 1 ? "copy" : "copies"}</span>
                          <span className="text-gray-400">•</span>
                          <span>All {selectedFile.totalPages || 1} pages</span>
                        </div>
                        
                        {/* Volume discount indicator */}
                        {(() => {
                          const totalPages = copies * (selectedFile.totalPages || 1);
                          let discountRate = null;
                          
                          if (totalPages >= 100) discountRate = "15%";
                          else if (totalPages >= 50) discountRate = "10%";
                          else if (totalPages >= 20) discountRate = "5%";
                          
                          return discountRate && (
                            <div className="mt-2 text-sm font-medium text-green-600 flex justify-between">
                              <span>Volume Discount:</span>
                              <span>{discountRate} OFF</span>
                            </div>
                          );
                        })()}
                        
                        {/* Coins required indicator */}
                        <div className="mt-2 text-sm font-medium text-primary flex justify-between">
                          <span>Coins Required:</span>
                          <span className="font-bold">{price}</span>
                        </div>
                      </div>

                      {/* Balance Card */}
                      <div className="bg-base-100 p-5 rounded-xl border border-base-200">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-gray-800">Your Balance</p>
                            <p className="text-sm text-gray-500">Available coins</p>
                          </div>
                          <div className="text-2xl font-bold text-primary">{balance}</div>
                        </div>
                        
                        {/* Insufficient balance warning */}
                        {price > balance && (
                          <div className="mt-2 text-sm text-error">
                            Insufficient coins. You need {price - balance} more coins.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons - Fixed at bottom */}
                <div className="p-4 border-t border-base-200 bg-white shrink-0">
                  <div className="flex gap-3">
                    <button className="btn flex-1 min-h-[48px]" onClick={handleClosePrintDialog}>
                Cancel
              </button>
                    <button 
                      className="btn btn-primary flex-1 min-h-[48px]" 
                      onClick={handlePrint}
                      disabled={!selectedPrinter || price > balance}
                      title={!selectedPrinter ? "Please select a printer" : price > balance ? `Insufficient balance (need ${price} coins)` : ""}
                    >
                    Print
              </button>
                  </div>
                </div>
            </div>

              {/* Right side - Document preview */}
              <div className="flex-1 bg-base-200 overflow-hidden flex flex-col min-h-0">
                <div className="p-4 bg-white border-b border-base-200 shrink-0">
                  <h4 className="font-medium text-gray-700">Document Preview</h4>
              </div>
                <div className="flex-1 p-6 overflow-auto">
                  <div className="bg-white rounded-lg shadow-sm h-full">
                    <DocumentPreview
                      fileUrl={selectedFile.fileUrl}
                      fileName={selectedFile.fileName}
                      className="w-full h-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setIsPrintDialogOpen(false)}></div>
        </div>
      )}
    </div>
  );
};

export default QRUpload;
