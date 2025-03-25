import React, { useState,useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPrint } from "react-icons/fa";
import { ezlogo } from "../assets/Icons";

import CustomPage from "../components/qr/customized_page";
import DocumentPreview from "../components/qr/document_preview";
import SmartPriceToggle from "../components/qr/smart_price";
import PrinterList from "../components/qr/printerList";
import PageOrientation from "../components/qr/page_orientation";
import SelectColor from "../components/qr/select_color";
import PageSize from "../components/qr/page_size";
import Copies from "../components/qr/copies";

import { realtimeDb, storage } from "../../firebase/firebase_config";
import { getDatabase, ref as dbRef, push,get, update } from "firebase/database";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { onValue } from "firebase/database";
import axios from "axios";
import { PDFDocument } from "pdf-lib";
import mammoth from "mammoth";

import { useLocation } from "react-router-dom";

import { getPageIndicesToPrint } from "../utils/pageRanges";

const QRUpload = () => {
  const navigate = useNavigate();

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const fileName = queryParams.get("name");
  const fileUrl = queryParams.get("url");
  const pagesParam = queryParams.get("pages");
  // File states
 
  // Print settings states
  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [copies, setCopies] = useState(1);
  const [selectedSize, setSelectedSize] = useState("Letter 8.5 x 11");
  const [isColor, setIsColor] = useState(false);
  const [orientation, setOrientation] = useState("Portrait");
  const [selectedPageOption, setSelectedPageOption] = useState("All");
  const [customPageRange, setCustomPageRange] = useState("");



  const [totalPages, setTotalPages] = useState(() => {
    return pagesParam ? parseInt(pagesParam) : 1;
  });
  
  const [isSmartPriceEnabled, setIsSmartPriceEnabled] = useState(false);
  const [calculatedPrice, setCalculatedPrice] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  let [availableCoins, setAvailableCoins] = useState(0);


  
  useEffect(() => {
    const coinRef = dbRef(realtimeDb, "coinCount/availableCoins");
    
    // Listen for real-time updates
    const unsubscribe = onValue(coinRef, (snapshot) => {
      if (snapshot.exists()) {
        setAvailableCoins(snapshot.val());
      } else {
        console.error("Error retrieving available coins.");
      }
    }, (error) => {
      console.error("Error fetching available coins:", error);
    });
    
    // Cleanup function to unsubscribe when component unmounts
    return () => unsubscribe();
  }, []);
  

 
  const handlePrint = async () => {
    setIsLoading(true);
    if (!fileUrl) {
      alert("No file uploaded! Please upload a file before printing.");
      setIsLoading(false);
      return;
    }
    if (!selectedPrinter) {
      alert("No printer selected! Please choose a printer first.");
      setIsLoading(false);
      return;
    }

    // Fetch current available coins from Firebase
        const coinRef = dbRef(realtimeDb, "coinCount");
        try {
          const snapshot = await get(coinRef);
          if (snapshot.exists()) {
            setAvailableCoins = snapshot.val();
          } else {
            alert("Error retrieving available coins.");
            setIsLoading(false);
            return;
          }
        } catch (error) {
          console.error("Error fetching available coins:", error);
          alert("Error fetching available coins.");
          setIsLoading(false);
          return;
        }

      // Check if availableCoins is enough to print
    if (availableCoins < calculatedPrice) {
      alert("Not enough coins to proceed with printing.");
      setIsLoading(false);
      return;
    }
  
  
    let finalFileUrlToPrint = fileUrl;
  
    try {if (fileUrl?.toLowerCase().endsWith(".pdf")) {
        const existingPdfBytes = await fetch(fileUrl).then((res) =>
          res.arrayBuffer()
        );
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
  
        const indicesToKeep = getPageIndicesToPrint({
          totalPages,
          selectedPageOption,
          customPageRange,
          orientation
        });
  
        if (indicesToKeep.length === 0) {
          alert("No pages selected based on your page option!");
          return;
        }
  
        const newPdfDoc = await PDFDocument.create();
        const copiedPages = await newPdfDoc.copyPages(pdfDoc, indicesToKeep);
  
        copiedPages.forEach((page) => {
          if (orientation === "Landscape") {
            page.setRotation(degrees(90)); // Rotate page if landscape
          }
          newPdfDoc.addPage(page);
        });
        if (!isColor) {
          copiedPages.forEach((page) => {
              page.drawRectangle({
                  color: rgb(0, 0, 0),
                  opacity: 0.8,
              });
          });
      }
  
        const newPdfBytes = await newPdfDoc.save();
        const newPdfBlob = new Blob([newPdfBytes], { type: "application/pdf" });
  
        const timeStamp = Date.now()
        finalFileUrlToPrint = fileUrl;
      } 
  
      else if (
        fileUrl?.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        const arrayBuffer = await fetch(fileUrl).then((res) =>
          res.arrayBuffer()
        );
        const pdfDoc = await PDFDocument.create();
        const extractedText = await mammoth.extractRawText({ arrayBuffer });
  
        const page = pdfDoc.addPage([612, 792]); // Default Letter size
        const { width, height } = page.getSize();
  
        if (orientation === "Landscape") {
          page.setRotation(degrees(90));
        }
  
        page.drawText(extractedText.value, {
          x: 50,
          y: height - 50,
          size: 12,
          color: isColor ? rgb(0, 0, 0) : grayscale(0.1),
        });
        
  
 
        const newPdfBytes = await newPdfDoc.save();

        const newPdfBlob = new Blob([newPdfBytes], { type: "application/pdf" });


        const timeStamp = Date.now();
        finalFileUrlToPrint = fileUrl
      } 

      else {
      
        if (selectedPageOption !== "All") {
          alert("Partial page selection is only supported for PDF right now.");
        }
      }

 
      const printJobsRef = dbRef(realtimeDb, "files");
      await push(printJobsRef, {
        fileName: fileName,
        fileUrl: finalFileUrlToPrint, 
        printerName: selectedPrinter,
        copies: copies,
        paperSize: selectedSize,
        isColor: isColor,
        orientation: orientation,
        pageOption: selectedPageOption,
        customPageRange: customPageRange,
        totalPages: totalPages,
        finalPrice:calculatedPrice,
        timestamp: new Date().toISOString(),
        status: "Pending"
      });

      const updatedCoins = availableCoins - calculatedPrice;
            await update(coinRef, { availableCoins: updatedCoins });
            alert("Print job sent successfully. Coins deducted.");
      try {
        const response = await axios.post("http://localhost:5000/api/print", {
          printerName: selectedPrinter,
          fileUrl: finalFileUrlToPrint,
          copies: copies,
          isColor: isColor,
        });

        if (response.data.success) {
          alert("Print job sent to the printer!");
        } else {
          alert("Failed to send print job to the printer.");
        }
      } catch (err) {
        console.error("Print job error:", err);
      }

    } catch (error) {
      console.error("Error preparing the print job:", error);
      alert("Failed to prepare print job. Please try again.");
    } finally{
      setIsLoading(false);
    }
  };


  return (
    <div className="p-4">
           <div className="flex items-center space-x-4 mb-6">
             <img src={ezlogo} alt="EZ Logo" className="w-16 h-16" />
             <h1 className="text-4xl font-bold text-[#31304D]">
               Kiosk Vendo Printer
             </h1>
           </div>

      {/* Main Box Container */}
      <div className="flex flex-col w-full h-full bg-gray-200 rounded-lg shadow-md border-4 border-[#31304D] p-6 space-x-4 relative">

        
        <div className="flex w-full space-x-6">
          {/* Left Side */}
          <div className="w-1/2 flex flex-col">
            <div className="flex items-center">
              <button
                className="w-10 h-10 bg-gray-200 text-[#31304D] flex items-center justify-center rounded-lg border-2 border-[#31304D] mr-4"
                onClick={() => navigate(-1)}
              >
                <FaArrowLeft className="text-2xl text-[#31304D]" />
              </button>
              <p className="text-3xl font-bold text-[#31304D]">Upload Your Files</p>
            </div>

            {/* Printer List */}
            <PrinterList
              selectedPrinter={selectedPrinter}
              setSelectedPrinter={setSelectedPrinter}
            />


            {/* Page Settings */}
            <div className="mt-6 space-y-4">
              <Copies copies={copies} setCopies={setCopies} />
              <PageSize
                selectedSize={selectedSize}
                setSelectedSize={setSelectedSize}
              />
              <CustomPage
                selectedPageOption={selectedPageOption}
                setSelectedPageOption={setSelectedPageOption}
                customPageRange={customPageRange}
                setCustomPageRange={setCustomPageRange}
                totalPages={totalPages}
              />
              <SelectColor isColor={isColor} setIsColor={setIsColor} />
              <PageOrientation
                orientation={orientation}
                setOrientation={setOrientation}
              />

              <p className="mt-6 font-bold text-gray-700 text-2xl">
              Inserted coins: {availableCoins}
              </p>

              <SmartPriceToggle
                paperSize={selectedSize}
                isColor={isColor}
                copies={copies}
                totalPages={totalPages}
                isSmartPriceEnabled={isSmartPriceEnabled}
                setIsSmartPriceEnabled={setIsSmartPriceEnabled}
                calculatedPrice={calculatedPrice}
                setCalculatedPrice={setCalculatedPrice}
                selectedPageOption={selectedPageOption}
                setSelectedPageOption={setSelectedPageOption}
                customPageRange={customPageRange}
                setCustomPageRange={setCustomPageRange}
                filePreviewUrl={fileUrl}
              />
            </div>
          </div>

          {/* Right Side - File Preview */}
          <div className="w-full">
            <DocumentPreview
              fileUrl={fileUrl}
              fileName={fileName}
            />
          </div>
        </div>

        {/* Bottom Section (Print Button) */}
      <div className="flex flex-col items-center mt-auto pt-6">
               {isLoading ? (
                 <button
                   disabled
                   className="w-40 py-3 bg-[#31304D] text-white text-lg font-bold rounded-lg mt-6 flex items-center justify-center"
                 >
                   <i className="fa fa-spinner fa-spin mr-2"></i>
                   Printing...
                 </button>
               ) : (
                 <button
                   onClick={handlePrint}
                   className="w-40 py-3 bg-[#31304D] text-white text-lg font-bold rounded-lg mt-6 flex items-center justify-center"
                 >
                   Print <FaPrint className="ml-2 text-white" />
                 </button>
               )}
             </div>
      </div>
    </div>
  );
};

export default QRUpload;
