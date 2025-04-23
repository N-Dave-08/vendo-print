import { PDFDocument } from 'pdf-lib';

/**
 * Truncates a PDF file to a maximum of 10 pages
 * @param {ArrayBuffer} pdfBytes - The original PDF file bytes
 * @returns {Promise<{pdfBytes: Uint8Array, pageCount: number}>} - The truncated PDF bytes and actual page count
 */
export const truncatePdfToTenPages = async (pdfBytes) => {
  try {
    // Load the PDF document
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const originalPageCount = pdfDoc.getPageCount();

    // If document has 10 or fewer pages, return it as is
    if (originalPageCount <= 10) {
      return {
        pdfBytes: await pdfDoc.save(),
        pageCount: originalPageCount
      };
    }

    // Create a new PDF document for the truncated version
    const truncatedPdf = await PDFDocument.create();
    
    // Copy only the first 10 pages
    const pagesToCopy = await truncatedPdf.copyPages(pdfDoc, Array.from({ length: 10 }, (_, i) => i));
    
    // Add the copied pages to the new document
    pagesToCopy.forEach(page => truncatedPdf.addPage(page));

    // Save and return the truncated PDF
    return {
      pdfBytes: await truncatedPdf.save(),
      pageCount: 10
    };
  } catch (error) {
    console.error('Error truncating PDF:', error);
    throw error;
  }
}; 