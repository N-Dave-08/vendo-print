import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaPrint } from 'react-icons/fa';
import { ezlogo } from '../assets/Icons';

import SmartPriceToggle from "../components/xerox/smart_price";

import { realtimeDb } from '../../firebase/firebase_config';
import { getDatabase, ref as dbRef, get } from "firebase/database";
import axios from "axios";
import ClientContainer from '../components/containers/ClientContainer';

const Xerox = () => {
  const navigate = useNavigate();
  const userInitiatedRef = useRef(false);

  // File at Printer states
  const [filePreviewUrl, setFilePreviewUrl] = useState("");
  const [isSmartPriceEnabled, setIsSmartPriceEnabled] = useState(false);
  const [calculatedPrice, setCalculatedPrice] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [availableCoins, setAvailableCoins] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAvailableCoins = async () => {
      const coinRef = dbRef(realtimeDb, "coinCount/availableCoins");
      try {
        const snapshot = await get(coinRef);
        if (snapshot.exists()) {
          setAvailableCoins(snapshot.val());
        } else {
          console.error("Error retrieving available coins.");
        }
      } catch (error) {
        console.error("Error fetching available coins:", error);
      }
    };
    fetchAvailableCoins();
  }, []);

  const handleScan = async () => {
    // Only proceed if the user explicitly initiated the scan
    if (!userInitiatedRef.current && event && event.type !== 'click') {
      console.log('Preventing automatic scan');
      return;
    }

    userInitiatedRef.current = false; // Reset the flag
    setIsLoading(true);
    setError("");
    setFilePreviewUrl("");

    try {
      // First check if scanner is available
      await axios.get('http://localhost:5000/api/xerox/check-scanner');

      // Then get the preview
      const response = await axios.get('http://localhost:5000/api/xerox/preview', {
        responseType: 'blob'
      });

      const imageUrl = URL.createObjectURL(response.data);
      setFilePreviewUrl(imageUrl);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to scan document. Please check if the scanner is connected and powered on.');
      console.error('Scan error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to explicitly set user-initiated flag
  const initiateUserScan = () => {
    userInitiatedRef.current = true;
    handleScan();
  };

  // Function to clear the scanned document
  const clearScannedDocument = () => {
    // Revoke object URL to prevent memory leaks
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }

    setFilePreviewUrl("");
    setCalculatedPrice(0);
    setError("");
  };

  const handlePrint = async () => {
    setIsLoading(true);

    if (!filePreviewUrl) {
      setError("No document scanned! Please scan a document first.");
      setIsLoading(false);
      return;
    }

    if (availableCoins < calculatedPrice) {
      setError(`Insufficient coins. Please insert ${calculatedPrice - availableCoins} more coins.`);
      setIsLoading(false);
      return;
    }

    try {
      // Create a hidden iframe
      const printFrame = document.createElement('iframe');
      printFrame.style.display = 'none';
      document.body.appendChild(printFrame);

      // Write the print content to the iframe
      printFrame.contentDocument.write(`
        <html>
          <head>
            <title>Print Document</title>
            <style>
              body {
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
              }
              img {
                max-width: 100%;
                max-height: 100vh;
                object-fit: contain;
              }
            </style>
          </head>
          <body>
            <img src="${filePreviewUrl}" onload="window.print();" />
          </body>
        </html>
      `);
      printFrame.contentDocument.close();

      // Handle print completion or cancellation
      const cleanup = () => {
        document.body.removeChild(printFrame);
        window.removeEventListener('focus', handlePrintComplete);
      };

      const handlePrintComplete = async () => {
        // Small delay to ensure print dialog is fully closed
        setTimeout(async () => {
          cleanup();

          // Update coins after print dialog is closed
          const coinRef = dbRef(realtimeDb, "coinCount/availableCoins");
          const snapshot = await get(coinRef);
          if (snapshot.exists()) {
            const currentCoins = snapshot.val();
            const remainingCoins = currentCoins - calculatedPrice;
            await dbRef(realtimeDb, "coinCount").set({
              availableCoins: remainingCoins
            });
            setAvailableCoins(remainingCoins);
          }

          setFilePreviewUrl(""); // Clear the preview
          setIsLoading(false);
        }, 500);
      };

      window.addEventListener('focus', handlePrintComplete);

    } catch (err) {
      console.error("Print job error:", err);
      setError("Failed to print. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <ClientContainer className="p-4">

      {/* Main Box Container */}
      <div className="flex flex-col w-full h-full bg-gray-200 rounded-lg shadow-md border-4 border-[#31304D] p-6 space-x-4 relative">
        {/* Top Section */}
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
              <p className="text-3xl font-bold text-[#31304D]">Xerox</p>
            </div>

            {/* Page Settings */}
            <div className="mt-6 space-y-4">
              <p className="mt-6 font-bold text-gray-700 text-2xl">
                Inserted coins: {availableCoins}
              </p>
              <SmartPriceToggle
                copies={1}
                isSmartPriceEnabled={isSmartPriceEnabled}
                setIsSmartPriceEnabled={setIsSmartPriceEnabled}
                calculatedPrice={calculatedPrice}
                totalPages={totalPages}
                setCalculatedPrice={setCalculatedPrice}
                filePreviewUrl={filePreviewUrl}
              />
            </div>
          </div>

          {/* Right Side - Preview */}
          <div className="w-1/2">
            <div className="bg-white rounded-lg p-4 h-full flex flex-col items-center justify-center relative">
              {error && (
                <div className="text-red-500 mb-4 text-center">
                  {error}
                </div>
              )}
              {filePreviewUrl ? (
                <>
                  <img
                    src={filePreviewUrl}
                    alt="Scanned Preview"
                    className="max-w-full max-h-[400px] object-contain"
                  />
                  <div className="mt-4 flex space-x-4">
                    <button
                      onClick={initiateUserScan}
                      disabled={isLoading}
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                    >
                      {isLoading ? "Scanning..." : "Scan Again"}
                    </button>
                    <button
                      onClick={clearScannedDocument}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                    >
                      Clear
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center text-gray-500">
                  <p className="mb-4">No document scanned yet</p>
                  <button
                    onClick={initiateUserScan}
                    disabled={isLoading}
                    className="px-4 py-2 bg-[#31304D] text-white rounded-lg hover:bg-opacity-90"
                  >
                    {isLoading ? "Scanning..." : "Scan Document"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Section (Xerox Button) */}
        <div className="flex flex-col items-center mt-auto pt-6">
          {isLoading ? (
            <button
              disabled
              className="w-40 py-3 bg-[#31304D] text-white text-lg font-bold rounded-lg mt-6 flex items-center justify-center opacity-70"
            >
              <i className="fa fa-spinner fa-spin mr-2"></i>
              Processing...
            </button>
          ) : (
            <button
              onClick={handlePrint}
              disabled={!filePreviewUrl}
              className={`w-40 py-3 bg-[#31304D] text-white text-lg font-bold rounded-lg mt-6 flex items-center justify-center ${!filePreviewUrl ? 'opacity-50 cursor-not-allowed' : 'hover:bg-opacity-90'
                }`}
            >
              Xerox <FaPrint className="ml-2 text-white" />
            </button>
          )}
        </div>
      </div>
    </ClientContainer>
  );
};

export default Xerox;
