import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to check if LibreOffice is installed
export const checkLibreOffice = () => {
    return new Promise((resolve, reject) => {
        // Direct path to LibreOffice (hardcoded based on user confirmation)
        const directPath = "C:\\Program Files\\LibreOffice\\program\\soffice.exe";

        // Check if the direct path exists first
        if (fs.existsSync(directPath)) {
            console.log(`Found LibreOffice at hardcoded path: ${directPath}`);
            return resolve(directPath);
        }

        // If direct path doesn't work, try standard command lookup
        const checkCmd = process.platform === 'win32'
            ? 'where soffice'
            : 'which soffice';

        exec(checkCmd, (error, stdout, stderr) => {
            if (error) {
                console.error('LibreOffice not found using PATH:', error);

                // On Windows, try to check common installation directories
                if (process.platform === 'win32') {
                    console.log('Checking common LibreOffice installation directories...');
                    // Common LibreOffice installation paths on Windows
                    const commonPaths = [
                        'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
                        'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
                        'C:\\LibreOffice\\program\\soffice.exe'
                    ];

                    // Check if any of these paths exist
                    for (const path of commonPaths) {
                        if (fs.existsSync(path)) {
                            console.log(`Found LibreOffice at: ${path}`);
                            return resolve(path);
                        }
                    }
                }

                reject(new Error('LibreOffice is not found on your system. Please install LibreOffice from https://www.libreoffice.org/download/download/ and make sure it\'s in your PATH.'));
            } else {
                resolve(stdout.trim());
            }
        });
    });
};

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

// Main conversion function - tries LibreOffice first, then falls back to text-based conversion
export const convertDocxToPdf = async (inputFilePath) => {
    // Get temp directory for output
    const tempDir = path.join(path.dirname(path.dirname(__dirname)), 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    // Try LibreOffice conversion first
    try {
        // Verify LibreOffice is installed
        let libreofficePath;
        try {
            libreofficePath = await checkLibreOffice();
            console.log(`Using LibreOffice at: ${libreofficePath}`);

            // Continue with LibreOffice conversion
            return await new Promise((resolve, reject) => {
                // For Windows command with spaces in paths, use PowerShell
                const psCmd = `powershell.exe -Command "& '${libreofficePath}' --headless --convert-to pdf --outdir '${tempDir}' '${inputFilePath}'"`;

                console.log(`Executing PowerShell command: ${psCmd}`);

                exec(psCmd, (error, stdout, stderr) => {
                    if (error) {
                        console.error('PowerShell conversion error:', error);
                        console.error('PowerShell stderr:', stderr);

                        // If LibreOffice command fails, try fallback method
                        console.log('LibreOffice command failed, trying fallback conversion...');
                        fallbackTextBasedConversion(inputFilePath)
                            .then(result => resolve(result))
                            .catch(fbErr => reject(fbErr));
                        return;
                    }

                    // LibreOffice outputs to the original filename but with .pdf extension
                    const originalName = path.basename(inputFilePath);
                    const expectedOutputName = originalName.replace(/\.(docx|doc)$/i, '.pdf');
                    const actualOutputPath = path.join(tempDir, expectedOutputName);

                    if (!fs.existsSync(actualOutputPath)) {
                        console.error('Output file not found, trying fallback conversion...');
                        fallbackTextBasedConversion(inputFilePath)
                            .then(result => resolve(result))
                            .catch(fbErr => reject(fbErr));
                        return;
                    }

                    // Generate unique output filename
                    const outputFileName = `${uuidv4()}.pdf`;
                    const outputFilePath = path.join(tempDir, outputFileName);

                    // Rename to our UUID filename for better tracking
                    try {
                        fs.renameSync(actualOutputPath, outputFilePath);
                    } catch (renameError) {
                        console.error('Error renaming file:', renameError);
                        return reject(new Error(`Error renaming output file: ${renameError.message}`));
                    }

                    console.log(`Conversion successful: ${stdout}`);
                    resolve({
                        filePath: outputFilePath,
                        fileName: outputFileName
                    });
                });
            });

        } catch (libreOfficeError) {
            // LibreOffice not found, log error and continue to fallback
            console.error('LibreOffice check failed:', libreOfficeError.message);
            console.log('Falling back to text-based conversion...');
        }

        // If we get here, LibreOffice was not available, use fallback
        return await fallbackTextBasedConversion(inputFilePath);

    } catch (error) {
        console.error('Error in conversion process:', error);
        throw error;
    }
};

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