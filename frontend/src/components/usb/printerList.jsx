import React, { useState, useEffect } from "react";
import axios from "axios";

const PrinterList = ({ selectedPrinter, setSelectedPrinter }) => {
  const [printers, setPrinters] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios
      .get("http://localhost:5000/api/printers")
      .then((response) => {
        setPrinters(response.data.printers);
      })
      .catch((error) => {
        setError("Failed to fetch printers");
        console.error(error);
      });
  }, []);

  return (
    <div>
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      <select
        value={selectedPrinter}
        onChange={(e) => setSelectedPrinter(e.target.value)}
        className="w-full px-3 py-2 border rounded-md bg-white text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
    </div>
  );
};

export default PrinterList;
