import React, { useEffect } from "react";

function SmartPriceLabel({
  copies,
  totalPages,
  calculatedPrice,
  setCalculatedPrice,
  filePreviewUrl
}) {

  useEffect(() => {

    const pricePerPage = 2;
   


  let pagesToPrint = totalPages;

 

  const totalCost = pricePerPage * copies * pagesToPrint;
  setCalculatedPrice(totalCost);
  
  }, [ copies, totalPages, setCalculatedPrice,filePreviewUrl]);

  return (
    <div className="mt-8 flex items-center space-x-4 w-full">
      <h1 className="font-bold text-gray-700 text-2xl">Smart Price:</h1>
      <span className="text-lg font-bold text-green-600">
        ₱{calculatedPrice.toFixed(2)}
      </span>
    </div>
  );
}

export default SmartPriceLabel;
