import React from "react";

const SelectColor = ({ isColor, setIsColor, printerCapabilities }) => {
  const supportsColor = printerCapabilities?.Capabilities?.SupportsColor ?? true;

  return (
    <div className="flex gap-4 border p-2 rounded-lg">
      <label className="flex flex-1 cursor-pointer justify-center gap-2 p-2 rounded-md items-center transition-all hover:bg-base-200" style={{backgroundColor: isColor ? "rgba(0,0,0,0.05)" : ""}}>
        <input
          type="radio"
          name="color"
          value="Color"
          checked={isColor}
          onChange={() => setIsColor(true)}
          className="radio radio-primary radio-sm"
          disabled={!supportsColor}
        />
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="3" fill="#FF5252" />
          <circle cx="12" cy="6.5" r="1.5" fill="#2196F3" />
          <circle cx="6.5" cy="12" r="1.5" fill="#4CAF50" />
          <circle cx="17.5" cy="12" r="1.5" fill="#FFC107" />
          <circle cx="12" cy="17.5" r="1.5" fill="#9C27B0" />
        </svg>
        <span className="label-text">Color</span>
      </label>
      
      <label className="flex flex-1 cursor-pointer justify-center gap-2 p-2 rounded-md items-center transition-all hover:bg-base-200" style={{backgroundColor: !isColor ? "rgba(0,0,0,0.05)" : ""}}>
        <input
          type="radio"
          name="color"
          value="Black and White"
          checked={!isColor}
          onChange={() => setIsColor(false)}
          className="radio radio-primary radio-sm"
          disabled={!supportsColor}
        />
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M7 12H17" stroke="currentColor" strokeWidth="2" />
        </svg>
        <span className="label-text">Black & White</span>
      </label>
      
      {!supportsColor && (
        <div className="absolute mt-1 text-xs text-error">
          This printer does not support color printing
        </div>
      )}
    </div>
  );
};

export default SelectColor;
