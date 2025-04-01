// BackendRoutes.js
import express from 'express';
import { addData, getData } from '../controller/firebase_controller.js';
// I-import natin ang mga handler na bagong pangalan
import {
  getPrintersHandler,
  printFileHandler,
  getPrinterCapabilitiesHandler,
  testPrinterConnectivityHandler
} from '../printer/printer_controller.js';
import { scanWithWIA, copyHandler, checkScanner } from '../printer/copy_controller.js';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import multer from 'multer';
// Import the conversion service
import { convertDocxToPdf, cleanupTempFiles, checkLibreOffice } from '../services/conversion_service.js';
// Import Firebase storage reference
import { storage } from "../firebase/firebase-config.js";
import { ref as storageRef, getDownloadURL } from "firebase/storage";
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const uploadStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(path.dirname(__dirname), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage: uploadStorage });

const BackendRoutes = express.Router();

// Add a debounce mechanism to prevent multiple scans
let lastScanTime = 0;
const SCAN_DEBOUNCE_TIME = 2000; // 2 seconds debounce

// Firebase Routes
BackendRoutes.post('/add-data', addData);
BackendRoutes.get('/get-files', getData);

// Printer Routes
BackendRoutes.get('/printers', getPrintersHandler);
BackendRoutes.get('/printers/:printerName/capabilities', getPrinterCapabilitiesHandler);
BackendRoutes.get('/printers/:printerName/test', testPrinterConnectivityHandler);
BackendRoutes.post('/print', upload.single('file'), printFileHandler);
BackendRoutes.post('/xerox', copyHandler);

// Scanner Routes
BackendRoutes.get('/xerox/check-scanner', async (req, res) => {
  try {
    const result = await checkScanner();
    res.json({ status: 'success', message: result });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Preview endpoint
BackendRoutes.get('/xerox/preview', async (req, res) => {
  // Implement debounce to prevent multiple scans
  const now = Date.now();
  if (now - lastScanTime < SCAN_DEBOUNCE_TIME) {
    console.log('Scan request debounced (too soon after last scan)');
    return res.status(429).json({
      status: 'error',
      message: 'Please wait before scanning again'
    });
  }

  lastScanTime = now;
  console.log('Starting preview scan...');
  let outputPath = null;

  try {
    console.log('Checking scanner availability...');
    await checkScanner();

    // Create scans directory in the printer folder
    const scansDir = path.join(path.dirname(__dirname), 'printer', 'scans');
    console.log('Scans directory path:', scansDir);

    if (!fs.existsSync(scansDir)) {
      console.log('Creating scans directory...');
      fs.mkdirSync(scansDir, { recursive: true });
    }

    const fileName = `preview_${uuidv4()}.bmp`;
    outputPath = path.join(scansDir, fileName);
    console.log('Will save preview to:', outputPath);

    console.log('Starting scan...');
    await scanWithWIA(outputPath);

    if (!fs.existsSync(outputPath)) {
      throw new Error('Scan failed - no output file generated');
    }

    res.sendFile(outputPath, (err) => {
      if (err) {
        console.error('Error sending file:', err);
      }
      // Clean up after sending
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
    });
  } catch (error) {
    console.error('Error during preview scan:', error);
    if (outputPath && fs.existsSync(outputPath)) {
      try {
        fs.unlinkSync(outputPath);
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }
    }
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to generate preview.'
    });
  }
});

// Print scanned document
BackendRoutes.post('/xerox/print', async (req, res) => {
  try {
    const { price } = req.body;

    // Get the path of the last scanned preview
    const scansDir = path.join(path.dirname(__dirname), 'printer', 'scans');
    const previewPath = path.join(scansDir, 'preview.bmp');

    // Check if the preview file exists
    if (!fs.existsSync(previewPath)) {
      return res.status(400).json({ status: 'error', message: 'No scanned document found' });
    }

    // Use PowerShell to check printer status first
    const checkPrinterCmd = `
      powershell.exe -Command "
        $printer = Get-Printer -Name 'EPSON L120 Series' -ErrorAction SilentlyContinue
        if ($printer.PrinterStatus -eq 'Normal') {
          Write-Output 'Ready'
        } else {
          Write-Error ('Printer not ready: ' + $printer.PrinterStatus)
          exit 1
        }
      "
    `;

    exec(checkPrinterCmd, async (checkError, stdout, stderr) => {
      if (checkError) {
        console.error('Printer check error:', stderr);
        return res.status(500).json({
          status: 'error',
          message: 'Printer is not ready. Please check if it is connected and turned on.'
        });
      }

      // If printer is ready, send the print job
      const printCmd = `        powershell.exe -Command "
          Start-Process -FilePath '${previewPath}' -Verb Print -PassThru | 
          ForEach-Object { 
            Start-Sleep -Seconds 1
            $_ | Stop-Process
          }
        "
      `;

      exec(printCmd, (printError, printStdout, printStderr) => {
        if (printError) {
          console.error('Print error:', printError);
          return res.status(500).json({
            status: 'error',
            message: 'Failed to print document. Please try again.'
          });
        }

        res.json({
          status: 'success',
          message: 'Document printed successfully'
        });
      });
    });

  } catch (error) {
    console.error('Print endpoint error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Add a new route for DOCX to PDF conversion
BackendRoutes.post('/convert-docx', upload.single('file'), async (req, res) => {
  console.log('✅ Received conversion request');

  // Check if file was uploaded
  if (!req.file) {
    console.error('❌ No file uploaded');
    return res.status(400).json({
      status: 'error',
      message: 'No file uploaded'
    });
  }

  // Check if the file is a DOCX file
  const fileExtension = path.extname(req.file.originalname).toLowerCase();
  if (fileExtension !== '.docx' && fileExtension !== '.doc') {
    console.error(`❌ Invalid file type: ${fileExtension}`);
    return res.status(400).json({
      status: 'error',
      message: 'Only DOCX and DOC files are supported'
    });
  }

  try {
    // Convert the uploaded DOCX to PDF
    console.log(`🔄 Converting ${req.file.originalname} to PDF using LibreOffice...`);
    console.log(`📁 File path: ${req.file.path}`);
    console.log(`📁 File size: ${(fs.statSync(req.file.path).size / 1024).toFixed(2)} KB`);

    // Verify file exists
    if (!fs.existsSync(req.file.path)) {
      console.error(`❌ File does not exist at path: ${req.file.path}`);
      return res.status(500).json({
        status: 'error',
        message: 'Uploaded file not found on server'
      });
    }

    console.log('🔍 Checking for LibreOffice...');
    const libreOfficePath = await checkLibreOffice().catch(err => {
      console.error('❌ LibreOffice check failed:', err.message);
      return null;
    });

    if (libreOfficePath) {
      console.log(`✅ LibreOffice found at: ${libreOfficePath}`);
    } else {
      console.log('⚠️ Using fallback conversion - LibreOffice not found');
    }

    // Do the conversion
    const result = await convertDocxToPdf(req.file.path);
    console.log('✅ Conversion completed successfully:', result);

    // Check if output file exists
    if (!fs.existsSync(result.filePath)) {
      console.error(`❌ Output file not found at: ${result.filePath}`);
      return res.status(500).json({
        status: 'error',
        message: 'Conversion failed: output file not found'
      });
    }

    console.log(`📝 PDF output size: ${(fs.statSync(result.filePath).size / 1024).toFixed(2)} KB`);

    // Send the converted PDF file
    console.log('📤 Sending converted PDF to client...');
    res.download(result.filePath, req.file.originalname.replace(/\.(docx|doc)$/i, '.pdf'), (err) => {
      if (err) {
        console.error('❌ Error sending file:', err);
      } else {
        console.log('✅ File sent successfully');
      }

      // Clean up temporary files after sending
      cleanupTempFiles([req.file.path, result.filePath]);
    });
  } catch (error) {
    console.error('❌ Conversion error:', error);

    // Determine the type of error for a more specific message
    let errorMessage = `Failed to convert file: ${error.message}`;
    let statusCode = 500;

    if (error.message.includes('LibreOffice not found')) {
      statusCode = 503; // Service Unavailable
      errorMessage = 'LibreOffice is not installed on the server. Please install LibreOffice to enable DOCX to PDF conversion.';
    } else if (error.message.includes('DOCX to PDF conversion failed')) {
      statusCode = 500; // Internal Server Error
      errorMessage = 'LibreOffice conversion failed. The document may be corrupted or incompatible.';
    }

    res.status(statusCode).json({
      status: 'error',
      message: errorMessage,
      details: error.message
    });

    // Clean up the uploaded file on error
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

// Add a new route to refresh Firebase Storage URLs
BackendRoutes.get('/refresh-url', async (req, res) => {
  try {
    const { path } = req.query;

    if (!path) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing storage path parameter'
      });
    }

    console.log(`Refreshing Firebase URL for path: ${path}`);

    try {
      // Get a fresh URL from Firebase Storage with custom token duration
      const fileRef = storageRef(storage, path);

      // Use getDownloadURL with custom settings
      const freshUrl = await getDownloadURL(fileRef);

      // Add cache headers to prevent browser caching
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      console.log('Successfully generated fresh URL with extended duration');

      return res.json({
        status: 'success',
        url: freshUrl,
        expiresAt: Date.now() + (storage._customTokenDuration * 1000) // Convert seconds to milliseconds
      });
    } catch (storageError) {
      console.error('Error getting fresh URL from Firebase Storage:', storageError);
      return res.status(500).json({
        status: 'error',
        message: `Failed to refresh URL: ${storageError.message}`
      });
    }
  } catch (error) {
    console.error('Error in refresh-url endpoint:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Add a proxy endpoint for PDF loading
BackendRoutes.get('/proxy-pdf', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing URL parameter'
      });
    }

    // Set CORS headers
    res.set({
      'Access-Control-Allow-Origin': 'http://localhost:5173',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true'
    });

    // Handle preflight request
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    console.log('📥 Processing PDF proxy request for URL:', url);

    // If it's a Firebase Storage URL, get a fresh URL first
    if (url.includes('firebasestorage.googleapis.com')) {
      try {
        // Extract the storage path and filename from the URL
        const urlObj = new URL(url);
        const pathFromUrl = decodeURIComponent(urlObj.pathname.split('/o/')[1].split('?')[0]);
        const fileName = pathFromUrl.split('/').pop(); // Get the filename from the path
        const fileRef = storageRef(storage, pathFromUrl);

        console.log('📄 Processing Firebase Storage PDF:', fileName);

        // Get a fresh URL with custom token duration
        const freshUrl = await getDownloadURL(fileRef);

        // Forward the request to the fresh URL
        const response = await axios.get(freshUrl, {
          responseType: 'arraybuffer',
          headers: {
            'Cache-Control': 'no-cache'
          }
        });

        // Set appropriate headers
        res.set({
          'Content-Type': 'application/pdf',
          'Content-Length': response.data.length,
          'Cache-Control': 'no-cache'
        });

        console.log('✅ Successfully proxied Firebase PDF:', fileName);
        return res.send(response.data);
      } catch (error) {
        console.error('❌ Error proxying Firebase Storage PDF:', error);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to proxy Firebase Storage PDF'
        });
      }
    }

    // For non-Firebase URLs, just proxy the request
    console.log('📄 Processing external PDF URL');
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'Cache-Control': 'no-cache'
      }
    });

    // Set appropriate headers
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': response.data.length,
      'Cache-Control': 'no-cache'
    });

    console.log('✅ Successfully proxied external PDF');
    return res.send(response.data);
  } catch (error) {
    console.error('❌ Error in proxy-pdf endpoint:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

export default BackendRoutes;

