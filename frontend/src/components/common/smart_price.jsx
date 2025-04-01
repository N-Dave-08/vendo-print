import React from "react";

const SmartPriceToggle = ({
  paperSize,
  isColor,
  copies,
  totalPages,
  setTotalPages,
  isSmartPriceEnabled,
  setIsSmartPriceEnabled,
  calculatedPrice,
  setCalculatedPrice,
  selectedPageOption,
  setSelectedPageOption,
  customPageRange,
  setCustomPageRange,
  filePreviewUrl
}) => {
  React.useEffect(() => {
    // Base price calculation
    const basePrice = isColor ? 10 : 5;  // 10 coins for color, 5 for B&W
    let pageCount = totalPages;

    // Adjust page count based on selected option
    if (selectedPageOption === "Odd") {
      pageCount = Math.ceil(totalPages / 2);
    } else if (selectedPageOption === "Even") {
      pageCount = Math.floor(totalPages / 2);
    } else if (selectedPageOption === "Custom" && customPageRange) {
      // Parse custom range and count pages
      const ranges = customPageRange.split(",");
      let customPageCount = 0;

      ranges.forEach(range => {
        if (range.includes("-")) {
          const [start, end] = range.split("-").map(num => parseInt(num));
          if (!isNaN(start) && !isNaN(end)) {
            customPageCount += (end - start + 1);
          }
        } else {
          const page = parseInt(range);
          if (!isNaN(page)) {
            customPageCount++;
          }
        }
      });

      pageCount = customPageCount;
    }

    // Calculate total price
    const totalPrice = basePrice * pageCount * copies;
    setCalculatedPrice(totalPrice);
  }, [isColor, copies, totalPages, selectedPageOption, customPageRange, setCalculatedPrice]);

  return (
    <div className="mt-8 flex items-center space-x-4 w-full">
      <h1 className="font-bold text-gray-700 text-2xl">Smart Price:</h1>
      <span className="text-lg font-bold text-green-600">
        ₱{calculatedPrice ? calculatedPrice.toFixed(2) : "0.00"}
      </span>
    </div>
  );
};

export default SmartPriceToggle; 