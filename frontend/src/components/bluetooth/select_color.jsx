import React from "react";

const SelectColor = ({ isColor, setIsColor }) => {
  return (
    <div className="flex items-center mt-6 relative">
      <p className="text-2xl font-bold text-[#31304D] mr-4">Color:</p>
      <select
        className="w-64 p-2 border-2 border-[#31304D] rounded-lg text-lg font-bold text-[#31304D]"
        value={isColor ? "Color" :"Black and White"} // ✅ Fix: Corrected logic
        onChange={(e) => setIsColor(e.target.value === "Color")}
      >
       <option value="Black and White">Black and White</option>
       <option value="Color">Color</option>
      </select>
    </div>
  );
};

export default SelectColor;
