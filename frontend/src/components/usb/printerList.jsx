import React, { useState, useEffect } from "react";
import axios from "axios";

const PrinterList = ({ selectedPrinter, setSelectedPrinter, onPrinterCapabilities }) => {
  const [printers, setPrinters] = useState([]);
  const [printerStatus, setPrinterStatus] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios
      .get("http://localhost:5000/api/printers")
      .then((response) => {
        setPrinters(response.data.printers);

        // Initialize status for all printers
        const statusObj = {};
        response.data.printers.forEach(printer => {
          statusObj[printer.name] = { status: "Unknown", loading: false };
        });
        setPrinterStatus(statusObj);
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
        const response = await axios.get(`http://localhost:5000/api/printers/${encodeURIComponent(printerName)}/capabilities`);
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

  // Get status indicator color
  const getStatusColor = (status) => {
    if (!status) return "bg-gray-400";

    status = status.toLowerCase();
    if (status === "ready") return "bg-green-500";
    if (status === "error") return "bg-red-500";
    if (status === "offline") return "bg-red-500";
    if (status === "printing") return "bg-blue-500";
    return "bg-yellow-500"; // Default for other states
  };

  return (
    <div>
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}

      <div className="relative">
        <select
          value={selectedPrinter}
          onChange={(e) => handlePrinterChange(e.target.value)}
          className={`w-full px-3 py-2 pl-10 border rounded-md bg-white text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary ${loading ? 'opacity-50 cursor-wait' : ''}`}
          disabled={loading}
        >
          <option value="">Select a printer...</option>
          {Array.isArray(printers) && printers.length > 0 ? (
            printers.map((printer, index) => (
              <option key={index} value={printer.name}>
                {printer.name}
              </option>
            ))
          ) : (
            <option value="">No printers available</option>
          )}
        </select>

        {/* Printer icon with status indicator */}
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center">
          <div className="text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      {/* Show printer status when one is selected */}
      {selectedPrinter && printerStatus[selectedPrinter] && (
        <div className="flex items-center mt-2">
          <div className={`w-3 h-3 rounded-full mr-2 ${getStatusColor(printerStatus[selectedPrinter].status)}`}></div>
          <span className="text-sm text-gray-700">
            {printerStatus[selectedPrinter].loading || loading
              ? "Checking status..."
              : `Status: ${printerStatus[selectedPrinter].status || "Ready"}`}
          </span>
        </div>
      )}

      {loading && !selectedPrinter && (
        <p className="text-sm text-gray-600 mt-1">Loading printer capabilities...</p>
      )}
    </div>
  );
};

export default PrinterList;
