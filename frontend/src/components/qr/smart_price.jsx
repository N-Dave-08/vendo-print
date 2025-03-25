// import React, { useEffect } from "react";

// function SmartPriceLabel({
//   isColor,
//   copies,
//   totalPages,
//   calculatedPrice,
//   setCalculatedPrice,
//   customPageRange,
//   selectedPageOption,
//   filePreviewUrl
// }) {

//   useEffect(() => {

//     const pricePerPage = isColor ? 7 : 14;
//     const oddPagesCount = Math.ceil(totalPages / 2);  
//     const evenPagesCount = Math.floor(totalPages / 2);


//   let pagesToPrint = totalPages;

//   if (selectedPageOption === "Odd") {
//      pagesToPrint = oddPagesCount;
//     } else if (selectedPageOption === "Even") {
//       pagesToPrint = evenPagesCount;
//    } else if (selectedPageOption === "Custom" && customPageRange) {

//      const customPages = customPageRange
//        .split(",")
//        .flatMap((range) => {
//         if (range.includes("-")) {
//           const [start, end] = range.split("-").map(Number);
//           return Array.from({ length: end - start + 1 }, (_, i) => start + i);
//         } else {
//       return [parseInt(range, 10)];
//     }
//  });

// console.log("Custom Pages:", customPages);

//  pagesToPrint = customPages.length;
//  } else if (selectedPageOption === "All") {
 
//  pagesToPrint = totalPages;
// }


// if (!filePreviewUrl){
//   const totalCost = 0;
//     setCalculatedPrice(totalCost);
// }else{
//   const totalCost = pricePerPage * copies * pagesToPrint;
//   setCalculatedPrice(totalCost);}

  
//   }, [isColor, copies, totalPages, setCalculatedPrice,customPageRange, selectedPageOption,filePreviewUrl]);

//   return (
//     <div className="mt-8 flex items-center space-x-4 w-full">
//       <h1 className="font-bold text-gray-700 text-2xl">Smart Price:</h1>
//       <span className="text-lg font-bold text-green-600">
//       ₱{calculatedPrice ? calculatedPrice.toFixed(2) : "0.00"}
//       </span>
//     </div>
//   );
// }

// export default SmartPriceLabel;
import React, { useEffect, useState } from "react";
import { getDatabase, ref as dbRef, onValue } from "firebase/database";

function SmartPriceLabel({
  isColor,
  copies,
  totalPages,
  calculatedPrice,
  setCalculatedPrice,
  customPageRange,
  selectedPageOption,
  filePreviewUrl
}) {

  const [pricing, setPricing] = useState({ colorPrice: 7, bwPrice: 14 });

  useEffect(() => {
    const db = getDatabase();
    const pricingRef = dbRef(db, 'pricing');
    const unsubscribe = onValue(pricingRef, (snapshot) => {
      if (snapshot.exists()) {
        setPricing(snapshot.val());
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const pricePerPage = isColor ? pricing.colorPrice : pricing.bwPrice;
    const oddPagesCount = Math.ceil(totalPages / 2);  
    const evenPagesCount = Math.floor(totalPages / 2);
    let pagesToPrint = totalPages;

    if (selectedPageOption === "Odd") {
      pagesToPrint = oddPagesCount;
    } else if (selectedPageOption === "Even") {
      pagesToPrint = evenPagesCount;
    } else if (selectedPageOption === "Custom" && customPageRange) {
      const customPages = customPageRange
        .split(",")
        .flatMap((range) => {
          if (range.includes("-")) {
            const [start, end] = range.split("-").map(Number);
            return Array.from({ length: end - start + 1 }, (_, i) => start + i);
          } else {
            return [parseInt(range, 10)];
          }
        });
      pagesToPrint = customPages.length;
    } else if (selectedPageOption === "All") {
      pagesToPrint = totalPages;
    }

    const totalCost = filePreviewUrl ? pricePerPage * copies * pagesToPrint : 0;
    setCalculatedPrice(totalCost);
  }, [isColor, copies, totalPages, setCalculatedPrice, customPageRange, selectedPageOption, filePreviewUrl, pricing]);

  return (
    <div className="mt-8 flex items-center space-x-4 w-full">
      <h1 className="font-bold text-gray-700 text-2xl">Smart Price:</h1>
      <span className="text-lg font-bold text-green-600">
        ₱{calculatedPrice ? calculatedPrice.toFixed(2) : "0.00"}
      </span>
    </div>
  );
}

export default SmartPriceLabel;
