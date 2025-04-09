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
      <div className="flex items-center gap-4">
        <p className="text-2xl font-bold text-primary">Size:</p>
        <select
          className="select select-bordered select-primary w-72 text-lg font-medium"
          value={selectedSize}
          onChange={(e) => handleSizeChange(e.target.value)}
        >
          <option value="Short Bond">Short Bond (8.5 x 11)</option>
          <option value="A4">A4 (8.3 x 11.7)</option>
          <option value="Long Bond">Long Bond (8.5 x 14)</option>
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
        <div className="flex gap-4 items-center">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Width (inches)</span>
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              className="input input-bordered input-primary w-32"
              value={customWidth}
              onChange={(e) => setCustomWidth(e.target.value)}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Height (inches)</span>
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              className="input input-bordered input-primary w-32"
              value={customHeight}
              onChange={(e) => setCustomHeight(e.target.value)}
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
