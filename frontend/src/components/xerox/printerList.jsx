import React, { useState, useEffect } from "react";
import axios from "axios";
import { RefreshCw, AlertCircle, Printer } from "lucide-react";

const PrinterList = ({ selectedPrinter, setSelectedPrinter, onPrinterCapabilities }) => {
  const [printers, setPrinters] = useState([]);
  const [printerStatus, setPrinterStatus] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Function to check if a printer name is likely a virtual printer
  const isVirtualPrinter = (printerName) => {
    const virtualPrinterPatterns = [
      'microsoft', 'pdf', 'xps', 'document writer', 'onedrive', 
      'fax', 'print to', 'onenote', 'adobe pdf'
    ];
    
    const lowerName = printerName.toLowerCase();
    return virtualPrinterPatterns.some(pattern => lowerName.includes(pattern));
  };

  // Function to fetch printers with retry capability
  const fetchPrinters = async (isRetry = false) => {
    if (isRetry) {
      setIsRetrying(true);
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get("http://localhost:5000/api/printers", { 
        timeout: 5000 // Add timeout to prevent long waits
      });
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
          handlePrinterChange(physicalPrinters[0].name);
        } else {
          // Fall back to the first printer in the list if no physical printers found
          handlePrinterChange(printerList[0].name);
        }
      }
      
      // Reset error state on success
      setError(null);
    } catch (error) {
      console.error("Failed to fetch printers:", error);
      
      if (error.code === 'ECONNABORTED' || !error.response) {
        setError("Connection timed out. Server might be offline.");
      } else if (error.message.includes('Network Error')) {
        setError("Network error. Please check your connection to the print server.");
      } else {
        setError(`Failed to fetch printers: ${error.message}`);
      }
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  };

  // Initial fetch on component mount
  useEffect(() => {
    fetchPrinters();
  }, []);

  const handlePrinterChange = async (printerName) => {
    setSelectedPrinter(printerName);
    if (printerName) {
      // Set loading state
      setPrinterStatus(prev => ({
        ...prev,
        [printerName]: { ...prev[printerName], loading: true }
      }));

      setLoading(true);
      try {
        const response = await axios.get(`http://localhost:5000/api/printers/${encodeURIComponent(printerName)}/capabilities`, {
          timeout: 5000 // Add timeout
        });
        if (response.data.status === 'success') {
          if (onPrinterCapabilities) {
            onPrinterCapabilities(response.data.capabilities);
          }

          const status = response.data.capabilities.capabilities?.status || "Ready";
          setPrinterStatus(prev => ({
            ...prev,
            [printerName]: { status, loading: false }
          }));
        }
      } catch (error) {
        console.error('Failed to fetch printer capabilities:', error);
        
        if (error.code === 'ECONNABORTED' || !error.response) {
          setError("Connection timed out. Server might be offline.");
        } else {
          setError('Failed to fetch printer capabilities');
        }
        
        setPrinterStatus(prev => ({
          ...prev,
          [printerName]: { status: "Error", loading: false }
        }));
      } finally {
        setLoading(false);
      }
    }
  };

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
    <div>
      {error && (
        <div className="alert alert-error mb-4">
          <AlertCircle className="w-6 h-6" />
          <div>
            <span>{error}</span>
            <div>
              <button 
                className="btn btn-sm btn-outline mt-2 gap-2" 
                onClick={() => fetchPrinters(true)}
                disabled={isRetrying}
              >
                {isRetrying ? (
                  <>
                    <span className="loading loading-spinner loading-xs"></span>
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Retry Connection
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="form-control w-full">
        {loading && !selectedPrinter ? (
          <div className="flex items-center border rounded-lg p-3 bg-base-100">
            <span className="loading loading-spinner loading-xs mr-2"></span>
            <span>Connecting to printer...</span>
          </div>
        ) : selectedPrinter ? (
          <div className="flex items-center border rounded-lg p-3 bg-base-100">
            <Printer className="w-5 h-5 mr-3 text-primary" />
            <span className="font-medium">{selectedPrinter}</span>
          </div>
        ) : (
          <div className="flex items-center border rounded-lg p-3 bg-base-100">
            <Printer className="w-5 h-5 mr-3 text-warning" />
            <span className="text-warning">No printer connected</span>
          </div>
        )}
      </div>

      {/* Show printer status when one is selected */}
      {selectedPrinter && printerStatus[selectedPrinter] && (
        <div className="mt-3 flex items-center gap-2">
          <div className={`badge ${getStatusClass(printerStatus[selectedPrinter].status)}`}>
            {printerStatus[selectedPrinter].loading || loading
              ? "Checking status..."
              : `Status: ${printerStatus[selectedPrinter].status || "Ready"}`}
          </div>
        </div>
      )}

      {loading && !error && !selectedPrinter && (
        <div className="mt-3 text-sm flex items-center gap-2 text-base-content/70">
          <span className="loading loading-spinner loading-xs"></span>
          <span>Loading printer information...</span>
        </div>
      )}
    </div>
  );
};

export default PrinterList;
