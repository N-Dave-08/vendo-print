import React, { useEffect, useState } from "react";
import { getDatabase, ref as dbRef, onValue } from "firebase/database";

function SmartPriceLabel({
  isColor = false,
  copies = 1,
  totalPages = 1,
  calculatedPrice = 0,
  setCalculatedPrice = null,
  customPageRange = "",
  selectedPageOption = "All",
  filePreviewUrl = "",
  colorAnalysis = null
}) {
  const [pageBreakdown, setPageBreakdown] = useState([]);
  const [internalPrice, setInternalPrice] = useState(0);
  const [pricingTiers, setPricingTiers] = useState({
    bw: { base: 10 },
    color: { base: 12 }
  });

  // Fetch pricing tiers from Firebase if available
  useEffect(() => {
    const db = getDatabase();
    const pricingRef = dbRef(db, "pricingRules");
    
    const unsubscribe = onValue(pricingRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setPricingTiers({
          bw: data.bw || { base: 10 },
          color: data.color || { base: 12 }
        });
      }
    });
    
    return () => unsubscribe();
  }, []);

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
      // Calculate base price per page
      const bwBasePrice = pricingTiers.bw.base;
      const colorBasePrice = pricingTiers.color.base;
      
      if (isColor && colorAnalysis?.pageAnalysis) {
        // For color mode, check each page
        colorAnalysis.pageAnalysis.forEach((page) => {
          const pageNum = page.pageNumber;
          const cost = page.hasColor ? colorBasePrice : bwBasePrice;
          totalCost += cost;
          breakdown.push({
            pageNum,
            type: page.hasColor ? 'Colored' : 'Black and White',
            cost
          });
        });
      } else {
        // For black and white mode, all pages are black and white price
        for (let i = 1; i <= pagesToPrint; i++) {
          totalCost += bwBasePrice;
          breakdown.push({
            pageNum: i,
            type: 'Black and White',
            cost: bwBasePrice
          });
        }
      }

      // Apply volume discounts
      if (copies * pagesToPrint >= 100) {
        // 15% discount for 100+ total pages
        totalCost = Math.round(totalCost * 0.85);
      } else if (copies * pagesToPrint >= 50) {
        // 10% discount for 50+ total pages
        totalCost = Math.round(totalCost * 0.90);
      } else if (copies * pagesToPrint >= 20) {
        // 5% discount for 20+ total pages
        totalCost = Math.round(totalCost * 0.95);
      }
      
      // Multiply by number of copies
      totalCost *= copies;
    }

    // Update internal price if external state management is not provided
    setInternalPrice(totalCost);
    
    // Update external state if available
    if (setCalculatedPrice) {
      setCalculatedPrice(totalCost);
    }
    
    setPageBreakdown(breakdown);
  }, [isColor, copies, totalPages, setCalculatedPrice, customPageRange, selectedPageOption, filePreviewUrl, colorAnalysis, pricingTiers]);

  // Use internal or external price based on what's available
  const displayPrice = setCalculatedPrice ? calculatedPrice : internalPrice;
  
  // Calculate the volume discount applied if any
  const getVolumeDiscount = () => {
    const totalPages = copies * (pageBreakdown.length || totalPages);
    
    if (totalPages >= 100) return "15%";
    if (totalPages >= 50) return "10%";
    if (totalPages >= 20) return "5%";
    return null;
  };
  
  const volumeDiscount = getVolumeDiscount();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-base-content">Smart Price:</h2>
        <span className="text-xl font-bold text-success">₱{displayPrice ? displayPrice.toFixed(2) : "0.00"}</span>
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
                <span className="font-medium">₱{isColor && page.hasColor ? pricingTiers.color.base.toFixed(2) : pricingTiers.bw.base.toFixed(2)}</span>
              </div>
            ))}
          </div>
          
          {/* Volume discount indicator */}
          {volumeDiscount && (
            <div className="mt-2 text-sm font-medium text-success flex justify-between">
              <span>Volume Discount:</span>
              <span>{volumeDiscount} OFF</span>
            </div>
          )}
          
          {copies > 1 && (
            <div className="mt-2 text-sm font-medium text-base-content/70 flex justify-between">
              <span>Total for {copies} {copies === 1 ? 'copy' : 'copies'}:</span>
              <span className="text-success">₱{displayPrice.toFixed(2)}</span>
            </div>
          )}
          
          {/* Display coin cost */}
          <div className="mt-2 text-sm font-medium text-primary flex justify-between">
            <span>Coins Required:</span>
            <span className="font-bold">{displayPrice}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default SmartPriceLabel;
