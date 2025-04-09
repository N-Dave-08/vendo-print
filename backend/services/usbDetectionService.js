import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import os from 'os';

// Store connected USB drives
let connectedDrives = new Map();
let wsClients = new Set();

// Store drive detection state
let driveDetectionState = new Map(); // Used for debouncing

// Supported file extensions for printing
const SUPPORTED_EXTENSIONS = [
  '.pdf', 
  '.doc', 
  '.docx', 
  '.jpg', 
  '.jpeg', 
  '.png', 
  '.xls', 
  '.xlsx'
];

// Constants
const POLL_INTERVAL = 5000; // Increase to 5 seconds
const DISCONNECT_THRESHOLD = 3; // Number of consecutive misses before considering disconnected

// Function to scan a directory for files
async function scanDirectory(dirPath) {
  console.log('🔍 Scanning directory:', dirPath);
  const files = [];
  
  try {
    // Use synchronous operations for better Windows compatibility
    const entries = fs.readdirSync(dirPath);
    console.log(`📂 Found ${entries.length} entries in directory`);
    
    for (const entry of entries) {
      try {
        const fullPath = path.join(dirPath, entry);
        console.log('📄 Processing entry:', entry);
        
        const stats = fs.statSync(fullPath);
        
        if (stats.isDirectory()) {
          console.log('📁 Found subdirectory:', entry);
          try {
            // Recursively scan subdirectories
            const subFiles = await scanDirectory(fullPath);
            files.push(...subFiles);
          } catch (err) {
            console.error(`❌ Error scanning subdirectory ${fullPath}:`, err);
          }
        } else if (stats.isFile()) {
          const ext = path.extname(entry).toLowerCase();
          console.log('🔎 File extension:', ext);
          
          if (SUPPORTED_EXTENSIONS.includes(ext)) {
            console.log('✅ Found supported file:', entry);
            const fileInfo = {
              name: entry,
              path: fullPath,
              size: stats.size,
              modified: stats.mtime,
              type: ext.substring(1) // Remove the dot from extension
            };
            console.log('📝 File info:', fileInfo);
            files.push(fileInfo);
            console.log('✨ Added file to list:', entry);
          } else {
            console.log('❌ Skipping unsupported file:', entry);
          }
        }
      } catch (entryError) {
        console.error(`❌ Error processing entry ${entry}:`, entryError);
      }
    }
    
    console.log(`📊 Scan complete. Found ${files.length} supported files:`, files);
    return files;
    
  } catch (error) {
    console.error(`❌ Error scanning directory ${dirPath}:`, error);
    return [];
  }
}

// Broadcast a message to all connected WebSocket clients
function broadcastToClients(message) {
  wsClients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(JSON.stringify(message));
    }
  });
}

// Function to detect USB drives based on the operating system
async function detectUsbDrives() {
  const platform = os.platform();
  
  if (platform === 'win32') {
    return detectWindowsUsbDrives();
  } else if (platform === 'darwin') {
    return detectMacUsbDrives();
  } else if (platform === 'linux') {
    return detectLinuxUsbDrives();
  } else {
    console.error('Unsupported platform for USB detection:', platform);
    return [];
  }
}

// Windows USB drive detection
function detectWindowsUsbDrives() {
  return new Promise((resolve, reject) => {
    // Suppress detailed log
    // console.log('Windows USB detection starting...');
    
    // Try multiple command variants for better reliability
    const attempts = [
      {
        name: 'primary method',
        cmd: 'Get-WmiObject Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 } | Select-Object -Property DeviceID'
      },
      {
        name: 'backup method',
        cmd: 'Get-WmiObject Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 } | Format-List DeviceID'
      }
    ];
    
    // Try each attempt in sequence until one succeeds
    tryNextCommand(0);
    
    function tryNextCommand(index) {
      if (index >= attempts.length) {
        // All attempts failed, return empty result
        console.error('All USB detection methods failed');
        resolve([]);
        return;
      }
      
      const attempt = attempts[index];
      // Suppress detailed log
      // console.log(`Executing PowerShell command (${attempt.name}):`, attempt.cmd);
      
      exec(`powershell.exe -Command "${attempt.cmd}"`, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error with ${attempt.name}:`, stderr || error.message);
          // Try next method
          tryNextCommand(index + 1);
          return;
        }

        // Extract drive letters from the output (e.g., "E:", "F:")
        // Suppress detailed log
        // console.log(`Raw PowerShell output (${attempt.name}):`);
        // console.log(stdout);
        
        const drivesRaw = stdout.trim();
        const driveLetterMatches = drivesRaw.match(/([A-Z]:)/g);
        const driveLetters = driveLetterMatches || [];
        
        if (driveLetters.length === 0) {
          // Suppress detailed log
          // console.log(`No removable drives detected from ${attempt.name}`);
          // Try next method
          tryNextCommand(index + 1);
          return;
        }
        
        // Suppress detailed log
        // console.log('Detected drive letters:', driveLetters);
        
        // For drives that didn't have volume info in the first query, get additional details
        // This is done to improve drive display names
        if (driveLetters.length > 0) {
          // Execute a second command to get volume names for better display
          const volumeInfoCmd = 'Get-WmiObject Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 } | Format-List DeviceID, VolumeName';
          
          exec(`powershell.exe -Command "${volumeInfoCmd}"`, (volError, volStdout, volStderr) => {
            // Proceed with results from first command even if this fails
            const volumeInfo = new Map();
            
            if (!volError) {
              // Parse volume names
              const volumeMatches = volStdout.matchAll(/DeviceID\s+:\s+([A-Z]:)[\r\n\s]+VolumeName\s+:\s+(.*?)[\r\n]/g);
              for (const match of volumeMatches) {
                const drive = match[1];
                const volumeName = match[2].trim();
                if (volumeName) {
                  volumeInfo.set(drive, volumeName);
                }
              }
            }
            
            // Now create drive objects with the basic information
            const drives = driveLetters.map(driveLetter => {
              return {
                path: driveLetter,
                displayName: volumeInfo.has(driveLetter) ? 
                  `${driveLetter} (${volumeInfo.get(driveLetter)})` : 
                  driveLetter,
                type: 'USB',
                size: 0,
                freeSpace: 0
              };
            });
            
            // More concise log message
            // console.log(`Detected ${drives.length} USB drives: ${drives.map(d => d.path).join(', ')}`);
            resolve(drives);
          });
        } else {
          // No drives found, return empty array
          resolve([]);
        }
      });
    }
  });
}

// Mac USB drive detection
function detectMacUsbDrives() {
  return new Promise((resolve, reject) => {
    exec('diskutil list -plist external', (error, stdout, stderr) => {
      if (error) {
        console.error('Error detecting Mac USB drives:', stderr);
        resolve([]);
        return;
      }
      
      exec('mount', (mountError, mountOutput) => {
        const drives = [];
        
        // Parse mount output to find external/USB drives
        const mountLines = mountOutput.split('\n');
        for (const line of mountLines) {
          if (line.includes('/Volumes/') && !line.includes('/Volumes/Macintosh HD')) {
            const parts = line.split(' on ');
            if (parts.length >= 2) {
              const device = parts[0];
              const mountPoint = parts[1].split(' ')[0];
              
              // Check if this is likely a USB drive (not a network mount)
              if (!device.includes('://')) {
                drives.push({
                  path: mountPoint,
                  displayName: path.basename(mountPoint),
                  type: 'USB'
                });
              }
            }
          }
        }
        
        resolve(drives);
      });
    });
  });
}

// Linux USB drive detection
function detectLinuxUsbDrives() {
  return new Promise((resolve, reject) => {
    exec('lsblk -o NAME,MOUNTPOINT,LABEL,SIZE,MODEL,TRAN -J', (error, stdout, stderr) => {
      if (error) {
        console.error('Error detecting Linux USB drives:', stderr);
        resolve([]);
        return;
      }
      
      try {
        const data = JSON.parse(stdout);
        const drives = [];
        
        // Extract USB drives with mountpoints
        for (const device of data.blockdevices || []) {
          if (device.tran === 'usb' && device.children) {
            for (const partition of device.children) {
              if (partition.mountpoint) {
                drives.push({
                  path: partition.mountpoint,
                  displayName: partition.label || path.basename(partition.mountpoint),
                  size: partition.size,
                  type: 'USB'
                });
              }
            }
          }
        }
        
        resolve(drives);
      } catch (e) {
        console.error('Error parsing lsblk output:', e);
        resolve([]);
      }
    });
  });
}

// Main function to check for USB drives
async function checkForUsbDrives() {
  try {
    const drives = await detectUsbDrives();
    const currentDrivePaths = new Set(drives.map(drive => drive.path));
    
    // Initialize detection state for new paths
    for (const drive of drives) {
      if (!driveDetectionState.has(drive.path)) {
        driveDetectionState.set(drive.path, {
          connected: true,
          missCount: 0,
          lastSeen: Date.now()
        });
      } else {
        // Reset miss count and update last seen for existing drives
        const state = driveDetectionState.get(drive.path);
        driveDetectionState.set(drive.path, {
          ...state,
          missCount: 0,
          lastSeen: Date.now()
        });
      }
    }
    
    // Check for new drives
    for (const drive of drives) {
      if (!connectedDrives.has(drive.path)) {
        console.log(`New USB drive detected: ${drive.path} (${drive.displayName})`);
        
        // Scan for files on the drive
        const files = await scanDirectory(drive.path);
        
        // Store drive info
        connectedDrives.set(drive.path, {
          ...drive,
          files,
          connected: true,
          lastSeen: Date.now()
        });
        
        // Notify clients
        broadcastToClients({
          type: 'usb_connected',
          data: {
            ...drive,
            files
          }
        });
      } else {
        // Update last seen time for existing drive
        const existingDrive = connectedDrives.get(drive.path);
        connectedDrives.set(drive.path, {
          ...existingDrive,
          lastSeen: Date.now()
        });
      }
    }
    
    // Check for disconnected drives with debouncing
    for (const [drivePath, drive] of connectedDrives.entries()) {
      if (!currentDrivePaths.has(drivePath)) {
        // Increment miss count for this drive
        const state = driveDetectionState.get(drivePath) || { missCount: 0, lastSeen: 0 };
        const newMissCount = state.missCount + 1;
        
        // Suppress detailed log
        // console.log(`USB drive ${drivePath} not detected in scan (miss ${newMissCount}/${DISCONNECT_THRESHOLD})`);
        
        driveDetectionState.set(drivePath, {
          ...state,
          missCount: newMissCount,
        });
        
        // Only disconnect after consecutive misses reach threshold
        if (newMissCount >= DISCONNECT_THRESHOLD) {
          console.log(`USB drive disconnected: ${drivePath} (${drive.displayName})`);
          
          connectedDrives.delete(drivePath);
          driveDetectionState.delete(drivePath);
          
          // Notify clients
          broadcastToClients({
            type: 'usb_disconnected',
            data: {
              path: drivePath,
              displayName: drive.displayName
            }
          });
        }
      }
    }
    
    // Clean up old detection states
    for (const [drivePath, state] of driveDetectionState.entries()) {
      if (!connectedDrives.has(drivePath)) {
        driveDetectionState.delete(drivePath);
      }
    }
  } catch (error) {
    console.error('Error in USB drive detection:', error);
  }
}

// Initialize the USB detection service
export async function initUsbDetectionService(server) {
  try {
    // Import the WebSocket module
    const ws = await import('ws');
    
    // Check which API version is available
    let WebSocketServer;
    if (ws.WebSocketServer) {
      // Suppress detailed log
      // console.log('Using WebSocketServer from ws module');
      WebSocketServer = ws.WebSocketServer;
    } else if (ws.default && ws.default.Server) {
      // Suppress detailed log
      // console.log('Using Server from ws.default');
      WebSocketServer = ws.default.Server;
    } else if (ws.Server) {
      // Suppress detailed log
      // console.log('Using Server directly from ws module');
      WebSocketServer = ws.Server;
    } else {
      throw new Error('Could not find WebSocketServer in the ws module. Available properties: ' + Object.keys(ws).join(', '));
    }
    
    // Create a simple WebSocket server with no path restrictions
    const wss = new WebSocketServer({ 
      server,
      // Remove the path parameter that might be causing issues
    });
    
    console.log('📀 USB detection service initialized');
    
    // Handle WebSocket connections
    wss.on('connection', (ws, req) => {
      const clientIp = req.socket.remoteAddress;
      // Suppress detailed log
      // console.log(`New client connected to USB detection service from ${clientIp}`);
      wsClients.add(ws);
      
      // Send currently connected USB drives
      for (const [drivePath, drive] of connectedDrives.entries()) {
        try {
          ws.send(JSON.stringify({
            type: 'usb_connected',
            data: drive
          }));
        } catch (error) {
          console.error('Error sending drive data to client:', error);
        }
      }
      
      // Handle client messages
      ws.on('message', (message) => {
        try {
          // Suppress detailed log
          // console.log(`Received message from client: ${message.toString()}`);
          const data = JSON.parse(message.toString());
          
          if (data.type === 'ping') {
            // Reply with pong to keep connection alive
            try {
              ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
              // Suppress detailed log
              // console.log('Sent pong response');
            } catch (error) {
              console.error('Error sending pong response:', error);
            }
          } else {
            // Suppress detailed log
            // console.log(`Received unknown message type: ${data.type}`);
            // Send acknowledgment for other message types
            try {
              ws.send(JSON.stringify({ 
                type: 'ack', 
                originalType: data.type,
                status: 'received',
                timestamp: Date.now() 
              }));
            } catch (error) {
              console.error('Error sending acknowledgment:', error);
            }
          }
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
          try {
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'Failed to parse message', 
              timestamp: Date.now() 
            }));
          } catch (sendError) {
            console.error('Error sending error message:', sendError);
          }
        }
      });
      
      // Handle client disconnection
      ws.on('close', (code, reason) => {
        wsClients.delete(ws);
        // Suppress detailed log
        // console.log(`Client disconnected from USB detection service: ${code} ${reason || ''}`);
      });
      
      // Handle errors
      ws.on('error', (error) => {
        console.error('WebSocket client error:', error);
        wsClients.delete(ws);
      });
    });
    
    // Start periodic polling for USB drives
    const pollInterval = setInterval(checkForUsbDrives, POLL_INTERVAL);
    
    // Keep track of the interval for proper cleanup
    wss.on('close', () => {
      clearInterval(pollInterval);
      console.log('WebSocket server closed, cleaning up resources');
    });
    
    // Do an initial check
    checkForUsbDrives();
    
    return wss;
  } catch (error) {
    console.error('Error initializing USB detection service:', error);
    return null;
  }
}

// Get all currently connected drives
export function getConnectedDrives() {
  return Array.from(connectedDrives.values());
}

// Refresh files for a specific drive
export async function refreshDriveFiles(drivePath) {
  if (connectedDrives.has(drivePath)) {
    const drive = connectedDrives.get(drivePath);
    const files = await scanDirectory(drivePath);
    
    connectedDrives.set(drivePath, {
      ...drive,
      files,
      lastSeen: Date.now()
    });
    
    broadcastToClients({
      type: 'files_updated',
      data: {
        path: drivePath,
        files
      }
    });
    
    return files;
  }
  
  return null;
} 