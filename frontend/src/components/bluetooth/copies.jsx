import React from "react";

const Copies = ({ copies, setCopies }) => {
  const increaseCopies = () => setCopies((prev) => prev + 1);
  const decreaseCopies = () => setCopies((prev) => (prev > 1 ? prev - 1 : 1));

  return (
    <div className="flex items-center mt-6">
      <p className="text-2xl font-bold text-[#31304D] mr-4">Copies:</p>
      <div className="flex items-center space-x-4">
        <button
          className="w-8 h-8 bg-gray-200 text-[#31304D] flex items-center justify-center rounded-lg border-2 border-[#31304D] text-2xl"
          onClick={decreaseCopies}
        >
          -
        </button>
        <div className="w-14 h-10 flex items-center justify-center bg-gray-200 border-2 border-[#31304D] rounded-lg">
          <span className="text-3xl font-bold text-[#31304D]">{copies}</span>
        </div>
        <button
          className="w-8 h-8 bg-gray-200 text-[#31304D] flex items-center justify-center rounded-lg border-2 border-[#31304D] text-2xl"
          onClick={increaseCopies}
        >
          +
        </button>
      </div>
    </div>
  );
};

export default Copies;
