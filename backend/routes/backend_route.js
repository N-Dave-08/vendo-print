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
import FormData from 'form-data';
// Import the conversion service
import { convertDocxToPdf, cleanupTempFiles, checkLibreOffice } from '../services/conversion_service.js';
// Import Firebase storage reference
import { storage } from "../firebase/firebase-config.js";
import { ref as storageRef, getDownloadURL, uploadBytes } from "firebase/storage";
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
  let jpegPath = null;

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

    // Convert BMP to JPEG using ImageMagick
    jpegPath = outputPath.replace('.bmp', '.jpg');
    console.log('Converting BMP to JPEG:', jpegPath);
    
    // Using PowerShell to call System.Drawing which is available on Windows
    const convertCmd = `
      powershell.exe -Command "
        Add-Type -AssemblyName System.Drawing
        
        try {
          # Wait a moment to ensure file is ready for read access
          Start-Sleep -Seconds 1
          
          # Make sure the source file exists
          if (!(Test-Path '${outputPath}')) {
            Write-Error 'Source BMP file does not exist'
            exit 1
          }
          
          # Get file info
          $fileInfo = Get-Item '${outputPath}'
          Write-Output ('Source BMP file size: ' + $fileInfo.Length + ' bytes')
          
          $bitmap = New-Object System.Drawing.Bitmap '${outputPath}'
          Write-Output ('Loaded bitmap: ' + $bitmap.Width + 'x' + $bitmap.Height)
          
          $encoderParam = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 85)
          $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
          $encoderParams.Param[0] = $encoderParam
          $jpegCodecInfo = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
          
          $bitmap.Save('${jpegPath}', $jpegCodecInfo, $encoderParams)
          $bitmap.Dispose()
          
          # Verify the output file was created
          if (Test-Path '${jpegPath}') {
            $jpegInfo = Get-Item '${jpegPath}'
            Write-Output ('JPEG file created: ' + $jpegInfo.Length + ' bytes')
            exit 0
          } else {
            Write-Error 'JPEG file was not created'
            exit 1
          }
        } catch {
          Write-Error $_
          exit 1
        }
      "
    `;

    await new Promise((resolve, reject) => {
      exec(convertCmd, { timeout: 30000 }, (error, stdout, stderr) => {
        if (error) {
          console.error('Image conversion error:', stderr);
          // If conversion fails, fall back to original BMP
          resolve(outputPath);
        } else {
          console.log('Image converted successfully');
          // Only delete BMP file after confirming JPEG exists
          if (fs.existsSync(jpegPath)) {
            try {
              fs.unlinkSync(outputPath);
              console.log('Original BMP file deleted');
            } catch (err) {
              console.error('Error deleting BMP file:', err);
            }
            resolve(jpegPath);
          } else {
            console.log('JPEG file not found, keeping BMP file');
            resolve(outputPath);
          }
        }
      });
    });

    // Send the JPEG if it exists, otherwise fall back to BMP
    const fileToSend = fs.existsSync(jpegPath) ? jpegPath : outputPath;
    console.log(`Sending file: ${fileToSend}`);

    // Verify file existence before sending
    if (!fs.existsSync(fileToSend)) {
      console.error(`File to send does not exist: ${fileToSend}`);
      throw new Error('File to send does not exist');
    }

    // Set appropriate cache control headers to prevent caching issues
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    // Send the file and handle cleanup
    res.sendFile(fileToSend, (err) => {
      if (err) {
        console.error('Error sending file:', err);
      } else {
        console.log(`File sent successfully: ${fileToSend}`);
      }
      // Clean up after sending
      if (fileToSend && fs.existsSync(fileToSend)) {
        fs.unlinkSync(fileToSend);
        console.log(`Cleaned up file: ${fileToSend}`);
      }
    });
  } catch (error) {
    console.error('Error during preview scan:', error);
    // Clean up any temporary files
    [outputPath, jpegPath].forEach(filePath => {
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (cleanupError) {
          console.error('Error during cleanup:', cleanupError);
        }
      }
    });
    
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

// Update the DOCX to PDF conversion route
BackendRoutes.post('/convert-docx', upload.single('file'), async (req, res) => {
  console.log('✅ Received conversion request');

  if (!req.file) {
    console.error('❌ No file uploaded');
    return res.status(400).json({
      status: 'error',
      message: 'No file uploaded'
    });
  }

  const fileExtension = path.extname(req.file.originalname).toLowerCase();
  if (fileExtension !== '.docx' && fileExtension !== '.doc') {
    console.error(`❌ Invalid file type: ${fileExtension}`);
    return res.status(400).json({
      status: 'error',
      message: 'Only DOCX and DOC files are supported'
    });
  }

  try {
    // Check LibreOffice installation
    console.log('🔍 Checking for LibreOffice...');
    await checkLibreOffice();

    // Convert the file
    console.log(`🔄 Converting ${req.file.originalname} to PDF...`);
    const pdfPath = await convertDocxToPdf(req.file.path);

    if (!pdfPath || !fs.existsSync(pdfPath)) {
      throw new Error('PDF conversion failed - output file not found');
    }

    // Upload the converted PDF to Firebase Storage
    console.log('📤 Uploading converted PDF to Firebase Storage...');
    const pdfFileName = path.basename(pdfPath);
    const storagePath = `uploads/${Date.now()}_${pdfFileName}`;

    // Create a reference to Firebase Storage
    const pdfRef = storageRef(storage, storagePath);

    // Read the PDF file
    const pdfBuffer = fs.readFileSync(pdfPath);

    // Upload to Firebase Storage
    await uploadBytes(pdfRef, pdfBuffer, {
      contentType: 'application/pdf',
      customMetadata: {
        originalName: req.file.originalname,
        convertedFrom: 'docx'
      }
    });

    // Get the download URL
    const pdfUrl = await getDownloadURL(pdfRef);

    // Clean up temporary files
    console.log('🧹 Cleaning up temporary files...');
    await cleanupTempFiles(req.file.path, pdfPath);

    // Return the Firebase Storage URL
    res.json({
      status: 'success',
      message: 'File converted successfully',
      pdfUrl
    });

  } catch (error) {
    console.error('❌ Conversion error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to convert file'
    });

    // Clean up on error
    try {
      await cleanupTempFiles(req.file.path);
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
  }
});

// Add a new Docker-based conversion endpoint
BackendRoutes.post('/docker-convert-docx', upload.single('file'), async (req, res) => {
  console.log('✅ Received Docker conversion request');

  if (!req.file) {
    console.error('❌ No file uploaded');
    return res.status(400).json({
      status: 'error',
      message: 'No file uploaded'
    });
  }

  const fileExtension = path.extname(req.file.originalname).toLowerCase();
  if (fileExtension !== '.docx' && fileExtension !== '.doc') {
    console.error(`❌ Invalid file type: ${fileExtension}`);
    return res.status(400).json({
      status: 'error',
      message: 'Only DOCX and DOC files are supported'
    });
  }

  try {
    console.log(`🔄 Converting ${req.file.originalname} using Docker service...`);
    console.log(`📁 File path: ${req.file.path}`);

    // Create a form with the file to send to the Docker service
    const form = new FormData();
    form.append('document', fs.createReadStream(req.file.path));

    // Send the file to the Docker service
    const dockerResponse = await axios.post('http://localhost:8080/pdf', form, {
      headers: {
        ...form.getHeaders(),
        'Accept': 'application/pdf'
      },
      responseType: 'arraybuffer' // Important to handle binary PDF data
    });

    // Convert the response to a Buffer
    const pdfBuffer = Buffer.from(dockerResponse.data);

    // Generate a unique filename for the PDF
    const pdfFileName = `${Date.now()}_${path.basename(req.file.originalname, fileExtension)}.pdf`;
    const pdfPath = path.join(path.dirname(req.file.path), pdfFileName);

    // Save the PDF locally
    fs.writeFileSync(pdfPath, pdfBuffer);

    console.log(`✅ PDF conversion successful, saved to: ${pdfPath}`);

    // Upload the converted PDF to Firebase Storage
    console.log('📤 Uploading converted PDF to Firebase Storage...');
    const storagePath = `uploads/${pdfFileName}`;

    // Create a reference to Firebase Storage
    const pdfRef = storageRef(storage, storagePath);

    // Upload to Firebase Storage using uploadBytes instead of put
    await uploadBytes(pdfRef, pdfBuffer, {
      contentType: 'application/pdf',
      customMetadata: {
        originalName: req.file.originalname,
        convertedFrom: 'docx',
        convertedUsing: 'docker'
      }
    });

    // Get the download URL
    const pdfUrl = await getDownloadURL(pdfRef);

    // Clean up temporary files
    cleanupTempFiles(req.file.path, pdfPath);

    // Return the Firebase Storage URL
    res.json({
      status: 'success',
      message: 'File converted successfully using Docker service',
      pdfUrl
    });

  } catch (error) {
    console.error('❌ Docker conversion error:', error.message);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to convert file using Docker service'
    });

    // Clean up on error
    try {
      cleanupTempFiles(req.file.path);
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
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

// Add route for updating print job status
BackendRoutes.post('/update-print-job', async (req, res) => {
  try {
    const { printJobId, status, progress, statusMessage } = req.body;

    if (!printJobId) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing print job ID'
      });
    }

    // Import Firebase Realtime Database functions
    const { getDatabase, ref, update } = await import('firebase/database');
    const db = getDatabase();
    
    // Update the print job in Firebase
    const printJobRef = ref(db, `printJobs/${printJobId}`);
    const updates = {};
    
    if (status) updates.status = status;
    if (progress !== undefined) updates.progress = progress;
    if (statusMessage) updates.statusMessage = statusMessage;
    updates.lastUpdated = Date.now();
    
    await update(printJobRef, updates);
    
    res.json({
      status: 'success',
      message: 'Print job updated successfully'
    });
  } catch (error) {
    console.error('Error updating print job:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to update print job'
    });
  }
});

// Add this route to read files from USB drives
BackendRoutes.get('/read-file', async (req, res) => {
  try {
    const filePath = req.query.path;
    
    if (!filePath) {
      return res.status(400).json({ error: 'No file path provided' });
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Get file stats to determine MIME type
    const stats = fs.statSync(filePath);
    
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Path is not a file' });
    }
    
    // Determine MIME type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    let mimeType = 'application/octet-stream'; // Default MIME type
    
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    
    if (mimeTypes[ext]) {
      mimeType = mimeTypes[ext];
    }
    
    // Set appropriate headers
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
    
    // Stream the file to the response
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error reading file:', error);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

export default BackendRoutes;

