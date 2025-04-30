import express from 'express';
import multer from 'multer';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/firebase-config.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Add at the top of the file after imports
const activeConversions = new Map();

// Helper function to clean up temporary files
const cleanupTempFiles = async (files) => {
  if (!Array.isArray(files)) files = [files];
  for (const file of files) {
    try {
      if (fs.existsSync(file)) {
        await fs.promises.unlink(file);
      }
    } catch (error) {
      console.error(`Error cleaning up file ${file}:`, error);
    }
  }
};

// Function to convert DOCX to PDF using LibreOffice
const convertDocxToPdf = async (inputFilePath, progressCallback) => {
  return new Promise((resolve, reject) => {
    try {
      // Verify input file exists
      if (!fs.existsSync(inputFilePath)) {
        reject(new Error(`Input file not found: ${inputFilePath}`));
        return;
      }

      // Get absolute paths
      const absoluteInputPath = path.resolve(inputFilePath);
      const outputDir = path.dirname(absoluteInputPath);
      const expectedOutputPath = path.join(
        outputDir,
        path.basename(inputFilePath, path.extname(inputFilePath)) + '.pdf'
      );

      console.log('Starting LibreOffice conversion...');
      console.log('Input path:', absoluteInputPath);
      console.log('Output directory:', outputDir);

      // Ensure input file is readable
      try {
        fs.accessSync(absoluteInputPath, fs.constants.R_OK);
      } catch (error) {
        reject(new Error(`Input file is not readable: ${error.message}`));
        return;
      }

      // Ensure output directory exists and is writable
      try {
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        fs.accessSync(outputDir, fs.constants.W_OK);
      } catch (error) {
        reject(new Error(`Output directory is not writable: ${error.message}`));
        return;
      }

      // Start LibreOffice conversion process
      const process = spawn('soffice', [
        '--headless',
        '--convert-to',
        'pdf:writer_pdf_Export',  // Specify the PDF export filter
        '--outdir',
        outputDir,
        absoluteInputPath
      ]);

      // Track progress
      let progress = 0;
      progressCallback?.(progress, 'Starting conversion...');

      let errorOutput = '';

      process.stdout.on('data', (data) => {
        console.log(`LibreOffice stdout: ${data}`);
        progress = Math.min(90, progress + 10);
        progressCallback?.(progress, 'Converting...');
      });

      process.stderr.on('data', (data) => {
        console.error(`LibreOffice stderr: ${data}`);
        errorOutput += data.toString();
      });

      process.on('error', (error) => {
        console.error('Failed to start LibreOffice:', error);
        reject(new Error(`Failed to start LibreOffice: ${error.message}`));
      });

      process.on('exit', async (code) => {
        console.log(`LibreOffice process exited with code ${code}`);
        
        // Even if the process exits with code 0, check for error output
        if (errorOutput.includes('Error:')) {
          reject(new Error(`LibreOffice conversion failed: ${errorOutput.trim()}`));
          return;
        }

        if (code === 0) {
          // Double check if the output file exists and has content
          if (fs.existsSync(expectedOutputPath)) {
            try {
              const stats = await fs.promises.stat(expectedOutputPath);
              if (stats.size > 0) {
                progressCallback?.(100, 'Conversion complete');
                resolve(expectedOutputPath);
              } else {
                reject(new Error('Conversion produced an empty file'));
              }
            } catch (error) {
              reject(new Error(`Error checking output file: ${error.message}`));
            }
          } else {
            reject(new Error(`Output file not found at ${expectedOutputPath}`));
          }
        } else {
          reject(new Error(`LibreOffice conversion failed with code ${code}${errorOutput ? ': ' + errorOutput.trim() : ''}`));
        }
      });
    } catch (error) {
      reject(error);
    }
  });
};

// Add DOCX to PDF conversion endpoint
router.post('/convert-docx', upload.single('file'), async (req, res) => {
  let inputFilePath = null;
  let outputFilePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Get the uploaded file path
    inputFilePath = req.file.path;
    console.log('Converting file:', inputFilePath);

    try {
      // Ensure the file exists and is readable
      await fs.promises.access(inputFilePath, fs.constants.R_OK);

      // Read the file contents to verify it's not empty
      const fileStats = await fs.promises.stat(inputFilePath);
      console.log('Input file size:', fileStats.size, 'bytes');
      
      if (fileStats.size === 0) {
        throw new Error('Input file is empty');
      }

      // Read a small portion of the file to verify it's a valid DOCX
      const header = Buffer.alloc(4);
      const fd = await fs.promises.open(inputFilePath, 'r');
      await fd.read(header, 0, 4, 0);
      await fd.close();
      
      // DOCX files start with PK.. (ZIP format)
      if (header[0] !== 0x50 || header[1] !== 0x4B) {
        throw new Error('File does not appear to be a valid DOCX file');
      }

      // Create output file path before conversion
      outputFilePath = path.join(
        path.dirname(inputFilePath),
        `${path.basename(inputFilePath, path.extname(inputFilePath))}.pdf`
      );

      // Convert DOCX to PDF with progress tracking
      const convertedPath = await convertDocxToPdf(inputFilePath, (progress, message) => {
        console.log(`Conversion progress: ${progress}% - ${message}`);
      });

      // Verify the output file exists and is not empty
      const stats = await fs.promises.stat(convertedPath);
      if (stats.size === 0) {
        throw new Error('Conversion produced an empty file');
      }

      // Read the PDF file
      const pdfData = await fs.promises.readFile(convertedPath);

      // Upload the converted PDF to Firebase Storage
      const pdfFileName = `converted_${Date.now()}_${path.basename(req.file.originalname, path.extname(req.file.originalname))}.pdf`;
      const storagePath = `uploads/${pdfFileName}`;
      
      // Upload to Firebase Storage
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, pdfData, {
        contentType: 'application/pdf',
        customMetadata: {
          originalName: req.file.originalname,
          convertedFrom: 'docx'
        }
      });

      // Get the download URL
      const pdfUrl = await getDownloadURL(storageRef);

      // Clean up temporary files
      await cleanupTempFiles([inputFilePath, convertedPath]);

      // Send the response with the PDF URL
      res.json({
        status: 'success',
        pdfUrl: pdfUrl,
        message: 'File converted successfully'
      });
    } catch (error) {
      // Clean up any temporary files that might exist
      const filesToClean = [inputFilePath];
      if (outputFilePath && fs.existsSync(outputFilePath)) {
        filesToClean.push(outputFilePath);
      }
      await cleanupTempFiles(filesToClean);
      throw error;
    }
  } catch (error) {
    console.error('Error in DOCX to PDF conversion:', error);
    // Clean up any remaining files
    if (inputFilePath || outputFilePath) {
      await cleanupTempFiles([inputFilePath, outputFilePath].filter(Boolean));
    }
    res.status(500).json({ 
      status: 'error',
      message: `Conversion failed: ${error.message}`,
      details: error.stack
    });
  }
});

// Add endpoint to convert DOCX to PDF from URL
router.post('/convert-docx-from-url', async (req, res) => {
  try {
    const { fileUrl, fileName } = req.body;
    
    if (!fileUrl || !fileName) {
      return res.status(400).json({ 
        status: 'error',
        message: 'File URL and filename are required' 
      });
    }

    // Check if this file is already being converted
    const conversionKey = `${fileName}_${fileUrl}`;
    if (activeConversions.has(conversionKey)) {
      console.log('Conversion already in progress for:', fileName);
      // Instead of error status, return success with in-progress flag
      return res.json({
        status: 'success',
        inProgress: true,
        message: 'Conversion in progress'
      });
    }

    // Mark this file as being converted
    activeConversions.set(conversionKey, Date.now());

    console.log('Converting DOCX from URL:', fileUrl);

    try {
      // Download the DOCX file
      const response = await axios.get(fileUrl, {
        responseType: 'arraybuffer',
        timeout: 30000 // 30 second timeout
      });

      // Create temporary file paths with sanitized names
      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Sanitize the filename to remove problematic characters
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const timestamp = Date.now();
      const inputFilePath = path.join(tempDir, `${timestamp}_${sanitizedFileName}`);
      const outputFilePath = path.join(tempDir, `${timestamp}_${sanitizedFileName.replace(/\.(docx|doc)$/i, '.pdf')}`);
      
      // Save the downloaded file
      fs.writeFileSync(inputFilePath, Buffer.from(response.data));
      console.log('Saved input file to:', inputFilePath);

      try {
        // Convert DOCX to PDF using LibreOffice
        await new Promise((resolve, reject) => {
          console.log('Starting LibreOffice conversion...');
          
          // Verify input file
          if (!fs.existsSync(inputFilePath)) {
            reject(new Error(`Input file not found: ${inputFilePath}`));
            return;
          }

          // Get absolute paths
          const absoluteInputPath = path.resolve(inputFilePath);
          const absoluteOutputDir = path.resolve(path.dirname(outputFilePath));

          console.log('Absolute input path:', absoluteInputPath);
          console.log('Absolute output directory:', absoluteOutputDir);

          const process = spawn('soffice', [
            '--headless',
            '--convert-to',
            'pdf',
            '--outdir',
            absoluteOutputDir,
            absoluteInputPath
          ]);

          // Capture stdout
          process.stdout.on('data', (data) => {
            console.log(`LibreOffice stdout: ${data}`);
          });

          // Capture stderr
          process.stderr.on('data', (data) => {
            console.error(`LibreOffice stderr: ${data}`);
          });

          process.on('error', (error) => {
            console.error('Failed to start LibreOffice:', error);
            reject(new Error(`Failed to start LibreOffice: ${error.message}`));
          });

          process.on('exit', (code) => {
            console.log(`LibreOffice process exited with code ${code}`);
            if (code === 0) {
              // Double check if the output file was created
              const expectedOutputPath = path.join(
                path.dirname(outputFilePath),
                path.basename(inputFilePath, path.extname(inputFilePath)) + '.pdf'
              );
              console.log('Checking for output file at:', expectedOutputPath);
              
              if (fs.existsSync(expectedOutputPath)) {
                console.log('Output file exists');
                resolve();
              } else {
                reject(new Error(`Output file not found at ${expectedOutputPath}`));
              }
            } else {
              reject(new Error(`LibreOffice conversion failed with code ${code}`));
            }
          });
        });

        // After conversion, verify the output file exists and is not empty
        const expectedOutputPath = path.join(
          path.dirname(outputFilePath),
          path.basename(inputFilePath, path.extname(inputFilePath)) + '.pdf'
        );
        console.log('Verifying output file:', expectedOutputPath);

        const stats = await fs.promises.stat(expectedOutputPath);
        if (stats.size === 0) {
          throw new Error('Conversion produced an empty file');
        }

        // Read the PDF file
        console.log('Reading converted PDF file');
        const pdfData = fs.readFileSync(expectedOutputPath);

        // Upload the converted PDF to Firebase Storage
        const pdfFileName = `converted_${Date.now()}_${path.basename(fileName, path.extname(fileName))}.pdf`;
        const storagePath = `uploads/${pdfFileName}`;
        
        // Upload to Firebase Storage
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, pdfData, {
          contentType: 'application/pdf',
          customMetadata: {
            originalFileName: fileName,
            convertedFrom: 'docx'
          }
        });

        // Get the download URL
        const pdfUrl = await getDownloadURL(storageRef);

        // Clean up temporary files
        await cleanupTempFiles([inputFilePath, outputFilePath]);

        // Remove the lock after successful conversion and upload
        activeConversions.delete(conversionKey);

        // Send the PDF URL back to the client
        res.json({ 
          status: 'success',
          pdfUrl: pdfUrl,
          message: 'File converted successfully'
        });
      } catch (error) {
        // Remove the lock if conversion fails
        activeConversions.delete(conversionKey);
        throw error;
      }
    } catch (downloadError) {
      console.error('Error downloading file:', downloadError);
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }
  } catch (error) {
    console.error('Error in DOCX to PDF conversion:', error);
    res.status(500).json({ 
      status: 'error',
      message: `Conversion failed: ${error.message}`,
      details: error.stack
    });
  }
});

// Add endpoint for direct USB file conversion
router.post('/convert-docx-direct', async (req, res) => {
  const { filePath } = req.body;
  let outputFilePath = null;

  try {
    if (!filePath) {
      return res.status(400).json({ message: 'No file path provided' });
    }

    console.log('Converting file directly from:', filePath);

    try {
      // Ensure the file exists and is readable
      await fs.promises.access(filePath, fs.constants.R_OK);

      // Create output file path in the temp directory
      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Create a unique output filename
      const timestamp = Date.now();
      const sanitizedName = path.basename(filePath, '.docx').replace(/[^a-zA-Z0-9]/g, '_');
      outputFilePath = path.join(tempDir, `${timestamp}_${sanitizedName}.pdf`);

      // Start LibreOffice conversion process
      await new Promise((resolve, reject) => {
        console.log('Starting LibreOffice conversion...');
        console.log('Input path:', filePath);
        console.log('Output directory:', tempDir);

        const process = spawn('soffice', [
          '--headless',
          '--convert-to',
          'pdf:writer_pdf_Export',
          '--outdir',
          tempDir,
          filePath
        ]);

        let errorOutput = '';

        process.stdout.on('data', (data) => {
          console.log(`LibreOffice stdout: ${data}`);
        });

        process.stderr.on('data', (data) => {
          console.error(`LibreOffice stderr: ${data}`);
          errorOutput += data.toString();
        });

        process.on('error', (error) => {
          console.error('Failed to start LibreOffice:', error);
          reject(new Error(`Failed to start LibreOffice: ${error.message}`));
        });

        process.on('exit', async (code) => {
          console.log(`LibreOffice process exited with code ${code}`);
          
          if (errorOutput.includes('Error:')) {
            reject(new Error(`LibreOffice conversion failed: ${errorOutput.trim()}`));
            return;
          }

          if (code === 0) {
            // Get the actual output file path
            const expectedOutputPath = path.join(
              tempDir,
              `${path.basename(filePath, '.docx')}.pdf`
            );

            if (fs.existsSync(expectedOutputPath)) {
              // Rename to our desired output path
              await fs.promises.rename(expectedOutputPath, outputFilePath);
              resolve();
            } else {
              reject(new Error(`Output file not found at ${expectedOutputPath}`));
            }
          } else {
            reject(new Error(`LibreOffice conversion failed with code ${code}`));
          }
        });
      });

      // Read the converted PDF
      const pdfData = await fs.promises.readFile(outputFilePath);

      // Upload to Firebase Storage
      const pdfFileName = `converted_${Date.now()}_${path.basename(filePath, '.docx')}.pdf`;
      const storagePath = `uploads/${pdfFileName}`;
      
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, pdfData, {
        contentType: 'application/pdf',
        customMetadata: {
          originalPath: filePath,
          convertedFrom: 'docx'
        }
      });

      // Get the download URL
      const pdfUrl = await getDownloadURL(storageRef);

      // Clean up the output file
      await cleanupTempFiles([outputFilePath]);

      // Send the response with the PDF URL
      res.json({
        status: 'success',
        pdfUrl: pdfUrl,
        message: 'File converted successfully'
      });
    } catch (error) {
      if (outputFilePath && fs.existsSync(outputFilePath)) {
        await cleanupTempFiles([outputFilePath]);
      }
      throw error;
    }
  } catch (error) {
    console.error('Error in direct DOCX to PDF conversion:', error);
    res.status(500).json({ 
      status: 'error',
      message: `Conversion failed: ${error.message}`,
      details: error.stack
    });
  }
});

// Add cleanup for stale conversions
setInterval(() => {
  const now = Date.now();
  for (const [key, startTime] of activeConversions.entries()) {
    // Remove locks older than 5 minutes
    if (now - startTime > 5 * 60 * 1000) {
      console.log('Removing stale conversion lock for:', key);
      activeConversions.delete(key);
    }
  }
}, 60000); // Check every minute

// Export the router
export default router; 