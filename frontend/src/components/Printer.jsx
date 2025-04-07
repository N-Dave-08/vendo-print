import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from "react-router-dom";

import { X, Printer as PrinterIcon, Usb, QrCode, Info, Clock, Trash2 } from "lucide-react";
import { BiLoaderAlt } from "react-icons/bi";

import M_Qrcode from './M_Qrcode';
import Header from './headers/Header';
import ActionCard from './ui/ActionCard';
import { realtimeDb } from "../../firebase/firebase_config";
import { ref as dbRef, onValue, remove, get, update, set } from "firebase/database";
import axios from 'axios';

const Printer = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUsbModalOpen, setIsUsbModalOpen] = useState(false);
  const [printJobs, setPrintJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [processingPendingJob, setProcessingPendingJob] = useState(false);

  // Process any pending print job from sessionStorage
  useEffect(() => {
    const processPendingPrintJob = async () => {
      const pendingJobData = sessionStorage.getItem('pendingPrintJob');
      
      if (pendingJobData) {
        setProcessingPendingJob(true);
        
        try {
          // Parse the stored print job data
          const printData = JSON.parse(pendingJobData);
          
          // First check if we already have a recent job with this filename to prevent duplicates
          const printJobsRef = dbRef(realtimeDb, "printJobs");
          const existingJobsSnapshot = await get(printJobsRef);
          let skipJobCreation = false;
          let existingJobId = null;
          
          if (existingJobsSnapshot.exists()) {
            const existingJobs = existingJobsSnapshot.val();
            const currentTime = Date.now();
            const TWO_MINUTES = 2 * 60 * 1000; // More generous time window
            
            // Look for ANY jobs with the same filename, not just recent ones
            // This is more aggressive about preventing duplicates
            const matchingJobs = Object.entries(existingJobs)
              .filter(([_, job]) => 
                job.fileName === printData.fileName &&
                (job.status === 'pending' || job.status === 'processing' || job.status === 'printing')
              )
              .map(([id, job]) => ({id, ...job}));
            
            // Also check for very recent jobs (completed or not)
            const recentJobs = Object.entries(existingJobs)
              .filter(([_, job]) => 
                job.fileName === printData.fileName && 
                job.createdAt && 
                (currentTime - job.createdAt < TWO_MINUTES)
              )
              .map(([id, job]) => ({id, ...job}));
            
            // Combine the lists, prioritizing active jobs
            const allDuplicateJobs = [...matchingJobs, ...recentJobs.filter(
              job => !matchingJobs.some(mj => mj.id === job.id)
            )];
            
            if (allDuplicateJobs.length > 0) {
              console.log(`Found ${allDuplicateJobs.length} potential duplicate jobs for "${printData.fileName}"`);
              
              // Take the most recent job with the highest progress as our primary
              allDuplicateJobs.sort((a, b) => {
                // First, sort by status: pending < processing < printing
                const statusOrder = { pending: 0, processing: 1, printing: 2 };
                const statusDiff = (statusOrder[b.status] || 0) - (statusOrder[a.status] || 0);
                if (statusDiff !== 0) return statusDiff;
                
                // Then by progress
                const progressDiff = (b.progress || 0) - (a.progress || 0);
                if (progressDiff !== 0) return progressDiff;
                
                // Finally by creation time (most recent first)
                return (b.createdAt || 0) - (a.createdAt || 0);
              });
              
              // Use the first job (highest priority) as our existing job
              existingJobId = allDuplicateJobs[0].id;
              skipJobCreation = true;
              
              console.log(`Using existing job ${existingJobId} for "${printData.fileName}" to prevent duplication`);
              
              // Clean up any duplicate jobs except the first one
              if (allDuplicateJobs.length > 1) {
                for (let i = 1; i < allDuplicateJobs.length; i++) {
                  if (allDuplicateJobs[i].id) {
                    await remove(dbRef(realtimeDb, `printJobs/${allDuplicateJobs[i].id}`));
                    console.log(`Removed duplicate job ${allDuplicateJobs[i].id}`);
                  }
                }
              }
              
              // Make sure the chosen job is active
              await update(dbRef(realtimeDb, `printJobs/${existingJobId}`), {
                status: "processing",
                progress: Math.max(allDuplicateJobs[0].progress || 0, 5),
                statusMessage: "Re-processing print job..."
              });
            }
          }
          
          if (!skipJobCreation) {
            // Create a unique ID for the print job with the filename embedded for easier tracking
            const timestamp = Date.now();
            const printJobId = timestamp.toString();
            // Create a more reliable and unique client job ID
            const fileNameSafe = printData.fileName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
            const clientJobId = `job_${timestamp}_${fileNameSafe}_${Math.random().toString(36).substring(2, 10)}`;
            
            // Update balance
            const balanceRef = dbRef(realtimeDb, "coinCount/availableCoins");
            const balanceSnapshot = await get(balanceRef);
            const currentBalance = balanceSnapshot.exists() ? balanceSnapshot.val() : 0;
            const updatedBalance = currentBalance - printData.price;
            await update(dbRef(realtimeDb, "coinCount"), { availableCoins: updatedBalance });
            
            // Add print job to queue
            const printJobRef = dbRef(realtimeDb, `printJobs/${printJobId}`);
            await set(printJobRef, {
              id: printJobId,
              clientJobId: clientJobId,
              fileName: printData.fileName,
              fileUrl: printData.fileUrl,
              printerName: printData.printerName,
              copies: printData.copies,
              isColor: printData.isColor,
              totalPages: printData.totalPages,
              colorPages: printData.colorPageCount,
              status: "pending",
              progress: 0,
              createdAt: timestamp,
              price: printData.price
            });
            
            // Update job status
            await update(printJobRef, {
              status: "processing",
              progress: 5,
              statusMessage: "Preparing print job..."
            });
            
            console.log(`Created new print job ${printJobId} for "${printData.fileName}"`);
            
            // Send the print request to the server with client job ID
            try {
              const response = await axios.post('http://localhost:5000/api/print', {
                fileUrl: printData.fileUrl,
                fileName: printData.fileName,
                printerName: printData.printerName,
                copies: printData.copies,
                isColor: printData.isColor,
                hasColorContent: printData.hasColorPages,
                colorPageCount: printData.colorPageCount,
                orientation: printData.orientation,
                selectedSize: printData.selectedSize,
                printJobId: printJobId,
                jobId: printJobId,
                clientJobId: clientJobId
              }, { timeout: 30000 });
              
              // Check response for duplicate detection
              if (response.data?.details?.isDuplicate) {
                console.log("Server detected duplicate print job, will use existing job");
              }
            } catch (apiError) {
              console.error("Error sending print request to server:", apiError);
              // Update job with error
              await update(printJobRef, {
                status: "error",
                progress: 0,
                statusMessage: `Error: ${apiError.message}`
              });
            }
          } else if (existingJobId) {
            // An existing print job was found, notify the user
            console.log(`Using existing print job ${existingJobId} instead of creating a new one`);
          }
          
          // Clean up any stale or duplicate jobs
          await cleanupDuplicateJobs(printData.fileName);
          
        } catch (error) {
          console.error("Error processing pending print job:", error);
        } finally {
          // Clear the pending job from sessionStorage
          sessionStorage.removeItem('pendingPrintJob');
          setProcessingPendingJob(false);
        }
      }
    };
    
    processPendingPrintJob();
  }, []);

  // Function to clean up duplicate jobs with the same filename
  const cleanupDuplicateJobs = async (fileName) => {
    try {
      const printJobsRef = dbRef(realtimeDb, "printJobs");
      const snapshot = await get(printJobsRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const currentTime = Date.now();
        const FIVE_MINUTES = 5 * 60 * 1000;
        
        // Get all jobs with this filename
        const fileJobs = Object.entries(data)
          .filter(([_, job]) => job.fileName === fileName)
          .map(([id, job]) => ({ id, ...job }))
          .sort((a, b) => b.createdAt - a.createdAt); // newest first
        
        // If we have more than one job with this filename
        if (fileJobs.length > 1) {
          console.log(`Found ${fileJobs.length} jobs for ${fileName}`);
          
          // Keep the job with the highest progress or most recent
          const jobsToRemove = fileJobs.slice(1)
            .filter(job => {
              // Don't remove jobs with high progress or that are very recent
              const hasHighProgress = job.progress > 50;
              const isVeryRecent = job.createdAt && (currentTime - job.createdAt < FIVE_MINUTES);
              return !hasHighProgress && !isVeryRecent;
            })
            .map(job => job.id);
          
          // Remove duplicate jobs
          const removePromises = jobsToRemove.map(jobId => 
            remove(dbRef(realtimeDb, `printJobs/${jobId}`))
          );
          
          await Promise.all(removePromises);
          
          if (jobsToRemove.length > 0) {
            console.log(`Removed ${jobsToRemove.length} duplicate jobs for ${fileName}`);
          }
        }
      }
    } catch (error) {
      console.error("Error cleaning duplicate jobs:", error);
    }
  };

  // Fetch print jobs from Firebase with improved filtering
  useEffect(() => {
    const printJobsRef = dbRef(realtimeDb, "printJobs");
    
    const unsubscribe = onValue(printJobsRef, (snapshot) => {
      setIsLoading(false);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const currentTime = Date.now();
        const ONE_HOUR = 60 * 60 * 1000;
        
        // Get all jobs and ensure filename exists
        const jobsArray = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
          fileName: data[key].fileName || "Unknown File"
        }));
        
        // First, immediately clean up any jobs with missing filenames
        jobsArray.forEach(job => {
          if (!job.fileName || job.fileName.trim() === "") {
            remove(dbRef(realtimeDb, `printJobs/${job.id}`));
          }
        });
        
        // Filter active and non-stale jobs
        const filteredJobs = jobsArray.filter(job => {
          // Include only pending, processing, printing jobs
          const isActive = ["pending", "processing", "printing"].includes(job.status);
          
          // Remove jobs that have been stuck at the same progress for more than 1 hour
          const isStale = job.createdAt && (currentTime - job.createdAt > ONE_HOUR) && job.progress <= 5;
          
          // Filter out jobs with missing filenames
          const hasValidFilename = job.fileName && job.fileName.trim() !== "";
          
          return isActive && !isStale && hasValidFilename;
        })
        // Sort by creation time (newest first)
        .sort((a, b) => b.createdAt - a.createdAt);
        
        // Create a map of filename to the job with highest progress
        const filenameJobMap = new Map();
        
        filteredJobs.forEach(job => {
          if (!filenameJobMap.has(job.fileName) || 
              filenameJobMap.get(job.fileName).progress < job.progress) {
            filenameJobMap.set(job.fileName, job);
          }
        });
        
        // Convert map values to array for the final list
        const uniqueJobs = Array.from(filenameJobMap.values());
        
        setPrintJobs(uniqueJobs);
      } else {
        setPrintJobs([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Handle job removal
  const handleRemoveJob = async (jobId) => {
    try {
      await remove(dbRef(realtimeDb, `printJobs/${jobId}`));
    } catch (error) {
      console.error("Error removing print job:", error);
    }
  };

  // Clear all print jobs
  const clearAllPrintJobs = async () => {
    if (!window.confirm("Are you sure you want to clear all print jobs?")) {
      return;
    }
    
    setIsClearing(true);
    
    try {
      const printJobsRef = dbRef(realtimeDb, "printJobs");
      const snapshot = await get(printJobsRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        
        // Remove each job one by one
        const removePromises = Object.keys(data).map(jobId => 
          remove(dbRef(realtimeDb, `printJobs/${jobId}`))
        );
        
        await Promise.all(removePromises);
      }
    } catch (error) {
      console.error("Error clearing print jobs:", error);
    } finally {
      setIsClearing(false);
    }
  };

  // Additional function to clean stale jobs
  const cleanStaleJobs = async () => {
    try {
      const printJobsRef = dbRef(realtimeDb, "printJobs");
      const snapshot = await get(printJobsRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const currentTime = Date.now();
        const ONE_HOUR = 60 * 60 * 1000;
        const TWO_HOURS = 2 * 60 * 60 * 1000;
        
        // Find stale jobs
        const staleJobIds = Object.keys(data).filter(jobId => {
          const job = data[jobId];
          
          // Clean jobs that are stuck processing with minimal progress
          const isStuckProcessing = (
            (job.status === "pending" || job.status === "processing") &&
            job.createdAt && 
            (currentTime - job.createdAt > ONE_HOUR) &&
            job.progress <= 10
          );
          
          // Clean any job regardless of status that's extremely old
          const isVeryOld = job.createdAt && (currentTime - job.createdAt > TWO_HOURS);
          
          // Clean jobs with missing filenames
          const hasMissingFilename = !job.fileName || job.fileName.trim() === "";
          
          return isStuckProcessing || isVeryOld || hasMissingFilename;
        });
        
        // Remove stale jobs
        const removePromises = staleJobIds.map(jobId => 
          remove(dbRef(realtimeDb, `printJobs/${jobId}`))
        );
        
        await Promise.all(removePromises);
        
        if (staleJobIds.length > 0) {
          console.log(`Cleaned ${staleJobIds.length} stale print jobs`);
        }
      }
    } catch (error) {
      console.error("Error cleaning stale jobs:", error);
    }
  };

  // Run stale job cleaner on component mount and every 5 minutes
  useEffect(() => {
    // Immediately clean stale jobs when component mounts
    cleanStaleJobs();
    
    // Also clean any jobs missing filenames right away
    cleanEmptyNameJobs();
    
    // Set up interval to clean stale jobs every 5 minutes
    const cleanupInterval = setInterval(() => {
      cleanStaleJobs();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(cleanupInterval);
  }, []);

  // Function to immediately clean jobs with missing filenames
  const cleanEmptyNameJobs = async () => {
    try {
      const printJobsRef = dbRef(realtimeDb, "printJobs");
      const snapshot = await get(printJobsRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const jobsToRemove = [];
        const filenameCounts = {};
        
        // First pass - count how many jobs we have for each filename and identify empty filename jobs
        Object.entries(data).forEach(([jobId, job]) => {
          if (!job.fileName || job.fileName.trim() === "") {
            jobsToRemove.push(jobId);
          } else {
            filenameCounts[job.fileName] = (filenameCounts[job.fileName] || 0) + 1;
          }
        });
        
        // Second pass - for filenames with multiple jobs, keep only the highest progress one
        const filenameJobs = {};
        
        Object.entries(data).forEach(([jobId, job]) => {
          const filename = job.fileName;
          
          // Skip jobs already marked for removal
          if (jobsToRemove.includes(jobId)) return;
          
          // Skip non-duplicate filenames
          if (filenameCounts[filename] <= 1) return;
          
          // First job with this filename we've seen
          if (!filenameJobs[filename]) {
            filenameJobs[filename] = { jobId, progress: job.progress || 0, createdAt: job.createdAt || 0 };
            return;
          }
          
          // Compare with existing job
          const existingJob = filenameJobs[filename];
          
          // If existing job has higher progress or is more recent (by more than 5 seconds),
          // mark current job for removal
          if (existingJob.progress > (job.progress || 0) || 
             (existingJob.createdAt > (job.createdAt || 0) + 5000)) {
            jobsToRemove.push(jobId);
          } 
          // Otherwise replace the existing job and mark it for removal
          else {
            jobsToRemove.push(existingJob.jobId);
            filenameJobs[filename] = { jobId, progress: job.progress || 0, createdAt: job.createdAt || 0 };
          }
        });
        
        // Remove all flagged jobs
        const removePromises = jobsToRemove.map(jobId => 
          remove(dbRef(realtimeDb, `printJobs/${jobId}`))
        );
        
        await Promise.all(removePromises);
        
        if (jobsToRemove.length > 0) {
          console.log(`Cleaned ${jobsToRemove.length} duplicate and empty jobs on page load`);
        }
      }
    } catch (error) {
      console.error("Error cleaning empty name jobs:", error);
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-warning" />;
      case "processing":
        return <BiLoaderAlt className="h-5 w-5 text-info animate-spin" />;
      case "printing":
        return <BiLoaderAlt className="h-5 w-5 text-primary animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  // Get detailed process stage description based on progress percentage
  const getProcessStage = (progress, statusMessage) => {
    // If there's a custom status message, use it
    if (statusMessage && statusMessage.trim() !== "") {
      return statusMessage;
    }
    
    // Otherwise map progress to appropriate stage
    if (progress <= 5) return "Initializing print job...";
    if (progress <= 20) return "Preparing document...";
    if (progress <= 40) return "Downloading file...";
    if (progress <= 50) return "Processing file for printing...";
    if (progress <= 60) return "Converting document format...";
    if (progress <= 75) return "Sending to printer...";
    if (progress <= 90) return "Printing in progress...";
    if (progress < 100) return "Finishing print job...";
    return "Print job completed";
  };

  // Get color class for progress bar based on progress and status
  const getProgressColorClass = (progress, status) => {
    if (status === "error") return "progress-error";
    if (status === "completed") return "progress-success";
    if (status === "printing") return "progress-primary";
    if (status === "processing") return "progress-info";
    if (progress >= 90) return "progress-success";
    return "progress-info";
  };

  // Check if a task is completed based on job progress
  const isTaskCompleted = (job, threshold) => {
    return (job.progress || 0) >= threshold;
  };

  // Get a badge class based on job status
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "pending": return "badge-warning";
      case "processing": return "badge-info";
      case "printing": return "badge-primary";
      case "completed": return "badge-success";
      case "error": return "badge-error";
      default: return "badge-ghost";
    }
  };

  return (
    <div className="min-h-screen bg-base-200">
      <Header />

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Xerox */}
          <ActionCard 
            icon={PrinterIcon} 
            iconColor="text-error"
            label="Xerox" 
            to="/xerox" 
          />

          {/* USB */}
          <ActionCard 
            icon={Usb} 
            iconColor="text-info"
            label="USB" 
            to="/usb" 
          />

          {/* Share via QR */}
          <ActionCard 
            icon={QrCode} 
            iconColor="text-success"
            label="Share files via QR" 
            to='/qr' 
          />
        </div>

        {/* Print Queue Section */}
        <div className="card bg-base-100 shadow-xl mt-8">
          <div className="card-body">
            <div className="flex justify-between items-center">
              <h2 className="card-title text-xl text-primary flex items-center gap-2">
                <PrinterIcon className="w-5 h-5" />
                Active Print Jobs
                {printJobs.length > 0 && (
                  <div className="badge badge-primary">{printJobs.length}</div>
                )}
              </h2>
              
              {printJobs.length > 0 && (
                <button 
                  className="btn btn-error btn-sm gap-2"
                  onClick={clearAllPrintJobs}
                  disabled={isClearing}
                >
                  {isClearing ? (
                    <BiLoaderAlt className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Clear All
                </button>
              )}
            </div>
            <div className="divider mt-0" />
            
            {isLoading || processingPendingJob ? (
              <div className="flex flex-col justify-center items-center py-8 gap-3">
                <BiLoaderAlt className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm text-gray-500">
                  {processingPendingJob ? "Processing print job..." : "Loading print jobs..."}
                </p>
              </div>
            ) : printJobs.length === 0 ? (
              <div className="alert justify-center py-6">
                <Info className="w-5 h-5" />
                <span>No active print jobs</span>
              </div>
            ) : (
              <div className="space-y-4">
                {printJobs.map(job => (
                  <div key={job.id} className="card bg-base-200 shadow-sm">
                    <div className="card-body p-4">
                      <div className="flex items-start gap-3">
                        {/* File info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{job.fileName}</h3>
                            <div className={`badge ${getStatusBadgeClass(job.status)} badge-sm`}>
                              {job.status}
                            </div>
                          </div>
                          
                          <div className="text-sm text-gray-500 mt-1">
                            {job.totalPages} page{job.totalPages !== 1 ? 's' : ''} • 
                            {job.copies} cop{job.copies !== 1 ? 'ies' : 'y'} • 
                            {job.isColor ? 'Color' : 'B&W'} • 
                            ₱{job.price}
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="mt-3">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs text-gray-500">
                                {getProcessStage(job.progress || 0, job.statusMessage)}
                              </span>
                              <span className="text-xs font-medium">{job.progress || 0}%</span>
                            </div>
                            <progress 
                              className={`progress ${getProgressColorClass(job.progress || 0, job.status)} w-full`} 
                              value={job.progress || 0} 
                              max="100"
                            ></progress>
                            
                            {/* Process Stage Details */}
                            <div className="mt-2 text-xs">
                              <div className="flex justify-between text-gray-500">
                                <div className="flex flex-col items-center">
                                  <span className={isTaskCompleted(job, 20) ? "text-success" : "text-gray-400"}>
                                    Prepare
                                  </span>
                                  {isTaskCompleted(job, 20) && <span className="text-xs text-success">✓</span>}
                                </div>
                                <div className="flex flex-col items-center">
                                  <span className={isTaskCompleted(job, 50) ? "text-success" : "text-gray-400"}>
                                    Process
                                  </span>
                                  {isTaskCompleted(job, 50) && <span className="text-xs text-success">✓</span>}
                                </div>
                                <div className="flex flex-col items-center">
                                  <span className={isTaskCompleted(job, 75) ? "text-success" : "text-gray-400"}>
                                    Print
                                  </span>
                                  {isTaskCompleted(job, 75) && <span className="text-xs text-success">✓</span>}
                                </div>
                                <div className="flex flex-col items-center">
                                  <span className={isTaskCompleted(job, 100) ? "text-success" : "text-gray-400"}>
                                    Complete
                                  </span>
                                  {isTaskCompleted(job, 100) && <span className="text-xs text-success">✓</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Status and Actions */}
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(job.status)}
                            <span className="text-xs">
                              {new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          
                          <button 
                            className="btn btn-ghost btn-xs text-error"
                            onClick={() => handleRemoveJob(job.id)}
                          >
                            <X className="w-3 h-3 mr-1" />
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Introduction Card */}
        <div className="card bg-base-100 shadow-xl mt-8">
          <div className="card-body">
            <h2 className="card-title text-2xl text-primary">Welcome to Print Station</h2>
            <div className="divider" />
            
            <div className="alert alert-info justify-center py-8">
              <Info className="w-6 h-6" />
              <span className="text-lg">Select a print method above to get started</span>
            </div>
            
            <div className="mt-6">
              <h3 className="font-medium text-lg mb-4">Available Print Options:</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Xerox:</strong> Print directly from physical documents</li>
                <li><strong>USB:</strong> Print from a USB flash drive</li>
                <li><strong>QR Code:</strong> Upload and print files from your mobile device</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Modal for QR */}
      <dialog className={`modal ${isModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box">
          <button 
            className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" 
            onClick={() => setIsModalOpen(false)}
            aria-label="Close"
          >
            <X size={18} />
          </button>
          <h3 className="font-bold text-xl text-center">Share files via QR</h3>
          <div className="py-4 flex justify-center">
            <M_Qrcode />
          </div>
          <div className="modal-action">
            <button className="btn" onClick={() => setIsModalOpen(false)}>Close</button>
          </div>
        </div>
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}></div>
      </dialog>

      {/* Modal for USB */}
      <dialog className={`modal ${isUsbModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box">
          <button 
            className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" 
            onClick={() => setIsUsbModalOpen(false)}
            aria-label="Close"
          >
            <X size={18} />
          </button>
          <h3 className="font-bold text-xl text-center">USB Print</h3>
          <div className="divider"></div>
          {/* Add USB print component here */}
          <div className="modal-action">
            <button className="btn" onClick={() => setIsUsbModalOpen(false)}>Close</button>
          </div>
        </div>
        <div className="modal-backdrop" onClick={() => setIsUsbModalOpen(false)}></div>
      </dialog>
    </div>
  );
};

export default Printer;
