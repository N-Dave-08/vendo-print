// export const calculatePrintPrice = (req, res) => {
//   try {
//     const { isColor, copies, totalPages, selectedPageOption, customPageRange } = req.body;

    // Base price for single copy
    const basePrice = isColor ? 14.50 : 6.75;

//     // Calculate number of odd and even pages
//     const oddPagesCount = Math.ceil(totalPages / 2);  // Odd pages: 1, 3, 5...
//     const evenPagesCount = Math.floor(totalPages / 2); // Even pages: 2, 4, 6...

//     console.log("Odd Pages Count:", oddPagesCount);
//     console.log("Even Pages Count:", evenPagesCount);
//     console.log("Total Pages:", totalPages);
//     console.log("Selected Page Option:", selectedPageOption);

//     let pagesToPrint = totalPages;

//     // Handle selected page options
//     if (selectedPageOption === "Odd") {
//       pagesToPrint = oddPagesCount;
//     } else if (selectedPageOption === "Even") {
//       pagesToPrint = evenPagesCount;
//     } else if (selectedPageOption === "Custom" && customPageRange) {
//       // Parse custom page range (e.g., "1-3,5,7-9")
//       const customPages = customPageRange
//         .split(",")
//         .flatMap((range) => {
//           if (range.includes("-")) {
//             const [start, end] = range.split("-").map(Number);
//             return Array.from({ length: end - start + 1 }, (_, i) => start + i);
//           } else {
//             return [parseInt(range, 10)];
//           }
//         });

//       console.log("Custom Pages:", customPages);

//       pagesToPrint = customPages.length;
//     } else if (selectedPageOption === "All") {
//       // If "All", we print all pages
//       pagesToPrint = totalPages;
//     }

//     // Final price calculation
//     const finalPrice = basePrice * copies * pagesToPrint;
//     console.log("Pages to Print:", pagesToPrint);
//     console.log("Final Price:", finalPrice);

//     return res.json({
//       success: true,
//       price: parseFloat(finalPrice.toFixed(2)),
//       totalPages: totalPages,
//       oddPagesCount: oddPagesCount,
//       evenPagesCount: evenPagesCount,
//       selectedPagesToPrint: pagesToPrint
//     });
//   } catch (error) {
//     console.error("Error calculating price:", error);
//     res.status(500).json({ success: false, message: "Error calculating price" });
//   }
// };
