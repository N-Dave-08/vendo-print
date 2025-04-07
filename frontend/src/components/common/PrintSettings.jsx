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
  isSmartPriceEnabled,
  setIsSmartPriceEnabled,
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

        <div className="divider my-1"></div>
        
        {/* Print Options Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Copies Selection */}
          <div className="form-control">
            <label className="label pb-1">
              <span className="text-base font-medium">Copies</span>
            </label>
            <div className="flex items-center">
              <button 
                className="btn btn-square btn-sm" 
                onClick={() => setCopies(Math.max(1, copies - 1))}
                disabled={copies <= 1}
              >
                -
              </button>
              <input
                type="number"
                min="1"
                max="10"
                value={copies}
                onChange={(e) => setCopies(parseInt(e.target.value))}
                className="input input-bordered w-full text-center mx-2"
              />
              <button 
                className="btn btn-square btn-sm" 
                onClick={() => setCopies(Math.min(10, copies + 1))}
                disabled={copies >= 10}
              >
                +
              </button>
            </div>
          </div>

          {/* Paper Size - Static Display */}
          <div className="form-control">
            <label className="label pb-1">
              <span className="text-base font-medium">Paper Size</span>
            </label>
            <div className="p-3 border rounded-lg bg-base-100 flex items-center">
              <svg className="w-5 h-5 mr-2 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Short Bond (8.5 x 11)
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Print Mode Selection */}
          <div className="form-control">
            <label className="label pb-1">
              <span className="text-base font-medium">Print Mode</span>
            </label>
            <SelectColor isColor={isColor} setIsColor={setIsColor} printerCapabilities={printerCapabilities} />
          </div>

          {/* Orientation Selection */}
          <div className="form-control">
            <label className="label pb-1">
              <span className="text-base font-medium">Orientation</span>
            </label>
            <div className="flex gap-4 border p-2 rounded-lg">
              <label className="flex flex-1 cursor-pointer justify-center gap-2 p-2 rounded-md items-center transition-all hover:bg-base-200" style={{backgroundColor: orientation === "portrait" ? "rgba(0,0,0,0.05)" : ""}}>
                <input
                  type="radio"
                  name="orientation"
                  className="radio radio-primary radio-sm"
                  checked={orientation === "portrait"}
                  onChange={() => setOrientation("portrait")}
                />
                <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <rect x="6" y="4" width="12" height="16" rx="1" strokeWidth="2" />
                </svg>
                <span className="label-text">Portrait</span>
              </label>
              <label className="flex flex-1 cursor-pointer justify-center gap-2 p-2 rounded-md items-center transition-all hover:bg-base-200" style={{backgroundColor: orientation === "landscape" ? "rgba(0,0,0,0.05)" : ""}}>
                <input
                  type="radio"
                  name="orientation"
                  className="radio radio-primary radio-sm"
                  checked={orientation === "landscape"}
                  onChange={() => setOrientation("landscape")}
                />
                <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <rect x="4" y="6" width="16" height="12" rx="1" strokeWidth="2" />
                </svg>
                <span className="label-text">Landscape</span>
              </label>
            </div>
          </div>
        </div>

        {/* Simple "All pages will be printed" message instead of page selection */}
        {filePreviewUrl && totalPages > 0 && (
          <div className="form-control mb-6">
            <label className="label pb-1">
              <span className="text-base font-medium">Pages to Print</span>
            </label>
            <div className="border rounded-lg p-3">
              <div className="text-sm text-gray-600">
                All {totalPages} pages will be printed
              </div>
            </div>
          </div>
        )}

        <div className="divider my-1"></div>

        {/* Smart Price Display */}
        <div className="bg-base-200 rounded-lg p-4 mt-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <svg className="w-6 h-6 mr-2 text-success" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-base font-medium">Smart Price</span>
            </div>
            <div className="text-2xl font-bold text-success">₱{calculatedPrice.toFixed(2)}</div>
          </div>
          <SmartPriceToggle
            isEnabled={isSmartPriceEnabled}
            onToggle={(enabled) => setIsSmartPriceEnabled(enabled)}
            isColor={isColor}
            copies={copies}
            totalPages={totalPages}
            onChange={(price) => setCalculatedPrice(price)}
            colorAnalysis={colorAnalysis}
          />
        </div>
      </div>
    </div>
  );
};

export default PrintSettings; 