import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage, realtimeDb } from "../../../firebase/firebase_config";
import { ref as dbRef, set, push } from "firebase/database";
import { PDFDocument } from "pdf-lib";
import { faSpinner, faFileUpload, faFilePdf, faFileWord } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const FileUpload = () => {
  const [fileToUpload, setFileToUpload] = useState(null);
  const [totalPages, setTotalPages] = useState(1);
  const [uploadStatus, setUploadStatus] = useState(""); // "uploading", ""
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const navigate = useNavigate();

  const allowedTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ];

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) {
      alert("No file selected!");
      return;
    }

    if (!allowedTypes.includes(file.type)) {
      alert("Unsupported file type! Please upload PDF or DOCX files only.");
      return;
    }
    setFileToUpload(file);

    if (file.type === "application/pdf") {
      try {
        const pdfData = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(pdfData);
        setTotalPages(pdfDoc.getPageCount());
      } catch (error) {
        console.error("Error processing PDF:", error);
      }
    } else {
      setTotalPages(1); // Default for DOCX files
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.files = e.dataTransfer.files;
      handleFileSelect({ target: fileInput });
    }
  };

  const uploadFile = async () => {
    if (!fileToUpload) {
      alert("No file selected for upload!");
      return;
    }
  
    try {
      setUploadStatus("uploading");
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
  
            const fileRef = push(dbRef(realtimeDb, "uploadedFiles"));
            await set(fileRef, {
              fileName: fileToUpload.name,
              fileUrl: url,
              totalPages,
              uploadedAt: new Date().toISOString(),
            });
  
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

  const getFileIcon = () => {
    if (!fileToUpload) return null;
    return fileToUpload.type === "application/pdf" ? (
      <FontAwesomeIcon icon={faFilePdf} className="text-red-500 text-3xl" />
    ) : (
      <FontAwesomeIcon icon={faFileWord} className="text-blue-500 text-3xl" />
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-xl shadow-2xl text-center max-w-md w-full mx-4 transform transition-all">
            <div className="flex justify-center space-x-4 mb-6">
              <FontAwesomeIcon icon={faFilePdf} className="text-red-500 text-4xl" />
              <FontAwesomeIcon icon={faFileWord} className="text-blue-500 text-4xl" />
            </div>
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Upload Your Document</h2>
            <p className="mb-6 text-gray-600">
              Please upload a PDF or DOCX file to continue.
            </p>
            <button
              onClick={() => setIsModalOpen(false)}
              className="bg-primary hover:bg-primary-dark text-white font-bold py-3 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md mx-4">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 text-center">Upload Your File</h2>
        
        <div 
          className={`relative border-2 ${dragActive ? 'border-primary border-solid' : 'border-dashed border-gray-400'} 
          rounded-xl p-8 transition-all duration-300 ease-in-out
          ${dragActive ? 'bg-primary bg-opacity-5' : 'bg-gray-50'}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input 
            type="file" 
            accept=".pdf,.docx" 
            className="hidden" 
            onChange={handleFileSelect}
            id="file-upload" 
          />
          <label 
            htmlFor="file-upload" 
            className="flex flex-col items-center cursor-pointer"
          >
            <FontAwesomeIcon 
              icon={faFileUpload} 
              className={`text-4xl mb-4 ${dragActive ? 'text-primary' : 'text-gray-400'}`}
            />
            <p className="text-center text-gray-600">
              <span className="text-primary font-semibold">Click to upload</span> or drag and drop
              <br />
              <span className="text-sm">PDF or DOCX files only</span>
            </p>
          </label>
        </div>

        {fileToUpload && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-4">
              {getFileIcon()}
              <div className="flex-1">
                <p className="font-medium text-gray-800 truncate">{fileToUpload.name}</p>
                <p className="text-sm text-gray-500">
                  Pages: {totalPages} • {(fileToUpload.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          className={`mt-6 w-full py-3 px-4 rounded-lg font-bold flex items-center justify-center transition duration-300 ease-in-out
            ${uploadStatus === "" ? 'bg-primary hover:bg-primary-dark text-white' : 'bg-gray-400 cursor-not-allowed'}
            ${fileToUpload ? 'opacity-100' : 'opacity-50 cursor-not-allowed'}`}
          onClick={uploadFile}
          disabled={uploadStatus !== "" || !fileToUpload}
        >
          {uploadStatus === "" ? (
            <>
              Upload File
              <FontAwesomeIcon icon={faFileUpload} className="ml-2" />
            </>
          ) : (
            <>
              Uploading...
              <FontAwesomeIcon icon={faSpinner} spin className="ml-2" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default FileUpload;
