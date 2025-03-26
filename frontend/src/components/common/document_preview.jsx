import React, { useState, useEffect } from "react";
import { Loader } from "lucide-react";
import { getStorage, ref, getBlob } from "firebase/storage";
import { storage } from "../../../firebase/firebase_config";
import mammoth from "mammoth";

const DocumentPreview = ({ fileUrl, fileName, fileToUpload }) => {
  const [viewerError, setViewerError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [blobUrl, setBlobUrl] = useState(null);
  const [docxHtml, setDocxHtml] = useState(null);
  const fileExtension = fileName ? fileName.split('.').pop().toLowerCase() : '';

  useEffect(() => {
    setViewerError(false);
    setLoading(true);
    setDocxHtml(null);

    // Handle local DOCX files with mammoth preview
    const handleDocxPreview = async (file) => {
      try {
        if (!['doc', 'docx'].includes(fileExtension)) {
          return false;
        }

        console.log("Trying to render DOCX preview");
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setDocxHtml(result.value);
        setLoading(false);
        return true;
      } catch (error) {
        console.error("Failed to process DOCX file:", error);
        return false;
      }
    };

    // If we have a local file (fileToUpload), use it directly first
    if (fileToUpload) {
      try {
        console.log("Using local file directly:", fileToUpload.name);

        // If it's a DOCX file, try to render it using mammoth.js
        if (['doc', 'docx'].includes(fileExtension)) {
          handleDocxPreview(fileToUpload);
          return;
        }

        // For other file types, create an object URL
        const url = URL.createObjectURL(fileToUpload);
        setBlobUrl(url);
        setLoading(false);
        return;
      } catch (error) {
        console.error("Error creating URL from local file:", error);
        // Continue to Firebase approach if this fails
      }
    }

    if (!fileUrl) {
      setLoading(false);
      return;
    }

    // Function to create a blob URL from a file using Firebase Storage SDK
    const fetchDocumentFromFirebase = async () => {
      try {
        console.log("Attempting to fetch from Firebase:", fileUrl);

        // Extract storage path from the Firebase URL
        // Convert URL like "https://firebasestorage.googleapis.com/v0/b/ezprint-4258e.firebasestorage.a.701_test-printer.docx"
        // to a storage path like "uploads/test-printer.docx"
        let storagePath;

        if (fileUrl.includes('firebasestorage.googleapis.com')) {
          // This is a Firebase Storage URL, extract the file path
          const pathMatch = fileUrl.match(/\/([^/?]+)(?:\?.*)?$/);
          if (pathMatch) {
            const filename = pathMatch[1];
            storagePath = `uploads/${decodeURIComponent(filename.split('_').pop())}`;
          } else {
            throw new Error("Invalid Firebase Storage URL format");
          }
        } else {
          // This could be a direct path or another URL format
          storagePath = fileUrl;
        }

        console.log("Fetching from storage path:", storagePath);

        // Use Firebase Storage SDK to get the blob
        const storageRef = ref(storage, storagePath);
        const blob = await getBlob(storageRef);

        // If it's a DOCX file, try to render it
        if (['doc', 'docx'].includes(fileExtension)) {
          const arrayBuffer = await blob.arrayBuffer();
          try {
            const result = await mammoth.convertToHtml({ arrayBuffer });
            setDocxHtml(result.value);
            setLoading(false);
            return;
          } catch (docxError) {
            console.error("Failed to process DOCX from Firebase:", docxError);
            // Fall back to normal handling
          }
        }

        // Create object URL from blob for other files
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setLoading(false);
      } catch (error) {
        console.error("Error loading document from Firebase:", error);

        // If we have a direct URL, try using that as a fallback
        if (fileUrl) {
          try {
            console.log("Attempting direct fetch of URL:", fileUrl);
            // Try a direct fetch as last resort
            const response = await fetch(fileUrl, {
              mode: 'cors',
              headers: {
                'Access-Control-Allow-Origin': '*'
              }
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const blob = await response.blob();

            // If it's a DOCX file, try to render it
            if (['doc', 'docx'].includes(fileExtension)) {
              try {
                const arrayBuffer = await blob.arrayBuffer();
                const result = await mammoth.convertToHtml({ arrayBuffer });
                setDocxHtml(result.value);
                setLoading(false);
                return;
              } catch (docxError) {
                console.error("Failed to process fetched DOCX:", docxError);
                // Fall back to normal handling
              }
            }

            const url = URL.createObjectURL(blob);
            setBlobUrl(url);
            setLoading(false);
            return;
          } catch (fetchError) {
            console.error("Error with direct fetch:", fetchError);
            setViewerError(true);
            setLoading(false);
          }
        } else {
          setViewerError(true);
          setLoading(false);
        }
      }
    };

    fetchDocumentFromFirebase();

    // Cleanup function to revoke blob URL when component unmounts
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [fileUrl, fileToUpload, fileExtension]);

  if (!fileUrl && !fileToUpload) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-gray-500">
        <p>No file selected</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center">
        <Loader className="w-10 h-10 text-primary animate-spin mb-2" />
        <p className="text-gray-600">Loading preview...</p>
      </div>
    );
  }

  const renderPreview = () => {
    // For DOCX files with HTML content
    if ((['doc', 'docx'].includes(fileExtension)) && docxHtml) {
      return (
        <div className="w-full h-full overflow-auto bg-white p-4">
          <div
            dangerouslySetInnerHTML={{ __html: docxHtml }}
            className="docx-preview"
          />
        </div>
      );
    }

    // For PDF files
    if (fileExtension === 'pdf' && blobUrl) {
      return (
        <iframe
          src={`${blobUrl}#toolbar=0&navpanes=0`}
          className="w-full h-full border-none"
          title="PDF Preview"
        />
      );
    }

    // For image files
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension) && blobUrl) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <img
            src={blobUrl}
            alt={fileName}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      );
    }

    // For Word files and other document types where we couldn't render a preview
    if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'].includes(fileExtension)) {
      let iconColor = 'text-blue-500';
      let iconLetter = 'W';

      if (['ppt', 'pptx'].includes(fileExtension)) {
        iconColor = 'text-orange-500';
        iconLetter = 'P';
      } else if (['xls', 'xlsx'].includes(fileExtension)) {
        iconColor = 'text-green-500';
        iconLetter = 'X';
      } else if (fileExtension === 'txt') {
        iconColor = 'text-gray-500';
        iconLetter = 'T';
      }

      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
          <div className={`w-20 h-24 relative mb-4`}>
            <div className="absolute inset-0 bg-white border border-gray-200 rounded-sm shadow"></div>
            <div className={`absolute left-0 top-0 w-12 h-12 bg-blue-600 flex items-center justify-center`}>
              <span className="text-white font-bold text-2xl">{iconLetter}</span>
            </div>
            <div className="absolute right-4 bottom-3 flex flex-col items-start space-y-1">
              <div className={`w-10 h-0.5 ${iconColor}`}></div>
              <div className={`w-10 h-0.5 ${iconColor}`}></div>
              <div className={`w-10 h-0.5 ${iconColor}`}></div>
            </div>
          </div>
          <p className="font-medium text-gray-800">{fileName}</p>
          <p className="text-sm text-gray-500 mt-1">Preview not available for this file type</p>
          <a
            href={blobUrl}
            download={fileName}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
            onClick={(e) => e.stopPropagation()}
          >
            Download to View
          </a>
        </div>
      );
    }

    // Fallback for other file types
    return (
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
        <p className="text-gray-600 mt-2">Preview not available for this file type</p>
        <a
          href={blobUrl}
          download={fileName}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
          onClick={(e) => e.stopPropagation()}
        >
          Download
        </a>
      </div>
    );
  };

  if (viewerError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center">
        <div className="mb-4 text-red-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h3 className="text-lg font-semibold">Preview Unavailable</h3>
        <p className="text-gray-600 mt-2">Could not load the document preview due to CORS restrictions. You can still print this document using the Print button.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-96 relative overflow-hidden rounded-md border border-gray-200">
      {renderPreview()}
    </div>
  );
};

export default DocumentPreview;