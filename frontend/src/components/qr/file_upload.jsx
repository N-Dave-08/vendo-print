import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage,realtimeDb } from "../../../firebase/firebase_config";
import { ref as dbRef, set, push } from "firebase/database";
import { PDFDocument } from "pdf-lib";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const FileUpload = () => {
  const [fileToUpload, setFileToUpload] = useState(null);
  const [totalPages, setTotalPages] = useState(1);
  const [uploadStatus, setUploadStatus] = useState(""); // "uploading", ""
  const [isModalOpen, setIsModalOpen] = useState(true); // Modal bukas pag-load
  const navigate = useNavigate();

  // Allowed types: PDF lang
  const allowedTypes = ["application/pdf"];

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) {
      alert("No file selected!");
      return;
    }
    // Tiyakin na PDF lang ang i-upload
    if (!allowedTypes.includes(file.type)) {
      alert("Unsupported file type! Please upload PDF files only.");
      return;
    }
    setFileToUpload(file);

    // Kunin ang page count gamit ang pdf-lib
    try {
      const pdfData = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfData);
      setTotalPages(pdfDoc.getPageCount());
    } catch (error) {
      console.error("Error processing PDF:", error);
    }
  };
 
  const uploadFile = async () => {
    if (!fileToUpload) {
      alert("No file selected for upload!");
      return;
    }
  
    try {
      setUploadStatus("uploading");
  
      // Upload file to Firebase Storage
      const storageRef = ref(storage, `uploads/${fileToUpload.name}`);
      const uploadTask = uploadBytesResumable(storageRef, fileToUpload);
  
      uploadTask.on(
        "state_changed",
        null,
        (error) => {
          console.error("Upload failed:", error);
          setUploadStatus("");
        },
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            setUploadStatus("");
  
            // Push file details to Firebase Realtime Database
            const fileRef = push(dbRef(realtimeDb, "uploadedFiles"));
            await set(fileRef, {
              fileName: fileToUpload.name,
              fileUrl: url,
              totalPages,
              uploadedAt: new Date().toISOString(),
            });
  
            // Navigate to printer page with file details
            navigate("/printer", { 
              state: { 
                fileName: fileToUpload.name, 
                fileUrl: url,
                totalPages
              }
            });
          } catch (error) {
            console.error("Error storing file info in database:", error);
            setUploadStatus("");
          }
        }
      );
    } catch (err) {
      console.error(err);
      setUploadStatus("");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center text-white relative">
      {/* Modal na nagpapahayag na PDF lang ang papayagan */}
      {isModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
            <h2 className="text-2xl font-bold mb-4">UPLOAD PDF FILE ONLY</h2>
            <p className="mb-4">
              Please upload a PDF file only. Other file types are not supported.
            </p>
            <button
              onClick={() => setIsModalOpen(false)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* File Upload Box */}
      <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-96 text-center">
        <h2 className="text-lg font-semibold mb-4">Upload Your File</h2>
        <label className="block w-full p-4 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer hover:border-gray-400">
          <input 
            type="file" 
            accept=".pdf" 
            className="hidden" 
            onChange={handleFileSelect} 
          />
          <p className="text-gray-300">Click or drag a file here to upload</p>
        </label>
        {fileToUpload && (
          <div className="mt-4 text-gray-400">
            <p className="text-sm">Selected file:</p>
            <p className="font-medium">{fileToUpload.name}</p>
            <p className="text-sm">
              Estimated Pages: {totalPages}
            </p>
          </div>
        )}
        <button
          className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg w-full transition flex justify-center items-center"
          onClick={uploadFile}
          disabled={uploadStatus !== ""}
        >
          {uploadStatus === ""
            ? "Upload"
            : uploadStatus === "uploading"
            ? "Uploading..."
            : "Upload"}
          {uploadStatus === "uploading" && (
            <FontAwesomeIcon icon={faSpinner} spin className="ml-2" />
          )}
        </button>
      </div>
    </div>
  );
};

export default FileUpload;
