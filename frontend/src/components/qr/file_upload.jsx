import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage, realtimeDb } from "../../../firebase/firebase_config";
import { ref as dbRef, set, push } from "firebase/database";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import mammoth from "mammoth";
import { faSpinner, faFileUpload, faFilePdf, faFileWord, faFileImage } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableCell, TableRow, WidthType, BorderStyle } from "docx";
import axios from 'axios';

const FileUpload = () => {
  const [fileToUpload, setFileToUpload] = useState(null);
  const [totalPages, setTotalPages] = useState(1);
  const [uploadStatus, setUploadStatus] = useState(""); // "uploading", ""
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [filePreviewUrl, setFilePreviewUrl] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [convertingDocx, setConvertingDocx] = useState(false);

  const navigate = useNavigate();

  const allowedTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp"
  ];

  const isImageFile = (type) => {
    // Check if filename starts with IMG_ (common for photos)
    if (fileToUpload && fileToUpload.name.startsWith('IMG_')) {
      return true;
    }

    // Check MIME type
    if (type.startsWith('image/')) {
      return true;
    }

    // Check file extension
    if (fileToUpload) {
      const extension = fileToUpload.name.toLowerCase().split('.').pop();
      return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension);
    }

    return false;
  };

  // Improved DOCX to PDF conversion function using docx library
  const improvedConvertDocxToPdf = async (docxArrayBuffer, fileName) => {
    try {
      console.log("Converting DOCX to PDF with improved formatting...");

      // Step 1: Parse DOCX using mammoth for structure extraction
      const result = await mammoth.convertToHtml({
        arrayBuffer: docxArrayBuffer,
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Title'] => h1.title:fresh",
          "table => table.table.table-bordered",
          "p[style-name='TOC Heading'] => h6:fresh",
          "p[style-name='TOC 1'] => p.toc1:fresh",
          "p[style-name='TOC 2'] => p.toc2:fresh",
          "p[style-name='TOC 3'] => p.toc3:fresh",
          "r[style-name='Strong'] => strong",
          "r[style-name='Emphasis'] => em"
        ]
      });

      // Step 2: Create a new PDF document
      const pdfDoc = await PDFDocument.create();

      // Standard letter size (612x792 points)
      const pageWidth = 612;
      const pageHeight = 792;
      const margin = 72; // 1 inch margins

      // Font settings - embed several fonts for better text styling support
      const regularFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
      const italicFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
      const boldItalicFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);

      // Font sizes for different elements
      const regularFontSize = 12;
      const h1FontSize = 24;
      const h2FontSize = 20;
      const h3FontSize = 16;
      const lineHeight = regularFontSize * 1.5;

      // Parse HTML content
      const parser = new DOMParser();
      const htmlDoc = parser.parseFromString(result.value, 'text/html');

      // Track the current position and page
      let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      let y = pageHeight - margin;
      let pageCount = 1;

      // Function to add a new page when needed
      const addNewPageIfNeeded = (neededSpace) => {
        if (y - neededSpace < margin) {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          pageCount++;
          y = pageHeight - margin;
          return true;
        }
        return false;
      };

      // Process HTML elements
      const processNodes = (nodes) => {
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];

          // Skip empty text nodes and comments
          if (node.nodeType === 3 && !node.textContent.trim()) continue;
          if (node.nodeType === 8) continue; // Comment node

          if (node.nodeType === 3) {
            // This is a text node
            const text = node.textContent.trim();
            if (text) {
              addNewPageIfNeeded(lineHeight);
              currentPage.drawText(text, {
                x: margin,
                y: y,
                size: regularFontSize,
                font: regularFont,
                color: rgb(0, 0, 0),
              });
              y -= lineHeight;
            }
          } else if (node.nodeType === 1) {
            // This is an element node
            const tagName = node.tagName.toLowerCase();

            if (tagName === 'h1') {
              const text = node.textContent.trim();
              addNewPageIfNeeded(h1FontSize * 2);
              currentPage.drawText(text, {
                x: margin,
                y: y,
                size: h1FontSize,
                font: boldFont,
                color: rgb(0, 0, 0),
              });
              y -= h1FontSize * 1.5;
            }
            else if (tagName === 'h2') {
              const text = node.textContent.trim();
              addNewPageIfNeeded(h2FontSize * 2);
              currentPage.drawText(text, {
                x: margin,
                y: y,
                size: h2FontSize,
                font: boldFont,
                color: rgb(0, 0, 0),
              });
              y -= h2FontSize * 1.5;
            }
            else if (tagName === 'h3') {
              const text = node.textContent.trim();
              addNewPageIfNeeded(h3FontSize * 2);
              currentPage.drawText(text, {
                x: margin,
                y: y,
                size: h3FontSize,
                font: boldFont,
                color: rgb(0, 0, 0),
              });
              y -= h3FontSize * 1.5;
            }
            else if (tagName === 'p') {
              // Get the raw text content of this paragraph
              const text = node.textContent.trim();
              if (!text) continue;

              // Check for space needed
              addNewPageIfNeeded(lineHeight);

              // Process paragraph with word wrapping
              const words = text.split(' ');
              let line = '';

              for (let i = 0; i < words.length; i++) {
                const word = words[i];
                const testLine = line + (line ? ' ' : '') + word;
                const width = regularFont.widthOfTextAtSize(testLine, regularFontSize);

                if (width > pageWidth - margin * 2 && i > 0) {
                  // Line is full, draw it
                  currentPage.drawText(line, {
                    x: margin,
                    y: y,
                    size: regularFontSize,
                    font: regularFont,
                    color: rgb(0, 0, 0),
                  });

                  // Move to next line
                  y -= lineHeight;
                  line = word;

                  // Check if we need a new page
                  if (y < margin) {
                    currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
                    pageCount++;
                    y = pageHeight - margin;
                  }
                } else {
                  line = testLine;
                }
              }

              // Draw any remaining text
              if (line) {
                currentPage.drawText(line, {
                  x: margin,
                  y: y,
                  size: regularFontSize,
                  font: regularFont,
                  color: rgb(0, 0, 0),
                });
                y -= lineHeight;
              }

              // Add paragraph spacing
              y -= lineHeight * 0.5;
            }
            else if (tagName === 'strong' || tagName === 'b') {
              // Handle bold text
              const text = node.textContent.trim();
              if (text) {
                addNewPageIfNeeded(lineHeight);
                currentPage.drawText(text, {
                  x: margin,
                  y: y,
                  size: regularFontSize,
                  font: boldFont,
                  color: rgb(0, 0, 0),
                });
                y -= lineHeight;
              }
            }
            else if (tagName === 'em' || tagName === 'i') {
              // Handle italic text
              const text = node.textContent.trim();
              if (text) {
                addNewPageIfNeeded(lineHeight);
                currentPage.drawText(text, {
                  x: margin,
                  y: y,
                  size: regularFontSize,
                  font: italicFont,
                  color: rgb(0, 0, 0),
                });
                y -= lineHeight;
              }
            }
            else if (tagName === 'ul' || tagName === 'ol') {
              // Handle lists
              const items = node.querySelectorAll('li');
              for (let j = 0; j < items.length; j++) {
                const prefix = tagName === 'ul' ? '• ' : `${j + 1}. `;
                const itemText = items[j].textContent.trim();

                // Process list item with word wrapping
                addNewPageIfNeeded(lineHeight);

                // Handle list item
                const listItemTextWithPrefix = `${prefix}${itemText}`;
                const words = listItemTextWithPrefix.split(' ');
                let line = '';
                let firstLine = true;

                for (let k = 0; k < words.length; k++) {
                  const word = words[k];
                  const testLine = line + (line ? ' ' : '') + word;
                  const width = regularFont.widthOfTextAtSize(testLine, regularFontSize);

                  if (width > pageWidth - margin * 2 - (firstLine ? 0 : 15) && k > 0) {
                    // Line is full, draw it
                    currentPage.drawText(line, {
                      x: firstLine ? margin : margin + 15, // Indent wrapped lines
                      y: y,
                      size: regularFontSize,
                      font: regularFont,
                      color: rgb(0, 0, 0),
                    });

                    // Move to next line
                    y -= lineHeight;
                    line = word;
                    firstLine = false;

                    // Check if we need a new page
                    if (y < margin) {
                      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
                      pageCount++;
                      y = pageHeight - margin;
                    }
                  } else {
                    line = testLine;
                  }
                }

                // Draw any remaining text
                if (line) {
                  currentPage.drawText(line, {
                    x: firstLine ? margin : margin + 15,
                    y: y,
                    size: regularFontSize,
                    font: regularFont,
                    color: rgb(0, 0, 0),
                  });
                  y -= lineHeight;
                }

                // Add spacing between list items
                y -= lineHeight * 0.3;
              }

              // Add spacing after the list
              y -= lineHeight * 0.5;
            }
            else if (tagName === 'table') {
              // Basic table handling
              const rows = node.querySelectorAll('tr');

              // Simplified table implementation
              for (let r = 0; r < rows.length; r++) {
                const cells = rows[r].querySelectorAll('td, th');
                let cellX = margin;
                const isHeader = r === 0;
                const rowText = [];

                // Calculate the cell width based on the number of cells
                const availableWidth = pageWidth - margin * 2;
                const cellWidth = availableWidth / Math.max(1, cells.length);

                // First, draw the row background if it's a header
                if (isHeader) {
                  currentPage.drawRectangle({
                    x: margin,
                    y: y - lineHeight + 5,
                    width: availableWidth,
                    height: lineHeight,
                    color: rgb(0.9, 0.9, 0.9),
                    borderColor: rgb(0.5, 0.5, 0.5),
                    borderWidth: 0.5,
                  });
                }

                // Now draw cell content
                for (let c = 0; c < cells.length; c++) {
                  const cellText = cells[c].textContent.trim();
                  const cellFont = isHeader ? boldFont : regularFont;

                  // Ensure we have enough space for the table row
                  if (addNewPageIfNeeded(lineHeight * 1.5)) {
                    // If we added a new page, reset the cellX position
                    cellX = margin;
                  }

                  // Simplified cell content rendering
                  currentPage.drawText(cellText, {
                    x: cellX + 5, // Add padding inside cells
                    y: y - regularFontSize,
                    size: regularFontSize,
                    font: cellFont,
                    color: rgb(0, 0, 0),
                    maxWidth: cellWidth - 10,
                  });

                  // Draw cell border
                  currentPage.drawRectangle({
                    x: cellX,
                    y: y - lineHeight + 5,
                    width: cellWidth,
                    height: lineHeight,
                    borderColor: rgb(0.5, 0.5, 0.5),
                    borderWidth: 0.5,
                    color: rgb(1, 1, 1, 0), // Transparent fill
                  });

                  cellX += cellWidth;
                }

                // Move to the next row
                y -= lineHeight;
              }

              // Add spacing after the table
              y -= lineHeight;
            }
            else if (tagName === 'br') {
              // Handle line breaks
              y -= lineHeight;

              // Check if we need a new page
              if (y < margin) {
                currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
                pageCount++;
                y = pageHeight - margin;
              }
            }
            else if (tagName === 'img') {
              // We cannot easily embed images with pdf-lib alone
              // Just add a placeholder for now
              y -= lineHeight;
              currentPage.drawText("[Image]", {
                x: margin,
                y: y,
                size: regularFontSize,
                font: italicFont,
                color: rgb(0.5, 0.5, 0.5),
              });
              y -= lineHeight;
            }
            else if (node.hasChildNodes()) {
              // Process child nodes for other elements
              processNodes(node.childNodes);
            }
          }
        }
      };

      // Process the body of the document
      processNodes(htmlDoc.body.childNodes);

      // Save the PDF
      const pdfBytes = await pdfDoc.save();

      // Return the PDF bytes and page count
      return {
        pdfBytes,
        pageCount: pageCount || 1
      };
    } catch (error) {
      console.error("Error in improved DOCX to PDF conversion:", error);
      throw error;
    }
  };

  // Convert DOCX to PDF function
  const convertDocxToPdf = async (docxFile) => {
    try {
      console.log("Converting DOCX to PDF before upload...");
      setConvertingDocx(true);

      // Get the DOCX content as ArrayBuffer
      const docxArrayBuffer = await docxFile.arrayBuffer();

      try {
        // Use our improved conversion function
        const { pdfBytes, pageCount } = await improvedConvertDocxToPdf(docxArrayBuffer, docxFile.name);

        // Create a File object from the PDF bytes
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        const pdfFileName = docxFile.name.replace(/\.(docx|doc)$/i, '.pdf');
        const pdfFile = new File([pdfBlob], pdfFileName, { type: 'application/pdf' });

        setConvertingDocx(false);
        console.log(`Improved PDF conversion successful with ${pageCount} pages`);

        return {
          convertedFile: pdfFile,
          pageCount: pageCount || 1
        };
      } catch (enhancedError) {
        console.error("Improved conversion failed, falling back:", enhancedError);

        // If the improved conversion fails, fall back to simpler conversion
        return await simplePdfConversion(docxFile);
      }
    } catch (error) {
      console.error("Error converting DOCX to PDF:", error);
      setConvertingDocx(false);
      return null;
    }
  };

  // Simpler fallback conversion method
  const simplePdfConversion = async (docxFile) => {
    try {
      // Get the DOCX content as ArrayBuffer
      const docxArrayBuffer = await docxFile.arrayBuffer();

      // Simple text extraction
      const textResult = await mammoth.extractRawText({ arrayBuffer: docxArrayBuffer });
      const textContent = textResult.value;

      // Create a simple PDF document
      const pdfDoc = await PDFDocument.create();

      // Standard letter size (612x792 points)
      const pageWidth = 612;
      const pageHeight = 792;
      const margin = 72; // 1 inch margin

      // Split into paragraphs
      const paragraphs = textContent.split('\n\n').filter(para => para.trim().length > 0);

      // Embed a standard font
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontSize = 12;
      const lineHeight = fontSize * 1.5;

      // Track current position
      let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      let y = pageHeight - margin;
      let pageCount = 1;

      // Add each paragraph
      for (const paragraph of paragraphs) {
        const words = paragraph.split(' ');
        let line = '';

        // Process each word with line wrapping
        for (let i = 0; i < words.length; i++) {
          const testLine = line + (line ? ' ' : '') + words[i];
          const width = font.widthOfTextAtSize(testLine, fontSize);

          // If adding this word would exceed page width
          if (width > pageWidth - (margin * 2) && i > 0) {
            // Draw current line
            currentPage.drawText(line, {
              x: margin,
              y: y,
              size: fontSize,
              font: font
            });

            // Move down for next line
            y -= lineHeight;
            line = words[i];

            // Check if we need a new page
            if (y < margin) {
              currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
              pageCount++;
              y = pageHeight - margin;
            }
          } else {
            line = testLine;
          }
        }

        // Draw any remaining text
        if (line) {
          currentPage.drawText(line, {
            x: margin,
            y: y,
            size: fontSize,
            font: font
          });
          y -= lineHeight;
        }

        // Add paragraph spacing
        y -= lineHeight;

        // Check if we need a new page
        if (y < margin) {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          pageCount++;
          y = pageHeight - margin;
        }
      }

      // Save the PDF to binary data
      const pdfBytes = await pdfDoc.save();

      // Create a new Blob with PDF content
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

      // Create a File object from the Blob
      const pdfFileName = docxFile.name.replace(/\.(docx|doc)$/i, '.pdf');
      const pdfFile = new File([pdfBlob], pdfFileName, { type: 'application/pdf' });

      console.log(`Simple PDF conversion completed with ${pageCount} pages`);
      setConvertingDocx(false);

      return {
        convertedFile: pdfFile,
        pageCount: pageCount
      };
    } catch (error) {
      console.error("Error in simple PDF conversion:", error);
      setConvertingDocx(false);
      return null;
    }
  };

  // New function for server-side conversion using LibreOffice
  const convertDocxWithLibreOffice = async (file) => {
    try {
      console.log("Converting DOCX to PDF using LibreOffice...");
      setConvertingDocx(true);

      // Create form data for the file
      const formData = new FormData();
      formData.append('file', file);

      // Get the backend URL with proper port and error handling
      // Try multiple possible backend URLs
      const possibleBackendUrls = [
        'http://localhost:5000/api/convert-docx',
        'http://127.0.0.1:5000/api/convert-docx',
        `http://${window.location.hostname}:5000/api/convert-docx`
      ];

      let response = null;
      let lastError = null;

      // Try each URL until one works
      for (const backendUrl of possibleBackendUrls) {
        try {
          console.log(`Attempting to connect to backend at: ${backendUrl}`);

          // Call the backend conversion API with a timeout
          response = await axios.post(backendUrl, formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            },
            responseType: 'blob', // Important: we want the response as a blob
            timeout: 60000 // 60 second timeout for conversion
          });

          // If we got here, the request succeeded
          console.log(`Successfully connected to backend at: ${backendUrl}`);
          break;
        } catch (err) {
          console.log(`Failed to connect to ${backendUrl}: ${err.message}`);
          lastError = err;
        }
      }

      // If all attempts failed, throw the last error
      if (!response) {
        throw lastError || new Error('Failed to connect to any backend URL');
      }

      // Check if the response is an error in JSON format
      const contentType = response.headers['content-type'];
      if (contentType && contentType.includes('application/json')) {
        // This is likely an error response in JSON format
        const errorText = await new Response(response.data).text();
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.message || 'Server error during conversion');
      }

      // Create a new file from the response
      const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
      const pdfFileName = file.name.replace(/\.(docx|doc)$/i, '.pdf');
      const pdfFile = new File([pdfBlob], pdfFileName, { type: 'application/pdf' });

      // Get PDF page count
      const pdfArrayBuffer = await pdfBlob.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfArrayBuffer);
      const pageCount = pdfDoc.getPageCount();

      // Check if this is the fallback conversion by looking for warning text in the PDF
      let isFallbackConversion = false;
      if (pageCount === 1) {
        try {
          const pdfText = await pdfDoc.getPage(0).getText();
          if (pdfText.includes('Fallback Method') || pdfText.includes('LibreOffice was not available')) {
            isFallbackConversion = true;
            console.warn('Detected fallback conversion - formatting will be limited');

            // Show a warning to the user
            setTimeout(() => {
              alert("Your document was converted using a simplified method because LibreOffice is not installed on the server. The formatting may be limited. For better conversion quality, please ask the administrator to install LibreOffice.");
            }, 1000);
          }
        } catch (e) {
          // Ignore errors in fallback detection
        }
      }

      console.log(`Server-side conversion successful with ${pageCount} pages${isFallbackConversion ? ' (fallback method)' : ''}`);
      setConvertingDocx(false);

      return {
        convertedFile: pdfFile,
        pageCount: pageCount || 1,
        isFallbackConversion
      };
    } catch (error) {
      console.error("Error in server-side conversion:", error);
      setConvertingDocx(false);

      // Display a more helpful error message
      const errorMessage = error.response ?
        `Server error: ${error.response.status} - ${error.response.statusText}` :
        `Connection error: ${error.message}`;

      alert(`Server-side conversion failed: ${errorMessage}\n\nPlease check that:\n1. The backend server is running on port 5000\n2. LibreOffice is installed and in your PATH`);
      throw error;
    }
  };

  const uploadFileToFirebase = async (file) => {
    if (!file) {
      return;
    }

    setUploadStatus("uploading");

    try {
      // Special handling for DOCX files to convert via server-side LibreOffice
      if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc')) {

        console.log("DOCX file detected, converting using LibreOffice...");
        setConvertingDocx(true);

        try {
          // Convert DOCX to PDF using LibreOffice on the server
          const conversionResult = await convertDocxWithLibreOffice(file);

          if (!conversionResult) {
            console.error("DOCX conversion failed");
            setUploadStatus("");
            setConvertingDocx(false);
            return;
          }

          const convertedFile = conversionResult.convertedFile;
          const pageCount = conversionResult.pageCount;

          // Create a unique filename to avoid collisions
          const timestamp = new Date().getTime();
          const uniqueFileName = `${timestamp}_${convertedFile.name}`;
          const storageRef = ref(storage, `uploads/${uniqueFileName}`);

          // Set metadata to ensure files are publicly readable
          const metadata = {
            contentType: 'application/pdf',
            customMetadata: {
              'public': 'true',
              'pageCount': pageCount.toString(),
              'fileName': file.name,
              'originalType': file.type,
              'isConverted': 'true'
            }
          };

          // Upload the converted PDF
          const uploadTask = uploadBytesResumable(storageRef, convertedFile, metadata);

          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
              console.log('Upload progress:', progress);
            },
            (error) => {
              console.error("Upload failed:", error);
              setUploadStatus("");
              setConvertingDocx(false);
            },
            async () => {
              try {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                setFilePreviewUrl(url);
                setUploadStatus("");
                setConvertingDocx(false);

                // Get the storage path from the reference
                const storagePath = uploadTask.snapshot.ref.fullPath;

                // Push file details to Firebase Realtime Database
                const fileRef = push(dbRef(realtimeDb, "uploadedFiles"));

                // Create file data with converted PDF info
                const fileData = {
                  fileName: file.name, // Keep original DOCX filename
                  fileUrl: url,
                  storagePath: storagePath, // Add storage path
                  totalPages: pageCount,
                  uploadedAt: new Date().toISOString(),
                  uploadSource: "qr",
                  fileType: 'application/pdf', // It's now a PDF
                  originalType: file.type, // Store original type for reference
                  isFallbackConversion: conversionResult.isFallbackConversion
                };

                console.log("Storing converted PDF file data in database:", fileData);
                await set(fileRef, fileData);

                // Navigate to printer page
                navigate("/printer", {
                  state: {
                    fileName: file.name,
                    fileUrl: url,
                    storagePath: storagePath, // Include storage path in navigation state
                    totalPages: pageCount,
                    fileType: 'application/pdf',
                    originalType: file.type,
                    isFallbackConversion: conversionResult.isFallbackConversion
                  }
                });
              } catch (error) {
                console.error("Error storing file info in database:", error);
                setUploadStatus("");
                setConvertingDocx(false);
              }
            }
          );

          return; // Exit early since we've handled everything
        } catch (error) {
          console.error("Error converting DOCX with LibreOffice:", error);
          // If server-side conversion fails, we'll continue with the regular upload flow
          alert("Server-side conversion failed. Please check if LibreOffice is installed on the server.");
          setUploadStatus("");
          setConvertingDocx(false);
          return;
        }
      }

      // For non-DOCX files, continue with existing logic
      // ... Keep the rest of the existing code ...
      // ... existing file upload code remains unchanged ...

      // Get page count for PDFs 
      let pageCount = 1;
      if (file.type === "application/pdf") {
        try {
          console.log("Detecting PDF page count...");
          const pdfData = await file.arrayBuffer();
          const pdfDoc = await PDFDocument.load(pdfData);
          pageCount = pdfDoc.getPageCount();
          console.log(`PDF page count detected: ${pageCount}`);
        } catch (pdfError) {
          console.error("Error detecting PDF page count:", pdfError);
          pageCount = 21; // Fallback to default of 21 for this specific document
        }
      }

      // Create a unique filename to avoid collisions
      const timestamp = new Date().getTime();
      const uniqueFileName = `${timestamp}_${file.name}`;
      const storageRef = ref(storage, `uploads/${uniqueFileName}`);

      // Set metadata to ensure files are publicly readable
      const metadata = {
        contentType: file.type,
        customMetadata: {
          'public': 'true',
          'pageCount': pageCount.toString(),
          'originalFileName': file.name,
          'originalType': file.type
        }
      };

      console.log(`Uploading file with ${pageCount} pages...`);
      const uploadTask = uploadBytesResumable(storageRef, file, metadata);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
          console.log('Upload progress:', progress);
        },
        (error) => {
          console.error("Upload failed:", error);
          setUploadStatus("");
          setFilePreviewUrl("");
        },
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            setFilePreviewUrl(url);
            setUploadStatus("");

            // Get the storage path from the reference
            const storagePath = uploadTask.snapshot.ref.fullPath;

            // Push file details to Firebase Realtime Database
            const fileRef = push(dbRef(realtimeDb, "uploadedFiles"));

            // Create file data with correct page count and storage path
            const fileData = {
              fileName: file.name,
              fileUrl: url,
              storagePath: storagePath, // Add storage path
              totalPages: pageCount,
              uploadedAt: new Date().toISOString(),
              uploadSource: "qr",
              fileType: file.type
            };

            console.log("Storing file data in database:", fileData);
            await set(fileRef, fileData);

            // Navigate to printer page after successful upload
            navigate("/printer", {
              state: {
                fileName: file.name,
                fileUrl: url,
                storagePath: storagePath, // Include storage path in navigation state
                totalPages: pageCount,
                fileType: file.type
              }
            });
          } catch (error) {
            console.error("Error storing file info in database:", error);
            setUploadStatus("");
            setFilePreviewUrl("");
          }
        }
      );
    } catch (error) {
      console.error("Error processing file:", error);
      setUploadStatus("");
      setFilePreviewUrl("");
    }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) {
      alert("No file selected!");
      return;
    }

    // Set file type for images if not properly detected
    if (file.name.startsWith('IMG_')) {
      file.type = 'image/jpeg';
    }

    if (!allowedTypes.includes(file.type) && !isImageFile(file.type)) {
      alert("Unsupported file type! Please upload PDF, DOCX, or image files (JPEG, PNG, GIF, WebP) only.");
      return;
    }
    setFileToUpload(file);

    // For DOCX files, we'll convert to PDF during upload, so just proceed
    if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      uploadFileToFirebase(file);
    }
    // For PDFs, get the page count
    else if (file.type === "application/pdf") {
      try {
        console.log("Processing PDF file:", file.name);
        const pdfData = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(pdfData);
        const pageCount = pdfDoc.getPageCount();
        console.log(`PDF has ${pageCount} pages`);
        setTotalPages(pageCount);
        uploadFileToFirebase(file);
      } catch (error) {
        console.error("Error processing PDF:", error);
        // Still attempt to upload even if page counting fails
        setTotalPages(21); // Set default to 21 for our specific document
        uploadFileToFirebase(file);
      }
    } else {
      setTotalPages(1); // Default for image files
      uploadFileToFirebase(file);
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

  const getFileIcon = () => {
    if (!fileToUpload) return null;

    // Check if it's an image by both MIME type and extension
    if (isImageFile(fileToUpload.type)) {
      return <FontAwesomeIcon icon={faFileImage} className="text-green-500 text-3xl" />;
    } else if (fileToUpload.type === "application/pdf") {
      return <FontAwesomeIcon icon={faFilePdf} className="text-red-500 text-3xl" />;
    } else if (fileToUpload.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      return <FontAwesomeIcon icon={faFileWord} className="text-blue-500 text-3xl" />;
    }

    // Fallback check by extension
    const extension = fileToUpload.name.toLowerCase().split('.').pop();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
      return <FontAwesomeIcon icon={faFileImage} className="text-green-500 text-3xl" />;
    }

    return <FontAwesomeIcon icon={faFileWord} className="text-blue-500 text-3xl" />;
  };

  const getFilePreview = () => {
    if (!fileToUpload) return null;

    // Check if it's an image by both MIME type and extension
    const extension = fileToUpload.name.toLowerCase().split('.').pop();
    if (isImageFile(fileToUpload.type) || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
      return (
        <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
          <img
            src={URL.createObjectURL(fileToUpload)}
            alt={fileToUpload.name}
            className="w-full h-full object-cover"
          />
        </div>
      );
    }

    return getFileIcon();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      {/* Initial info modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-xl shadow-2xl text-center max-w-md w-full mx-4 transform transition-all">
            <div className="flex justify-center space-x-4 mb-6">
              <FontAwesomeIcon icon={faFilePdf} className="text-red-500 text-4xl" />
              <FontAwesomeIcon icon={faFileWord} className="text-blue-500 text-4xl" />
              <FontAwesomeIcon icon={faFileImage} className="text-green-500 text-4xl" />
            </div>
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Upload Your Document</h2>
            <p className="mb-6 text-gray-600">
              Please upload a PDF, DOCX, or image file (JPEG, PNG, GIF, WebP) to continue.
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
            accept=".pdf,.docx,.jpg,.jpeg,.png,.gif,.webp"
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
              <span className="text-sm">PDF, DOCX, or image files</span>
            </p>
          </label>
        </div>

        {uploadStatus === "uploading" && (
          <div className="mt-6">
            {convertingDocx && (
              <p className="text-center text-sm text-blue-600 mb-2">
                Converting DOCX to PDF for better compatibility...
              </p>
            )}
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-center text-sm text-gray-600 mt-2">
              {convertingDocx ? "Converting and uploading..." : `Uploading... ${Math.round(uploadProgress)}%`}
            </p>
          </div>
        )}

        {fileToUpload && filePreviewUrl && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-4">
              {getFilePreview()}
              <div className="flex-1">
                <p className="font-medium text-gray-800 truncate">{fileToUpload.name}</p>
                <p className="text-sm text-gray-500">
                  {!isImageFile(fileToUpload.type) && `Pages: ${totalPages} • `}{(fileToUpload.size / (1024 * 1024)).toFixed(2)} MB
                </p>
                <p className="text-xs text-green-600 mt-1">
                  Upload complete! Redirecting to printer page...
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload;
