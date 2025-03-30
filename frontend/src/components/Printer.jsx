import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from "react-router-dom";
import { realtimeDb, storage } from '../../firebase/firebase_config';
import { ref, onValue, update, remove } from "firebase/database"
import { deleteObject, listAll, ref as storageRef } from "firebase/storage";

import {
  vectorImage1,
  vectorImage3,
  vectorImage4
} from '../assets/Icons';

import { FaTimes, FaFilePdf, FaFileWord, FaFileExcel, FaFileImage } from "react-icons/fa";

import M_Qrcode from './M_Qrcode';
import Header from './headers/Header';
import ActionCard from './ui/ActionCard';

const Printer = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUsbModalOpen, setIsUsbModalOpen] = useState(false);
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    const fetchQueue = () => {
      const queueRef = ref(realtimeDb, "files"); // Fetching print queue

      onValue(queueRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const queueArray = Object.keys(data)
            .map((key) => ({
              id: key,
              ...data[key],
            }))
            // Make sure we show all relevant job statuses
            .filter((file) =>
              file.status === "Pending" ||
              file.status === "Processing" ||
              file.status === "Error"
            )
            // Sort by timestamp (newest first)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

          setQueue(queueArray);
        } else {
          setQueue([]);
        }
      });
    };

    fetchQueue();
  }, []);

  // Replace the existing cancelPrintJob with this:
  const cancelPrintJob = (fileId) => {
    if (!window.confirm("Are you sure you want to remove this file from the queue?")) {
      return;
    }

    remove(ref(realtimeDb, `files/${fileId}`))
      .then(() => {
        console.log(`File with ID ${fileId} removed from queue in DB.`);
      })
      .catch((error) => {
        console.error("Error removing file from queue:", error);
      });
  };

  const clearAllFiles = async () => {
    if (!window.confirm("Are you sure you want to clear all files? This action cannot be undone.")) {
      return;
    }

    try {
      const storageFolderRef = storageRef(storage, "uploads/");
      const result = await listAll(storageFolderRef);

      await Promise.all(
        result.items.map((fileRef) => deleteObject(fileRef))
      );

      await remove(ref(realtimeDb, "files"));
      await remove(ref(realtimeDb, "uploadedFiles"));

      setQueue([]);
      console.log("✅ All files deleted successfully!");
    } catch (error) {
      console.error("❌ Error clearing files:", error);
    }
  };

  // Function to start printing a file
  const startPrinting = (fileId) => {
    // Set initial status to Processing with 5% progress
    update(ref(realtimeDb, `files/${fileId}`), {
      status: "Processing",
      progress: 5,
      printStatus: "Starting print job..."
    });

    console.log(`🖨️ Printing started for file ID: ${fileId}`);

    // Simulate print progress with more detailed updates
    const progressSteps = [
      { progress: 15, status: "Processing document...", delay: 800 },
      { progress: 30, status: "Configuring printer settings...", delay: 1500 },
      { progress: 45, status: "Converting document format...", delay: 2200 },
      { progress: 60, status: "Connecting to printer...", delay: 3000 },
      { progress: 75, status: "Sending to printer...", delay: 3800 },
      { progress: 85, status: "Printing in progress...", delay: 4500 },
      { progress: 95, status: "Finishing print job...", delay: 5200 },
    ];

    // Update progress using for...of to maintain sequence
    for (const step of progressSteps) {
      setTimeout(() => {
        update(ref(realtimeDb, `files/${fileId}`), {
          progress: step.progress,
          printStatus: step.status
        });
      }, step.delay);
    }

    // Complete the print job
    setTimeout(() => {
      update(ref(realtimeDb, `files/${fileId}`), {
        status: "Done",
        progress: 100,
        printStatus: "Print completed"
      })
        .then(() => console.log(`✅ Printing completed for file ID: ${fileId}`))
        .catch((error) => console.error("Error updating status:", error));
    }, 6000);
  };

  // Function to determine the file type icon
  const getFileIcon = (fileName) => {
    if (!fileName) return <FaFileWord className="text-blue-600 text-2xl" />;
    const ext = fileName.split(".").pop().toLowerCase();

    if (ext === "pdf") return <FaFilePdf className="text-red-600 text-2xl" />;
    if (["docx", "doc"].includes(ext)) return <FaFileWord className="text-blue-600 text-2xl" />;
    if (["xls", "xlsx"].includes(ext)) return <FaFileExcel className="text-green-600 text-2xl" />;
    if (["jpg", "png", "jpeg"].includes(ext)) return <FaFileImage className="text-yellow-600 text-2xl" />;

    return <FaFileWord className="text-gray-600 text-2xl" />;
  };

  // Function to get the proper background color for progress bar based on status and progress
  const getProgressBarColor = (status, progress) => {
    if (status === "Error") return "bg-red-500";
    if (status === "Done") return "bg-green-500";

    // Progress-based gradient for processing status
    if (progress < 30) return "bg-blue-400";
    if (progress < 60) return "bg-blue-500";
    if (progress < 90) return "bg-blue-600";
    return "bg-blue-700";
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <Header />

      <div className="container mx-auto mt-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Xerox */}
          <ActionCard icon={vectorImage1} alt="Xerox" label="Xerox" to="/xerox" />

          {/* USB */}
          <ActionCard icon={vectorImage3} alt="USB" label="USB" to="/usb" />

          {/* Share via QR */}
          <ActionCard icon={vectorImage4} alt="Share files via QR" label="Share files via QR" to='/qr' />
        </div>

        {/* Printer Queue */}
        <div className="mt-12 bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-[#31304D]">Printer Queue</h2>
          </div>

          {queue.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg">No files in the queue</p>
            </div>
          ) : (
            <div className="space-y-6">
              {queue.map((file) => (
                <div key={file.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      {getFileIcon(file.name || file.fileName)}
                      <span className="ml-3 font-medium">{file.fileName}</span>
                    </div>
                    <button
                      onClick={() => cancelPrintJob(file.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <FaTimes size={18} />
                    </button>
                  </div>

                  {file.status === "Pending" ? (
                    <div className="flex items-center justify-between mt-4">
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                        Waiting to print
                      </span>
                      <button
                        onClick={() => startPrinting(file.id)}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                      >
                        Start Print
                      </button>
                    </div>
                  ) : file.status === "Error" ? (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-red-700">
                          {file.printStatus || "Error processing print job"}
                        </span>
                        <button
                          onClick={() => startPrinting(file.id)}
                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs"
                        >
                          Retry
                        </button>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-red-500 h-2.5 rounded-full"
                          style={{ width: "100%" }}
                        ></div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          {file.printStatus || "Processing..."}
                        </span>
                        <span className="text-sm font-medium text-blue-600">
                          {file.progress || 0}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`${getProgressBarColor(file.status, file.progress)} h-2.5 rounded-full transition-all duration-500 ease-in-out`}
                          style={{ width: `${file.progress || 0}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal for QR */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm z-50">
          <div className="bg-white p-6 rounded-xl shadow-2xl max-w-md w-full flex flex-col items-center">
            <h2 className="text-2xl font-bold mb-4 text-center">Share files via QR</h2>
            <M_Qrcode />
            <button
              className="mt-6 bg-red-500 text-white px-6 py-3 rounded-lg w-3/4 text-center font-bold hover:bg-red-600 transition-colors"
              onClick={() => setIsModalOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {isUsbModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm z-50">
          <div className="bg-white p-10 rounded-xl shadow-2xl max-w-xl w-full flex flex-col items-center relative">
            <button
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
              onClick={() => navigate('/usb')}>
              <FaTimes className="text-2xl" />
            </button>
            <h2 className="text-4xl font-bold mb-6 text-center text-[#31304D]">
              Guide
            </h2>

            <ul className="list-disc list-inside mb-6 text-2xl space-y-4">
              <li><span className="font-medium text-blue-600">Please choose file from your USB drive.</span></li>
              <li className="font-medium">Insert exact amount.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default Printer;
