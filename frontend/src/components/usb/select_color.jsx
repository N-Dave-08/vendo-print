import React from "react";

const SelectColor = ({ isColor, setIsColor, printerCapabilities }) => {
  const supportsColor = printerCapabilities?.Capabilities?.SupportsColor ?? true;

  return (
    <div className="flex items-center mt-6 relative">
      <p className="text-2xl font-bold text-[#31304D] mr-4">Color:</p>
      <select
        className={`w-64 p-2 border-2 border-[#31304D] rounded-lg text-lg font-bold text-[#31304D]
          ${!supportsColor ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`}
        value={isColor ? "Color" : "Black and White"}
        onChange={(e) => setIsColor(e.target.value === "Color")}
        disabled={!supportsColor}
      >
        <option>Color</option>
        <option>Black and White</option>
      </select>
      {!supportsColor && (
        <p className="text-sm text-red-500 mt-1 absolute -bottom-6">
          This printer does not support color printing
        </p>
      )}
    </div>
  );
};

export default SelectColor;
