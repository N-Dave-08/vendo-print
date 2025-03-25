import React, { useState } from "react";

const PageSize = ({ selectedSize, setSelectedSize }) => {
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");

  const handleSizeChange = (size) => {
    setSelectedSize(size);
    // Clear custom dimensions if any option other than "Custom" is selected
    if (size !== "Custom") {
      setCustomWidth("");
      setCustomHeight("");
    }
  };

  return (
    <div className="flex flex-col space-y-4 mt-6">
      <div className="flex items-center space-x-4">
        <p className="text-2xl font-bold text-[#31304D]">Size:</p>
        <select
          className="w-72 p-2 border-2 border-[#31304D] rounded-lg text-lg font-bold text-[#31304D]"
          value={selectedSize}
          onChange={(e) => handleSizeChange(e.target.value)}
        >
          <option value="Letter 8.5 x 11">Letter 8.5 x 11</option>
          <option value="A4 8.3 x 11.7">A4 8.3 x 11.7</option>
          <option value="Legal 8.5 x 14">Legal 8.5 x 14</option>
          <option value="Executive 7.25 x 10.5">Executive 7.25 x 10.5</option>
          <option value="Tabloid 11 x 17">Tabloid 11 x 17</option>
          <option value="Statement 5.5 x 8.5">Statement 5.5 x 8.5</option>
          <option value="B5 6.9 x 9.8">B5 6.9 x 9.8</option>
          <option value="Fit to Cover">Fit to Cover</option>
          <option value="Shrink to Int">Shrink to Int</option>
          <option value="Custom">Custom</option>
        </select>
      </div>

      {/* Show custom input fields only when "Custom" is selected */}
      {selectedSize === "Custom" && (
        <div className="flex space-x-4">
          <div className="flex flex-col">
            <label className="text-lg font-semibold text-[#31304D]">
              Width (inches):
            </label>
            <input
              type="number"
              step="0.1"
              value={customWidth}
              onChange={(e) => setCustomWidth(e.target.value)}
              className="w-32 p-2 border-2 border-[#31304D] rounded-lg text-lg font-bold text-[#31304D]"
              placeholder="Width"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-lg font-semibold text-[#31304D]">
              Height (inches):
            </label>
            <input
              type="number"
              step="0.1"
              value={customHeight}
              onChange={(e) => setCustomHeight(e.target.value)}
              className="w-32 p-2 border-2 border-[#31304D] rounded-lg text-lg font-bold text-[#31304D]"
              placeholder="Height"
            />
          </div>
        </div>
      )}

      {/* Display additional info for "Fit to Cover" and "Shrink to Int" */}
      {(selectedSize === "Fit to Cover" || selectedSize === "Shrink to Int") && (
        <div className="mt-2 text-lg text-[#31304D]">
          {selectedSize === "Fit to Cover" ? (
            <p>Document will be scaled to cover the entire page.</p>
          ) : (
            <p>Document will be scaled to fit within the printable area.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default PageSize;
