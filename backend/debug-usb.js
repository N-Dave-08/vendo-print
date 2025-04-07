// Debug script to test USB detection directly
import { exec } from 'child_process';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Starting direct USB detection test...');
console.log('Platform:', os.platform());
console.log('Working directory:', __dirname);

// Directly test Windows detection
function testWindowsUsbDetection() {
  console.log('Testing Windows USB detection...');
  
  // Create a PowerShell script that outputs JSON
  const jsonScript = `
    $drives = @()
    Get-WmiObject Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 } | ForEach-Object {
      $obj = New-Object PSObject -Property @{
        DeviceID = $_.DeviceID
        VolumeName = $_.VolumeName
        FileSystem = $_.FileSystem
        Size = $_.Size
        FreeSpace = $_.FreeSpace
      }
      $drives += $obj
    }
    $drives | ConvertTo-Json -Depth 3
  `;
  
  exec(`powershell.exe -Command "${jsonScript}"`, (error, stdout, stderr) => {
    console.log('JSON command execution:');
    if (error) {
      console.error('Error:', error);
      console.error('Stderr:', stderr);
    } else {
      console.log('Command executed successfully');
      console.log('Raw JSON output:');
      console.log(stdout);
      
      try {
        // Parse the JSON output
        const drivesData = JSON.parse(stdout);
        const drives = [];
        
        // Handle both array and single object responses
        const drivesArray = Array.isArray(drivesData) ? drivesData : [drivesData];
        
        for (const drive of drivesArray) {
          if (drive && drive.DeviceID) {
            drives.push({
              path: drive.DeviceID,
              displayName: drive.VolumeName || drive.DeviceID,
              fileSystem: drive.FileSystem,
              size: parseInt(drive.Size, 10) || 0,
              freeSpace: parseInt(drive.FreeSpace, 10) || 0,
              type: 'USB'
            });
          }
        }
        
        console.log('\nParsed drives:');
        console.log(JSON.stringify(drives, null, 2));
      } catch (e) {
        console.error('Error parsing JSON:', e);
      }
    }
  });
}

// Run detection based on platform
const platform = os.platform();
if (platform === 'win32') {
  testWindowsUsbDetection();
} else {
  console.log('This debug script only supports Windows currently.');
} 