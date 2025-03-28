import React from "react";

const SelectColor = ({ isColor, setIsColor, printerCapabilities }) => {
  const supportsColor = printerCapabilities?.Capabilities?.SupportsColor ?? true;

  return (
    <div>

      <div className="flex gap-5 mb-6">
        <label className="flex items-center">
          <input
            type="radio"
            name="color"
            value="Color"
            checked={isColor}
            onChange={() => setIsColor(true)}
            className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
            disabled={!supportsColor}
          />
          <span className="ml-2 text-sm font-medium text-gray-700">Color</span>
        </label>
        <label className="flex items-center">
          <input
            type="radio"
            name="color"
            value="Black and White"
            checked={!isColor}
            onChange={() => setIsColor(false)}
            className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
            disabled={!supportsColor}
          />
          <span className="ml-2 text-sm font-medium text-gray-700">Black and White</span>
        </label>
      </div>

      {!supportsColor && (
        <p className="text-sm text-red-500 mt-1 mb-4">
          This printer does not support color printing
        </p>
      )}
    </div>
  );
};

export default SelectColor;
