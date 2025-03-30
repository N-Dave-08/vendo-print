import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft, FaPrint, FaTimes } from "react-icons/fa";
import { ezlogo } from "../assets/Icons";
import { realtimeDb, storage } from "../../firebase/firebase_config";
import { ref as dbRef, get, remove, update, set } from "firebase/database";
import { ref as storageRef, deleteObject } from "firebase/storage";
import { onValue } from "firebase/database";
import M_Qrcode from "../components/M_Qrcode";

const QRUpload = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);

  // File states
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState({
    fileName: queryParams.get("name") || "",
    fileUrl: queryParams.get("url") || "",
    totalPages: parseInt(queryParams.get("pages")) || 1
  });

  // QR Code modal state
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Print settings
  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [copies, setCopies] = useState(1);
  const [isColor, setIsColor] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Balance and price
  const [balance, setBalance] = useState(0);
  const [price, setPrice] = useState(0);

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

  // Calculate price based on settings
  useEffect(() => {
    if (!selectedFile.fileName) {
      setPrice(0);
      return;
    }

    // Base price per page
    const basePricePerPage = 5;

    // Color multiplier
    const colorMultiplier = isColor ? 2 : 1;

    // Calculate total price
    const calculatedPrice = basePricePerPage * selectedFile.totalPages * copies * colorMultiplier;

    setPrice(calculatedPrice);
  }, [selectedFile, copies, isColor]);

  // Fetch uploaded files
  useEffect(() => {
    const uploadedFilesRef = dbRef(realtimeDb, "uploadedFiles");
    const unsubscribe = onValue(uploadedFilesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const filesArray = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }))
          // Filter to only include files that were uploaded via QR
          // Files uploaded via QR should have a uploadSource field set to "qr"
          .filter(file => file.uploadSource === "qr");

        setUploadedFiles(filesArray);
      } else {
        setUploadedFiles([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Handle file deletion
  const handleDeleteFile = async (fileId, fileName) => {
    if (!window.confirm("Are you sure you want to delete this file?")) return;

    try {
      // Delete from Storage
      const fileRef = storageRef(storage, `uploads/${fileName}`);
      await deleteObject(fileRef);

      // Delete from Database
      await remove(dbRef(realtimeDb, `uploadedFiles/${fileId}`));

      // Clear selection if deleted file was selected
      if (selectedFile.fileName === fileName) {
        setSelectedFile({ fileName: "", fileUrl: "", totalPages: 1 });
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      alert("Failed to delete file. Please try again.");
    }
  };

  // Handle file selection
  const handleSelectFile = (file) => {
    setSelectedFile({
      fileName: file.fileName,
      fileUrl: file.fileUrl,
      totalPages: file.totalPages
    });
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

    setIsLoading(true);
    try {
      // Create a unique ID for the print job
      const printJobId = Date.now().toString();

      // Add to print queue with the unique ID
      const printJobRef = dbRef(realtimeDb, `files/${printJobId}`);

      // Add print job details
      await set(printJobRef, {
        fileName: selectedFile.fileName,
        fileUrl: selectedFile.fileUrl,
        printerName: selectedPrinter || "default",
        copies: copies,
        isColor: isColor,
        totalPages: selectedFile.totalPages,
        price: price,
        timestamp: new Date().toISOString(),
        status: "Processing",
        progress: 5,
        printStatus: "Preparing print job..."
      });

      // Update balance
      const updatedBalance = balance - price;
      await update(dbRef(realtimeDb, "coinCount"), { availableCoins: updatedBalance });

      // Immediately redirect to printer page
      navigate('/printer');

      // Simulate print progress in the background with more detailed steps
      const progressSteps = [
        { progress: 15, status: "Processing document...", delay: 800 },
        { progress: 30, status: "Configuring printer settings...", delay: 1500 },
        { progress: 45, status: "Converting document format...", delay: 2200 },
        { progress: 60, status: "Connecting to printer...", delay: 3000 },
        { progress: 75, status: "Sending to printer...", delay: 3800 },
        { progress: 85, status: "Printing in progress...", delay: 4500 },
        { progress: 95, status: "Finishing print job...", delay: 5200 },
      ];

      // Update progress in the background
      for (const step of progressSteps) {
        setTimeout(() => {
          update(printJobRef, {
            progress: step.progress,
            printStatus: step.status
          });
        }, step.delay);
      }

      // Complete the job after all steps
      setTimeout(() => {
        update(printJobRef, {
          status: "Done",
          progress: 100,
          printStatus: "Print job completed"
        });
      }, 6000);

    } catch (error) {
      console.error("Print error:", error);
      alert("Failed to print. Please try again.");
      setIsLoading(false);
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
            <div className="bg-white rounded-lg shadow-sm p-6 mt-auto">
              <p className="text-xl font-bold text-[#31304D] mb-3">
                Balance: <span className="text-green-500">{balance}</span> coins
              </p>

              <p className="text-xl font-bold text-[#31304D]">
                Smart Price: <span className="text-green-500">₱{price.toFixed(2)}</span>
              </p>
            </div>
          </div>

          {/* Right Side - Uploaded Files and Print (2/3 width) */}
          <div className="flex flex-col h-full md:col-span-2">
            {/* Uploaded Files Section */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6 flex-grow">
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
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {uploadedFiles.map((file) => (
                      <div
                        key={file.id}
                        className={`flex flex-col items-center cursor-pointer p-2 ${selectedFile.fileName === file.fileName ? "bg-blue-50 rounded-lg" : ""
                          }`}
                        onClick={() => handleSelectFile(file)}
                      >
                        {/* File Icon */}
                        <div className="mb-2 relative">
                          {file.fileName.toLowerCase().endsWith('.pdf') ? (
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
                            </div>
                          ) : file.fileName.toLowerCase().endsWith('.pptx') ? (
                            <div className="w-20 h-24 relative">
                              <div className="absolute inset-0 bg-white border border-gray-200 rounded-sm shadow"></div>
                              <div className="absolute left-0 top-0 w-12 h-12 bg-orange-500 flex items-center justify-center">
                                <span className="text-white font-bold text-2xl">P</span>
                              </div>
                              <div className="absolute right-0 top-5 w-8 h-8">
                                <svg viewBox="0 0 24 24" className="w-full h-full text-orange-300" fill="currentColor">
                                  <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />
                                </svg>
                              </div>
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
                              handleDeleteFile(file.id, file.fileName);
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
                            {file.totalPages} {file.totalPages === 1 ? 'page' : 'pages'} • {new Date(file.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Print Options and Button */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex flex-wrap justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-[#31304D]">Print Options</h2>

                <div className="flex items-center space-x-6 my-2">
                  <div className="flex items-center">
                    <input
                      id="color-print"
                      type="checkbox"
                      className="w-4 h-4 text-[#31304D] border-gray-300 rounded focus:ring-[#31304D]"
                      checked={isColor}
                      onChange={(e) => setIsColor(e.target.checked)}
                    />
                    <label htmlFor="color-print" className="ml-2 text-sm font-medium text-gray-700">Color</label>
                  </div>

                  <div className="flex items-center">
                    <label htmlFor="copies" className="text-sm font-medium text-gray-700 mr-2">Copies:</label>
                    <input
                      id="copies"
                      type="number"
                      min="1"
                      max="99"
                      className="w-16 p-1 text-sm border border-gray-300 rounded-md"
                      value={copies}
                      onChange={(e) => setCopies(parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handlePrint}
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
                    Printing...
                  </>
                ) : (
                  <>
                    <FaPrint className="mr-2" />
                    Print Document
                  </>
                )}
              </button>
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
