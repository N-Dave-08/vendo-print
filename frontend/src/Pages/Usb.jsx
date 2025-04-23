import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Printer, ArrowLeft, X, FileText } from "lucide-react";
import MiniNav from "../components/MiniNav";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import CustomPage from "../components/common/customized_page";
import DocumentPreview from "../components/common/document_preview";
import SmartPriceToggle from "../components/common/smart_price";
import PrinterList from "../components/usb/printerList";
import SelectColor from "../components/usb/select_color";
import PrintSettings from "../components/common/PrintSettings";
import UsbDrivePanel from "../components/usb/UsbDrivePanel";

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
  const [totalPages, setTotalPages] = useState(1);
  const [calculatedPrice, setCalculatedPrice] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [availableCoins, setAvailableCoins] = useState(0);
  const [colorAnalysis, setColorAnalysis] = useState(null);

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
  
  // Add state to track if USB Panel is shown
  const [showUsbPanel, setShowUsbPanel] = useState(true);

  // Function to handle document load
  const onDocumentLoad = (info) => {
    console.log("Document loaded:", info);
    if (info && info.numPages) {
      setTotalPages(info.numPages);
    }
  };

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

      // Use a single backend URL with increased timeout
      const backendUrl = 'http://localhost:5000/api/convert-docx';
      console.log(`Attempting to connect to backend at: ${backendUrl}`);

      // Call the backend conversion API with increased timeout
      const response = await axios.post(backendUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        responseType: 'blob', // Important: we want the response as a blob
        timeout: 300000 // 5 minute timeout for conversion
      });

      console.log(`Successfully connected to backend at: ${backendUrl}`);

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

  useEffect(() => {
    // Add event listener for color analysis messages
    const handleMessage = (event) => {
      if (event.data.type === 'colorAnalysisComplete') {
        console.log('Color analysis results received:', event.data.results);
        setColorAnalysis(event.data.results);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Handle file selection from USB drive
  const handleUsbFileSelect = async (file) => {
    console.log("USB file selected:", file);
    
    try {
      // Show loading indicator
      setIsLoading(true);
      setPrintProgress(10);
      setPrintStatus("Reading file from USB drive...");

      // Check if the file is a DOCX file
      const isDocx = file.name.toLowerCase().endsWith(".docx") ||
        file.name.toLowerCase().endsWith(".doc");

      if (isDocx) {
        console.log("DOCX file detected, converting to PDF using LibreOffice...");
        setPrintStatus("Converting DOCX to PDF...");

        try {
          // Send the file path to the backend for conversion
          const response = await axios.post('http://localhost:5000/api/convert-docx', 
            { filePath: file.path }, 
            {
              headers: {
                'Content-Type': 'application/json'
              },
              timeout: 120000 // 2 minutes timeout
            }
          );

          if (!response.data || response.data.status === 'error') {
            throw new Error(response.data?.message || 'Server error during conversion');
          }

          // Get the converted PDF from Firebase Storage URL
          const pdfUrl = response.data.pdfUrl;
          if (!pdfUrl) {
            throw new Error('No PDF URL received from server');
          }

          console.log('Converted PDF URL:', pdfUrl);

          // Download the PDF file
          const pdfResponse = await axios.get(pdfUrl, {
            responseType: 'blob'
          });

          // Create a new file from the response
          const pdfFile = new File([pdfResponse.data], file.name.replace(/\.(docx|doc)$/i, '.pdf'), { type: 'application/pdf' });
          
          // Get PDF page count
          const pdfData = await pdfResponse.data.arrayBuffer();
          const pdfDoc = await PDFDocument.load(pdfData);
          const pageCount = pdfDoc.getPageCount();

          // Set the file for preview
          setFileToUpload(pdfFile);
          setTotalPages(pageCount);

          // Create a unique filename for storage
          const timestamp = new Date().getTime();
          const uniqueFileName = `${timestamp}_${pdfFile.name}`;
          const storageRef = ref(storage, `uploads/${uniqueFileName}`);

          // Upload the converted PDF to Firebase Storage
          setPrintStatus("Uploading converted PDF...");
          setPrintProgress(70);

          const uploadTask = uploadBytesResumable(storageRef, pdfFile, {
            contentType: 'application/pdf',
            customMetadata: {
              originalName: file.name,
              convertedFrom: 'docx'
            }
          });

          // Listen for upload task completion
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const progress = Math.round(
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100
              );
              setPrintProgress(70 + (progress * 0.3)); // Scale from 70-100%
              setPrintStatus(`Uploading: ${progress}%`);
            },
            (error) => {
              console.error("Upload error:", error);
              setIsLoading(false);
              setPrintStatus("Error uploading file. Please try again.");
              setPrintProgress(0);
            },
            async () => {
              try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                console.log("File uploaded, URL:", downloadURL);
                setFilePreviewUrl(downloadURL);

                // Create an iframe for color analysis
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                iframe.src = '/proxy-pdf.html';
                document.body.appendChild(iframe);

                // Wait for iframe to load
                await new Promise((resolve) => {
                  iframe.onload = resolve;
                });

                // Send message to iframe with PDF URL
                iframe.contentWindow.postMessage({
                  type: 'analyzePDF',
                  pdfUrl: downloadURL,
                  filename: pdfFile.name
                }, '*');

                // Listen for color analysis results
                const colorAnalysisResult = await new Promise((resolve) => {
                  window.addEventListener('message', function onMessage(event) {
                    if (event.data.type === 'colorAnalysisComplete') {
                      window.removeEventListener('message', onMessage);
                      document.body.removeChild(iframe);
                      resolve(event.data);
                    }
                  });
                });

                console.log('Color analysis results:', colorAnalysisResult);

                // Set the color analysis results
                setColorAnalysis(colorAnalysisResult.results);

                // If there are colored pages, automatically set isColor to true
                if (colorAnalysisResult.results.hasColoredPages) {
                  setIsColor(true);
                }

                setIsLoading(false);
                setPrintStatus("Ready to print");
                setPrintProgress(100);
              } catch (error) {
                console.error("Error getting download URL or analyzing colors:", error);
                setIsLoading(false);
                setPrintStatus("Error preparing file. Please try again.");
                setPrintProgress(0);
              }
            }
          );
        } catch (error) {
          console.error("Error converting DOCX:", error);
          setIsLoading(false);
          setPrintStatus("Error converting file. Please try again.");
          setPrintProgress(0);
          alert(`Error converting file: ${error.message}`);
        }
      } else {
        // For non-DOCX files, read directly
      const response = await fetch(`http://localhost:5000/api/read-file?path=${encodeURIComponent(file.path)}`);
      
      if (!response.ok) {
        throw new Error('Failed to read file from USB drive');
      }
      
      setPrintProgress(30);
      setPrintStatus("Processing file...");
      
      const fileBlob = await response.blob();
        const fileObj = new File([fileBlob], file.name, { type: fileBlob.type });
      
        // Process the file as if it was selected via input
      await processSelectedFile(fileObj);
      }
      
    } catch (error) {
      console.error("Error handling USB file:", error);
      setIsLoading(false);
      setPrintStatus("Error reading file from USB. Please try again.");
      setPrintProgress(0);
      alert(`Error: ${error.message}`);
    }
  };
  
  // Extract file processing logic to a separate function
  const processSelectedFile = async (selectedFile) => {
    if (!selectedFile) return;

    try {
      // Show loading indicator
      setIsLoading(true);
      setPrintProgress(10);
      setPrintStatus("Processing file...");

      // For files from USB, we need to fetch the file content first
      let fileToProcess = selectedFile;
      if (selectedFile.path) {
        setPrintStatus("Reading file from USB drive...");
        try {
          const response = await axios.get(`http://localhost:5000/api/read-file?path=${encodeURIComponent(selectedFile.path)}`, {
            responseType: 'blob'
          });
          
          // Create a new File object from the blob
          fileToProcess = new File([response.data], selectedFile.name, {
            type: response.data.type
          });
        } catch (error) {
          console.error("Error reading file from USB:", error);
          throw new Error("Failed to read file from USB drive");
        }
      }

      // Check if the file is a DOCX file
      const isDocx = selectedFile.name.toLowerCase().endsWith(".docx") ||
        selectedFile.name.toLowerCase().endsWith(".doc");

      // For DOCX files, convert to PDF using LibreOffice
      let fileToUpload = fileToProcess;
      let pageCount = 1;

      if (isDocx) {
        console.log("DOCX file detected, converting to PDF...");
        setPrintStatus("Converting DOCX to PDF...");

        try {
          // For files from USB, we need to send the file content
          const formData = new FormData();
          formData.append('file', fileToProcess);

          const response = await axios.post('http://localhost:5000/api/convert-docx-content', 
            formData,
            {
              headers: {
                'Content-Type': 'multipart/form-data'
              },
              timeout: 120000 // 2 minutes timeout
            }
          );

          if (!response.data || response.data.status === 'error') {
            throw new Error(response.data?.message || 'Server error during conversion');
          }

          // Get the converted PDF from Firebase Storage URL
          const pdfUrl = response.data.pdfUrl;
          if (!pdfUrl) {
            throw new Error('No PDF URL received from server');
          }

          console.log('Converted PDF URL:', pdfUrl);

          // Download the PDF file
          const pdfResponse = await axios.get(pdfUrl, {
            responseType: 'blob'
          });

          // Create a new file from the response
          fileToUpload = new File([pdfResponse.data], selectedFile.name.replace(/\.(docx|doc)$/i, '.pdf'), { type: 'application/pdf' });
          
          // Get PDF page count
          const pdfData = await pdfResponse.data.arrayBuffer();
          const pdfDoc = await PDFDocument.load(pdfData);
          pageCount = pdfDoc.getPageCount();

          console.log("Conversion complete, proceeding with converted PDF", fileToUpload);
          setPrintStatus("Analyzing document colors...");
          setPrintProgress(50);
        } catch (error) {
          console.error("Error converting with LibreOffice:", error);
          setIsLoading(false);
          setPrintStatus("Conversion failed: " + (error.response?.data?.message || error.message));
          setPrintProgress(0);
          return;
        }
      } else if (fileToProcess.type === 'application/pdf') {
        // For PDF files, get the page count
        try {
          const pdfData = await fileToProcess.arrayBuffer();
          const pdfDoc = await PDFDocument.load(pdfData);
          pageCount = pdfDoc.getPageCount();
          console.log(`PDF has ${pageCount} pages`);
          setPrintStatus("Analyzing document colors...");
        } catch (error) {
          console.error("Error getting PDF page count:", error);
          const fileSizeInKB = fileToProcess.size / 1024;
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
          public: "true",
          pageCount: pageCount.toString(),
          fileName: selectedFile.name,
          original: selectedFile.name,
          isConverted: isDocx ? "true" : "false"
        }
      };

      // Upload the file
      setPrintStatus("Uploading file to storage...");
      setPrintProgress(60);

      const uploadTask = uploadBytesResumable(storageRef, fileToUpload, metadata);

      // Listen for upload task completion
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          setPrintProgress(60 + (progress * 0.4)); // Scale from 60-100%
          setPrintStatus(`Uploading: ${progress}%`);
        },
        (error) => {
          console.error("Upload error:", error);
          setIsLoading(false);
          setPrintStatus("Error uploading file. Please try again.");
          setPrintProgress(0);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log("File uploaded, URL:", downloadURL);
            setFilePreviewUrl(downloadURL);

            // Create an iframe for color analysis
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = '/proxy-pdf.html';
            document.body.appendChild(iframe);

            // Wait for iframe to load
            await new Promise((resolve) => {
              iframe.onload = resolve;
            });

            // Send message to iframe with PDF URL
            iframe.contentWindow.postMessage({
              type: 'analyzePDF',
              pdfUrl: downloadURL,
              filename: fileToUpload.name
            }, '*');

            // Listen for color analysis results
            const colorAnalysisResult = await new Promise((resolve) => {
              window.addEventListener('message', function onMessage(event) {
                if (event.data.type === 'colorAnalysisComplete') {
                  window.removeEventListener('message', onMessage);
                  document.body.removeChild(iframe);
                  resolve(event.data);
                }
              });
            });

            console.log('Color analysis results:', colorAnalysisResult);

            // Create database entry with comprehensive file information
            const newFileRef = push(dbRef(realtimeDb, "uploadedFiles"));
            const fileData = {
              fileName: fileToUpload.name,
              fileUrl: downloadURL,
              fileType: fileToUpload.type,
              uploadedAt: new Date().toISOString(),
              totalPages: pageCount,
              uploadSource: "usb",
              status: "ready",
              isConverted: isDocx
            };

            // Add color analysis data if available
            if (colorAnalysisResult.results && !colorAnalysisResult.results.error) {
              fileData.colorAnalysis = {
                hasColoredPages: colorAnalysisResult.results.hasColoredPages,
                coloredPageCount: colorAnalysisResult.results.coloredPageCount,
                blackAndWhitePageCount: pageCount - colorAnalysisResult.results.coloredPageCount,
                pageDetails: colorAnalysisResult.results.pageAnalysis?.map(page => ({
                  pageNumber: page.pageNumber,
                  hasColor: page.hasColor,
                  colorPercentage: parseFloat(page.colorPercentage)
                }))
              };
            }

            // Save to Firebase Realtime Database
            await set(newFileRef, fileData);

            // Set color analysis state for UI
            setColorAnalysis(colorAnalysisResult.results);
            
            // Update UI state
            setIsLoading(false);
            setPrintProgress(100);
            setPrintStatus("File ready for printing");

          } catch (error) {
            console.error("Error getting download URL or analyzing colors:", error);
            setIsLoading(false);
            setPrintStatus("Error preparing file. Please try again.");
            setPrintProgress(0);
          }
        }
      );
    } catch (error) {
      console.error("Error processing file:", error);
      setIsLoading(false);
      setPrintStatus("Error processing file. Please try again.");
      setPrintProgress(0);
      alert(`Error: ${error.message}`);
    }
  };

  // Update the handlePrint function
  const handlePrint = async () => {
    if (!filePreviewUrl) {
      alert("Please select a file to print first.");
      return;
    }

    if (!selectedPrinter) {
      alert("Please select a printer first.");
      return;
    }

    if (availableCoins < calculatedPrice) {
      alert(`Insufficient coins. Please insert ${calculatedPrice - availableCoins} more coins.`);
      return;
    }

    try {
      // Create a unique ID for the print job
      const printJobId = Date.now().toString();

      // Get actual page count from the file if it's a PDF
      let actualPages = totalPages;
      if (fileToUpload?.type === "application/pdf") {
        try {
          const pdfData = await fileToUpload.arrayBuffer();
          const pdfDoc = await PDFDocument.load(pdfData);
          actualPages = pdfDoc.getPageCount();
          console.log(`Actual PDF pages: ${actualPages}`);
        } catch (error) {
          console.error("Error getting PDF page count:", error);
        }
      }

      // Initialize the print job in Firebase first
      const printJobsRef = dbRef(realtimeDb, `printJobs/${printJobId}`);
      await set(printJobsRef, {
        fileName: fileToUpload?.name || "document.pdf",
        fileUrl: filePreviewUrl,
        printerName: selectedPrinter,
        copies: copies,
        isColor: isColor,
        totalPages: actualPages,
        status: "pending",
        progress: 0,
        statusMessage: "Initializing print job...",
        createdAt: Date.now(),
        price: calculatedPrice,
        source: "usb",
        // Only include colorAnalysis if it exists
        ...(colorAnalysis && { colorAnalysis })
      });

      // Update coins immediately
      const updatedCoins = availableCoins - calculatedPrice;
      await update(dbRef(realtimeDb, "coinCount"), {
        availableCoins: updatedCoins
      });
      setAvailableCoins(updatedCoins);

      // Prepare the print request data
      const printData = {
        fileUrl: filePreviewUrl,
        fileName: fileToUpload?.name || "document.pdf",
        printerName: selectedPrinter,
        copies: copies,
        isColor: isColor,
        orientation: orientation,
        selectedSize: "Short Bond",
        printJobId: printJobId,
        totalPages: actualPages,
        price: calculatedPrice
      };

      // Only add color analysis data if it exists
      if (colorAnalysis && colorAnalysis.hasColoredPages !== undefined) {
        printData.hasColorContent = colorAnalysis.hasColoredPages;
        printData.colorPageCount = colorAnalysis.coloredPages?.length || 0;
      }

      // Immediately redirect to printer page
      navigate('/printer');

      // Send print request to backend
      const response = await axios.post('http://localhost:5000/api/print', printData);

      if (response.data.status === 'error') {
        throw new Error(response.data.error || 'Failed to print document');
      }

    } catch (error) {
      console.error("Error printing document:", error);
      alert(`Error printing document: ${error.message}`);
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
        paperSize: "Short Bond",  // Always use Short Bond
        paperWidth: 8.5,          // Short Bond width in inches
        paperHeight: 11,          // Short Bond height in inches
        scale: "fit",             // Fit to page
        isColor: isColor,
        orientation: orientation,
        totalPages: totalPages,
        finalPrice: calculatedPrice,
        timestamp: new Date().toISOString(),
        status: "Pending",
        colorAnalysis: colorAnalysis
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
    if (filePreviewUrl) {
      // Create a temporary link element to trigger download
      const link = document.createElement("a");
      link.href = filePreviewUrl;
      link.download = fileToUpload ? fileToUpload.name : "document";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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
        paperSize: "Short Bond",  // Always use Short Bond
        paperWidth: 8.5,          // Short Bond width in inches
        paperHeight: 11,          // Short Bond height in inches
        scale: "fit",             // Fit to page
        isColor: isColor,
        orientation: orientation,
        totalPages: pageCount,
        price: calculatedPrice,
        timestamp: new Date().toISOString(),
        status: "Ready",
        progress: 0,
        colorAnalysis: colorAnalysis
      });

    } catch (error) {
      console.error("Error in handlePrintFile:", error);
      setIsLoading(false);
      setPrintStatus("Error preparing print job");
      setPrintProgress(0);
    }
  };

  const handleClearFile = () => {
    // Clear file preview and reset related state
    setFilePreviewUrl("");
    setFileToUpload(null);
    setPrintStatus("");
    setPrintProgress(0);
    setTotalPages(1);
    setIsColor(false);
    setSelectedSize("Short Bond");
    setOrientation("portrait");
    setCalculatedPrice(0);
    setSelectedPrinter("");
    setPrinterCapabilities(null);
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-base-200">
      <div className="container mx-auto px-4 py-4 flex flex-col h-full">
        {/* Page Header */}
        <div className="flex items-center gap-3 mb-3">
          <button
            className="btn btn-circle btn-ghost btn-sm"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-primary">USB Print</h1>
          
          {/* Balance Display - moved to header */}
          <div className="ml-auto">
            <div className="badge badge-lg badge-primary text-base-100 font-bold">
              Inserted coins: {availableCoins}
            </div>
          </div>
        </div>

        {/* Main Content Area with proper overflow handling */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 overflow-hidden">
          {/* Left Column - File Selection and Settings with own scrollbar */}
          <div className="overflow-y-auto pr-2 pb-2">
            <div className="flex flex-col gap-4">
              {/* USB Drive Panel */}
              <UsbDrivePanel onFileSelect={handleUsbFileSelect} />
              
              {/* Use the reusable PrintSettings component */}
              <PrintSettings 
                selectedPrinter={selectedPrinter}
                setSelectedPrinter={setSelectedPrinter}
                printerCapabilities={printerCapabilities}
                setPrinterCapabilities={setPrinterCapabilities}
                copies={copies}
                setCopies={setCopies}
                isColor={isColor}
                setIsColor={setIsColor}
                orientation={orientation}
                setOrientation={setOrientation}
                filePreviewUrl={filePreviewUrl}
                totalPages={totalPages}
                calculatedPrice={calculatedPrice}
                setCalculatedPrice={setCalculatedPrice}
                colorAnalysis={colorAnalysis}
              />
              
              {/* Only show message if no file is selected */}
              {!filePreviewUrl && (
                <div className="mt-6 text-center">
                  <div className="text-sm text-gray-500 mb-4">
                    Connect your USB drive to select a file for printing
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Document Preview with own scrollbar */}
          <div className="overflow-y-auto pl-2 pb-2">
            <div className="card bg-base-100 shadow-sm h-full flex flex-col">
              <div className="card-body p-4 flex-1 flex flex-col">
                <h2 className="card-title text-base text-primary mb-2">Document Preview</h2>
                
                <div className="flex-1 bg-base-200 rounded-lg flex flex-col overflow-hidden">
                  {isLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                      <div className="loading loading-spinner loading-lg text-primary mb-4"></div>
                      <p className="text-base-content/70">{printStatus}</p>
                      {printProgress > 0 && (
                        <div className="w-full max-w-xs mt-4">
                          <div className="flex justify-between text-xs text-base-content/50 mb-1">
                            <span>Progress</span>
                            <span>{printProgress}%</span>
                          </div>
                          <progress 
                            className="progress progress-primary w-full" 
                            value={printProgress} 
                            max="100"
                          ></progress>
                        </div>
                      )}
                    </div>
                  ) : filePreviewUrl ? (
                    <div className="relative w-full h-full flex flex-col">
                      <div className="absolute top-2 right-2 z-10">
                        <button
                          className="btn btn-circle btn-sm btn-error"
                          onClick={handleClearFile}
                          aria-label="Clear file"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <DocumentPreview
                        url={filePreviewUrl}
                        className="flex-1 overflow-hidden"
                        onDocumentLoad={onDocumentLoad}
                        externalViewerUrl={externalViewerUrl}
                        useExternalViewer={useExternalViewer}
                        fileName={fileToUpload ? fileToUpload.name : "document.pdf"}
                      />
                      <div className="p-2 flex justify-center">
                        <a 
                          href={filePreviewUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-primary"
                        >
                          Open file in new window
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                      <FileText className="h-12 w-12 text-primary/30 mb-4" />
                      <p className="text-base-content/70">
                        Select a file to preview and print
                      </p>
                      <p className="text-xs text-base-content/50 mt-2">
                        Supported formats: PDF, DOC, DOCX, JPG, PNG, XLS, XLSX
                      </p>
                    </div>
                  )}
                </div>

                {filePreviewUrl && (
                  <div className="card-actions justify-end mt-3">
                    <button
                      className="btn btn-primary gap-2"
                      onClick={handlePrint}
                      disabled={!selectedPrinter || isLoading}
                    >
                      {isLoading ? (
                        <>
                          <span className="loading loading-spinner"></span>
                          Processing...
                        </>
                      ) : (
                        <>
                          Print Document
                          <Printer className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* USB Guide Modal */}
      {showModal && (
        <div className="modal modal-open">
          <div className="modal-box relative max-w-3xl">
            <h3 className="text-2xl font-bold text-primary mb-8">How to Print from USB</h3>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="badge badge-lg badge-primary">1</div>
                <p className="text-base-content/80 text-lg">Connect your USB drive - your files will appear automatically</p>
              </div>
              <div className="flex items-start gap-4">
                <div className="badge badge-lg badge-primary">2</div>
                <p className="text-base-content/80 text-lg">Click on a file from your USB drive to select it</p>
              </div>
              <div className="flex items-start gap-4">
                <div className="badge badge-lg badge-primary">3</div>
                <p className="text-base-content/80 text-lg">Choose your desired printer and print settings</p>
              </div>
              <div className="flex items-start gap-4">
                <div className="badge badge-lg badge-primary">4</div>
                <p className="text-base-content/80 text-lg">Preview your document to make sure it looks correct</p>
              </div>
              <div className="flex items-start gap-4">
                <div className="badge badge-lg badge-primary">5</div>
                <p className="text-base-content/80 text-lg">Check the smart price to ensure you have enough coins</p>
              </div>
              <div className="flex items-start gap-4">
                <div className="badge badge-lg badge-primary">6</div>
                <p className="text-base-content/80 text-lg">Click the Print button to send your document to the printer</p>
              </div>
            </div>
            <div className="modal-action mt-8">
              <button 
                className="btn btn-primary btn-wide" 
                onClick={() => setShowModal(false)}
              >
                Got it!
              </button>
            </div>
          </div>
          <div className="modal-backdrop bg-neutral/80" onClick={() => setShowModal(false)}></div>
        </div>
      )}
    </div>
  );
};

export default Usb;
