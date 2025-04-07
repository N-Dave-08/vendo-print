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
    <div className="flex flex-col space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Pages:</span>
        <select
          className="select select-bordered select-sm w-32"
          value={selectedPageOption}
          onChange={(e) => handlePageSelectionChange(e.target.value)}
        >
          <option value="All">All</option>
          <option value="Odd">Odd pages only</option>
          <option value="Even">Even pages only</option>
          <option value="Custom">Custom range</option>
        </select>
      </div>

      {selectedPageOption === "Custom" && (
        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="pageRange" className="text-sm font-medium text-gray-700">
              Page Range:
            </label>
            <span className="text-xs text-gray-500">
              Total pages: {totalPages}
            </span>
          </div>
          <input
            id="pageRange"
            type="text"
            className="input input-bordered input-sm w-full"
            placeholder="e.g. 1-5,8,10-12"
            value={customPageRange}
            onChange={(e) => setCustomPageRange(e.target.value)}
          />
          <div className="text-xs text-gray-500 mt-1">
            Use commas to separate values and hyphens for ranges (e.g. 1-5,8,11-13)
          </div>
        </div>
      )}
      
      {selectedPageOption === "All" && totalPages > 0 && (
        <div className="text-sm text-gray-600">
          All {totalPages} pages will be printed
        </div>
      )}
      
      {selectedPageOption === "Odd" && totalPages > 0 && (
        <div className="text-sm text-gray-600">
          {Math.ceil(totalPages / 2)} odd pages will be printed
        </div>
      )}
      
      {selectedPageOption === "Even" && totalPages > 0 && (
        <div className="text-sm text-gray-600">
          {Math.floor(totalPages / 2)} even pages will be printed
        </div>
      )}
    </div>
  );
};

export default CustomPage; 