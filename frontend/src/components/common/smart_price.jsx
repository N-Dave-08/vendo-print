import React, { useState, useEffect } from "react";

const SmartPriceToggle = ({
  paperSize,
  isColor,
  copies = 1,
  totalPages = 1,
  setTotalPages,
  calculatedPrice,
  setCalculatedPrice,
  selectedPageOption = "All",
  setSelectedPageOption,
  customPageRange = "",
  setCustomPageRange,
  filePreviewUrl,
  onChange,
  colorAnalysis = null
}) => {
  const [localPrice, setLocalPrice] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);

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
        // For black and white mode, each page costs ₱10
        if (colorAnalysis?.pageAnalysis) {
          totalCost = colorAnalysis.pageAnalysis.length * 10;
        } else if (pagesToPrint > 0) {
          totalCost = pagesToPrint * 10;
        }
      }

      console.log("TOTAL COST", totalCost);

      // Multiply by number of copies
      totalCost *= copies;
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
  }, [isColor, copies, totalPages, selectedPageOption, customPageRange, filePreviewUrl, setCalculatedPrice, onChange, colorAnalysis]);

  // Use either the parent's calculatedPrice or the local price
  const displayPrice = calculatedPrice !== undefined ? calculatedPrice : localPrice;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <h3 className="text-base font-medium">Smart Price</h3>
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
                Smart Price automatically calculates the cost based on your print settings and color content.
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

      {/* Paper Size Display */}
      <div className="mt-2 bg-base-200 rounded-lg p-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-base-content/70" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          <span className="text-sm text-base-content/70">Paper Size:</span>
        </div>
        <span className="text-sm font-medium">Short Bond (8.5" x 11")</span>
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
          <div className="mt-2 text-sm font-medium text-success flex justify-between">
            <span>Total:</span>
            <span>₱{displayPrice.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartPriceToggle; 