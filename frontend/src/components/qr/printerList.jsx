import React, { useState, useEffect } from "react";
import axios from "axios";

const PrinterList = ({ selectedPrinter, setSelectedPrinter }) => {
  const [printers, setPrinters] = useState([]);
  const [printerStatus, setPrinterStatus] = useState({});
  const [error, setError] = useState(null);

  // Function to check if a printer name is likely a virtual printer
  const isVirtualPrinter = (printerName) => {
    const virtualPrinterPatterns = [
      'microsoft', 'pdf', 'xps', 'document writer', 'onedrive', 
      'fax', 'print to', 'onenote', 'adobe pdf'
    ];
    
    const lowerName = printerName.toLowerCase();
    return virtualPrinterPatterns.some(pattern => lowerName.includes(pattern));
  };

  // Fetch the list of printers
  useEffect(() => {
    axios
      .get("http://localhost:5000/api/printers")
      .then((response) => {
        const printerList = response.data.printers || [];
        setPrinters(printerList);

        // Initialize status for all printers
        const statusObj = {};
        printerList.forEach(printer => {
          statusObj[printer.name] = { status: "Unknown", loading: false };
        });
        setPrinterStatus(statusObj);
        
        // Auto-select first printer if printers are available and none is selected
        if (printerList.length > 0 && (!selectedPrinter || selectedPrinter === "")) {
          // Try to find a physical printer first
          const physicalPrinters = printerList.filter(printer => !isVirtualPrinter(printer.name));
          
          if (physicalPrinters.length > 0) {
            // Use the first physical printer
            setSelectedPrinter(physicalPrinters[0].name);
          } else {
            // Fall back to the first printer in the list if no physical printers found
            setSelectedPrinter(printerList[0].name);
          }
        }
      })
      .catch((error) => {
        setError("Failed to fetch printers");
        console.error(error);
      });
  }, []);

  // Fetch capabilities when a printer is selected
  useEffect(() => {
    if (selectedPrinter) {
      // Set loading state
      setPrinterStatus(prev => ({
        ...prev,
        [selectedPrinter]: { ...prev[selectedPrinter], loading: true }
      }));

      // Fetch printer capabilities
      axios
        .get(`http://localhost:5000/api/printers/${encodeURIComponent(selectedPrinter)}/capabilities`)
        .then((response) => {
          const capabilities = response.data.capabilities;
          const status = capabilities.capabilities?.status || "Ready";

          setPrinterStatus(prev => ({
            ...prev,
            [selectedPrinter]: { status, loading: false }
          }));
        })
        .catch((error) => {
          console.error("Failed to fetch printer capabilities:", error);
          setPrinterStatus(prev => ({
            ...prev,
            [selectedPrinter]: { status: "Error", loading: false }
          }));
        });
    }
  }, [selectedPrinter]);

  // Get status indicator class based on printer status
  const getStatusClass = (status) => {
    if (!status) return "badge-neutral";

    status = status.toLowerCase();
    if (status === "ready") return "badge-success";
    if (status === "error") return "badge-error";
    if (status === "offline") return "badge-error";
    if (status === "printing") return "badge-info";
    return "badge-warning"; // Default for other states
  };

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body p-4">
        <h2 className="card-title text-lg mb-2">Connected Printer</h2>
        
        {error && (
          <div className="alert alert-error mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{error}</span>
          </div>
        )}

        <div className="form-control w-full">
          {!selectedPrinter ? (
            <div className="flex items-center border rounded-lg p-3 bg-base-100">
              <span className="loading loading-spinner loading-xs mr-2"></span>
              <span>Connecting to printer...</span>
            </div>
          ) : (
            <div className="flex items-center border rounded-lg p-3 bg-base-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 text-primary" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{selectedPrinter}</span>
            </div>
          )}
        </div>

        {/* Show printer status when one is selected */}
        {selectedPrinter && printerStatus[selectedPrinter] && (
          <div className="mt-3 flex items-center gap-2">
            <div className={`badge ${getStatusClass(printerStatus[selectedPrinter].status)}`}>
              {printerStatus[selectedPrinter].loading
                ? "Checking status..."
                : `Status: ${printerStatus[selectedPrinter].status || "Ready"}`}
            </div>
          </div>
        )}
        
        {selectedPrinter && (
          <div className="card-actions justify-end mt-4">
            <button className="btn btn-primary btn-sm">
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrinterList;
