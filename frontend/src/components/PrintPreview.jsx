import React, { useState, useEffect, useRef } from "react";
import { X, Printer, Download, Check } from "lucide-react";
import axios from "axios";

// Add styles to clean up the preview
const previewStyles = {
  container: {
    backgroundColor: '#fff',
    margin: '0',
    padding: '0',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    height: '100%'
  },
  header: {
    padding: '1rem',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff'
  },
  previewArea: {
    flex: 1,
    overflow: 'auto',
    padding: '0',
    margin: '0',
    backgroundColor: '#fff'
  }
};

const PrintPreview = ({ fileUrl, onClose, printOptions = {} }) => {
  const [loading, setLoading] = useState(true);
  const [printSuccess, setPrintSuccess] = useState(false);
  const [blobUrl, setBlobUrl] = useState(null);
  const [printerName, setPrinterName] = useState("");
  const [printers, setPrinters] = useState([]);
  const [printSettings, setPrintSettings] = useState({
    copies: printOptions.copies || 1,
    isColor: printOptions.isColor || false,
    orientation: printOptions.orientation || "portrait",
    paperSize: printOptions.paperSize || "letter", // Use letter size (8.5x11)
    scale: printOptions.scale || "fit-to-page" // Set scale to fit to page
  });
  const iframeRef = useRef(null);

  // Function to check if a printer name is likely a virtual printer
  const isVirtualPrinter = (printerName) => {
    const virtualPrinterPatterns = [
      'microsoft', 'pdf', 'xps', 'document writer', 'onedrive', 
      'fax', 'print to', 'onenote', 'adobe pdf'
    ];
    
    const lowerName = printerName.toLowerCase();
    return virtualPrinterPatterns.some(pattern => lowerName.includes(pattern));
  };

  useEffect(() => {
    // Fetch the file and create a blob URL to prevent auto-download
    const fetchDocument = async () => {
      try {
        setLoading(true);
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setLoading(false);
      } catch (error) {
        console.error("Error loading document:", error);
        setLoading(false);
      }
    };

    fetchDocument();

    // Cleanup function to revoke URL when component unmounts
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [fileUrl]);

  // Fetch printers from API
  useEffect(() => {
    const fetchPrinters = async () => {
      try {
        const response = await axios.get("http://localhost:5000/api/printers");
        const printerList = response.data.printers || [];
        setPrinters(printerList);
        
        // Auto-select first printer if available
        if (printerList.length > 0 && !printerName) {
          // Try to find a physical printer first
          const physicalPrinters = printerList.filter(printer => !isVirtualPrinter(printer.name));
          
          if (physicalPrinters.length > 0) {
            // Use the first physical printer
            setPrinterName(physicalPrinters[0].name);
          } else {
            // Fall back to the first printer in the list if no physical printers found
            setPrinterName(printerList[0].name);
          }
        }
      } catch (error) {
        console.error("Error fetching printers:", error);
      }
    };
    
    fetchPrinters();
  }, []);

  const handleCopiesChange = (e) => {
    const value = parseInt(e.target.value);
    if (value > 0 && value <= 10) {
      setPrintSettings({ ...printSettings, copies: value });
    }
  };

  const handleColorChange = (e) => {
    setPrintSettings({ ...printSettings, isColor: e.target.checked });
  };

  const handleOrientationChange = (e) => {
    setPrintSettings({ ...printSettings, orientation: e.target.value });
  };

  const handlePrint = async () => {
    try {
      setLoading(true);

      // Create a FormData object to send the file and settings to the backend
      const formData = new FormData();

      // Get the blob from the blobUrl
      const response = await fetch(blobUrl);
      const blob = await response.blob();

      // Create a unique ID for the job
      const printJobId = Date.now().toString();

      // Append the file and print settings
      formData.append('file', blob, 'document.pdf');
      formData.append('printerName', printerName || 'EPSON L3210 Series');
      formData.append('isColor', printSettings.isColor);
      formData.append('copies', printSettings.copies);
      formData.append('orientation', printSettings.orientation);
      formData.append('paperSize', printSettings.paperSize);
      formData.append('scale', printSettings.scale);
      formData.append('jobId', printJobId);
      formData.append('printJobId', printJobId);

      // Call the backend API to handle the print job
      const printResponse = await fetch('/api/print', {
        method: 'POST',
        body: formData,
      });

      if (!printResponse.ok) {
        throw new Error('Print job failed');
      }

      // Show success message
      setPrintSuccess(true);

      // Close after showing success
      setTimeout(() => {
        // Return settings to parent component
        onClose(printSettings);
      }, 1500);
    } catch (error) {
      console.error("Error printing document:", error);
      alert("Failed to print document. Please try again.");
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  const handleDownload = () => {
    // Create a temporary link element to trigger download
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = "document"; // You can pass a filename if available
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white w-full h-full flex flex-col max-w-6xl mx-auto my-4 rounded-lg overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">Print Preview</h2>
          <button onClick={handleCancel} className="p-2 rounded-full hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Print Settings */}
          <div className="w-64 p-4 border-r overflow-y-auto bg-gray-50">
            <h3 className="font-medium mb-4">Print Settings</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Copies</label>
              <input
                type="number"
                min="1"
                max="10"
                value={printSettings.copies}
                onChange={handleCopiesChange}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <div className="mb-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={printSettings.isColor}
                  onChange={handleColorChange}
                  className="rounded-sm"
                />
                <span className="text-sm font-medium text-gray-700">Color</span>
              </label>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Orientation</label>
              <select
                value={printSettings.orientation}
                onChange={handleOrientationChange}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>

            {/* Paper Size */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Paper Size</label>
              <div className="px-3 py-2 border rounded-md bg-gray-100 text-gray-700">
                Letter (8.5 x 11 in)
              </div>
            </div>

            {/* Scale */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Scale</label>
              <div className="px-3 py-2 border rounded-md bg-gray-100 text-gray-700">
                Fit to page
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Printer</label>
              <div className="flex items-center border rounded-md p-3 bg-white">
                <Printer className="w-5 h-5 mr-3 text-blue-500" />
                <span className="font-medium">{printerName || "Loading printer..."}</span>
              </div>
            </div>
          </div>

          {/* Document Preview */}
          <div className="flex-1 overflow-auto bg-gray-200 relative">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center">
                  <svg className="animate-spin h-10 w-10 text-primary mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-gray-600">Loading document preview...</p>
                </div>
              </div>
            ) : printSuccess ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="bg-white p-8 rounded-lg shadow-md text-center">
                  <div className="mb-4 text-green-500">
                    <Check size={64} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Print Job Sent!</h3>
                  <p className="text-gray-600">Your document has been sent to the printer.</p>
                </div>
              </div>
            ) : (
              <iframe
                ref={iframeRef}
                src={`${blobUrl}#toolbar=0&navpanes=0&scrollbar=0&paperSize=letter&pagemode=thumbs&view=FitH&scale=100&printScale=fit-to-page`}
                className="w-full h-full border-none"
                title="Document Preview"
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-between items-center">
          <div className="text-sm text-gray-500">
            {!loading && !printSuccess && `${printSettings.copies} ${printSettings.copies > 1 ? 'copies' : 'copy'}, ${printSettings.isColor ? 'Color' : 'Black & White'}, ${printSettings.orientation}, Letter (8.5 x 11 in), Fit to page`}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>

            {!printSuccess && !loading && (
              <>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
                >
                  <Download size={16} />
                  <span>Download</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark flex items-center gap-2"
                >
                  <Printer size={16} />
                  <span>Print</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintPreview; 