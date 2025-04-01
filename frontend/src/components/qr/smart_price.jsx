import React, { useEffect, useState } from "react";
import { getDatabase, ref as dbRef, onValue } from "firebase/database";

function SmartPriceLabel({
  isColor,
  copies,
  totalPages,
  calculatedPrice,
  setCalculatedPrice,
  customPageRange,
  selectedPageOption,
  filePreviewUrl,
  colorAnalysis
}) {
  const [pageBreakdown, setPageBreakdown] = useState([]);

  useEffect(() => {
    let pagesToPrint = totalPages;
    let totalCost = 0;
    const breakdown = [];

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
          const pageNum = page.pageNumber;
          const cost = page.hasColor ? 12 : 10;
          totalCost += cost;
          breakdown.push({
            pageNum,
            type: page.hasColor ? 'Colored' : 'Black and White',
            cost
          });
        });
      } else {
        // For black and white mode, all pages are ₱10
        for (let i = 1; i <= pagesToPrint; i++) {
          totalCost += 10;
          breakdown.push({
            pageNum: i,
            type: 'Black and White',
            cost: 10
          });
        }
      }

      // Multiply by number of copies
      totalCost *= copies;
    }

    setCalculatedPrice(totalCost);
    setPageBreakdown(breakdown);
  }, [isColor, copies, totalPages, setCalculatedPrice, customPageRange, selectedPageOption, filePreviewUrl, colorAnalysis]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#31304D]">Smart Price:</h2>
        <span className="text-xl font-bold text-green-500">₱{calculatedPrice ? calculatedPrice.toFixed(2) : "0.00"}</span>
      </div>

      {colorAnalysis?.pageAnalysis && colorAnalysis.pageAnalysis.length > 0 && (
        <div className="mt-2">
          <p className="text-sm font-medium text-gray-600 mb-2">Page Breakdown:</p>
          <div className="max-h-32 overflow-y-auto space-y-1 bg-gray-50 rounded-lg p-2">
            {colorAnalysis.pageAnalysis.map((page) => (
              <div key={page.pageNumber} className="flex justify-between text-sm">
                <span className="text-gray-600">
                  Page {page.pageNumber}: {isColor && page.hasColor ? 'Colored' : 'Black and White'}
                </span>
                <span className="font-medium">₱{isColor && page.hasColor ? '12.00' : '10.00'}</span>
              </div>
            ))}
          </div>
          {copies > 1 && (
            <div className="mt-2 text-sm font-medium text-gray-600 flex justify-between">
              <span>Total for {copies} {copies === 1 ? 'copy' : 'copies'}:</span>
              <span className="text-green-500">₱{calculatedPrice.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SmartPriceLabel;
