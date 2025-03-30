import React, { useState, useEffect } from "react";
import { Loader } from "lucide-react";
import mammoth from "mammoth";
import axios from "axios";

// Determine the API base URL dynamically
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? window.location.origin // Use same origin in production
  : 'http://localhost:5000'; // Use localhost in development

const DocumentPreview = ({ fileUrl, fileName }) => {
  const [loading, setLoading] = useState(true);
  const [docxHtml, setDocxHtml] = useState(null);
  const [previewError, setPreviewError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  const fileExtension = fileName ? fileName.split('.').pop().toLowerCase() : '';
  const isDocx = ['doc', 'docx'].includes(fileExtension);

  useEffect(() => {
    let isMounted = true;
    let source = axios.CancelToken.source();

    setLoading(true);
    setDocxHtml(null);
    setPreviewError(false);
    setErrorMessage("");

    const fetchAndPreviewDocx = async () => {
      if (!fileUrl || !isDocx) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        console.log(`Fetching DOCX file via proxy (attempt ${retryCount + 1}):`, fileUrl);

        // Use our backend proxy endpoint
        const proxyUrl = `${API_BASE_URL}/api/document-proxy?url=${encodeURIComponent(fileUrl)}&fileName=${encodeURIComponent(fileName)}`;

        // Fetch the file as an arraybuffer
        const response = await axios.get(proxyUrl, {
          responseType: 'arraybuffer',
          timeout: 15000, // 15 second timeout for slow connections
          cancelToken: source.token,
          // Simplified headers to avoid CORS issues
          headers: {
            'Cache-Control': 'no-cache'
          }
        });

        if (!isMounted) return;

        // Convert DOCX to HTML using mammoth
        try {
          const result = await mammoth.convertToHtml({ arrayBuffer: response.data });
          if (!isMounted) return;

          setDocxHtml(result.value);
          setLoading(false);
        } catch (mammothError) {
          console.error("Error converting DOCX to HTML:", mammothError);
          if (!isMounted) return;

          // If this is the first attempt, try one more time
          if (retryCount < 1) {
            setRetryCount(prev => prev + 1);
            return; // Let the effect run again with increased retry count
          }

          setPreviewError(true);
          setErrorMessage("Could not convert the document to HTML for preview.");
          setLoading(false);
        }
      } catch (fetchError) {
        console.error("Error fetching DOCX file:", fetchError);
        if (!isMounted) return;

        // If this is the first attempt, try one more time
        if (retryCount < 1) {
          setRetryCount(prev => prev + 1);
          return; // Let the effect run again with increased retry count
        }

        setPreviewError(true);

        // More specific error messages based on the error type
        if (fetchError.message && fetchError.message.includes('Network Error')) {
          setErrorMessage("Network error. The server may be unavailable or CORS is blocking access.");
        } else if (fetchError.response?.status === 404) {
          setErrorMessage("Document not found. It may have been deleted or moved.");
        } else {
          setErrorMessage("Could not load the document. Please check your connection.");
        }

        setLoading(false);
      }
    };

    // For DOCX files, try to use mammoth
    if (isDocx) {
      fetchAndPreviewDocx();
    } else {
      // For non-DOCX files, just show file info after a short delay
      const timer = setTimeout(() => {
        if (isMounted) setLoading(false);
      }, 800);
      return () => clearTimeout(timer);
    }

    return () => {
      isMounted = false;
      source.cancel('Component unmounted');
    };
  }, [fileUrl, fileName, isDocx, retryCount]);

  if (!fileName) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500">
        <p>No file selected</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8">
        <Loader className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-gray-600">
          {isDocx ? "Preparing document preview..." : "Loading document information..."}
        </p>
      </div>
    );
  }

  // If we have successfully converted DOCX to HTML, show it
  if (isDocx && docxHtml && !previewError) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="w-full bg-gray-100 p-2 border-b border-gray-200">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-600 flex-shrink-0 rounded-md flex items-center justify-center mr-2">
              <span className="text-white font-bold text-sm">W</span>
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-800 truncate text-sm">{fileName}</h3>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-5 bg-white">
          <div
            className="docx-preview prose max-w-none"
            dangerouslySetInnerHTML={{ __html: docxHtml }}
          />
        </div>
        <div className="bg-gray-50 p-2 border-t border-gray-200 text-xs text-gray-500 text-center">
          Preview powered by mammoth.js | Some formatting may differ from the original document
        </div>
      </div>
    );
  }

  // Determine file type icon and colors for non-DOCX or error cases
  let iconColor = 'text-blue-500';
  let iconLetter = 'W';
  let iconBg = 'bg-blue-600';
  let fileTypeName = 'Document';

  if (fileExtension === 'pdf') {
    iconColor = 'text-red-300';
    iconLetter = 'P';
    iconBg = 'bg-red-500';
    fileTypeName = 'PDF Document';
  } else if (['ppt', 'pptx'].includes(fileExtension)) {
    iconColor = 'text-orange-300';
    iconLetter = 'P';
    iconBg = 'bg-orange-500';
    fileTypeName = 'PowerPoint Presentation';
  } else if (['xls', 'xlsx'].includes(fileExtension)) {
    iconColor = 'text-green-300';
    iconLetter = 'X';
    iconBg = 'bg-green-500';
    fileTypeName = 'Excel Spreadsheet';
  } else if (['doc', 'docx'].includes(fileExtension)) {
    iconColor = 'text-blue-300';
    iconLetter = 'W';
    iconBg = 'bg-blue-600';
    fileTypeName = 'Word Document';
  } else if (['jpg', 'jpeg', 'png', 'gif'].includes(fileExtension)) {
    iconColor = 'text-purple-300';
    iconLetter = 'I';
    iconBg = 'bg-purple-600';
    fileTypeName = 'Image';
  } else if (fileExtension === 'txt') {
    iconColor = 'text-gray-300';
    iconLetter = 'T';
    iconBg = 'bg-gray-500';
    fileTypeName = 'Text File';
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 p-8">
      <div className="w-24 h-32 relative mb-6">
        <div className="absolute inset-0 bg-white border border-gray-200 rounded-md shadow-md"></div>
        <div className={`absolute left-0 top-0 w-16 h-16 ${iconBg} flex items-center justify-center`}>
          <span className="text-white font-bold text-4xl">{iconLetter}</span>
        </div>
        {fileExtension === 'pdf' && (
          <div className="absolute right-0 top-5 w-10 h-10">
            <svg viewBox="0 0 24 24" className="w-full h-full text-red-300" fill="currentColor">
              <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />
            </svg>
          </div>
        )}
        {['doc', 'docx', 'txt'].includes(fileExtension) && (
          <div className="absolute right-4 bottom-6 flex flex-col items-start space-y-1">
            <div className={`w-12 h-1 ${iconColor}`}></div>
            <div className={`w-12 h-1 ${iconColor}`}></div>
            <div className={`w-12 h-1 ${iconColor}`}></div>
          </div>
        )}
        {['ppt', 'pptx'].includes(fileExtension) && (
          <div className="absolute right-0 top-5 w-10 h-10">
            <svg viewBox="0 0 24 24" className="w-full h-full text-orange-300" fill="currentColor">
              <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />
            </svg>
          </div>
        )}
      </div>

      <h3 className="text-2xl font-semibold text-gray-800 mb-2 text-center">{fileName}</h3>
      <p className="text-gray-500 mb-4">{fileTypeName}</p>

      <div className="max-w-md text-center bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        {isDocx && previewError ? (
          <>
            <p className="text-red-600 font-medium">
              {errorMessage || "Could not preview this document"}
            </p>
            <p className="text-gray-600 mt-2">
              Your document will still print correctly when you use the Print button below.
            </p>
          </>
        ) : (
          <>
            <p className="text-gray-600">
              Document previews are currently unavailable due to browser security restrictions.
            </p>
            <p className="text-gray-600 mt-2">
              Your document will print correctly when you use the Print button below.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default DocumentPreview;