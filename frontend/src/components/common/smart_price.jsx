import React, { useState, useEffect } from "react";

const SmartPriceToggle = ({
  paperSize,
  isColor,
  copies = 1,
  totalPages = 1,
  setTotalPages,
  isSmartPriceEnabled,
  setIsSmartPriceEnabled,
  calculatedPrice,
  setCalculatedPrice,
  selectedPageOption = "All",
  setSelectedPageOption,
  customPageRange = "",
  setCustomPageRange,
  filePreviewUrl,
  onChange,
  onToggle,
  isEnabled,
  colorAnalysis = null
}) => {
  const [localPrice, setLocalPrice] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);

  const enabled = isEnabled !== undefined ? isEnabled : isSmartPriceEnabled;

  useEffect(() => {
    // Base price calculation
    let totalCost = 0;
    let pagesToPrint = totalPages;

    // Handle different page selection options
    if (selectedPageOption === "Custom" && customPageRange) {
      const customPages = customPageRange
        .split(",")
        .flatMap((range) => {
          if (range.includes("-")) {
            const [start, end] = range.split("-").map(Number);
            return Array.from({ length: end - start + 1 }, (_, i) => start + i);
          } else {
            return [parseInt(range, 10)];
          }
        });
      pagesToPrint = customPages.length;
    }

    if (!filePreviewUrl) {
      totalCost = 0;
    } else {
      if (isColor && colorAnalysis?.pageAnalysis) {
        // For color mode, check each page
        colorAnalysis.pageAnalysis.forEach((page) => {
          const cost = page.hasColor ? 12 : 10;
          totalCost += cost;
        });
      } else {
        // For black and white mode, all pages are ₱10
        totalCost = 10 * pagesToPrint;
      }

      // Multiply by number of copies
      totalCost *= copies;

      // Apply smart pricing discount if enabled
      if (enabled) {
        totalCost = Math.round(totalCost * 0.85);
      }
    }

    // Update local price state
    setLocalPrice(totalCost);
    
    // If parent component provided a setter, use it
    if (typeof setCalculatedPrice === 'function') {
      setCalculatedPrice(totalCost);
    }
    
    // If parent component provided an onChange callback, use it
    if (typeof onChange === 'function') {
      onChange(totalCost);
    }
  }, [isColor, copies, totalPages, selectedPageOption, customPageRange, filePreviewUrl, setCalculatedPrice, onChange, enabled, colorAnalysis]);

  // Use either the parent's calculatedPrice or the local price
  const displayPrice = calculatedPrice !== undefined ? calculatedPrice : localPrice;

  const handleToggleChange = (e) => {
    if (typeof setIsSmartPriceEnabled === 'function') {
      setIsSmartPriceEnabled(e.target.checked);
    }
    
    if (typeof onToggle === 'function') {
      onToggle(e.target.checked);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <label className="cursor-pointer label justify-start gap-2 items-center">
            <input 
              type="checkbox" 
              className="toggle toggle-primary toggle-sm" 
              checked={enabled}
              onChange={handleToggleChange}
            />
            <span className="label-text">Smart Price</span>
          </label>
          
          <div className="relative ml-1">
            <button 
              className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 font-bold flex items-center justify-center text-xs"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              ?
            </button>
            
            {showTooltip && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-10">
                Smart Price automatically calculates the cost based on your current print settings and applies a 15% discount.
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-800"></div>
              </div>
            )}
          </div>
        </div>
        
        <div className="text-xl font-bold text-success flex items-baseline">
          <span className="text-sm font-normal mr-1">₱</span>
          {displayPrice.toFixed(2)}
        </div>
      </div>
      
      <div className="mt-2 text-xs text-gray-500">
        {isColor ? 'Color' : 'Black & White'} printing • {copies} {copies === 1 ? 'copy' : 'copies'} • 
        {selectedPageOption === "All" 
          ? ` All ${totalPages} pages` 
          : selectedPageOption === "Custom" 
            ? ` Custom range` 
            : ` ${selectedPageOption} pages`}
      </div>

      {colorAnalysis?.pageAnalysis && colorAnalysis.pageAnalysis.length > 0 && (
        <div className="mt-2">
          <p className="text-sm font-medium text-base-content/70 mb-2">Page Breakdown:</p>
          <div className="max-h-32 overflow-y-auto space-y-1 bg-base-200 rounded-lg p-2">
            {colorAnalysis.pageAnalysis.map((page) => (
              <div key={page.pageNumber} className="flex justify-between text-sm">
                <span className="text-base-content/70">
                  Page {page.pageNumber}: {isColor && page.hasColor ? 'Colored' : 'Black and White'}
                </span>
                <span className="font-medium">₱{isColor && page.hasColor ? '12.00' : '10.00'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartPriceToggle; 