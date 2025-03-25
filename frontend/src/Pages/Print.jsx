import React, { useState, useEffect } from "react";
import { Upload, FileText, Info } from "lucide-react";
import MiniNav from "../components/MiniNav";
import { ALLOWED_FILE_TYPES, PRICING } from "../config";
import PrintPreview from "../components/PrintPreview";
import { useAuth } from "../contexts/AuthContext";

function Print() {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  
  // Print options
  const [orientation, setOrientation] = useState("portrait");
  const [isColor, setIsColor] = useState(false);
  const [copies, setCopies] = useState(1);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Handle file upload
  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  // Handle file drop
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  // Validate file and set it
  const validateAndSetFile = (selectedFile) => {
    setError(null);
    
    // Check file type
    if (!ALLOWED_FILE_TYPES.includes(selectedFile.type)) {
      setError("File type not supported. Please upload a PDF, Word document, or image file.");
      return;
    }
    
    // Check file size (10MB max)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("File too large. Maximum size is 10MB.");
      return;
    }
    
    setFile(selectedFile);
    
    // Create object URL for preview
    const fileUrl = URL.createObjectURL(selectedFile);
    setFilePreviewUrl(fileUrl);
  };

  // Clean up object URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  const handlePrint = () => {
    if (!file) {
      setError("Please select a file to print.");
      return;
    }
    
    setShowPrintPreview(true);
  };

  const handlePrintComplete = (printSettings) => {
    // User cancelled the print if no settings are returned
    if (!printSettings) {
      setShowPrintPreview(false);
      return;
    }
    
    // Update our options with user selections
    setOrientation(printSettings.orientation || orientation);
    setIsColor(printSettings.isColor !== undefined ? printSettings.isColor : isColor);
    setCopies(printSettings.copies || copies);
    
    // In a real implementation, we would send these settings to the backend
    // along with the file to print
    console.log("Print completed with settings:", printSettings);
    
    // Record the print job to the backend here
    
    // Close the preview
    setShowPrintPreview(false);
    
    // Show success message
    alert("Print job submitted successfully!");
    
    // Reset form
    setFile(null);
    setFilePreviewUrl("");
  };

  const calculateEstimatedCost = () => {
    if (!file) return 0;
    
    const pagePrice = isColor ? PRICING.COLOR_PAGE : PRICING.BLACK_WHITE_PAGE;
    // Estimate page count based on file size (very rough estimate)
    const estimatedPages = Math.max(1, Math.ceil(file.size / (500 * 1024)));
    return pagePrice * estimatedPages * copies;
  };

  return (
    <div className="max-w-4xl mx-auto py-6">
      <MiniNav title="Print a Document" />
      
      <div className="mt-6 bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Upload File</h2>
        
        {/* File Uploader */}
        <div 
          className={`border-2 border-dashed rounded-lg p-8 text-center ${
            dragActive ? "border-primary bg-primary-50" : "border-gray-300 hover:border-primary"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(false);
          }}
          onDrop={handleDrop}
        >
          {!filePreviewUrl ? (
            <div className="flex flex-col items-center">
              <Upload size={40} className="text-gray-400 mb-4" />
              <p className="mb-2 text-gray-700">Drag and drop a file here, or click to browse</p>
              <p className="text-sm text-gray-500 mb-4">Supported formats: PDF, Word, Excel, PowerPoint, Images</p>
              <input
                type="file"
                id="file-upload"
                className="hidden"
                onChange={handleFileChange}
                accept={ALLOWED_FILE_TYPES.join(",")}
              />
              <button
                onClick={() => document.getElementById("file-upload").click()}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
              >
                Browse Files
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <FileText size={40} className="text-primary mb-4" />
              <p className="mb-2 font-medium">{file.name}</p>
              <p className="text-sm text-gray-500 mb-4">
                {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type}
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setFile(null);
                    setFilePreviewUrl("");
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Remove
                </button>
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark flex items-center gap-2"
                >
                  <span>Continue to Print</span>
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md border border-red-200">
            <div className="flex items-center gap-2">
              <Info size={16} />
              <span>{error}</span>
            </div>
          </div>
        )}
        
        {/* File information and cost estimate */}
        {file && (
          <div className="mt-6 p-4 bg-gray-50 rounded-md">
            <h3 className="font-medium mb-2">Estimated Details:</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Estimated cost:</p>
                <p className="font-medium">{calculateEstimatedCost()} coins</p>
              </div>
              <div>
                <p className="text-gray-500">Your balance:</p>
                <p className="font-medium">{user?.coins || 0} coins</p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Print Preview Modal */}
      {showPrintPreview && (
        <PrintPreview
          fileUrl={filePreviewUrl}
          onClose={handlePrintComplete}
          printOptions={{
            orientation,
            isColor,
            copies
          }}
        />
      )}
    </div>
  );
}

export default Print; 