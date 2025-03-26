// BackendRoutes.js
import express from 'express';
import { addData, getData } from '../controller/firebase_controller.js';
// I-import natin ang mga handler na bagong pangalan
import { getPrintersHandler, printFileHandler } from '../printer/printer_controller.js';
import { scanWithWIA, copyHandler, checkScanner } from '../printer/copy_controller.js';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BackendRoutes = express.Router();

// Add a debounce mechanism to prevent multiple scans
let lastScanTime = 0;
const SCAN_DEBOUNCE_TIME = 2000; // 2 seconds debounce

// Firebase Routes
BackendRoutes.post('/add-data', addData);
BackendRoutes.get('/get-files', getData);

// Printer Routes
BackendRoutes.get('/printers', getPrintersHandler);
BackendRoutes.post('/print', printFileHandler);
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

export default BackendRoutes;

