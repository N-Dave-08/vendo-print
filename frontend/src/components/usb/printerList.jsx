import React, { useState, useEffect } from "react";
import axios from "axios";
import { Printer, AlertCircle } from "lucide-react";

const PrinterList = ({ selectedPrinter, setSelectedPrinter, onPrinterCapabilities }) => {
  const [printers, setPrinters] = useState([]);
  const [printerStatus, setPrinterStatus] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Function to check if a printer name is likely a virtual printer
  const isVirtualPrinter = (printerName) => {
    const virtualPrinterPatterns = [
      'microsoft', 'pdf', 'xps', 'document writer', 'onedrive', 
      'fax', 'print to', 'onenote', 'adobe pdf'
    ];
    
    const lowerName = printerName.toLowerCase();
    return virtualPrinterPatterns.some(pattern => lowerName.includes(pattern));
  };

  // Function to try to get printer status from multiple endpoints
  const getPrinterStatus = async (printerName) => {
    try {
      // First try the capabilities endpoint
      const response = await axios.get(`http://localhost:5000/api/printers/${encodeURIComponent(printerName)}/capabilities`);
      if (response.data.status === 'success' && response.data.capabilities?.capabilities?.status) {
        return response.data.capabilities.capabilities.status;
      }
      
      // If no status in capabilities, try status endpoint directly
      const statusResponse = await axios.get(`http://localhost:5000/api/printers/${encodeURIComponent(printerName)}/status`);
      if (statusResponse.data.status) {
        return statusResponse.data.status;
      }
      
      return "Ready"; // Default if no status found
    } catch (error) {
      console.error('Error fetching printer status:', error);
      return "Unknown";
    }
  };

  useEffect(() => {
    axios
      .get("http://localhost:5000/api/printers")
      .then((response) => {
        const printerList = response.data.printers || [];
        setPrinters(printerList);

        // Initialize status for all printers
        const statusObj = {};
        printerList.forEach(printer => {
          statusObj[printer.name] = { status: "Ready", loading: false };
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
      })
      .catch((error) => {
        setError("Failed to fetch printers");
        console.error(error);
      });
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
        // Get printer status
        const status = await getPrinterStatus(printerName);
        
        // Get printer capabilities
        const response = await axios.get(`http://localhost:5000/api/printers/${encodeURIComponent(printerName)}/capabilities`);
        if (response.data.status === 'success') {
          if (onPrinterCapabilities) {
            onPrinterCapabilities(response.data.capabilities);
          }

          setPrinterStatus(prev => ({
            ...prev,
            [printerName]: { status, loading: false }
          }));
        }
      } catch (error) {
        console.error('Failed to fetch printer capabilities:', error);
        setError('Failed to fetch printer capabilities');
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
  const getStatusColor = (status) => {
    if (!status) return "text-gray-400";

    status = status.toLowerCase();
    if (status === "ready") return "text-green-500";
    if (status === "error") return "text-red-500";
    if (status === "offline") return "text-red-500";
    if (status === "printing") return "text-blue-500";
    return "text-yellow-500"; // Default for other states
  };

  // Format the display for the UI
  const formatStatus = (status) => {
    if (!status || status.toLowerCase() === "unknown") return "Ready";
    return status;
  };

  return (
    <div>
      {/* Display selected printer without dropdown */}
      <div className="border rounded-lg p-3 bg-base-100 flex items-center justify-between">
        <div className="flex items-center">
          <Printer className="h-5 w-5 mr-3 text-primary" />
          {loading && !selectedPrinter ? (
            <div className="flex items-center">
              <span className="loading loading-spinner loading-xs mr-2"></span>
              <span>Connecting to printer...</span>
            </div>
          ) : selectedPrinter ? (
            <span className="font-medium">{selectedPrinter}</span>
          ) : (
            <span className="text-warning">No printer connected</span>
          )}
        </div>
        
        {/* Status indicator */}
        {selectedPrinter && printerStatus[selectedPrinter] && (
          <div className="flex items-center gap-2">
            <div className="badge" style={{backgroundColor: printerStatus[selectedPrinter].status.toLowerCase() === "ready" ? "#10b981" : "#f59e0b", color: "white"}}>
              {printerStatus[selectedPrinter].loading || loading
                ? "Checking..."
                : `Status: ${formatStatus(printerStatus[selectedPrinter].status)}`}
            </div>
          </div>
        )}
      </div>
      
      {/* Error message if present */}
      {error && (
        <div className="mt-2 px-3 py-2 bg-red-50 text-red-600 text-sm rounded flex items-center">
          <AlertCircle className="w-4 h-4 mr-2" />
          {error}
        </div>
      )}
    </div>
  );
};

export default PrinterList;

