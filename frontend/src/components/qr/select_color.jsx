import React from "react";

const SelectColor = ({ isColor, setIsColor }) => {
  return (
    <div className="flex items-center mt-6 gap-4">
      <p className="text-2xl font-bold text-primary">Color:</p>
      <select
        className="select select-bordered select-primary w-64 text-lg font-medium"
        value={isColor ? "Color" : "Black and White"} 
        onChange={(e) => setIsColor(e.target.value === "Black and White")}
      >
        <option>Color</option>
        <option>Black and White</option>
      </select>
    </div>
  );
};

export default SelectColor;
