import React from "react";

const PageOrientation = ({ orientation, setOrientation }) => {
  return (
    <div className="mt-6">
      <p className="text-2xl font-bold text-[#31304D] mb-2">Orientation</p>
      <div className="flex gap-4">
        <label className="flex items-center">
          <input
            type="radio"
            name="orientation"
            value="Portrait"
            checked={orientation === "Portrait"}
            onChange={(e) => setOrientation(e.target.value)}
            className="w-4 h-4 text-[#31304D] border-[#31304D] focus:ring-[#31304D]"
          />
          <span className="ml-2 text-lg font-medium text-[#31304D]">Portrait</span>
        </label>
        <label className="flex items-center">
          <input
            type="radio"
            name="orientation"
            value="Landscape"
            checked={orientation === "Landscape"}
            onChange={(e) => setOrientation(e.target.value)}
            className="w-4 h-4 text-[#31304D] border-[#31304D] focus:ring-[#31304D]"
          />
          <span className="ml-2 text-lg font-medium text-[#31304D]">Landscape</span>
        </label>
      </div>
    </div>
  );
};

export default PageOrientation;
