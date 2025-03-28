import React, { useState, useEffect } from "react";
import axios from "axios";

const PrinterList = ({ selectedPrinter, setSelectedPrinter }) => {
  const [printers, setPrinters] = useState([]);
  const [printerStatus, setPrinterStatus] = useState({});
  const [error, setError] = useState(null);

  // Fetch the list of printers
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
    <div className="p-6">
      {error && <p className="text-red-500">{error}</p>}

      <div className="flex flex-col space-y-4">
        <div className="relative">
          <select
            value={selectedPrinter}
            onChange={(e) => setSelectedPrinter(e.target.value)}
            className="w-full p-2 pl-10 border-2 border-[#31304D] rounded-lg text-lg font-bold text-[#31304D]"
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
              {printerStatus[selectedPrinter].loading
                ? "Checking status..."
                : `Status: ${printerStatus[selectedPrinter].status || "Ready"}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrinterList;
