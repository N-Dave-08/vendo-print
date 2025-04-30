import React, { useState, useEffect } from "react";
import { Loader } from "lucide-react";
import { getStorage, ref, getBlob, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../../firebase/firebase_config";
import mammoth from "mammoth";
import { PDFDocument, StandardFonts } from "pdf-lib";
import axios from "axios";

const DocumentPreview = ({ 
  fileUrl, 
  url, // Add url parameter for backward compatibility
  fileName, 
  fileToUpload,
  className,
  onDocumentLoad,
  externalViewerUrl,
  useExternalViewer
}) => {
  const [viewerError, setViewerError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [blobUrl, setBlobUrl] = useState(null);
  const [docxHtml, setDocxHtml] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [conversionStatus, setConversionStatus] = useState('');
  const [convertingDocx, setConvertingDocx] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Use url as fallback if fileUrl is not provided
  const documentUrl = fileUrl || url;
  
  // Get file extension from fileName or from URL
  let fileExtension = '';
  if (fileName) {
    fileExtension = fileName.split('.').pop().toLowerCase();
  } else if (documentUrl) {
    // Try to get extension from URL
    const urlPath = typeof documentUrl === 'string' ? documentUrl : '';
    if (urlPath) {
      // Try to extract extension from URL path
      const matches = urlPath.match(/\.([a-zA-Z0-9]+)($|\?|#)/);
      if (matches && matches[1]) {
        fileExtension = matches[1].toLowerCase();
      }
    }
  }
  
  // Force PDF extension if the URL contains .pdf
  if (documentUrl && typeof documentUrl === 'string' && documentUrl.toLowerCase().includes('.pdf')) {
    fileExtension = 'pdf';
  }
  
  console.log("File extension detected:", fileExtension);
  console.log("Document URL:", documentUrl);
  
  // Helper function to check if an URL points to a document with original DOCX available
  const checkForOriginalDocx = async (url) => {
    try {
      // If the url already contains 'original_', it's likely the original DOCX
      if (url && typeof url === 'string' && url.includes('original_') &&
        (url.includes('.docx') || url.includes('.doc'))) {
        return url;
      }

      // If we have originalDocUrl directly in props
      if (documentUrl && typeof documentUrl === 'object' && documentUrl.originalDocUrl) {
        return documentUrl.originalDocUrl;
      }

      return null;
    } catch (error) {
      console.error("Error checking for original document:", error);
      return null;
    }
  };

  // Function to handle DOCX display with better formatting
  const displayDocxWithFormatting = async (arrayBuffer, fallbackToText = false) => {
    try {
      // If we want direct HTML display instead of PDF conversion
      if (fallbackToText) {
        // Convert DOCX to HTML with formatting options
        const result = await mammoth.convertToHtml({
          arrayBuffer,
          options: {
            styleMap: [
              "p[style-name='Heading 1'] => h1:fresh",
              "p[style-name='Heading 2'] => h2:fresh",
              "p[style-name='Heading 3'] => h3:fresh",
              "p[style-name='Title'] => h1.title:fresh",
              "table => table.table.table-bordered",
              "r[style-name='Strong'] => strong",
              "r[style-name='Emphasis'] => em"
            ]
          }
        });

        // Add some basic CSS for formatting
        const styledHtml = `
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.5; }
            h1 { font-size: 1.8em; margin-top: 1em; margin-bottom: 0.5em; }
            h2 { font-size: 1.5em; margin-top: 1em; margin-bottom: 0.5em; }
            h3 { font-size: 1.3em; margin-top: 1em; margin-bottom: 0.5em; }
            p { margin-bottom: 0.8em; }
            table { border-collapse: collapse; width: 100%; margin: 1em 0; }
            table, th, td { border: 1px solid #ddd; }
            th, td { padding: 8px; text-align: left; }
            strong { font-weight: bold; }
            em { font-style: italic; }
            ul, ol { margin-left: 2em; margin-bottom: 1em; }
            li { margin-bottom: 0.3em; }
            img { max-width: 100%; height: auto; }
          </style>
          ${result.value}
        `;

        // Set the HTML content for rendering
        setDocxHtml(styledHtml);
        return null; // No PDF URL since we're using HTML rendering
      }

      // Otherwise proceed with HTML-based PDF conversion for better formatting
      try {
        // Convert to HTML with formatting options 
        const result = await mammoth.convertToHtml({
          arrayBuffer,
          options: {
            styleMap: [
              "p[style-name='Heading 1'] => h1:fresh",
              "p[style-name='Heading 2'] => h2:fresh",
              "p[style-name='Heading 3'] => h3:fresh",
              "p[style-name='Title'] => h1.title:fresh",
              "table => table.table.table-bordered",
              "r[style-name='Strong'] => strong"
            ]
          }
        });

        // Extract structured content with formatting
        const htmlContent = result.value;

        // Create PDF document
        const pdfDoc = await PDFDocument.create();

        // Standard letter size
        const pageWidth = 612;
        const pageHeight = 792;

        // Smaller margins for better content fit
        const margin = 50;

        // Font settings
        const fontSize = 11;
        const titleFontSize = 16;
        const headingFontSize = 14;
        const lineHeight = fontSize * 1.5;

        // Embed fonts
        const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // Track position and pages
        let pageCount = 1;
        let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        let yPosition = pageHeight - margin;

        // Create a DOM parser to process the HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const elements = doc.body.children;

        // Process each HTML element
        for (let i = 0; i < elements.length; i++) {
          const element = elements[i];
          const tagName = element.tagName.toLowerCase();
          const text = element.textContent.trim();

          if (!text) continue; // Skip empty elements

          // Check if we need a new page
          if (yPosition < margin + lineHeight * 2) {
            currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
            pageCount++;
            yPosition = pageHeight - margin;
          }

          // Process different element types
          if (tagName === 'h1') {
            // Draw heading with bold font and larger size
            currentPage.drawText(text, {
              x: margin,
              y: yPosition,
              size: titleFontSize,
              font: boldFont
            });
            yPosition -= titleFontSize * 1.8;
          }
          else if (tagName === 'h2' || tagName === 'h3') {
            // Draw subheading
            currentPage.drawText(text, {
              x: margin,
              y: yPosition,
              size: headingFontSize,
              font: boldFont
            });
            yPosition -= headingFontSize * 1.6;
          }
          else if (tagName === 'p') {
            // Process paragraph with word wrapping
            const words = text.split(' ');
            let line = '';

            for (let i = 0; i < words.length; i++) {
              const testLine = line + (line ? ' ' : '') + words[i];
              const width = regularFont.widthOfTextAtSize(testLine, fontSize);

              if (width > pageWidth - (margin * 2) && i > 0) {
                // Line is full, draw it
                currentPage.drawText(line, {
                  x: margin,
                  y: yPosition,
                  size: fontSize,
                  font: regularFont
                });

                // Move to next line
                yPosition -= lineHeight;
                line = words[i];

                // Check if we need a new page
                if (yPosition < margin) {
                  currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
                  pageCount++;
                  yPosition = pageHeight - margin;
                }
              } else {
                line = testLine;
              }
            }

            // Draw any remaining text
            if (line) {
              currentPage.drawText(line, {
                x: margin,
                y: yPosition,
                size: fontSize,
                font: regularFont
              });
              yPosition -= lineHeight;
            }

            // Add paragraph spacing
            yPosition -= lineHeight / 2;
          }
          else if (tagName === 'ul' || tagName === 'ol') {
            // Process lists
            const items = element.querySelectorAll('li');
            for (let j = 0; j < items.length; j++) {
              const itemText = items[j].textContent.trim();

              // Add bullet or number
              const prefix = tagName === 'ul' ? '• ' : `${j + 1}. `;

              // Process list item with word wrapping
              const words = (prefix + itemText).split(' ');
              let line = '';
              let firstLine = true;

              for (let k = 0; k < words.length; k++) {
                const testLine = line + (line ? ' ' : '') + words[k];
                const width = regularFont.widthOfTextAtSize(testLine, fontSize);

                if (width > pageWidth - (margin * 2) - (firstLine ? 0 : 15) && k > 0) {
                  // Line is full, draw it
                  currentPage.drawText(line, {
                    x: firstLine ? margin : margin + 15, // Indent continuation lines
                    y: yPosition,
                    size: fontSize,
                    font: regularFont
                  });

                  // Move to next line
                  yPosition -= lineHeight;
                  line = words[k];
                  firstLine = false;

                  // Check if we need a new page
                  if (yPosition < margin) {
                    currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
                    pageCount++;
                    yPosition = pageHeight - margin;
                  }
                } else {
                  line = testLine;
                }
              }

              // Draw any remaining text
              if (line) {
                currentPage.drawText(line, {
                  x: firstLine ? margin : margin + 15,
                  y: yPosition,
                  size: fontSize,
                  font: regularFont
                });
                yPosition -= lineHeight;
              }

              // Add some spacing between list items
              yPosition -= lineHeight / 3;

              // Check if we need a new page
              if (yPosition < margin) {
                currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
                pageCount++;
                yPosition = pageHeight - margin;
              }
            }

            // Add extra spacing after list
            yPosition -= lineHeight / 2;
          }
        }

        // Save the PDF
        const pdfBytes = await pdfDoc.save();

        // Upload the PDF to Firebase (temporary storage)
        const pdfFileName = fileName.replace(/\.(docx|doc)$/i, '.pdf');
        const pdfRef = ref(storage, `temp/${Date.now()}_${pdfFileName}`);

        // Create a blob from the PDF bytes
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

        // Upload the blob
        await uploadBytes(pdfRef, pdfBlob);

        // Get download URL
        const pdfDownloadUrl = await getDownloadURL(pdfRef);
        console.log("Enhanced PDF preview conversion completed with", pageCount, "pages");

        return pdfDownloadUrl;
      } catch (error) {
        console.error("Enhanced PDF conversion failed:", error);
        throw error; // Re-throw to let caller try fallback methods
      }
    } catch (error) {
      console.error("DOCX display error:", error);
      return null;
    }
  };

  // Modify the convertWithLibreOffice function to handle status updates
  const convertWithLibreOffice = async (docxUrl, docxFileName) => {
    let retryCount = 0;
    const maxRetries = 5;
    
    while (retryCount < maxRetries) {
      try {
        console.log("Converting DOCX to PDF using LibreOffice...");
        setConvertingDocx(true);
        setConversionStatus('Converting document...');

        const response = await axios.post('http://localhost:5000/api/convert-docx-from-url', {
          fileUrl: docxUrl,
          fileName: docxFileName
        });

        // Handle successful conversion
        if (response.data.status === 'success') {
          if (response.data.pdfUrl) {
            console.log("LibreOffice conversion successful");
            setConvertingDocx(false);
            setConversionStatus('Conversion successful');
            return response.data.pdfUrl;
          }
          
          // If conversion is in progress, wait and retry
          if (response.data.inProgress) {
            console.log("Conversion in progress, waiting...");
            setConversionStatus('Converting document...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            retryCount++;
            continue;
          }
        }
      } catch (error) {
        console.log("Conversion attempt failed, retrying...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        retryCount++;
        
        if (retryCount === maxRetries) {
          console.log("Max retries reached, continuing without conversion");
          setConvertingDocx(false);
          setConversionStatus('');
          return null;
        }
        continue;
      }
    }
    
    setConvertingDocx(false);
    setConversionStatus('');
    return null;
  };

  // Modify the processDocxFile function to handle conversion status better
  const processDocxFile = async () => {
    try {
      if (['doc', 'docx'].includes(fileExtension)) {
        // First try to get the original DOCX URL
        const originalDocxUrl = await checkForOriginalDocx(documentUrl);
        const docxUrl = originalDocxUrl || documentUrl;

        if (docxUrl) {
          try {
            // Try server-side LibreOffice conversion first
            const pdfUrl = await convertWithLibreOffice(docxUrl, fileName);
            if (pdfUrl) {
              console.log("Using LibreOffice converted PDF");
              setPdfUrl(pdfUrl);
              setLoading(false);
              return true;
            }
          } catch (libreOfficeError) {
            // Only log and fall back for non-409 errors
            if (!libreOfficeError.response || libreOfficeError.response.status !== 409) {
              console.error("LibreOffice conversion failed:", libreOfficeError);
              // If LibreOffice fails, fall back to Office Online Viewer
              console.log("Falling back to Office Online Viewer");
              const encodedFileUrl = encodeURIComponent(docxUrl);
              const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodedFileUrl}`;
              setBlobUrl(officeViewerUrl);
              setLoading(false);
              return true;
            }
          }
        }
      }
      return false;
    } catch (error) {
      console.error("Error in DOCX processing:", error);
      return false;
    }
  };

  // Modify the handleLocalFile function to use LibreOffice conversion
  const handleLocalFile = async () => {
    try {
      console.log("Using local file directly:", fileToUpload.name);

      // If it's a DOCX file, process it
      if (['doc', 'docx'].includes(fileExtension)) {
        try {
          // First upload the file to get a URL
          const fileRef = ref(storage, `uploads/${Date.now()}_${fileToUpload.name}`);
          await uploadBytes(fileRef, fileToUpload);
          const docxUrl = await getDownloadURL(fileRef);

          // Convert using LibreOffice
          const pdfUrl = await convertWithLibreOffice(docxUrl, fileToUpload.name);
          if (pdfUrl) {
            setPdfUrl(pdfUrl);
            setLoading(false);
            return;
          }

          throw new Error('PDF conversion failed');
        } catch (error) {
          console.error("Failed to process DOCX file:", error);
          setViewerError(true);
          setLoading(false);
        }
        return;
      }

      // For other file types, create an object URL
      const url = URL.createObjectURL(fileToUpload);
      setBlobUrl(url);
      setLoading(false);
    } catch (error) {
      console.error("Error creating URL from local file:", error);
      setViewerError(true);
      setLoading(false);
    }
  };

  useEffect(() => {
    // Reset state
    setLoading(true);
    setViewerError(false);
    setDocxHtml(null);
    setPdfUrl(null);

    if (!documentUrl && !fileToUpload) {
      setLoading(false);
      return;
    }
    
    // Prioritize PDF handling - if it's a PDF, render it directly
    if (fileExtension === 'pdf' || (documentUrl && typeof documentUrl === 'string' && documentUrl.toLowerCase().includes('.pdf'))) {
      console.log("Direct PDF detection - using PDF viewer");
      // For PDF files, use direct PDF URL
      setPdfUrl(documentUrl);
      setLoading(false);
      
      // Notify parent about loaded document
      if (typeof onDocumentLoad === 'function') {
        // Use timeout to ensure the UI updates first
        setTimeout(() => {
          onDocumentLoad({ status: 'success', numPages: 1 });
        }, 100);
      }
      return;
    }
    
    // Special handling for DOCX files to prioritize the Office Online Viewer
    processDocxFile().then(handled => {
      if (handled) return;

      // If we have a local file, use it directly
      if (fileToUpload) {
        handleLocalFile();
        return;
      }

      // For remote files, try direct embedding first
      if (documentUrl) {
        if (['doc', 'docx'].includes(fileExtension)) {
          // For DOCX files, try to convert to PDF
          const fetchAndProcessDocx = async () => {
            try {
              console.log("Attempting to fetch and process DOCX:", documentUrl);

              // Check if the URL ends with .pdf despite having a DOCX extension in the filename
              // This indicates it might be a converted DOCX file
              if (typeof documentUrl === 'string' && documentUrl.toLowerCase().includes('.pdf')) {
                console.log("This appears to be a converted DOCX file, treating as PDF");
                setPdfUrl(documentUrl);
                setLoading(false);
                return;
              }

              // Try to fetch the file as a blob first
              try {
                const actualUrl = typeof documentUrl === 'string' ? documentUrl :
                  (documentUrl.fileUrl ? documentUrl.fileUrl : '');

                if (!actualUrl) {
                  throw new Error("Invalid URL");
                }

                // Simple direct fetch attempt - this might fail due to CORS
                const response = await fetch(actualUrl, { mode: 'cors' });
                if (response.ok) {
                  const blob = await response.blob();
                  const arrayBuffer = await blob.arrayBuffer();

                  // Try to convert DOCX to PDF
                  const pdfUrl = await displayDocxWithFormatting(arrayBuffer);
                  if (pdfUrl) {
                    setPdfUrl(pdfUrl);
                    setLoading(false);
                    return;
                  }
                }
              } catch (fetchError) {
                console.log("Direct fetch failed, falling back to simple display:", fetchError);
              }

              // If direct fetch or conversion fails, fall back to a message
              setDocxHtml('<div class="flex justify-center items-center h-full"><p>DOCX preview is not available. Please use the Open File button below to view the document.</p></div>');
              setLoading(false);
            } catch (error) {
              console.error("Error processing DOCX file:", error);
              setViewerError(true);
              setLoading(false);
            }
          };

          fetchAndProcessDocx();
        } else {
          // For other file types, use direct URL
          const actualUrl = typeof documentUrl === 'string' ? documentUrl :
            (documentUrl.fileUrl ? documentUrl.fileUrl : '');

          if (actualUrl) {
            setBlobUrl(actualUrl);
            setLoading(false);
          } else {
            setViewerError(true);
            setLoading(false);
          }
        }
      }
    });

    // Cleanup function to revoke blob URL when component unmounts
    return () => {
      if (blobUrl && typeof blobUrl === 'string' && typeof documentUrl === 'string' && blobUrl !== documentUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [documentUrl, fileToUpload, fileExtension, fileName]);

  if (!documentUrl && !fileToUpload) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="text-center p-6">
          <p className="text-base-content/70">No document selected</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-600">{conversionStatus || 'Loading...'}</p>
        </div>
      </div>
    );
  }

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-600">{conversionStatus || 'Loading...'}</p>
          </div>
        </div>
      );
    }

    // For DOCX files converted to PDF or direct PDF files
    if ((fileExtension === 'pdf' || ['doc', 'docx'].includes(fileExtension)) && pdfUrl) {
      // Add event handlers for iframe loading
      const handleIframeLoad = () => {
        setLoading(false);
        // Call onDocumentLoad when PDF is loaded
        if (typeof onDocumentLoad === 'function') {
          onDocumentLoad({ status: 'success', numPages: 1 });
        }
      };

      const handleIframeError = () => {
        setViewerError(true);
        setLoading(false);
        if (typeof onDocumentLoad === 'function') {
          onDocumentLoad({ status: 'error' });
        }
      };

      return (
        <iframe
          src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&paperSize=letter&pagemode=thumbs&view=FitH&scale=100&printScale=fit-to-page`}
          className="w-full h-full border-none"
          title="PDF Preview"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      );
    }

    // For DOCX files with HTML content (fallback)
    if (docxHtml) {
      return (
        <div className="w-full h-full overflow-auto p-4">
          <div
            className="docx-preview"
            dangerouslySetInnerHTML={{ __html: docxHtml }}
          />
          <style>{`
            .docx-preview {
              font-family: 'Calibri', 'Arial', sans-serif;
              line-height: 1.5;
              max-width: 800px;
              margin: 0 auto;
            }
            .docx-preview h1 {
              font-size: 24px;
              font-weight: bold;
              margin: 24px 0 12px;
            }
            .docx-preview h2 {
              font-size: 20px;
              font-weight: bold;
              margin: 20px 0 10px;
            }
            .docx-preview h3 {
              font-size: 16px;
              font-weight: bold;
              margin: 16px 0 8px;
            }
            .docx-preview p {
              margin: 12px 0;
            }
            .docx-preview strong {
              font-weight: bold;
            }
            .docx-preview em {
              font-style: italic;
            }
          `}</style>
          <div className="text-center mt-4">
            <a
              href={documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-100 text-blue-600 rounded-md text-sm hover:bg-blue-200 transition-all"
            >
              Open file in new window
            </a>
          </div>
        </div>
      );
    }

    // For PDF files - direct embedding
    if (fileExtension === 'pdf' || (documentUrl && typeof documentUrl === 'string' && documentUrl.toLowerCase().includes('.pdf'))) {
      // Add event handlers for iframe loading
      const handleIframeLoad = () => {
        setLoading(false);
        // Call onDocumentLoad when PDF is loaded
        if (typeof onDocumentLoad === 'function') {
          onDocumentLoad({ status: 'success', numPages: 1 });
        }
      };

      const handleIframeError = () => {
        setViewerError(true);
        setLoading(false);
        if (typeof onDocumentLoad === 'function') {
          onDocumentLoad({ status: 'error' });
        }
      };

      // Use the documentUrl directly for PDFs
      const pdfViewerUrl = pdfUrl || documentUrl;
      
      console.log("Rendering PDF with URL:", pdfViewerUrl);
      
      return (
        <iframe
          src={`${pdfViewerUrl}#toolbar=0&navpanes=0&scrollbar=0&paperSize=letter&pagemode=thumbs&view=FitH&scale=100&printScale=fit-to-page`}
          className="w-full h-full border-none"
          title="PDF Preview"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      );
    }

    // For image files
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension) && (blobUrl || documentUrl)) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <img
            src={blobUrl || documentUrl}
            alt={fileName}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      );
    }

    // For files where we couldn't render a preview
    let iconColor = 'text-blue-500';
    let iconLetter = 'F';  // Default is generic file
    let fileTypeName = "file";

    // Set appropriate icon and type name based on file extension
    if (['doc', 'docx'].includes(fileExtension)) {
      iconColor = 'text-blue-500';
      iconLetter = 'W';
      fileTypeName = "Word document";
    } else if (['ppt', 'pptx'].includes(fileExtension)) {
      iconColor = 'text-orange-500';
      iconLetter = 'P';
      fileTypeName = "PowerPoint presentation";
    } else if (['xls', 'xlsx'].includes(fileExtension)) {
      iconColor = 'text-green-500';
      iconLetter = 'X';
      fileTypeName = "Excel spreadsheet";
    } else if (fileExtension === 'pdf') {
      iconColor = 'text-red-500';
      iconLetter = 'P';
      fileTypeName = "PDF document";
    } else if (fileExtension === 'txt') {
      iconColor = 'text-gray-500';
      iconLetter = 'T';
      fileTypeName = "Text file";
    }

    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
        <div className={`w-20 h-24 relative mb-4`}>
          <div className="absolute inset-0 bg-white border border-gray-200 rounded-xs shadow-sm"></div>
          <div className={`absolute left-0 top-0 w-12 h-12 bg-${iconColor.replace('text-', '')} flex items-center justify-center`}>
            <span className="text-white font-bold text-2xl">{iconLetter}</span>
          </div>
          <div className="absolute right-4 bottom-3 flex flex-col items-start space-y-1">
            <div className={`w-10 h-0.5 ${iconColor}`}></div>
            <div className={`w-10 h-0.5 ${iconColor}`}></div>
            <div className={`w-10 h-0.5 ${iconColor}`}></div>
          </div>
        </div>
        <p className="text-sm font-medium text-gray-800">{fileName || 'Document'}</p>
        <p className="text-xs text-gray-500 mt-1">Preview not available for this {fileTypeName}</p>
        <p className="text-xs text-gray-400 mt-1">Use the button below to open it</p>
        {documentUrl && (
          <a
            href={documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 px-4 py-2 bg-blue-100 text-blue-600 rounded-md text-sm hover:bg-blue-200 transition-all"
          >
            Open file in new window
          </a>
        )}
      </div>
    );
  };

  // Check if we should use external viewer instead
  if (useExternalViewer && externalViewerUrl) {
    return (
      <iframe
        src={externalViewerUrl}
        className={`w-full h-full border-none ${className || ''}`}
        title="External Document Preview"
        onLoad={() => {
          setLoading(false);
          if (typeof onDocumentLoad === 'function') {
            onDocumentLoad({ status: 'success', numPages: 1 });
          }
        }}
      />
    );
  }

  // Add error dialog component to the render
  const renderErrorDialog = () => {
    if (!showErrorDialog) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md">
          <h3 className="text-lg font-semibold mb-4">Conversion Error</h3>
          <p className="text-gray-600 mb-4">{errorMessage}</p>
          <div className="flex justify-end">
            <button
              onClick={() => setShowErrorDialog(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Update the return statement to include the error dialog
  return (
    <div className="w-full h-full bg-gray-50 overflow-hidden">
      {renderErrorDialog()}
      {!documentUrl && (
        <div className="flex flex-col items-center justify-center h-full">
          <p className="text-gray-500">Uploading...</p>
        </div>
      )}
      {viewerError ? (
        <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
          <p className="mb-4 text-center">Unable to load preview</p>
          {/* PDF direct embed fallback for error cases */}
          {fileExtension === 'pdf' && documentUrl && (
            <div className="w-full h-[80%] px-4">
              <iframe
                src={`${documentUrl}#toolbar=0&navpanes=0&scrollbar=0&paperSize=letter&pagemode=thumbs&view=FitH&scale=100&printScale=fit-to-page`}
                className="w-full h-full border-none"
                title="PDF Preview"
              />
            </div>
          )}
          {documentUrl && (
            <a
              href={documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 px-4 py-2 bg-blue-100 text-blue-600 rounded-md text-sm hover:bg-blue-200 transition-all"
            >
              Open in new window
            </a>
          )}
        </div>
      ) : (
        renderPreview()
      )}
    </div>
  );
};

export default DocumentPreview;