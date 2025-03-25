import React, { useState, useEffect } from "react";
import mammoth from "mammoth";

const DocumentPreview = ({ fileUrl, fileName, fileToUpload }) => {
  const [htmlContent, setHtmlContent] = useState('');
  const [viewerError, setViewerError] = useState(false);
  const fileExtension = fileName?.split(".").pop().toLowerCase();

  // Effect to handle local rendering of docx as primary method for Word documents
  useEffect(() => {
    if (["docx", "doc"].includes(fileExtension) && fileToUpload) {
      const renderLocalDocx = async () => {
        try {
          const arrayBuffer = await fileToUpload.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });
          setHtmlContent(result.value);
        } catch (error) {
          console.error("Error converting docx to html:", error);
          setViewerError(true);
        }
      };
      
      renderLocalDocx();
    }
  }, [fileToUpload, fileExtension]);

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 w-full">
      <h2 className="text-xl font-bold mb-4 text-[#31304D]">
        {fileName || "Document Preview"}
      </h2>

      <div className="w-full h-full overflow-y-auto flex justify-center rounded-lg shadow-md p-4 relative">
        {!fileUrl && !fileToUpload && (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-gray-500">No document selected. Please upload a file first.</p>
          </div>
        )}

        {/* Image files */}
        {["jpg", "jpeg", "png", "gif"].includes(fileExtension) && fileUrl && !viewerError && (
          <img
            src={fileUrl}
            alt="Preview"
            className="max-w-full max-h-full object-contain"
            onError={() => setViewerError(true)}
          />
        )}

        {/* PDF files */}
        {["pdf"].includes(fileExtension) && fileUrl && !viewerError && (
          <iframe
            src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0`}
            className="w-full h-[80vh]"
            title="PDF Preview"
            onError={() => setViewerError(true)}
            frameBorder="0"
          />
        )}

        {/* Other document types */}
        {["xlsx", "pptx", "xls", "ppt"].includes(fileExtension) && fileUrl && !viewerError && (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <div className="mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <h3 className="text-lg font-semibold">{fileName}</h3>
            <p className="text-gray-600 mt-2">Preview not available. You can still print this document.</p>
          </div>
        )}

        {/* Word documents */}
        {["docx", "doc"].includes(fileExtension) && fileToUpload && (
          <div className="w-full h-full overflow-auto p-4 bg-white">
            {htmlContent ? (
              <div 
                className="document-content" 
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            ) : (
              <div className="text-center py-12">
                <div className="mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold">Word Document</h3>
                <p className="text-gray-600 mt-2">
                  {viewerError 
                    ? "There was an error processing this document. You can still print it using the Print button below."
                    : "Document is ready for printing."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Error state for all file types */}
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
