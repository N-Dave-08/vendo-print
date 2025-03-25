import React from "react";

const CustomPage = ({
  selectedPageOption,
  setSelectedPageOption,
  customPageRange,
  setCustomPageRange,
  totalPages
}) => {
  const handlePageSelectionChange = (option) => {
    setSelectedPageOption(option);
    if (option !== "Custom") {
    
      setCustomPageRange("");
    }
  };

  return (
    <div className="flex flex-col space-y-4 mt-6">

      <div className="flex items-center space-x-4">
        <p className="text-2xl font-bold text-[#31304D]">Pages:</p>
        <select
          className="w-64 p-2 border-2 border-[#31304D] rounded-lg text-lg font-bold text-[#31304D]"
          value={selectedPageOption}
          onChange={(e) => handlePageSelectionChange(e.target.value)}
        >
    <option value="All">
            {totalPages > 1 ? `Pages ${totalPages}` : "All"}
          </option>
          <option value="Odd">Odd pages only</option>
          <option value="Even">Even pages only</option>
          <option value="Custom">Custom</option>
        </select>
      </div>

 
      {selectedPageOption === "Custom" && (
        <div className="flex flex-col space-y-2">
          <p className="text-lg font-bold text-[#31304D]">
            Enter Page Numbers:
          </p>
          <input
            type="text"
            className="w-64 p-2 border-2 border-[#31304D] rounded-lg text-lg font-bold text-[#31304D]"
            placeholder="e.g. 1-5,8,10-12"
            value={customPageRange}
            onChange={(e) => setCustomPageRange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
};

export default CustomPage;
