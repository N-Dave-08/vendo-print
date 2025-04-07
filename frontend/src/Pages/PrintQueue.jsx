import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AiOutlineArrowLeft } from "react-icons/ai";
import { BsPrinterFill } from "react-icons/bs";
import { IoClose } from "react-icons/io5";
import { MdCheckCircle, MdPictureAsPdf, MdInsertDriveFile, MdImage, MdWarning } from "react-icons/md";
import { FaFileWord } from "react-icons/fa";
import { BiLoaderAlt } from "react-icons/bi";
import { realtimeDb } from "../../firebase/firebase_config";
import { ref as dbRef, onValue, remove } from "firebase/database";

// Function to get the appropriate icon based on file type (reused from Qr_Files.jsx)
const getFileIcon = (fileName, size = "normal") => {
  const extension = fileName.split('.').pop().toLowerCase();
  const sizeClass = size === "large" ? "w-14 h-14" : "w-11 h-11";
  const baseClass = `${sizeClass} rounded-xl flex items-center justify-center`;
  const iconClass = size === "large" ? "w-8 h-8" : "w-6 h-6";
  
  if (extension === 'pdf') {
    return (
      <div className={`${baseClass} bg-red-50 border border-red-100`}>
        <MdPictureAsPdf className={`${iconClass} text-red-500`} />
      </div>
    );
  } else if (['doc', 'docx'].includes(extension)) {
    return (
      <div className={`${baseClass} bg-blue-50 border border-blue-100`}>
        <FaFileWord className={`${iconClass} text-blue-500`} />
      </div>
    );
  } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
    return (
      <div className={`${baseClass} bg-purple-50 border border-purple-100`}>
        <MdImage className={`${iconClass} text-purple-500`} />
      </div>
    );
  } else {
    return (
      <div className={`${baseClass} bg-gray-50 border border-gray-100`}>
        <MdInsertDriveFile className={`${iconClass} text-gray-500`} />
      </div>
    );
  }
};

// Status badge component
const StatusBadge = ({ status }) => {
  switch (status) {
    case "pending":
      return <span className="badge badge-warning badge-sm">Pending</span>;
    case "processing":
      return <span className="badge badge-info badge-sm">Processing</span>;
    case "printing":
      return <span className="badge badge-primary badge-sm">Printing</span>;
    case "completed":
      return <span className="badge badge-success badge-sm">Completed</span>;
    case "error":
      return <span className="badge badge-error badge-sm">Error</span>;
    default:
      return <span className="badge badge-sm">{status}</span>;
  }
};

const PrintQueue = () => {
  const navigate = useNavigate();
  const [printJobs, setPrintJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch print jobs from Firebase
  useEffect(() => {
    setIsLoading(true);
    const printJobsRef = dbRef(realtimeDb, "printJobs");
    
    const unsubscribe = onValue(printJobsRef, (snapshot) => {
      setIsLoading(false);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const jobsArray = Object.keys(data).map((key) => ({
          id: key,
          ...data[key]
        }))
        // Sort by creation time (newest first)
        .sort((a, b) => b.createdAt - a.createdAt);
        
        setPrintJobs(jobsArray);
      } else {
        setPrintJobs([]);
      }
    }, (error) => {
      console.error("Error fetching print jobs:", error);
      setError("Failed to load print jobs");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Handle job removal (for completed or error jobs)
  const handleRemoveJob = async (jobId) => {
    if (!window.confirm("Are you sure you want to remove this print job from the queue?")) {
      return;
    }
    
    try {
      await remove(dbRef(realtimeDb, `printJobs/${jobId}`));
    } catch (error) {
      console.error("Error removing print job:", error);
      setError("Failed to remove print job");
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case "pending":
        return <div className="w-4 h-4 bg-warning rounded-full"></div>;
      case "processing":
      case "printing":
        return <BiLoaderAlt className="w-5 h-5 text-primary animate-spin" />;
      case "completed":
        return <MdCheckCircle className="w-5 h-5 text-success" />;
      case "error":
        return <MdWarning className="w-5 h-5 text-error" />;
      default:
        return <div className="w-4 h-4 bg-gray-300 rounded-full"></div>;
    }
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-base-200">
      <div className="container mx-auto px-4 py-4 flex flex-col h-full">
        {/* Page Header */}
        <div className="flex items-center gap-3 mb-4">
          <button
            className="btn btn-circle btn-ghost btn-sm"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <AiOutlineArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-primary">Print Queue</h1>
          
          <div className="ml-auto">
            <button 
              className="btn btn-primary btn-sm gap-2"
              onClick={() => navigate('/qr')}
            >
              <BsPrinterFill className="w-4 h-4" />
              New Print Job
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          <div className="card bg-base-100 shadow-sm h-full flex flex-col">
            <div className="p-4 border-b border-base-200">
              <div className="flex items-center gap-3">
                <BsPrinterFill className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-bold">Print Jobs</h3>
                  <p className="text-sm text-gray-500">
                    {printJobs.length} job{printJobs.length !== 1 ? 's' : ''} in queue
                  </p>
                </div>
              </div>
            </div>
            
            {/* Print Jobs List */}
            <div className="flex-1 overflow-y-auto p-4">
              {error && (
                <div className="alert alert-error mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span>{error}</span>
                </div>
              )}

              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <BiLoaderAlt className="w-12 h-12 text-primary animate-spin mb-4" />
                  <p className="text-base-content/70">Loading print jobs...</p>
                </div>
              ) : printJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <BsPrinterFill className="w-16 h-16 text-base-content/20 mb-4" />
                  <h3 className="font-medium text-xl text-base-content/70 mb-2">No print jobs in queue</h3>
                  <p className="text-base-content/50 max-w-md">
                    Your print jobs will appear here once you've sent documents to print
                  </p>
                  <button 
                    className="btn btn-primary mt-6"
                    onClick={() => navigate('/qr')}
                  >
                    Start a new print job
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {printJobs.map((job) => (
                    <div key={job.id} className="card bg-base-100 border border-base-200 shadow-sm overflow-hidden">
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          {/* File Icon */}
                          {getFileIcon(job.fileName)}
                          
                          {/* File Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium truncate">{job.fileName}</h3>
                              <StatusBadge status={job.status} />
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                              <span>{job.totalPages} page{job.totalPages !== 1 ? 's' : ''}</span>
                              <span>•</span>
                              <span>{job.copies} cop{job.copies !== 1 ? 'ies' : 'y'}</span>
                              <span>•</span>
                              <span>{job.isColor ? 'Color' : 'B&W'}</span>
                              <span>•</span>
                              <span>₱{job.price}</span>
                            </div>
                            
                            {/* Progress Bar */}
                            <div className="mt-3">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-gray-500">
                                  {job.statusMessage || `Status: ${job.status}`}
                                </span>
                                <span className="text-xs font-medium">{job.progress || 0}%</span>
                              </div>
                              <div className="w-full bg-base-200 rounded-full h-2.5">
                                <div 
                                  className={`h-2.5 rounded-full ${
                                    job.status === 'error' 
                                      ? 'bg-error' 
                                      : job.status === 'completed'
                                        ? 'bg-success'
                                        : 'bg-primary'
                                  }`}
                                  style={{ width: `${job.progress || 0}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Status Icon & Controls */}
                          <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(job.status)}
                              <span className="text-xs text-gray-500">{formatTime(job.createdAt)}</span>
                            </div>
                            
                            {(job.status === 'completed' || job.status === 'error') && (
                              <button
                                className="btn btn-ghost btn-xs"
                                onClick={() => handleRemoveJob(job.id)}
                              >
                                <IoClose className="w-4 h-4" />
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Printer Info - Only show for active jobs */}
                      {['pending', 'processing', 'printing'].includes(job.status) && (
                        <div className="bg-base-200/50 p-3 border-t border-base-200">
                          <div className="flex items-center text-sm">
                            <BsPrinterFill className="w-4 h-4 text-gray-500 mr-2" />
                            <span>Printer: {job.printerName}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintQueue; 