import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft, FaPrint, FaTimes } from "react-icons/fa";
import { ezlogo } from "../assets/Icons";

import CustomPage from "../components/qr/customized_page";
import DocumentPreview from "../components/qr/document_preview";
import SmartPriceToggle from "../components/qr/smart_price";
import PrinterList from "../components/qr/printerList";
import PageOrientation from "../components/qr/page_orientation";
import SelectColor from "../components/qr/select_color";
import PageSize from "../components/qr/page_size";
import Copies from "../components/qr/copies";

import { realtimeDb, storage } from "../../firebase/firebase_config";
import { getDatabase, ref as dbRef, push, get, update, remove } from "firebase/database";
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { onValue } from "firebase/database";
import axios from "axios";
import { PDFDocument } from "pdf-lib";
import mammoth from "mammoth";

import { getPageIndicesToPrint } from "../utils/pageRanges";
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

  // Print settings
  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [copies, setCopies] = useState(1);
  const [pageSize, setPageSize] = useState("A4");
  const [orientation, setOrientation] = useState("portrait");
  const [isColor, setIsColor] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch uploaded files
  useEffect(() => {
    const uploadedFilesRef = dbRef(realtimeDb, "uploadedFiles");
    const unsubscribe = onValue(uploadedFilesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const filesArray = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
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

    if (!selectedPrinter) {
      alert("Please select a printer");
      return;
    }

    setIsLoading(true);
    try {
      // Add your print logic here
      console.log("Printing file:", selectedFile);
      // TODO: Implement print functionality
    } catch (error) {
      console.error("Print error:", error);
      alert("Failed to print. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate('/')}
          className="text-gray-600 hover:text-gray-800 mr-4"
        >
          <FaArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold text-gray-800">Print Document</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side - Settings */}
        <div className="space-y-6">
          {/* QR Code */}
          <div className="bg-white rounded-lg shadow-md p-6 flex flex-col items-center">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Scan to Upload</h2>
            <M_Qrcode />
          </div>
          
          {/* Print Settings */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Print Settings</h2>
            
            {/* Printer Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Printer
              </label>
              <select
                value={selectedPrinter}
                onChange={(e) => setSelectedPrinter(e.target.value)}
                className="w-full p-2 border rounded-lg"
              >
                <option value="">Choose a printer...</option>
                <option value="printer1">Printer 1</option>
                <option value="printer2">Printer 2</option>
              </select>
            </div>

            {/* Copies */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Copies
              </label>
              <input
                type="number"
                min="1"
                value={copies}
                onChange={(e) => setCopies(parseInt(e.target.value))}
                className="w-full p-2 border rounded-lg"
              />
            </div>

            {/* Page Size */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Page Size
              </label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value)}
                className="w-full p-2 border rounded-lg"
              >
                <option value="A4">A4</option>
                <option value="Letter">Letter</option>
                <option value="Legal">Legal</option>
              </select>
            </div>

            {/* Orientation */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Orientation
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="portrait"
                    checked={orientation === "portrait"}
                    onChange={(e) => setOrientation(e.target.value)}
                    className="mr-2"
                  />
                  Portrait
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="landscape"
                    checked={orientation === "landscape"}
                    onChange={(e) => setOrientation(e.target.value)}
                    className="mr-2"
                  />
                  Landscape
                </label>
              </div>
            </div>

            {/* Color Option */}
            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isColor}
                  onChange={(e) => setIsColor(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Color Print</span>
              </label>
            </div>

            <button
              onClick={handlePrint}
              disabled={!selectedFile.fileUrl || !selectedPrinter || isLoading}
              className={`w-full py-3 px-4 rounded-lg font-bold flex items-center justify-center ${
                !selectedFile.fileUrl || !selectedPrinter || isLoading
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              }`}
            >
              {isLoading ? (
                <>
                  <span className="animate-spin mr-2">⌛</span>
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

        {/* Middle - Preview */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Document Preview</h2>
          
          {selectedFile.fileUrl ? (
            <div className="h-[600px] mb-6">
              <iframe
                src={`https://docs.google.com/gview?url=${encodeURIComponent(
                  selectedFile.fileUrl
                )}&embedded=true`}
                className="w-full h-full border-0 rounded-lg"
                title="Document Preview"
              />
            </div>
          ) : (
            <div className="h-[600px] flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-gray-500">Select a file to preview</p>
            </div>
          )}
        </div>

        {/* Right Side - Uploaded Files */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Uploaded Files</h2>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {uploadedFiles.length === 0 ? (
              <p className="text-gray-500">No files uploaded yet</p>
            ) : (
              uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                    selectedFile.fileName === file.fileName
                      ? "bg-blue-50 border border-blue-200"
                      : "bg-gray-50 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">
                      {file.fileName}
                    </p>
                    <p className="text-sm text-gray-500">
                      Pages: {file.totalPages} • {new Date(file.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleSelectFile(file)}
                      className={`px-3 py-1 rounded transition-colors ${
                        selectedFile.fileName === file.fileName
                          ? "bg-blue-500 text-white"
                          : "text-blue-500 hover:bg-blue-50"
                      }`}
                    >
                      Select
                    </button>
                    <button
                      onClick={() => handleDeleteFile(file.id, file.fileName)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <FaTimes />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRUpload;
