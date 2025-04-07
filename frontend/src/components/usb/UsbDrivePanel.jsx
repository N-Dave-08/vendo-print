import React, { useState, useEffect, useRef } from "react";
import { Usb, HardDrive, File, FolderOpen, RefreshCw, AlertCircle } from "lucide-react";
import axios from "axios";

const UsbDrivePanel = ({ onFileSelect }) => {
  const [usbDrives, setUsbDrives] = useState([]);
  const [selectedDrive, setSelectedDrive] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const realConnectionStatus = useRef('disconnected');
  const statusTimeoutRef = useRef(null);

  const setDelayedConnectionStatus = (status) => {
    realConnectionStatus.current = status;
    
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }
    
    if (status === 'disconnected' && usbDrives.length > 0) {
      console.log('Suppressing disconnected status because drives are present');
      return;
    }
    
    if (status !== 'connected') {
      statusTimeoutRef.current = setTimeout(() => {
        if (realConnectionStatus.current === status) {
          setConnectionStatus(status);
        }
      }, 5000);
    } else {
      setConnectionStatus(status);
    }
  };

  useEffect(() => {
    let pingInterval = null;
    let reconnectTimeout = null;
    let wsInstance = null;

    const connectWebSocket = () => {
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      
      setDelayedConnectionStatus('connecting');
      
      const wsURLs = [
        `ws://${window.location.hostname}:5000`,
        'ws://localhost:5000',
        'ws://127.0.0.1:5000'
      ];
      
      let connected = false;
      let wsIndex = 0;
      
      const sendPing = () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
            console.log('Sent ping to server');
          } catch (err) {
            console.error('Error sending ping:', err);
          }
        }
      };
      
      const tryConnect = () => {
        if (wsIndex >= wsURLs.length) {
          console.warn('Could not connect to any WebSocket endpoints, falling back to REST API');
          setDelayedConnectionStatus('error');
          setError('Could not connect to USB detection service');
          
          fetchUsbDrives();
          
          reconnectTimeout = setTimeout(connectWebSocket, 10000);
          return;
        }
        
        const wsURL = wsURLs[wsIndex];
        console.log(`Trying to connect to WebSocket at: ${wsURL}`);
        
        try {
          if (wsRef.current) {
            try {
              wsRef.current.close();
            } catch (err) {
              console.error('Error closing existing WebSocket:', err);
            }
            wsRef.current = null;
          }
          
          const ws = new WebSocket(wsURL);
          wsRef.current = ws;
          wsInstance = ws;
          
          const connectionTimeout = setTimeout(() => {
            console.warn(`Connection to ${wsURL} timed out`);
            if (ws && ws.readyState !== WebSocket.OPEN) {
              try {
                ws.close();
              } catch (err) {
                console.error('Error closing WebSocket on timeout:', err);
              }
              wsIndex++;
              setTimeout(tryConnect, 500);
            }
          }, 5000);
          
          ws.onopen = () => {
            clearTimeout(connectionTimeout);
            console.log('WebSocket connected to USB detection service');
            setDelayedConnectionStatus('connected');
            connected = true;
            
            if (pingInterval) clearInterval(pingInterval);
            pingInterval = setInterval(sendPing, 30000);
            
            sendPing();
          };
          
          ws.onmessage = (event) => {
            try {
              const message = JSON.parse(event.data);
              handleWebSocketMessage(message);
            } catch (err) {
              console.error('Error parsing WebSocket message:', err, event.data);
            }
          };
          
          ws.onerror = (error) => {
            clearTimeout(connectionTimeout);
            console.error('WebSocket error:', error);
            
            try {
              ws.close();
            } catch (err) {
              console.error('Error closing WebSocket after error:', err);
            }
          };
          
          ws.onclose = (event) => {
            clearTimeout(connectionTimeout);
            console.log(`WebSocket closed with code ${event.code}`, event.reason);
            
            if (ws === wsInstance) {
              if (pingInterval) clearInterval(pingInterval);
              
              if (!connected) {
                wsIndex++;
                setTimeout(tryConnect, 500);
              } else {
                console.log('WebSocket connection closed. Reconnecting...');
                setDelayedConnectionStatus('disconnected');
                reconnectTimeout = setTimeout(connectWebSocket, 3000);
              }
            }
          };
          
        } catch (error) {
          console.error('WebSocket connection error:', error);
          wsIndex++;
          setTimeout(tryConnect, 500);
        }
      };
      
      tryConnect();
    };
    
    connectWebSocket();
    
    const pollInterval = setInterval(() => {
      if (realConnectionStatus.current !== 'connected') {
        console.log('WebSocket not connected, using REST API fallback');
        fetchUsbDrives();
      }
    }, 10000);
    
    return () => {
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (pollInterval) clearInterval(pollInterval);
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
      
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (err) {
          console.error('Error closing WebSocket on unmount:', err);
        }
        wsRef.current = null;
      }
    };
  }, []);
  
  // Add the effect to respond to usbDrives changes
  useEffect(() => {
    // If we have drives but the status is 'disconnected', suppress it
    if (usbDrives.length > 0 && connectionStatus === 'disconnected') {
      setConnectionStatus('connected');
    }
  }, [usbDrives, connectionStatus]);
  
  // Handle WebSocket messages
  const handleWebSocketMessage = (message) => {
    switch (message.type) {
      case 'usb_connected':
        setUsbDrives(prev => {
          const newDrives = [...prev];
          const existingIndex = newDrives.findIndex(d => d.path === message.data.path);
          
          if (existingIndex !== -1) {
            // Update existing drive
            newDrives[existingIndex] = message.data;
          } else {
            // Add new drive
            newDrives.push(message.data);
          }
          
          return newDrives;
        });
        
        // If this is the first drive and no drive is selected, select it
        if (usbDrives.length === 0 && !selectedDrive) {
          setSelectedDrive(message.data.path);
        }
        
        // Since we have drives, ensure connection status appears connected
        setConnectionStatus('connected');
        break;
        
      case 'usb_disconnected':
        setUsbDrives(prev => {
          const newDrives = prev.filter(drive => drive.path !== message.data.path);
          return newDrives;
        });
        
        // If the selected drive was disconnected, clear selection
        if (selectedDrive === message.data.path) {
          setSelectedDrive(null);
        }
        break;
        
      case 'files_updated':
        setUsbDrives(prev => {
          const newDrives = [...prev];
          const driveIndex = newDrives.findIndex(d => d.path === message.data.path);
          
          if (driveIndex !== -1) {
            newDrives[driveIndex] = {
              ...newDrives[driveIndex],
              files: message.data.files
            };
          }
          
          return newDrives;
        });
        break;
        
      case 'pong':
        // Server responded to our ping
        console.log('Received pong from server, connection is alive');
        // Update connection status to connected
        setDelayedConnectionStatus('connected');
        break;
        
      default:
        console.log('Unknown WebSocket message type:', message.type);
    }
  };
  
  // Fetch USB drives through REST API as a fallback
  const fetchUsbDrives = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.get('http://localhost:5000/api/usb-drives');
      if (response.data.status === 'success') {
        setUsbDrives(response.data.drives);
        
        // If we successfully got drives via REST API, show connected status
        if (response.data.drives.length > 0) {
          setDelayedConnectionStatus('connected');
        }
      }
    } catch (error) {
      console.error('Error fetching USB drives:', error);
      setError('Failed to load USB drives');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Refresh files for a specific drive
  const refreshDrive = async (drivePath) => {
    if (!drivePath) return;
    
    setIsLoading(true);
    try {
      await axios.get(`http://localhost:5000/api/usb-drives/${encodeURIComponent(drivePath)}/refresh`);
      // No need to update state - WebSocket will handle it
    } catch (error) {
      console.error('Error refreshing drive:', error);
      setError('Failed to refresh drive');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle file selection
  const handleFileSelect = (file) => {
    if (onFileSelect && typeof onFileSelect === 'function') {
      onFileSelect(file);
    }
  };
  
  // Get the selected drive object
  const getSelectedDriveObject = () => {
    return usbDrives.find(drive => drive.path === selectedDrive);
  };
  
  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };
  
  return (
    <div className="bg-base-100 p-4 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <Usb className="mr-2 h-5 w-5 text-primary" />
          USB Drives
        </h3>
        
        {/* Connection status indicator - only show when actually relevant */}
        {(usbDrives.length === 0 || connectionStatus === 'connected') && (
          <div className="flex items-center">
            <span className={`inline-block h-2 w-2 rounded-full mr-2 ${
              connectionStatus === 'connected' ? 'bg-success' : 
              connectionStatus === 'connecting' ? 'bg-warning' : 
              'bg-error'
            }`}></span>
            <span className="text-xs text-base-content/70">
              {connectionStatus === 'connected' ? 'Connected' : 
              connectionStatus === 'connecting' ? 'Connecting...' : 
              'Disconnected'}
            </span>
          </div>
        )}
      </div>
      
      {error && (
        <div className="alert alert-error mb-4 p-2 text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
      
      {usbDrives.length === 0 ? (
        <div className="text-center py-8">
          <HardDrive className="h-12 w-12 mx-auto text-base-300 mb-2" />
          <p className="text-base-content/70">No USB drives detected</p>
          <p className="text-xs text-base-content/50 mt-1">Connect a USB drive to see its contents</p>
          
          {connectionStatus === 'error' && (
            <button 
              className="btn btn-sm btn-outline mt-4"
              onClick={fetchUsbDrives}
            >
              Try manual refresh
            </button>
          )}
        </div>
      ) : (
        <div>
          {/* Drive selector */}
          <div className="flex flex-wrap gap-2 mb-4">
            {usbDrives.map((drive) => (
              <button
                key={drive.path}
                onClick={() => setSelectedDrive(drive.path)}
                className={`btn btn-sm ${selectedDrive === drive.path ? 'btn-primary' : 'btn-outline'}`}
              >
                <HardDrive className="h-4 w-4 mr-1" /> 
                {drive.displayName || drive.path}
              </button>
            ))}
          </div>
          
          {/* Selected drive contents */}
          {selectedDrive && (
            <div className="mt-4 border rounded-lg">
              <div className="bg-base-200 p-2 rounded-t-lg flex justify-between items-center">
                <span className="font-medium">Drive Contents</span>
                <button 
                  className="btn btn-xs btn-ghost"
                  onClick={() => refreshDrive(selectedDrive)}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              
              <div className="max-h-64 overflow-y-auto p-2">
                <table className="table table-compact w-full">
                  <thead>
                    <tr>
                      <th>File Name</th>
                      <th>Type</th>
                      <th>Size</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSelectedDriveObject()?.files?.length > 0 ? (
                      getSelectedDriveObject().files.map((file, index) => (
                        <tr key={index} className="hover">
                          <td className="max-w-xs truncate">{file.name}</td>
                          <td>{file.type}</td>
                          <td>{formatFileSize(file.size)}</td>
                          <td>
                            <button
                              className="btn btn-xs btn-primary"
                              onClick={() => handleFileSelect(file)}
                            >
                              <File className="h-3 w-3 mr-1" /> Select
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="text-center py-4">
                          <FolderOpen className="h-8 w-8 mx-auto text-base-300 mb-2" />
                          <p className="text-base-content/70">No supported files found</p>
                          <p className="text-xs text-base-content/50">
                            Supported: PDF, DOC, DOCX, JPG, PNG, XLS, XLSX
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UsbDrivePanel; 