import React, { useState, useEffect } from "react";

const DocumentPreview = ({ fileUrl, fileName, fileToUpload }) => {
  const [viewerError, setViewerError] = useState(false);
  const fileExtension = fileName ? fileName.split('.').pop().toLowerCase() : '';

  useEffect(() => {
    setViewerError(false);
  }, [fileUrl]);

  if (!fileUrl) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-gray-500">
        <p>No file selected</p>
      </div>
    );
  }

  return (
    <div className="w-full h-96 relative">
      <div className="w-full h-full">
        {!viewerError && (
          <iframe
            src={fileUrl}
            className="w-full h-full border-none"
            onError={() => setViewerError(true)}
            title="Document Preview"
          />
        )}
        
        {viewerError && !["docx", "doc"].includes(fileExtension) && (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <div className="mb-4 text-red-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h3 className="text-lg font-semibold">Preview Unavailable</h3>
            <p className="text-gray-600 mt-2">Could not load the document preview. You can still print this document using the Print button below.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentPreview; 