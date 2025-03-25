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
    <div className="p-6">
      {error && <p className="text-red-500">{error}</p>}

      <div className="flex flex-col space-y-4">
        <select
          value={selectedPrinter}
          onChange={(e) => setSelectedPrinter(e.target.value)}
          className="w-64 p-2 border-2 border-[#31304D] rounded-lg text-lg font-bold text-[#31304D]"
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
    </div>
  );
};

export default PrinterList;
