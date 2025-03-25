// server.js

// Import lahat ng dependencies
import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import util from 'util';
import { fileURLToPath } from 'url';
import { PDFDocument, rgb, degrees } from 'pdf-lib';


const execPromise = util.promisify(exec);


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const getPrintersFromPowerShell = () => {
  return new Promise((resolve, reject) => {
    const command =
      'powershell.exe -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"';
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Error getting printers:', error);
        return reject(new Error('Failed to retrieve printers'));
      }
      const printerList = stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      resolve(printerList);
    });
  });
};


export const getPrintersHandler = async (req, res) => {
  try {
    const printerNames = await getPrintersFromPowerShell();
    const printers = printerNames.map((name) => ({ name }));
    res.json({ status: 'success', printers });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
};


export const printFileWithSumatra = async (filePath, printerName, isColor) => {
  let command = `"C:\\Program Files\\SumatraPDF\\SumatraPDF.exe" -print-to "${printerName}"`;
  if (isColor === false) {
    command += ' -print-settings "monochrome"';
  }
  command += ` "${filePath}"`;

  try {
    const { stdout, stderr } = await execPromise(command);
    if (stderr) {
      throw new Error(stderr);
    }
    return stdout;
  } catch (error) {
    console.error('Error printing file with Sumatra:', error);
    throw error;
  }
};


const processPdf = async (inputFilePath, options) => {

  const existingPdfBytes = fs.readFileSync(inputFilePath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const totalPages = pdfDoc.getPageCount();
  let pagesToKeep = [];


  if (options.pageOption === "All") {
    pagesToKeep = Array.from({ length: totalPages }, (_, i) => i);
  } else if (options.pageOption === "Odd") {
    pagesToKeep = Array.from({ length: totalPages }, (_, i) => i).filter(i => (i + 1) % 2 === 1);
  } else if (options.pageOption === "Even") {
    pagesToKeep = Array.from({ length: totalPages }, (_, i) => i).filter(i => (i + 1) % 2 === 0);
  } else if (options.pageOption === "Custom") {

    const ranges = options.customPageRange.split(',').map(token => token.trim());
    for (const range of ranges) {
      if (range.includes('-')) {
        const [start, end] = range.split('-').map(Number);
        for (let i = start; i <= end; i++) {
          if (i - 1 < totalPages) pagesToKeep.push(i - 1);
        }
      } else {
        const pageNum = Number(range);
        if (pageNum - 1 < totalPages) pagesToKeep.push(pageNum - 1);
      }
    }
    pagesToKeep = [...new Set(pagesToKeep)].sort((a, b) => a - b);
  }

  const newPdfDoc = await PDFDocument.create();
  const copiedPages = await newPdfDoc.copyPages(pdfDoc, pagesToKeep);


  copiedPages.forEach(page => {

    if (options.orientation === "Landscape") {
      page.setRotation(degrees(90));
    }

    if (options.selectedSize) {
      let width, height;
      switch (options.selectedSize) {
        case "Letter 8.5 x 11":
          width = 8.5 * 72; height = 11 * 72; break;
        case "A4 8.3 x 11.7":
          width = 8.3 * 72; height = 11.7 * 72; break;
        case "Legal 8.5 x 14":
          width = 8.5 * 72; height = 14 * 72; break;
        case "Executive 7.25 x 10.5":
          width = 7.25 * 72; height = 10.5 * 72; break;
        case "Tabloid 11 x 17":
          width = 11 * 72; height = 17 * 72; break;
        case "Statement 5.5 x 8.5":
          width = 5.5 * 72; height = 8.5 * 72; break;
        case "B5 6.9 x 9.8":
          width = 6.9 * 72; height = 9.8 * 72; break;
        case "Custom":
          width = Number(options.customWidth) * 72;
          height = Number(options.customHeight) * 72;
          break;
        case "Fit to Cover":
        case "Shrink to Int":

          width = page.getWidth();
          height = page.getHeight();
          break;
        default:
          width = page.getWidth();
          height = page.getHeight();
      }
      page.setSize(width, height);
    }

    newPdfDoc.addPage(page);
  });

  const newPdfBytes = await newPdfDoc.save();
  return newPdfBytes;
};


export const printFileHandler = async (req, res) => {
  let filePath = '';
  let processedFilePath = '';
  try {

    const { 
      printerName, 
      fileUrl, 
      isColor, 
      selectedPageOption, 
      customPageRange, 
      orientation, 
      selectedSize, 
      customWidth, 
      customHeight,
      copies
    } = req.body;

    if (!printerName || !fileUrl) {
      return res.status(400).json({
        status: 'error',
        error: 'Missing printerName or fileUrl in request body.',
      });
    }


    const printers = await getPrintersFromPowerShell();
    if (!printers.includes(printerName)) {
      return res.status(404).json({
        status: 'error',
        error: 'Printer not found',
      });
    }

    const documentsDir = path.join(__dirname, 'documents');
    if (!fs.existsSync(documentsDir)) {
      fs.mkdirSync(documentsDir, { recursive: true });
    }

    const fileName = `${uuidv4()}.pdf`;
    filePath = path.join(documentsDir, fileName);
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(filePath, response.data);


    const pdfBytes = await processPdf(filePath, { 
      pageOption: selectedPageOption || "All",
      customPageRange: customPageRange || "",
      orientation: orientation || "Portrait",
      selectedSize: selectedSize || "Letter 8.5 x 11",
      customWidth: customWidth || "",
      customHeight: customHeight || ""
    });


    const processedFileName = `${uuidv4()}_processed.pdf`;
    processedFilePath = path.join(documentsDir, processedFileName);
    fs.writeFileSync(processedFilePath, pdfBytes);


    const numCopies = copies && copies > 0 ? copies : 1;
    for (let i = 0; i < numCopies; i++) {
      await printFileWithSumatra(processedFilePath, printerName, isColor);
    }


    fs.unlinkSync(filePath);
    fs.unlinkSync(processedFilePath);

    return res.json({
      status: 'success',
      message: 'Print job sent successfully.',
      success: true,
    });
  } catch (error) {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    if (processedFilePath && fs.existsSync(processedFilePath)) {
      fs.unlinkSync(processedFilePath);
    }
    console.error('Error during print operation:', error);
    return res.status(500).json({ status: 'error', error: error.message });
  }
};

