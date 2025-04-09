import { exec } from 'child_process';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import mammoth from 'mammoth';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { rgb } from 'pdf-lib';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to kill any hanging LibreOffice processes
async function killLibreOfficeProcesses() {
    try {
        await execAsync('powershell -Command "Stop-Process -Name \\"soffice\\" -Force -ErrorAction SilentlyContinue"');
        console.log('Killed existing LibreOffice processes');
    } catch (error) {
        console.log('No LibreOffice processes to kill');
    }
}

// Function to check if LibreOffice is installed
export async function checkLibreOffice() {
    const possiblePaths = [
                        'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
                        'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
        'C:\\Program Files (x86)\\LibreOffice 7\\program\\soffice.exe',
        'C:\\Program Files\\LibreOffice 7\\program\\soffice.exe'
                    ];

    for (const path of possiblePaths) {
                        if (fs.existsSync(path)) {
            return path;
                    }
                }

    throw new Error('LibreOffice not found. Please install LibreOffice first.');
            }

// Fallback text-based conversion when LibreOffice is not available
export const fallbackTextBasedConversion = async (inputFilePath) => {
    console.log('Using fallback text-based conversion method...');

    // Get temp directory for output
    const tempDir = path.join(path.dirname(path.dirname(__dirname)), 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    // Generate unique output filename
    const outputFileName = `${uuidv4()}.pdf`;
    const outputFilePath = path.join(tempDir, outputFileName);

    try {
        // Read the DOCX file content as binary
        const fileContent = fs.readFileSync(inputFilePath);

        // Try to extract text from DOCX (very simple approach)
        let textContent = '';
        const stringContent = fileContent.toString();

        // Very basic text extraction - this will not work well for all DOCX files
        // but provides a minimal fallback when LibreOffice is not available
        const textChunks = stringContent.match(/[A-Za-z0-9\s.,;:'"!?()[\]{}@#$%^&*+=\-_\\|/<>]+/g);
        if (textChunks && textChunks.length > 0) {
            textContent = textChunks.join(' ').replace(/\s+/g, ' ');
        } else {
            textContent = "This document could not be properly converted without LibreOffice.\nPlease install LibreOffice for better conversion quality.";
        }

        // Create a very simple PDF with just the text
        // This is just a text file with a PDF extension as a placeholder
        // In a real implementation, you would want to use a PDF library here
        fs.writeFileSync(outputFilePath, `
%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources 4 0 R /MediaBox [0 0 612 792] /Contents 6 0 R >>
endobj
4 0 obj
<< /Font << /F1 5 0 R >> >>
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
6 0 obj
<< /Length 168 >>
stream
BT
/F1 12 Tf
72 720 Td
(DOCX to PDF Conversion - Fallback Method) Tj
0 -20 Td
(Warning: LibreOffice was not available for proper conversion.) Tj
0 -20 Td
(For better quality conversion, please install LibreOffice.) Tj
0 -40 Td
(Document Text:) Tj
0 -20 Td
(${textContent.substring(0, 1000)}${textContent.length > 1000 ? '... (content truncated)' : ''}) Tj
ET
endstream
endobj
xref
0 7
0000000000 65535 f
0000000010 00000 n
0000000060 00000 n
0000000120 00000 n
0000000220 00000 n
0000000270 00000 n
0000000340 00000 n
trailer
<< /Size 7 /Root 1 0 R >>
startxref
560
%%EOF
`);

        console.log(`Fallback conversion completed. Output saved to: ${outputFilePath}`);
        return {
            filePath: outputFilePath,
            fileName: outputFileName
        };
    } catch (error) {
        console.error('Error in fallback conversion:', error);
        throw new Error(`Fallback conversion failed: ${error.message}`);
    }
};

// Add file validation function
export const validateFile = async (filePath) => {
    try {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            throw new Error('File does not exist');
        }

        // Check file size (max 100MB)
        const stats = fs.statSync(filePath);
        if (stats.size > 100 * 1024 * 1024) {
            throw new Error('File is too large (max 100MB)');
        }

        // Check if file is readable
        await fs.promises.access(filePath, fs.constants.R_OK);

        return true;
    } catch (error) {
        console.error('File validation error:', error);
        throw error;
    }
};

// Add function to copy file to temp directory
export const copyToTemp = async (filePath) => {
    try {
        // Create temp directory if it doesn't exist
    const tempDir = path.join(path.dirname(path.dirname(__dirname)), 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

        // Generate unique filename
        const uniqueId = `${Date.now()}-${uuidv4()}`;
        const ext = path.extname(filePath);
        const tempFilePath = path.join(tempDir, `${uniqueId}${ext}`);

        // Copy file
        await fs.promises.copyFile(filePath, tempFilePath);

        // Verify copy was successful
        const sourceStats = fs.statSync(filePath);
        const destStats = fs.statSync(tempFilePath);
        if (sourceStats.size !== destStats.size) {
            throw new Error('File copy verification failed');
        }

        return tempFilePath;
    } catch (error) {
        console.error('Error copying file to temp directory:', error);
        throw error;
    }
};

// Main conversion function
export async function convertDocxToPdf(inputFilePath, progressCallback = () => {}) {
    let tempInputFile = null;
    try {
        // Kill any hanging LibreOffice processes
        await killLibreOfficeProcesses();
        progressCallback(10);

        // Get absolute paths and normalize them
        const absoluteInputPath = path.resolve(inputFilePath);
        const tempDir = path.resolve(path.join(__dirname, '../printer/temp'));
        const scriptPath = path.resolve(path.join(__dirname, '../scripts/convert.ps1'));

        console.log('Input file path:', absoluteInputPath);
        console.log('Temp directory:', tempDir);
        console.log('Script path:', scriptPath);

        // Validate input file exists and is accessible
        try {
            await fs.promises.access(absoluteInputPath, fs.constants.R_OK);
        } catch (error) {
            throw new Error(`Cannot access input file at: ${absoluteInputPath}. Error: ${error.message}`);
        }

        // Ensure temp directory exists
        if (!fs.existsSync(tempDir)) {
            throw new Error(`Temp directory not found at: ${tempDir}`);
        }

        // Clean old files from temp directory
        const files = fs.readdirSync(tempDir);
        for (const file of files) {
            if (file.endsWith('.pdf') || file.endsWith('.docx')) {
                try {
                    fs.unlinkSync(path.join(tempDir, file));
                } catch (error) {
                    console.error('Error cleaning up old file:', error);
                }
            }
        }

        // Copy input file to temp directory with a simple name
        const tempFileName = `${Date.now()}.docx`;
        tempInputFile = path.join(tempDir, tempFileName);
        await fs.promises.copyFile(absoluteInputPath, tempInputFile);
        console.log('Copied input file to:', tempInputFile);

        // Verify the file was copied successfully
        try {
            await fs.promises.access(tempInputFile, fs.constants.R_OK);
            const stats = fs.statSync(tempInputFile);
            console.log('Temp file size:', stats.size);
            if (stats.size === 0) {
                throw new Error('Copied file is empty');
            }
        } catch (error) {
            throw new Error(`Failed to verify copied file: ${error.message}`);
        }

        // Get LibreOffice path
        const libreOfficePath = await checkLibreOffice();
        console.log('Using LibreOffice at:', libreOfficePath);

        // Create PowerShell command to run the script
        const psCommand = `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}" -inputFile "${tempInputFile}" -outputDir "${tempDir}" -libreOfficePath "${libreOfficePath}"`;

        console.log('Executing command:', psCommand);

        // Execute PowerShell command with increased buffer and shell option
        const { stdout, stderr } = await execAsync(psCommand, {
            windowsHide: true,
            maxBuffer: 1024 * 1024 * 10, // 10MB buffer
            shell: true,
            timeout: 120000 // 2 minutes timeout
        });

        console.log('PowerShell stdout:', stdout);
        if (stderr) {
            console.error('PowerShell stderr:', stderr);
            throw new Error(`PowerShell error: ${stderr}`);
        }

        progressCallback(80);

        // The output file will have the same name as the temp input but with .pdf extension
        const expectedOutputFile = path.join(tempDir, `${tempFileName.replace('.docx', '.pdf')}`);

        console.log('Expected output file:', expectedOutputFile);

        // Wait a bit for the file system to sync
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check if the file exists
        if (!fs.existsSync(expectedOutputFile)) {
            throw new Error(`PDF conversion failed - output file not found at ${expectedOutputFile}`);
        }

        // Check if the file has content
        const stats = fs.statSync(expectedOutputFile);
        if (stats.size === 0) {
            throw new Error('PDF conversion failed - output file is empty');
        }

        progressCallback(100);
        return expectedOutputFile;

    } catch (error) {
        console.error('Error in conversion process:', error);
        throw error;
    } finally {
        // Clean up temporary input file
        if (tempInputFile && fs.existsSync(tempInputFile)) {
            try {
                fs.unlinkSync(tempInputFile);
            } catch (error) {
                console.error('Error cleaning up temp input file:', error);
            }
        }
        // Kill any remaining LibreOffice processes
        await killLibreOfficeProcesses();
    }
}

// Clean up temporary files
export const cleanupTempFiles = (filePaths) => {
    if (!Array.isArray(filePaths)) {
        filePaths = [filePaths];
    }

    filePaths.forEach(filePath => {
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                console.log(`Deleted temporary file: ${filePath}`);
            } catch (error) {
                console.error(`Failed to delete temporary file ${filePath}:`, error);
            }
        }
    });
}; 