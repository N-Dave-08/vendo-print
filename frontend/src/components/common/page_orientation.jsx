import React from "react";

const PageOrientation = ({ orientation, setOrientation }) => {
  return (
    <div className="flex items-center mt-6 relative">
      <p className="text-2xl font-bold text-[#31304D] mr-4">Orientation:</p>
      <select
        className="w-64 p-2 border-2 border-[#31304D] rounded-lg text-lg font-bold text-[#31304D]"
        value={orientation}
        onChange={(e) => setOrientation(e.target.value)}
      >
        <option>Portrait</option>
        <option>Landscape</option>
      </select>
    </div>
  );
};

export default PageOrientation;
