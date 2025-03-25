import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPrint, FaTimes } from "react-icons/fa";
import { ezlogo } from "../assets/Icons";

import CustomPage from "../components/bluetooth/customized_page";
import DocumentPreview from "../components/bluetooth/document_preview";
import SmartPriceToggle from "../components/bluetooth/smart_price";
import PrinterList from "../components/bluetooth/printerList";
import PageOrientation from "../components/bluetooth/page_orientation";
import SelectColor from "../components/bluetooth/select_color";
import PageSize from "../components/bluetooth/page_size";
import Copies from "../components/bluetooth/copies";


import { realtimeDb, storage } from "../../firebase/firebase_config";
import { ref as dbRef, push, get, update } from "firebase/database";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { onValue } from "firebase/database";
import axios from "axios";
import { PDFDocument } from "pdf-lib";
import mammoth from "mammoth";

import { getPageIndicesToPrint } from "../utils/pageRanges";

const BTUpload = () => {
  const navigate = useNavigate();


  const [filePreviewUrl, setFilePreviewUrl] = useState("");
  const [fileToUpload, setFileToUpload] = useState(null);


  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [copies, setCopies] = useState(1);
  const [selectedSize, setSelectedSize] = useState("Letter 8.5 x 11");
  const [isColor, setIsColor] = useState(false);
  const [orientation, setOrientation] = useState("Portrait");
  const [selectedPageOption, setSelectedPageOption] = useState("All");
  const [customPageRange, setCustomPageRange] = useState("");
  const [totalPages, setTotalPages] = useState(1);
  const [isSmartPriceEnabled, setIsSmartPriceEnabled] = useState(false);
  const [calculatedPrice, setCalculatedPrice] = useState(0);
  const [isLoading, setIsLoading] = useState(false);


  const [availableCoins, setAvailableCoins] = useState(0);

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
    
  
    return () => unsubscribe();
  }, []);
  



  const [showModal, setShowModal] = useState(false);


  useEffect(() => {
    setShowModal(true);
  }, []);

  const closeModal = () => {
    setShowModal(false);
  };


  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) {
      alert("No file selected!");
      return;
    }
    setFileToUpload(file);

    // If PDF, get total pages
    if (file.type === "application/pdf") {
      const reader = new FileReader();  
      reader.onload = async (e) => {
        const pdfData = new Uint8Array(e.target.result);
        const pdfDoc = await PDFDocument.load(pdfData);
        const totalPageCount = pdfDoc.getPageCount();
        setTotalPages(totalPageCount);
      };
      reader.readAsArrayBuffer(file);
    }

    else if (
      file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const arrayBuffer = e.target.result;
        try {
          const result = await mammoth.extractRawText({ arrayBuffer });
          const textLength = result.value.length;
          const estimatedPages = Math.ceil(textLength / 1000);
          setTotalPages(estimatedPages);
        } catch (error) {
          console.error("Error reading docx file:", error);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setTotalPages(1);
    }


    uploadFileToFirebase(file);
  };

  const uploadFileToFirebase = async (file) => {
    if (!file) {
      alert("No file selected for upload!");
      return;
    }
    const storageRef = ref(storage, `uploads/${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        console.log(
          `Upload progress: ${
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          }%`
        );
      },
      (error) => {
        console.error("Upload failed", error);
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          setFilePreviewUrl(url);
          console.log("File available at:", url);
          alert("File uploaded successfully!");
        } catch (error) {
          console.error("Error getting download URL:", error);
        }
      }
    );
  };


   const handlePrint = async () => {
     setIsLoading(true);
     if (!filePreviewUrl) {
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
            setAvailableCoins(snapshot.val());
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
   
   
     let finalFileUrlToPrint = filePreviewUrl;
   
     try {
      if (filePreviewUrl?.toLowerCase().endsWith(".pdf")) {


         const existingPdfBytes = await fetch(filePreviewUrl).then((res) =>
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
         finalFileUrlToPrint = filePreviewUrl;
       } 
   
       else if (
         filePreviewUrl?.type ===
         "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
       ) {
         const arrayBuffer = await fetch(filePreviewUrl).then((res) =>
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
         finalFileUrlToPrint = filePreviewUrl
       } 
 
       else {
       
         if (selectedPageOption !== "All") {
           alert("Partial page selection is only supported for PDF right now.");
         }
       }
 
  
       const printJobsRef = dbRef(realtimeDb, "files");
       await push(printJobsRef, {
         fileName: fileToUpload?.name,
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

  // Add new state variables for Bluetooth
  const [isBluetoothConnected, setIsBluetoothConnected] = useState(false);
  const [bluetoothDevice, setBluetoothDevice] = useState(null);
  const [receivedData, setReceivedData] = useState(null);
  const [bluetoothError, setBluetoothError] = useState(null);

  // Add Bluetooth receive functionality
  const connectToBluetooth = async () => {
    try {
      setBluetoothError(null);
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          {
            services: ['battery_service'] // Replace with your specific service UUID
          }
        ]
      });

      console.log('Device selected:', device.name);
      setBluetoothDevice(device);

      const server = await device.gatt.connect();
      console.log('Connected to GATT server');
      
      const service = await server.getPrimaryService('battery_service'); // Replace with your service UUID
      const characteristic = await service.getCharacteristic('battery_level'); // Replace with your characteristic UUID

      await characteristic.startNotifications();
      console.log('Notifications started');

      characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const value = event.target.value;
        setReceivedData(value);
        console.log('Received value:', value);
      });

      setIsBluetoothConnected(true);
    } catch (error) {
      console.error('Bluetooth Error:', error);
      setBluetoothError(error.message);
      setIsBluetoothConnected(false);
    }
  };

  const disconnectBluetooth = async () => {
    if (bluetoothDevice && bluetoothDevice.gatt.connected) {
      await bluetoothDevice.gatt.disconnect();
      setIsBluetoothConnected(false);
      setBluetoothDevice(null);
      setReceivedData(null);
    }
  };

  // Cleanup Bluetooth connection on component unmount
  useEffect(() => {
    return () => {
      disconnectBluetooth();
    };
  }, []);

  return (
    <div className="p-4">
      <div className="flex items-center space-x-4 mb-6">
        <img src={ezlogo} alt="EZ Logo" className="w-16 h-16" />
        <h1 className="text-4xl font-bold text-[#31304D]">
          Kiosk Vendo Printer
        </h1>
      </div>

      {showModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-md shadow-md relative  max-w-full">
          {/* Close Button */}
          <button
            onClick={closeModal}
            className="absolute top-2 right-2 text-2xl font-bold hover:text-red-600"
          >
            &times;
          </button>

          <h2 className="text-4xl font-bold mb-4 text-center">
            Guide
          </h2>

          <ul className="list-disc list-inside mb-4 text-2xl">
            <li ><span className="font-bold text-blue-500">Please send your file via Bluetooth Vendo Print.</span></li>
            <li className="font-bold">Insert exact amount.</li>
            <li className="font-semibold">Once your file is transferred, select or browse it below to upload.</li>
 
          </ul>
        </div>
      </div>
    )}


     
      <div className="flex flex-col w-full h-full bg-gray-200 rounded-lg shadow-md border-4 border-[#31304D] p-6 space-x-4 relative">
      
        <div className="flex w-full space-x-6">
       
          <div className="w-1/2 flex flex-col">
            <div className="flex items-center">
              <button
                className="w-10 h-10 bg-gray-200 text-[#31304D] flex items-center justify-center rounded-lg border-2 border-[#31304D] mr-4"
                onClick={() => navigate(-1)}
              >
                <FaArrowLeft className="text-2xl text-[#31304D]" />
              </button>
              <p className="text-3xl font-bold text-[#31304D]">
                Upload Your Files
              </p>
            </div>

            <PrinterList
              selectedPrinter={selectedPrinter}
              setSelectedPrinter={setSelectedPrinter}
            />

      
            <p className="mt-4 text-3xl font-bold text-[#31304D]">Choose File</p>
            <input
              type="file"
              onChange={handleFileSelect}
              className="mt-4 w-full border-2 border-[#31304D] p-2"
            />


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
                Inserted coins: {availableCoins.toString()}
              </p>

              <SmartPriceToggle
                paperSize={selectedSize}
                isColor={isColor}
                copies={copies}
                totalPages={totalPages}
                setTotalPages={setTotalPages}
                isSmartPriceEnabled={isSmartPriceEnabled}
                setIsSmartPriceEnabled={setIsSmartPriceEnabled}
                calculatedPrice={calculatedPrice}
                setCalculatedPrice={setCalculatedPrice}
                selectedPageOption={selectedPageOption}
                setSelectedPageOption={setSelectedPageOption}
                customPageRange={customPageRange}
                setCustomPageRange={setCustomPageRange}
                filePreviewUrl = {filePreviewUrl}
              />
            </div>
          </div>

          <div className="w-full">
            <DocumentPreview fileUrl={filePreviewUrl} fileName={fileToUpload?.name} />
          </div>
        </div>

       

        <div className="flex flex-col items-center mt-auto pt-6">
          <button
            onClick={handlePrint}
            disabled={isLoading}
            className="w-40 py-3 bg-[#31304D] text-white text-lg font-bold rounded-lg mt-6 flex items-center justify-center disabled:opacity-50"
          >
            {isLoading ? "Printing..." : "Print"}
            <FaPrint className="ml-2 text-white" />
          </button>
        </div>
      </div>

      {/* Add Bluetooth controls */}
      <div className="bluetooth-controls">
        {!isBluetoothConnected ? (
          <button 
            onClick={connectToBluetooth}
            className="bluetooth-connect-btn"
          >
            Connect to Bluetooth Device
          </button>
        ) : (
          <button 
            onClick={disconnectBluetooth}
            className="bluetooth-disconnect-btn"
          >
            Disconnect Bluetooth
          </button>
        )}
        
        {bluetoothError && (
          <div className="bluetooth-error">
            Error: {bluetoothError}
          </div>
        )}
        
        {receivedData && (
          <div className="received-data">
            Received Data: {receivedData}
          </div>
        )}
      </div>
    </div>
  );
};

export default BTUpload;
