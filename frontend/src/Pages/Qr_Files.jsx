import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft, FaPrint, FaTimes, FaCheck, FaRegFilePdf, FaRegFileWord, FaSpinner, FaFileImage } from "react-icons/fa";
import { ezlogo } from "../assets/Icons";
import { realtimeDb, storage } from "../../firebase/firebase_config";
import { ref as dbRef, get, remove, update, set, push } from "firebase/database";
import { ref as storageRef, deleteObject, getDownloadURL, uploadBytesResumable } from "firebase/storage";
import { onValue } from "firebase/database";
import M_Qrcode from "../components/M_Qrcode";
import DocumentPreview from "../components/common/document_preview";
import axios from "axios";
import { loadPDF } from '../utils/pdfjs-init';
import SmartPriceLabel from "../components/qr/smart_price";

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
  const [isPrinting, setIsPrinting] = useState(false);
  const [printSuccess, setPrintSuccess] = useState(false);
  const [orientation, setOrientation] = useState("portrait");
  const [selectedSize, setSelectedSize] = useState("Short Bond");

  // Print settings
  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [copies, setCopies] = useState(1);
  const [isColor, setIsColor] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Balance and price
  const [balance, setBalance] = useState(0);
  const [price, setPrice] = useState(0);

  // Custom print dialog state
  const [printDialogOpen, setPrintDialogOpen] = useState(false);

  // Add analyzing state
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Add upload progress state
  const [uploadProgress, setUploadProgress] = useState(0);
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

  // Fetch printers when print dialog opens
  useEffect(() => {
    if (isPrintDialogOpen) {
      axios
        .get("http://localhost:5000/api/printers")
        .then((response) => {
          setPrinters(response.data.printers || []);
        })
        .catch((error) => {
          console.error("Failed to fetch printers:", error);
        });
    }
  }, [isPrintDialogOpen]);

  // Calculate price based on settings
  useEffect(() => {
    if (!selectedFile.fileName) {
      setPrice(0);
      return;
    }

    let totalPrice = 0;

    if (selectedFile.colorAnalysis?.pageAnalysis) {
      // Calculate price based on color analysis of each page
      selectedFile.colorAnalysis.pageAnalysis.forEach(page => {
        // ₱12 for colored pages, ₱10 for black and white
        const pagePrice = isColor && page.hasColor ? 12 : 10;
        totalPrice += pagePrice;
      });
    } else {
      // If no color analysis available, use base price
      totalPrice = selectedFile.totalPages * (isColor ? 12 : 10);
    }

    // Multiply by number of copies
    totalPrice *= copies;

    setPrice(totalPrice);
  }, [selectedFile, copies, isColor]);

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

          // Log file data for debugging
          if (fileData.fileName.toLowerCase().endsWith('.pdf')) {
            // Removed PDF loading log
          }

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

  // Add a new useEffect to analyze files when component mounts
  useEffect(() => {
    // Only run if there are uploaded files but no analysis yet
    const filesToAnalyze = uploadedFiles.filter(file =>
      file.fileUrl &&
      !file.colorAnalysis &&
      (file.fileName.toLowerCase().endsWith('.pdf') || file.fileName.toLowerCase().endsWith('.docx') || file.fileName.toLowerCase().endsWith('.doc'))
    );

    if (filesToAnalyze.length > 0) {
      // Process files one by one to avoid overwhelming the browser
      const analyzeNextFile = async (index) => {
        if (index >= filesToAnalyze.length) return;

        const file = filesToAnalyze[index];
        console.log(`Analyzing file ${index + 1}/${filesToAnalyze.length}: ${file.fileName}`);

        try {
          // Create an iframe for color analysis
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = '/proxy-pdf.html';
          document.body.appendChild(iframe);

          // Wait for iframe to load
          await new Promise((resolve) => {
            iframe.onload = resolve;
          });

          // Send message to iframe with PDF URL
          iframe.contentWindow.postMessage({
            type: 'analyzePDF',
            pdfUrl: file.fileUrl,
            filename: file.fileName
          }, '*');

          // Listen for color analysis results
          const colorAnalysisResult = await new Promise((resolve) => {
            const handler = function (event) {
              if (event.data.type === 'colorAnalysisComplete') {
                window.removeEventListener('message', handler);
                document.body.removeChild(iframe);
                resolve(event.data);
              }
            };
            window.addEventListener('message', handler);
          });

          if (colorAnalysisResult.results) {
            // Calculate accurate page count
            const accuratePageCount = colorAnalysisResult.results.pageAnalysis ?
              colorAnalysisResult.results.pageAnalysis.length : file.totalPages || 1;

            // Update the file in the database
            const fileRef = dbRef(realtimeDb, `uploadedFiles/${file.id}`);
            update(fileRef, {
              totalPages: accuratePageCount,
              hasColorPages: colorAnalysisResult.results.hasColoredPages,
              colorPageCount: colorAnalysisResult.results.coloredPageCount,
              colorAnalysis: colorAnalysisResult.results
            });
          }

          // Process next file with a small delay
          setTimeout(() => analyzeNextFile(index + 1), 500);

        } catch (error) {
          console.error(`Error analyzing file ${file.fileName}:`, error);
          // Continue with next file even if current one fails
          setTimeout(() => analyzeNextFile(index + 1), 500);
        }
      };

      // Start analysis process
      analyzeNextFile(0);
    }
  }, [uploadedFiles]);

  // Handle file deletion
  const handleDeleteFile = async (fileId, fileUrl) => {
    if (!window.confirm("Are you sure you want to delete this file?")) return;

    try {
      // Extract the full path from the fileUrl
      const fileUrlObj = new URL(fileUrl);
      const pathFromUrl = decodeURIComponent(fileUrlObj.pathname.split('/o/')[1].split('?')[0]);

      // Delete from Storage
      const fileRef = storageRef(storage, pathFromUrl);
      await deleteObject(fileRef);

      // Delete from Database
      await remove(dbRef(realtimeDb, `uploadedFiles/${fileId}`));

      // Clear selection if deleted file was selected
      if (selectedFile.fileUrl === fileUrl) {
        setSelectedFile({ fileName: "", fileUrl: "", totalPages: 1, hasColorPages: false, colorPageCount: 0, colorAnalysis: null });
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      alert("Failed to delete file. Please try again.");
    }
  };

  // Handle file selection
  const handleSelectFile = async (file) => {
    console.log("Selected file:", file);

    try {
      // Create an iframe for color analysis
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = '/proxy-pdf.html';
      document.body.appendChild(iframe);

      // Wait for iframe to load
      await new Promise((resolve) => {
        iframe.onload = resolve;
      });

      // Send message to iframe with PDF URL
      iframe.contentWindow.postMessage({
        type: 'analyzePDF',
        pdfUrl: file.fileUrl,
        filename: file.fileName
      }, '*');

      // Listen for color analysis results
      const colorAnalysisResult = await new Promise((resolve) => {
        window.addEventListener('message', function onMessage(event) {
          if (event.data.type === 'colorAnalysisComplete') {
            window.removeEventListener('message', onMessage);
            document.body.removeChild(iframe);
            resolve(event.data);
          }
        });
      });

      console.log('Color analysis results:', colorAnalysisResult);

      // Determine the proper file type
      let fileType = 'application/pdf';

      // Check if this is a converted DOCX file
      if (file.originalType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
        file.fileType === "application/pdf") {
        fileType = "application/pdf";
      }
      // Otherwise detect based on file extension
      else if (file.fileName.toLowerCase().endsWith('.pdf')) {
        fileType = "application/pdf";
      }
      else if (file.fileName.toLowerCase().endsWith('.docx') || file.fileName.toLowerCase().endsWith('.doc')) {
        fileType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      }
      else if (file.fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/)) {
        fileType = "image/" + file.fileName.toLowerCase().split('.').pop().replace('jpg', 'jpeg');
      }

      // Set the file with color analysis results
      setSelectedFile({
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        totalPages: file.totalPages || 1,
        fileType: fileType,
        hasColorPages: colorAnalysisResult.results.hasColoredPages,
        colorPageCount: colorAnalysisResult.results.coloredPageCount,
        colorAnalysis: colorAnalysisResult.results
      });

      // If there are colored pages, automatically set isColor to true
      if (colorAnalysisResult.results.hasColoredPages) {
        setIsColor(true);
      }

      console.log(`File selected with ${file.totalPages} pages and type ${fileType}`);

    } catch (error) {
      console.error("Error handling file selection:", error);
      // Set file without color analysis in case of error
      setSelectedFile({
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        totalPages: file.totalPages || 1,
        fileType: file.fileType,
        hasColorPages: false,
        colorPageCount: 0,
        colorAnalysis: null
      });
    }
  };

  // Handle print dialog
  const openPrintDialog = () => {
    if (selectedFile.fileUrl) {
      setIsPrintDialogOpen(true);
    } else {
      alert("Please select a file to print");
    }
  };

  const closePrintDialog = () => {
    setIsPrintDialogOpen(false);
    setPrintSuccess(false);
  };

  // Handle print
  const handlePrint = async () => {
    if (!selectedFile.fileUrl) {
      alert("Please select a file to print");
      return;
    }

    if (balance < price) {
      alert("Not enough balance to complete this print job");
      return;
    }

    if (!selectedPrinter) {
      alert("Please select a printer");
      return;
    }

    try {
      // Create a unique ID for the print job
      const printJobId = Date.now().toString();

      // First, navigate to printer page
      setIsPrintDialogOpen(false);
      navigate('/printer');

      // Add to print queue with the unique ID
      const printJobRef = dbRef(realtimeDb, `files/${printJobId}`);

      // Add print job details
      await set(printJobRef, {
        fileName: selectedFile.fileName,
        fileUrl: selectedFile.fileUrl,
        printerName: selectedPrinter,
        copies: copies,
        isColor: isColor,
        hasColorContent: selectedFile.hasColorPages,
        colorPageCount: selectedFile.colorPageCount,
        orientation: orientation,
        selectedSize: selectedSize,
        totalPages: selectedFile.totalPages,
        price: price,
        timestamp: new Date().toISOString(),
        status: "Processing",
        progress: 0,
        printStatus: "Preparing print job..."
      });

      // Update balance
      const updatedBalance = balance - price;
      await update(dbRef(realtimeDb, "coinCount"), { availableCoins: updatedBalance });

      // Send the actual print request to the server
      await axios.post('http://localhost:5000/api/print', {
        fileUrl: selectedFile.fileUrl,
        fileName: selectedFile.fileName,
        printerName: selectedPrinter,
        copies: copies,
        isColor: isColor,
        hasColorContent: selectedFile.hasColorPages,
        colorPageCount: selectedFile.colorPageCount,
        orientation: orientation,
        selectedSize: selectedSize,
        printJobId: printJobId
      });

    } catch (error) {
      console.error("Print error:", error);
      // Update the job status to error in case of failure
      const printJobRef = dbRef(realtimeDb, `files/${printJobId}`);
      await update(printJobRef, {
        status: "Error",
        progress: 0,
        printStatus: "Failed to start print job"
      });
      alert("Failed to print. Please try again.");
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
      setIsLoading(false);
      throw error;
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setError("");

    try {
      // Check if it's a DOCX file
      if (file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc')) {
        // Create form data for the file
        const formData = new FormData();
        formData.append('file', file);

        // Send to backend for conversion
        const response = await axios.post('http://localhost:5000/api/convert-docx', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          },
        });

        if (response.data.pdfUrl) {
          // Use the converted PDF URL
          handleUploadSuccess(response.data.pdfUrl, file.name, "application/pdf");
        } else {
          throw new Error('PDF conversion failed');
        }
      } else {
        // Handle other file types normally
        const storageRef = ref(storage, `uploads/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
          },
          (error) => {
            console.error('Upload error:', error);
            setError('Failed to upload file. Please try again.');
            setIsLoading(false);
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            handleUploadSuccess(downloadURL, file.name, file.type);
          }
        );
      }
    } catch (error) {
      console.error('File handling error:', error);
      setError(error.message || 'Failed to process file. Please try again.');
      setIsLoading(false);
    }
  };

  const handleUploadSuccess = async (fileUrl, fileName, fileType) => {
    try {
      let fileMetadata = {
        fileName,
        fileUrl,
        fileType,
        uploadedAt: new Date().toISOString(),
        uploadSource: "qr",
        status: "ready",
        totalPages: 1 // Default page count that will be updated after analysis
      };

      // For converted DOCX files, track the original format
      if (fileName.toLowerCase().endsWith('.docx') && fileType === "application/pdf") {
        fileMetadata.originalFormat = "docx";
        fileMetadata.isConverted = true;
      }

      // Create a new entry in the realtime database
      const newFileRef = push(dbRef(realtimeDb, 'uploadedFiles'));
      const fileId = newFileRef.key;

      await set(newFileRef, fileMetadata);

      // For PDF files, immediately start the analysis process
      if (fileType === "application/pdf" || fileName.toLowerCase().endsWith('.pdf')) {
        try {
          // Set state to show we're analyzing
          setIsAnalyzing(true);

          // Create an iframe for color analysis
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = '/proxy-pdf.html';
          document.body.appendChild(iframe);

          // Wait for iframe to load
          await new Promise((resolve) => {
            iframe.onload = resolve;
          });

          // Send message to iframe with PDF URL
          iframe.contentWindow.postMessage({
            type: 'analyzePDF',
            pdfUrl: fileUrl,
            filename: fileName
          }, '*');

          // Listen for color analysis results
          const colorAnalysisResult = await new Promise((resolve) => {
            const handler = function (event) {
              if (event.data.type === 'colorAnalysisComplete') {
                window.removeEventListener('message', handler);
                document.body.removeChild(iframe);
                resolve(event.data);
              }
            };
            window.addEventListener('message', handler);
          });

          if (colorAnalysisResult.results) {
            // Calculate accurate page count based on color analysis
            const accuratePageCount = colorAnalysisResult.results.pageAnalysis ?
              colorAnalysisResult.results.pageAnalysis.length : 1;

            // Update the file in the database with the accurate page count
            await update(dbRef(realtimeDb, `uploadedFiles/${fileId}`), {
              totalPages: accuratePageCount,
              hasColorPages: colorAnalysisResult.results.hasColoredPages,
              colorPageCount: colorAnalysisResult.results.coloredPageCount,
              colorAnalysis: colorAnalysisResult.results
            });

            console.log(`Updated file ${fileName} with ${accuratePageCount} pages`);
          }
        } catch (error) {
          console.error("Error analyzing PDF:", error);
        } finally {
          setIsAnalyzing(false);
        }
      }

      setIsLoading(false);
      setUploadProgress(0);
    } catch (error) {
      console.error('Database update error:', error);
      setError('Failed to save file information. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* QR Code Modal */}
      {isQrModalOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm z-50 transition-opacity duration-300 ease-in-out"
          onClick={handleCloseQrModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full flex flex-col items-center transform transition-all duration-300 ease-in-out scale-100 opacity-100 animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header with gradient background */}
            <div className="w-full bg-gradient-to-r from-[#31304D] to-[#41405D] rounded-t-2xl p-6">
              <h2 className="text-2xl font-bold text-white text-center">Scan QR Code</h2>
              <p className="text-gray-200 text-center text-sm mt-1">Scan with your mobile device to share files</p>
            </div>

            {/* QR Code Container */}
            <div className="py-8 px-4 flex flex-col items-center">
              <div className="bg-white p-4 rounded-xl shadow-md border-2 border-[#31304D] mb-4">
                <M_Qrcode size={300} />
              </div>
              <p className="text-gray-500 text-center text-sm mt-4 px-6">
                Point your phone's camera at the QR code to open the file upload page
              </p>

              <div className="mt-6 flex items-center justify-center w-full">
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                  <span>Click outside to close</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Dialog Modal */}
      {isPrintDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl mx-4 transform transition-all animate-fadeIn flex flex-col h-[85vh]">
            <div className="flex justify-between items-center px-6 py-3 border-b">
              <h2 className="text-xl font-bold text-[#31304D]">Print</h2>
              <span className="text-gray-600 text-sm">{selectedFile.totalPages} sheets of paper</span>
              <button
                onClick={closePrintDialog}
                className="text-gray-500 hover:text-gray-700 transition duration-200"
              >
                <FaTimes size={20} />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Document Preview Area - Left Side */}
              <div className="w-3/5 border-r flex flex-col h-full">
                <div className="flex-1 flex justify-center items-center bg-[#f8f9fa] p-3">
                  <div className="shadow-md bg-white w-[95%] h-[95%] flex items-center justify-center relative">
                    {selectedFile.fileType?.startsWith('image/') || selectedFile.fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/) ? (
                      <div className="w-full h-full flex items-center justify-center bg-gray-50">
                        <img
                          src={selectedFile.fileUrl}
                          alt={selectedFile.fileName}
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    ) : (
                      <DocumentPreview
                        fileUrl={selectedFile.fileUrl}
                        fileName={selectedFile.fileName}
                      />
                    )}
                  </div>
                </div>
                <div className="py-1 px-3 bg-gray-100 border-t flex justify-center">
                  <div className="flex items-center space-x-2 text-xs text-gray-600">
                    <span>Pages: {selectedFile.totalPages}</span>
                    {selectedFile.hasColorPages && (
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                        {selectedFile.colorPageCount} color {selectedFile.colorPageCount === 1 ? 'page' : 'pages'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Print Settings Area - Right Side */}
              <div className="w-2/5 p-4 flex flex-col h-full">
                <div className="grid grid-cols-1 gap-2">
                  {/* Destination/Printer selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Destination
                    </label>
                    <select
                      value={selectedPrinter}
                      onChange={(e) => setSelectedPrinter(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-md bg-white text-gray-900 shadow-sm"
                    >
                      <option value="">Select a printer...</option>
                      {Array.isArray(printers) && printers.length > 0 ? (
                        printers.map((printer, index) => (
                          <option key={index} value={printer.name}>
                            {printer.name}
                          </option>
                        ))
                      ) : (
                        <option value="">No printers available</option>
                      )}
                    </select>
                  </div>

                  {/* Pages and Copies in two columns */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Pages
                      </label>
                      <select
                        className="w-full px-3 py-1.5 border rounded-md bg-white text-gray-900 shadow-sm"
                        defaultValue="All"
                      >
                        <option value="All">All</option>
                        <option value="Custom">Custom</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Copies
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={copies}
                        onChange={(e) => setCopies(parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-1.5 border rounded-md bg-white text-gray-900 shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Layout and Color in two columns */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Layout
                      </label>
                      <select
                        value={orientation}
                        onChange={(e) => setOrientation(e.target.value)}
                        className="w-full px-3 py-1.5 border rounded-md bg-white text-gray-900 shadow-sm"
                      >
                        <option value="portrait">Portrait</option>
                        <option value="landscape">Landscape</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Color
                      </label>
                      <select
                        value={isColor ? "Color" : "Black and white"}
                        onChange={(e) => setIsColor(e.target.value === "Color")}
                        className="w-full px-3 py-1.5 border rounded-md bg-white text-gray-900 shadow-sm"
                      >
                        <option value="Color">
                          Color {selectedFile.hasColorPages ? `(${selectedFile.colorPageCount} color pages detected)` : ''}
                        </option>
                        <option value="Black and white">Black and white</option>
                      </select>
                      {selectedFile.hasColorPages && !isColor && (
                        <div className="mt-1 text-xs text-amber-600">
                          This document contains color content. Printing in black & white may affect quality.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Paper size */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Paper size
                    </label>
                    <select
                      value={selectedSize}
                      onChange={(e) => setSelectedSize(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-md bg-white text-gray-900 shadow-sm"
                    >
                      <option value="Short Bond">Letter (8.5 × 11 in)</option>
                      <option value="A4">A4 (210 × 297 mm)</option>
                      <option value="Legal">Legal (8.5 × 14 in)</option>
                    </select>
                  </div>

                  {/* More settings disclosure */}
                  <div className="mt-1 flex items-center justify-between border-t pt-2">
                    <button className="flex items-center justify-between w-full text-sm text-gray-700">
                      <span className="font-medium">More settings</span>
                      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  {/* Price & Balance information */}
                  <div className="flex justify-between pt-2 pb-1 border-t mt-1">
                    <span className="text-gray-700">Price:</span>
                    <span className="font-semibold">{price} coins</span>
                    {selectedFile.hasColorPages && isColor && (
                      <span className="text-xs text-orange-600">
                        *Price includes color surcharge
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4 p-3 border-t">
              <button
                className="px-6 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition duration-200"
                onClick={closePrintDialog}
              >
                Cancel
              </button>
              <button
                className={`px-6 py-1.5 rounded-md text-white flex items-center space-x-2 ${selectedFile && selectedPrinter && balance >= price && !isPrinting
                  ? 'bg-[#31304D] hover:bg-[#282740] transition duration-200'
                  : 'bg-gray-400 cursor-not-allowed'
                  }`}
                onClick={handlePrint}
                disabled={!selectedFile || !selectedPrinter || balance < price || isPrinting}
              >
                {isPrinting ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <FaPrint />
                    <span>Print</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Header with Logo */}
      <div className="bg-white p-4 shadow-md flex items-center">
        <img src={ezlogo} alt="EZ Logo" className="w-16 h-16 mr-4" />
        <h1 className="text-4xl font-bold text-[#31304D]">
          Kiosk Vendo Printer
        </h1>
      </div>

      {/* Sub Header with Back Button and Page Title */}
      <div className="bg-gray-200 p-4 flex items-center">
        <button
          onClick={() => navigate('/')}
          className="flex items-center justify-center w-10 h-10 bg-white text-[#31304D] border-2 border-[#31304D] rounded-lg mr-4"
          aria-label="Go back"
        >
          <FaArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold text-[#31304D]">Share files via QR</h2>
      </div>

      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Side - QR and Balance (1/3 width) */}
          <div className="flex flex-col h-full space-y-6">
            {/* QR Code Section */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-[#31304D] mb-4">Scan here</h2>
              <div className="border border-gray-200 rounded-lg p-6 relative">
                <div className="absolute -top-3 left-0 right-0 text-center">
                  <span className="bg-white px-3 text-sm text-gray-500 font-medium">
                    Scan this QR Code to share files
                  </span>
                </div>
                <div className="flex justify-center">
                  <div className="w-56 h-56 flex items-center justify-center">
                    <M_Qrcode onClick={handleOpenQrModal} />
                  </div>
                </div>
              </div>
            </div>

            {/* Balance and Pricing */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <p className="text-xl font-bold text-[#31304D] mb-3">
                Balance: <span className="text-green-500">{balance}</span> coins
              </p>

              {/* Smart Price Label */}
              <SmartPriceLabel
                isColor={isColor}
                copies={copies}
                totalPages={selectedFile.totalPages}
                calculatedPrice={price}
                setCalculatedPrice={setPrice}
                customPageRange=""
                selectedPageOption="All"
                filePreviewUrl={selectedFile.fileUrl}
                colorAnalysis={selectedFile.colorAnalysis}
              />
            </div>

            {/* Print Button */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <button
                onClick={openPrintDialog}
                disabled={!selectedFile.fileName || isLoading}
                className={`w-full py-3 flex items-center justify-center rounded-lg font-bold text-lg transition-all duration-200 ${!selectedFile.fileName || isLoading
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-[#31304D] hover:bg-[#41405D] text-white shadow-sm hover:shadow"
                  }`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {isAnalyzing ? "Analyzing PDF..." : "Processing..."}
                  </>
                ) : (
                  <>
                    <FaPrint className="mr-2" />
                    Print
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Side - Uploaded Files (2/3 width) */}
          <div className="flex flex-col h-full md:col-span-2">
            {/* Uploaded Files Section */}
            <div className="bg-white rounded-lg shadow-sm p-6 flex-grow">
              <h2 className="text-xl font-bold text-[#31304D] mb-4 flex justify-between items-center">
                <span>Uploaded files</span>
                <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {uploadedFiles.length} {uploadedFiles.length === 1 ? 'file' : 'files'}
                </span>
              </h2>

              <div className="min-h-[400px]">
                {uploadedFiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-12">
                    <div className="bg-gray-100 p-4 rounded-full mb-3">
                      <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                      </svg>
                    </div>
                    <p className="text-gray-500 font-medium mb-1">No files uploaded yet</p>
                    <p className="text-center text-gray-400 text-sm">
                      Scan the QR code with your mobile device to upload files
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {uploadedFiles.map((file) => (
                      <div
                        key={file.id}
                        className={`flex flex-col items-center cursor-pointer p-2 ${selectedFile.fileName === file.fileName ? "bg-blue-50 rounded-lg" : ""
                          }`}
                        onClick={() => handleSelectFile(file)}
                      >
                        {/* File Icon */}
                        <div className="mb-2 relative">
                          {file.fileType?.startsWith('image/') || file.fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/) ? (
                            <div className="w-20 h-24 relative">
                              <div className="absolute inset-0 bg-white border border-gray-200 rounded-sm shadow overflow-hidden">
                                <img
                                  src={file.fileUrl}
                                  alt={file.fileName}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            </div>
                          ) : file.fileName.toLowerCase().endsWith('.pdf') ? (
                            <div className="w-20 h-24 relative">
                              <div className="absolute inset-0 bg-white border border-gray-200 rounded-sm shadow"></div>
                              <div className="absolute left-0 top-0 w-12 h-12 bg-red-500 flex items-center justify-center">
                                <span className="text-white font-bold text-2xl">P</span>
                              </div>
                              <div className="absolute right-0 top-5 w-8 h-8">
                                <svg viewBox="0 0 24 24" className="w-full h-full text-red-300" fill="currentColor">
                                  <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />
                                </svg>
                              </div>
                              {file.hasColorPages && (
                                <div className="absolute right-0 bottom-0 w-6 h-6 bg-yellow-400 rounded-tl-lg flex items-center justify-center">
                                  <span className="text-white font-bold text-xs" title={`${file.colorPageCount} color pages`}>C</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="w-20 h-24 relative">
                              <div className="absolute inset-0 bg-white border border-gray-200 rounded-sm shadow"></div>
                              <div className="absolute left-0 top-0 w-12 h-12 bg-blue-600 flex items-center justify-center">
                                <span className="text-white font-bold text-2xl">W</span>
                              </div>
                              <div className="absolute right-4 bottom-3 flex flex-col items-start space-y-1">
                                <div className="w-10 h-0.5 bg-blue-600"></div>
                                <div className="w-10 h-0.5 bg-blue-600"></div>
                                <div className="w-10 h-0.5 bg-blue-600"></div>
                              </div>
                            </div>
                          )}

                          {/* Delete Button - Top Right */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFile(file.id, file.fileUrl);
                            }}
                            className="absolute -top-2 -right-2 bg-white rounded-full w-6 h-6 flex items-center justify-center shadow-sm border border-gray-200 text-gray-400 hover:text-red-500"
                            aria-label="Delete file"
                          >
                            <FaTimes size={12} />
                          </button>
                        </div>

                        {/* File Name - Under Icon */}
                        <div className="text-center w-full">
                          <p className="text-sm font-medium text-gray-800 truncate">{file.fileName}</p>
                          <p className="text-xs text-gray-500">
                            {file.totalPages} {file.totalPages === 1 ? 'page' : 'pages'}
                            {file.hasColorPages && (
                              <span className="ml-1 text-amber-600">• {file.colorPageCount} color</span>
                            )}
                            <span className="ml-1">• {new Date(file.uploadedAt).toLocaleDateString()}</span>
                          </p>
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
    </div>
  );
};

// Add this at the end of the file before the export statement:
// CSS for animation
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = `
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
.animate-fadeIn {
  animation: fadeIn 0.2s ease-out forwards;
}
`;
document.head.appendChild(styleSheet);

export default QRUpload;
