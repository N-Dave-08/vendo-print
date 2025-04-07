import React from "react";
import PrinterList from "../usb/printerList";
import SelectColor from "../usb/select_color";
import SmartPriceToggle from "./smart_price";

/**
 * Reusable Print Settings component for all printing modes
 */
const PrintSettings = ({
  // Printer settings
  selectedPrinter,
  setSelectedPrinter,
  printerCapabilities,
  setPrinterCapabilities,
  
  // Copies
  copies,
  setCopies,
  
  // Color settings
  isColor,
  setIsColor,
  
  // Orientation
  orientation,
  setOrientation,
  
  // File preview URL (used to check if a file is selected)
  filePreviewUrl,
  totalPages,
  
  // Smart Price
  calculatedPrice,
  setCalculatedPrice,
  
  // Color Analysis
  colorAnalysis,
}) => {
  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body p-4">
        <h2 className="card-title text-lg text-primary mb-4">Print Settings</h2>
        
        {/* Printer Selection */}
        <div className="form-control mb-6">
          <label className="label pb-1">
            <span className="text-base font-medium">Connected Printer</span>
          </label>
          <PrinterList
            selectedPrinter={selectedPrinter}
            setSelectedPrinter={setSelectedPrinter}
            onPrinterCapabilities={setPrinterCapabilities}
          />
        </div>

        {/* Color Mode Selection */}
        <div className="form-control mb-6">
          <label className="label pb-1">
            <span className="text-base font-medium">Color Mode</span>
          </label>
          <SelectColor
            isColor={isColor}
            setIsColor={setIsColor}
          />
        </div>

        {/* Copies Selection */}
        <div className="form-control mb-6">
          <label className="label pb-1">
            <span className="text-base font-medium">Number of Copies</span>
          </label>
          <input
            type="number"
            min="1"
            max="99"
            value={copies}
            onChange={(e) => setCopies(parseInt(e.target.value) || 1)}
            className="input input-bordered w-full"
          />
        </div>
        
        {/* Smart Price Display */}
        <div className="bg-base-200 rounded-lg p-4 mt-3">
          <SmartPriceToggle
            isColor={isColor}
            copies={copies}
            totalPages={totalPages}
            calculatedPrice={calculatedPrice}
            setCalculatedPrice={setCalculatedPrice}
            filePreviewUrl={filePreviewUrl}
            colorAnalysis={colorAnalysis}
          />
        </div>
      </div>
    </div>
  );
};

export default PrintSettings; 