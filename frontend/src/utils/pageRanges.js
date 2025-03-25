
export function getPageIndicesToPrint({
    totalPages,
    selectedPageOption,
    customPageRange,
  }) {
    switch (selectedPageOption) {
      case "Odd": {
 
        return Array.from({ length: totalPages }, (_, i) => i).filter(
          (i) => (i + 1) % 2 === 1
        );
      }
      case "Even": {
    
        return Array.from({ length: totalPages }, (_, i) => i).filter(
          (i) => (i + 1) % 2 === 0
        );
      }
      case "Custom": {

        return parseCustomRange(customPageRange, totalPages);
      }

      default:
        return Array.from({ length: totalPages }, (_, i) => i); 
    }
  }
  

  function parseCustomRange(rangeStr, totalPages) {
    if (!rangeStr) return [];
    const pages = [];
  

    const parts = rangeStr.split(",");
    for (let part of parts) {
      part = part.trim();
      if (part.includes("-")) {

        const [start, end] = part.split("-").map((n) => parseInt(n, 10));
        if (isNaN(start) || isNaN(end)) continue;

        const rangeStart = Math.max(1, start);
        const rangeEnd = Math.min(totalPages, end);
        for (let p = rangeStart; p <= rangeEnd; p++) {
          pages.push(p - 1); 
        }
      } else {
     
        const pageNum = parseInt(part, 10);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
          pages.push(pageNum - 1);
        }
      }
    }
  
   
    const uniqueSorted = Array.from(new Set(pages)).sort((a, b) => a - b);
    return uniqueSorted;
  }
  