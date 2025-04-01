import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { Printer, ArrowLeft, X } from "lucide-react";
import MiniNav from "../components/MiniNav";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import CustomPage from "../components/common/customized_page";
import DocumentPreview from "../components/common/document_preview";
import SmartPriceToggle from "../components/common/smart_price";
import PrinterList from "../components/usb/printerList";
import SelectColor from "../components/usb/select_color";

import { realtimeDb, storage } from "../../firebase/firebase_config";
import { ref as dbRef, push, get, update, set } from "firebase/database";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { onValue } from "firebase/database";
import axios from "axios";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import mammoth from "mammoth";

import { getPageIndicesToPrint } from "../utils/pageRanges";
import Header from "../components/headers/Header";
import ClientContainer from "../components/containers/ClientContainer";

const Usb = () => {
  const navigate = useNavigate();

  const [filePreviewUrl, setFilePreviewUrl] = useState("");
  const [fileToUpload, setFileToUpload] = useState(null);
  const [copies, setCopies] = useState(1);
  const [selectedSize, setSelectedSize] = useState("Short Bond");
  const [isColor, setIsColor] = useState(false);
  const [orientation, setOrientation] = useState("portrait");
  const [selectedPageOption, setSelectedPageOption] = useState("All");
  const [customPageRange, setCustomPageRange] = useState("");
  const [totalPages, setTotalPages] = useState(1);
  const [isSmartPriceEnabled, setIsSmartPriceEnabled] = useState(false);
  const [calculatedPrice, setCalculatedPrice] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [availableCoins, setAvailableCoins] = useState(0);

  // Add print status state
  const [printStatus, setPrintStatus] = useState("");
  const [printProgress, setPrintProgress] = useState(0);

  // Guide modal state
  const [showModal, setShowModal] = useState(false);

  // Add a state variable to track if we're using an external viewer
  const [useExternalViewer, setUseExternalViewer] = useState(false);
  const [externalViewerUrl, setExternalViewerUrl] = useState("");

  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [printerCapabilities, setPrinterCapabilities] = useState(null);

  // Improved DOCX to PDF conversion function
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
  const convertDocxToPdf = async (file) => {
    try {
      setIsLoading(true);
      console.log("Converting DOCX to PDF before upload...");

      // Get the DOCX content as ArrayBuffer
      const docxArrayBuffer = await file.arrayBuffer();

      try {
        // Use our improved conversion function
        const { pdfBytes, pageCount } = await improvedConvertDocxToPdf(docxArrayBuffer, file.name);

        // Create a File object from the PDF bytes
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        const pdfFileName = file.name.replace(/\.(docx|doc)$/i, '.pdf');
        const pdfFile = new File([pdfBlob], pdfFileName, { type: 'application/pdf' });

        setIsLoading(false);
        console.log(`Improved PDF conversion successful with ${pageCount} pages`);

        return {
          convertedFile: pdfFile,
          pageCount: pageCount || 1
        };
      } catch (enhancedError) {
        console.error("Improved conversion failed, falling back to simple conversion:", enhancedError);

        // Fallback to simpler conversion if advanced conversion fails
        const result = await mammoth.extractRawText({ arrayBuffer: docxArrayBuffer });
        const text = result.value;

        // Create a simple PDF with the text
        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontSize = 12;
        const margin = 50;
        const lineHeight = fontSize * 1.2;

        // Split text into lines and draw on the page
        const textLines = text.split('\n');
        let y = height - margin;
        let pageCount = 1;

        for (const line of textLines) {
          if (y < margin + fontSize) {
            // Add a new page if needed
            page = pdfDoc.addPage();
            pageCount++;
            y = height - margin;
          }

          page.drawText(line, {
            x: margin,
            y: y,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0),
          });

          y -= lineHeight;
        }

        const pdfBytes = await pdfDoc.save();
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        const pdfFileName = file.name.replace(/\.(docx|doc)$/i, '.pdf');
        const pdfFile = new File([pdfBlob], pdfFileName, { type: 'application/pdf' });

        setIsLoading(false);
        console.log(`Simple PDF conversion completed with ${pageCount} pages`);

        return {
          convertedFile: pdfFile,
          pageCount: pageCount || 1
        };
      }
    } catch (error) {
      console.error("Error converting DOCX to PDF:", error);
      setIsLoading(false);
      return null;
    }
  };

  // New function for server-side conversion using LibreOffice
  const convertDocxWithLibreOffice = async (file) => {
    try {
      console.log("Converting DOCX to PDF using LibreOffice...");
      setPrintStatus("Converting document using LibreOffice...");
      setPrintProgress(20);

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
          setPrintStatus(`Trying alternative connection method... (${backendUrl})`);
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
      setPrintStatus("Conversion complete!");
      setPrintProgress(40);

      return {
        convertedFile: pdfFile,
        pageCount: pageCount || 1,
        isFallbackConversion
      };
    } catch (error) {
      console.error("Error in server-side conversion:", error);
      setPrintStatus("Conversion failed. Please try again.");
      setPrintProgress(0);

      // Display a more helpful error message
      const errorMessage = error.response ?
        `Server error: ${error.response.status} - ${error.response.statusText}` :
        `Connection error: ${error.message}`;

      alert(`Server-side conversion failed: ${errorMessage}\n\nPlease check that:\n1. The backend server is running on port 5000\n2. LibreOffice is installed and in your PATH`);
      throw error;
    }
  };

  useEffect(() => {
    setShowModal(true);
  }, []);

  const closeModal = () => {
    setShowModal(false);
  };

  useEffect(() => {
    const coinRef = dbRef(realtimeDb, "coinCount/availableCoins");

    // Listen for real-time updates
    const unsubscribe = onValue(coinRef, (snapshot) => {
      if (snapshot.exists()) {
        setAvailableCoins(snapshot.val());
      } else {
        console.error("Error retrieving available coins.");
      }
    }, (error) => {
      console.error("Error fetching available coins:", error);
    });

    return () => unsubscribe();
  }, []);

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0];

    if (!selectedFile) return;

    try {
      // Show loading indicator
      setIsLoading(true);
      setPrintProgress(10);
      setPrintStatus("Processing file...");

      // Check if the file is a DOCX file
      const isDocx = selectedFile.name.toLowerCase().endsWith(".docx") ||
        selectedFile.name.toLowerCase().endsWith(".doc");

      // For DOCX files, convert to PDF using LibreOffice
      let fileToUpload = selectedFile;
      let pageCount = 1;

      if (isDocx) {
        console.log("DOCX file detected, converting to PDF using LibreOffice...");
        setPrintStatus("Converting DOCX to PDF...");

        try {
          const conversionResult = await convertDocxWithLibreOffice(selectedFile);

          if (!conversionResult) {
            console.error("DOCX conversion failed");
            setIsLoading(false);
            setPrintStatus("Conversion failed. Please try again.");
            return;
          }

          fileToUpload = conversionResult.convertedFile;
          pageCount = conversionResult.pageCount;

          console.log("Conversion complete, uploading converted PDF", fileToUpload);
          setPrintStatus("Analyzing document colors...");
          setPrintProgress(50);
        } catch (error) {
          console.error("Error converting with LibreOffice:", error);
          alert("Server-side conversion failed. Please check if LibreOffice is installed on the server.");
          setIsLoading(false);
          setPrintStatus("");
          setPrintProgress(0);
          return;
        }
      } else if (selectedFile.type === "application/pdf") {
        // For PDF files, get the page count and analyze colors
        try {
          const fileSizeInKB = selectedFile.size / 1024;
          const pdfData = await selectedFile.arrayBuffer();
          const pdfDoc = await PDFDocument.load(pdfData);
          pageCount = pdfDoc.getPageCount();
          console.log(`PDF has ${pageCount} pages`);
          setPrintStatus("Analyzing document colors...");
        } catch (error) {
          console.error("Error getting PDF page count:", error);
          pageCount = Math.max(1, Math.ceil(fileSizeInKB / 100)); // rough estimate
        }
      }

      // Create a unique filename to avoid collisions
      const timestamp = new Date().getTime();
      const uniqueFileName = `${timestamp}_${fileToUpload.name}`;
      const storageRef = ref(storage, `uploads/${uniqueFileName}`);

      // Set metadata
      const metadata = {
        contentType: fileToUpload.type,
        customMetadata: {
          public: "true", // Make it publicly readable
          pageCount: pageCount.toString(),
          fileName: selectedFile.name,
          original: selectedFile.name,
          isConverted: isDocx ? "true" : "false"
        }
      };

      // Upload the file
      setPrintStatus("Uploading file to storage...");
      setPrintProgress(60);

      // Create a new File object from the converted file if it's a Blob
      const fileToUploadFinal = fileToUpload instanceof Blob ?
        new File([fileToUpload], uniqueFileName, { type: fileToUpload.type }) :
        fileToUpload;

      // Set the file for preview
      setFileToUpload(fileToUploadFinal);

      const uploadTask = uploadBytesResumable(storageRef, fileToUploadFinal, metadata);

      // Listen for upload task completion
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          // Update progress
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setPrintProgress(Math.min(60 + Math.floor(progress / 5), 80)); // Scale to go from 60-80%
          setPrintStatus(`Uploading file: ${Math.round(progress)}%`);
        },
        (error) => {
          console.error("Upload error:", error);
          setPrintStatus("Error uploading file");
          setIsLoading(false);
        },
        async () => {
          try {
            // Get download URL
            setPrintStatus("Processing uploaded file...");
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

            // Set the preview URL
            setFilePreviewUrl(downloadURL);

            // Create an iframe for color analysis
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = '/proxy-pdf.html';
            document.body.appendChild(iframe);

            // Wait for iframe to load and be ready
            await new Promise((resolve) => {
              const handleMessage = (event) => {
                if (event.data.type === 'proxyReady') {
                  window.removeEventListener('message', handleMessage);
                  resolve();
                }
              };
              window.addEventListener('message', handleMessage);
              iframe.onload = () => {
                // Send a ping to check if the proxy is ready
                iframe.contentWindow.postMessage({ type: 'ping' }, '*');
              };
            });

            setPrintStatus("Analyzing document colors...");

            // Send message to iframe with PDF URL
            iframe.contentWindow.postMessage({
              type: 'analyzePDF',
              pdfUrl: downloadURL,
              filename: selectedFile.name
            }, '*');

            // Listen for color analysis results with timeout
            const colorAnalysisResult = await Promise.race([
              new Promise((resolve) => {
                const handleColorAnalysis = (event) => {
                  if (event.data.type === 'colorAnalysisComplete') {
                    window.removeEventListener('message', handleColorAnalysis);
                    document.body.removeChild(iframe);
                    resolve(event.data);
                  }
                };
                window.addEventListener('message', handleColorAnalysis);
              }),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Color analysis timeout')), 30000)
              )
            ]).catch(error => {
              console.error('Color analysis error:', error);
              document.body.removeChild(iframe);
              return { results: { hasColoredPages: false, coloredPages: [] } };
            });

            console.log('Color analysis results:', colorAnalysisResult);

            // Get the storage path
            const storagePath = uploadTask.snapshot.ref.fullPath;

            // Generate unique ID for this file
            const fileId = Date.now().toString();

            // Create the database reference
            const fileDbRef = dbRef(realtimeDb, `uploadedFiles/${fileId}`);

            // Create file entry in database with color analysis results
            await set(fileDbRef, {
              id: fileId,
              fileName: selectedFile.name,
              fileUrl: downloadURL,
              storagePath: storagePath,
              fileType: fileToUploadFinal.type,
              isOriginalDocx: isDocx,
              totalPages: pageCount,
              timestamp: new Date().toISOString(),
              uploadedFrom: "usb",
              status: "ready",
              colorAnalysis: colorAnalysisResult.results
            });

            // Update status
            setPrintStatus("File uploaded successfully!");
            setPrintProgress(85);

            // If color pages are detected, automatically set isColor to true
            if (colorAnalysisResult.results.hasColoredPages) {
              setIsColor(true);
            }

            // Now send for printing
            await handlePrintFile(downloadURL, selectedFile.name, pageCount, fileId, storagePath);

          } catch (error) {
            console.error("Error finalizing upload:", error);
            setPrintStatus("Error finalizing upload");
            // Reset progress on error
            setPrintProgress(0);
            setIsLoading(false);
          }
        }
      );
    } catch (error) {
      console.error("Error handling file:", error);
      setIsLoading(false);
      setPrintStatus("Error processing file. Please try again.");
      setPrintProgress(0);
    }
  };

  // Update the handlePrint function to use our custom settings and send them to the backend
  const handlePrint = async () => {
    if (!fileToUpload) {
      alert("Please select a file to print first.");
      return;
    }

    if (!selectedPrinter) {
      alert("Please select a printer first.");
      return;
    }

    setIsLoading(true);
    setPrintStatus("Initializing print job...");
    setPrintProgress(10);

    if (availableCoins < calculatedPrice) {
      setIsLoading(false);
      setPrintStatus("");
      setPrintProgress(0);
      alert(`Insufficient coins. Please insert ${calculatedPrice - availableCoins} more coins.`);
      return;
    }

    try {
      // Get file extension
      const fileName = fileToUpload.name;
      const fileExtension = fileName.split('.').pop().toLowerCase();

      // Create a unique ID for the print job
      const printJobId = Date.now().toString();

      // Record the print job in Firebase first
      const printJobsRef = dbRef(realtimeDb, `files/${printJobId}`);
      await set(printJobsRef, {
        fileName: fileName,
        fileUrl: filePreviewUrl,
        printerName: selectedPrinter,
        copies: copies,
        selectedSize,
        isColor,
        orientation,
        selectedPageOption,
        customPageRange,
        totalPages,
        price: calculatedPrice,
        progress: 5, // Start with 5% right away
        printStatus: "Preparing print job...",
        status: "Processing",
        fileType: fileExtension,
        timestamp: new Date().toISOString()
      });

      // Update coins immediately
      const updatedCoins = availableCoins - calculatedPrice;
      await update(dbRef(realtimeDb, "coinCount"), {
        availableCoins: updatedCoins
      });
      setAvailableCoins(updatedCoins);

      // Immediately redirect to printer page
      navigate('/printer');

      // Progress simulation steps for background updates
      const progressSteps = [
        { progress: 15, status: "Processing document...", delay: 800 },
        { progress: 30, status: "Configuring printer settings...", delay: 1500 },
        { progress: 45, status: "Converting document format...", delay: 2200 },
        { progress: 60, status: "Connecting to printer...", delay: 3000 },
        { progress: 75, status: "Sending to printer...", delay: 3800 },
        { progress: 85, status: "Printing in progress...", delay: 4500 },
        { progress: 95, status: "Finishing print job...", delay: 5200 },
      ];

      // Start updating progress in the background
      for (const step of progressSteps) {
        setTimeout(() => {
          update(printJobsRef, {
            progress: step.progress,
            printStatus: step.status
          });
        }, step.delay);
      }

      // Continue with API call in the background
      const printJob = {
        jobId: printJobId,
        fileName: fileName,
        fileUrl: filePreviewUrl,
        printerName: selectedPrinter,
        copies: copies,
        selectedSize,
        isColor,
        orientation,
        selectedPageOption,
        customPageRange,
        totalPages
      };

      // Make API call in the background
      fetch('http://localhost:5000/api/print', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(printJob)
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`Print failed. Server returned ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          // Update the print job with success status
          update(printJobsRef, {
            progress: 100,
            printStatus: "Print job completed",
            status: "Done"
          });
        })
        .catch(error => {
          console.error("Error in background print job:", error);
          // Update the print job with error status
          update(printJobsRef, {
            progress: 0,
            printStatus: `Error: ${error.message}`,
            status: "Error"
          });
        });

    } catch (error) {
      console.error("❌ Error printing document:", error);
      alert(`Error printing document: ${error.message}`);
      setIsLoading(false);
    }
  };

  // Function to record the print job in Firebase
  const recordPrintJob = async () => {
    try {
      // Record the print job in Firebase
      const printJobsRef = dbRef(realtimeDb, "files");
      await push(printJobsRef, {
        fileName: fileToUpload?.name,
        fileUrl: filePreviewUrl,
        printerName: selectedPrinter,
        copies: copies,
        paperSize: selectedSize,
        isColor: isColor,
        orientation: orientation,
        pageOption: selectedPageOption,
        customPageRange: customPageRange,
        totalPages: totalPages,
        finalPrice: calculatedPrice,
        timestamp: new Date().toISOString(),
        status: "Pending"
      });

      // Deduct coins
      const coinRef = dbRef(realtimeDb, "coinCount");
      const updatedCoins = availableCoins - calculatedPrice;
      await update(coinRef, { availableCoins: updatedCoins });

      // Update local state
      setAvailableCoins(updatedCoins);

      return true;
    } catch (error) {
      console.error("Error recording print job:", error);
      alert("Failed to record print job. Please try again.");
      return false;
    }
  };

  // Add a function to handle printing from the GroupDocs viewer
  const handleCloseExternalViewer = () => {
    setUseExternalViewer(false);
    setExternalViewerUrl("");
  };

  // Add a function to handle direct downloading for Word docs
  const handleDocDownload = () => {
    if (!filePreviewUrl) return;

    // Create an anchor element
    const downloadLink = document.createElement('a');
    downloadLink.href = filePreviewUrl;

    // Set the download attribute with the file name
    downloadLink.download = fileToUpload?.name || 'document.docx';

    // Append to the body
    document.body.appendChild(downloadLink);

    // Trigger the download
    downloadLink.click();

    // Clean up
    document.body.removeChild(downloadLink);
  };

  // In the handlePrintFile function, pass along the storage path
  const handlePrintFile = async (fileUrl, fileName, pageCount, fileId, storagePath) => {
    try {
      // Set the preview URL
      setFilePreviewUrl(fileUrl);

      // Set total pages
      setTotalPages(pageCount);

      // Reset loading state
      setIsLoading(false);
      setPrintStatus("Ready to print");
      setPrintProgress(0);

      // Create print job entry
      const printJobRef = dbRef(realtimeDb, `files/${fileId}`);
      await set(printJobRef, {
        fileName: fileName,
        fileUrl: fileUrl,
        storagePath: storagePath,
        printerName: selectedPrinter || "",
        copies: copies,
        isColor: isColor,
        orientation: orientation,
        selectedSize: selectedSize,
        totalPages: pageCount,
        price: calculatedPrice,
        timestamp: new Date().toISOString(),
        status: "Ready",
        progress: 0
      });

    } catch (error) {
      console.error("Error in handlePrintFile:", error);
      setIsLoading(false);
      setPrintStatus("Error preparing print job");
      setPrintProgress(0);
    }
  };

  return (
    <ClientContainer>
      {/* Main Box Container */}
      <div className="flex flex-col w-full h-full bg-gray-200 rounded-lg shadow-md border-4 border-[#31304D] p-6 space-x-4 relative">
        {/* Top Section */}
        <div className="flex w-full space-x-6">
          {/* Left Side */}
          <div className="w-1/2 flex flex-col">
            <div className="flex items-center">
              <button
                className="w-10 h-10 bg-gray-200 text-[#31304D] flex items-center justify-center rounded-lg border-2 border-[#31304D] mr-4"
                onClick={() => navigate(-1)}
              >
                <FaArrowLeft className="text-2xl text-[#31304D]" />
              </button>
              <p className="text-3xl font-bold text-[#31304D]">USB</p>
            </div>

            {/* File Upload Section */}
            <div className="mt-6 space-y-4">
              {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white p-8 rounded-md shadow-md relative max-w-full">
                    {/* Close Button */}
                    <button
                      onClick={closeModal}
                      className="absolute top-2 right-2 text-2xl font-bold hover:text-red-600"
                    >
                      <X size={24} />
                    </button>

                    <h2 className="text-4xl font-bold mb-4 text-center">
                      Guide
                    </h2>

                    <ul className="list-disc list-inside mb-4 text-2xl">
                      <li><span className="font-bold text-blue-500">Please send your file via USB to VendoPrint.</span></li>
                      <li className="font-bold">Make sure you have enough coins in your account.</li>
                      <li className="font-semibold">Once your file is transferred, select or browse it below to upload.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* External Viewer Modal */}
              {useExternalViewer && externalViewerUrl && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg shadow-lg w-full h-[90vh] flex flex-col max-w-6xl">
                    <div className="flex justify-between items-center p-4 border-b">
                      <h2 className="text-xl font-semibold">Document Preview - {fileToUpload?.name}</h2>
                      <div className="flex items-center gap-4">
                        <button
                          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark flex items-center"
                          onClick={() => {
                            const printUrl = externalViewerUrl.replace('/embed?', '/view?');
                            window.open(printUrl, '_blank', 'width=800,height=600');
                          }}
                        >
                          <Printer size={18} className="mr-2" />
                          Open Print View
                        </button>
                        <button
                          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
                          onClick={handleDocDownload}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="mr-2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                          </svg>
                          Download
                        </button>
                        <button
                          onClick={handleCloseExternalViewer}
                          className="p-2 rounded-full hover:bg-gray-100"
                        >
                          <X size={24} />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <iframe
                        src={externalViewerUrl}
                        className="w-full h-full border-none"
                        title="Document Preview"
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
                        referrerpolicy="no-referrer"
                      />
                    </div>
                    <div className="p-4 bg-gray-100 border-t text-center">
                      <p className="text-sm text-gray-600 mb-2">Having trouble seeing the document?</p>
                      <a
                        href={externalViewerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Open in new tab
                      </a>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 p-6 rounded-lg shadow-sm border border-gray-200">
                <h2 className="text-xl font-bold text-primary mb-4 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="mr-2" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  Choose File
                </h2>
                <div className="relative">
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    accept=".pdf,.doc,.docx"
                    className="w-full border-2 border-gray-300 rounded p-2 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary file:text-white hover:file:bg-primary-dark"
                  />
                  {isLoading && (
                    <div className="mt-2 text-sm text-gray-600">
                      Uploading...
                    </div>
                  )}
                </div>
              </div>

              {/* Print Settings Section */}
              <div className="bg-gray-50 p-6 rounded-lg shadow-sm border border-gray-200">
                <h2 className="text-xl font-bold text-primary mb-4">Print Settings</h2>

                {/* Printer Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Printer
                  </label>
                  <PrinterList
                    selectedPrinter={selectedPrinter}
                    setSelectedPrinter={setSelectedPrinter}
                    onPrinterCapabilities={setPrinterCapabilities}
                  />
                </div>

                {/* Copies */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Copies
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={copies}
                    onChange={(e) => setCopies(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border rounded-md bg-white text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Paper Size */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Paper Size
                  </label>
                  <select
                    value={selectedSize}
                    onChange={(e) => setSelectedSize(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-white text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="Short Bond">Short Bond (8.5 x 11)</option>
                    <option value="A4">A4 (8.3 x 11.7)</option>
                    <option value="Long Bond">Long Bond (8.5 x 14)</option>
                  </select>
                </div>

                {/* Color Option */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Color
                  </label>
                  <SelectColor
                    isColor={isColor}
                    setIsColor={setIsColor}
                    printerCapabilities={printerCapabilities}
                  />
                </div>

                {/* Orientation */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Orientation
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="orientation"
                        value="portrait"
                        checked={orientation === "portrait"}
                        onChange={(e) => setOrientation(e.target.value)}
                        className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">Portrait</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="orientation"
                        value="landscape"
                        checked={orientation === "landscape"}
                        onChange={(e) => setOrientation(e.target.value)}
                        className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">Landscape</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Balance and Smart Price Section */}
              <div className="bg-gray-50 p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <div className="text-right">
                    <p className="font-bold text-gray-700 text-xl">
                      Balance: <span className="text-green-600">{availableCoins}</span> coins
                    </p>
                  </div>
                </div>

                <SmartPriceToggle
                  paperSize={selectedSize}
                  isColor={isColor}
                  copies={copies}
                  totalPages={totalPages}
                  setTotalPages={setTotalPages}
                  isSmartPriceEnabled={isSmartPriceEnabled}
                  setIsSmartPriceEnabled={setIsSmartPriceEnabled}
                  calculatedPrice={calculatedPrice}
                  setCalculatedPrice={setCalculatedPrice}
                  selectedPageOption={selectedPageOption}
                  setSelectedPageOption={setSelectedPageOption}
                  customPageRange={customPageRange}
                  setCustomPageRange={setCustomPageRange}
                  filePreviewUrl={filePreviewUrl}
                />
              </div>
            </div>
          </div>

          {/* Right Side - Document Preview */}
          <div className="w-1/2">
            <div className="bg-gray-50 p-6 rounded-lg shadow-sm border border-gray-200 h-full">

              <div className="bg-white border border-gray-200 rounded-lg w-full h-full">
                <DocumentPreview
                  fileUrl={filePreviewUrl}
                  fileName={fileToUpload?.name}
                  fileToUpload={fileToUpload}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Print Button */}
        <div className="flex flex-col items-center mt-6 mb-4">
          <button
            onClick={handlePrint}
            disabled={isLoading || !filePreviewUrl}
            className={`px-8 py-3 text-white text-lg font-bold rounded-lg flex items-center justify-center transition-all ${isLoading || !filePreviewUrl
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-primary hover:bg-primary-dark shadow-lg hover:shadow-xl"
              }`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {printStatus || "Processing..."}
              </>
            ) : (
              <>
                Print Document
                <Printer className="ml-2" />
              </>
            )}
          </button>

          {/* Progress Bar */}
          {isLoading && printProgress > 0 && (
            <div className="w-full max-w-md mt-4">
              <div className="bg-gray-300 rounded-full h-2.5">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${printProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 mt-1 text-center">{printStatus}</p>
            </div>
          )}
        </div>
      </div>
    </ClientContainer>
  );
};

export default Usb;
