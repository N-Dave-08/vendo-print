import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

console.log('Starting USB detection test...');
console.log(`Running on ${process.platform} platform`);

// Test Windows USB detection
async function testWindowsUsbDetection() {
  console.log('\n--- Testing Windows USB Drive Detection ---');
  
  // Function to execute PowerShell commands and return the result
  const runPowerShell = (command) => {
    return new Promise((resolve, reject) => {
      console.log(`Executing PowerShell command: ${command}`);
      exec(`powershell.exe -Command "${command}"`, (error, stdout, stderr) => {
        if (error) {
          console.error('Error executing PowerShell command:', stderr);
          reject(error);
          return;
        }
        resolve(stdout.trim());
      });
    });
  };
  
  try {
    // Test 1: List all disk drives
    console.log('\n1. Listing all disk drives:');
    const allDrives = await runPowerShell('Get-WmiObject Win32_DiskDrive | Format-List DeviceID, Model, InterfaceType');
    console.log(allDrives || 'No drives found');
    
    // Test 2: List logical disks (drive letters)
    console.log('\n2. Listing logical disks (drive letters):');
    const logicalDisks = await runPowerShell('Get-WmiObject Win32_LogicalDisk | Format-List DeviceID, VolumeName, DriveType, FileSystem');
    console.log(logicalDisks || 'No logical disks found');
    
    // Test 3: Try the specific USB detection script used in the application
    console.log('\n3. Testing USB-specific detection script:');
    const usbScript = `
      Get-WmiObject Win32_DiskDrive | Where-Object { $_.InterfaceType -eq "USB" } | ForEach-Object {
        $drive = $_
        Write-Output "Found USB drive: $($drive.DeviceID), Model: $($drive.Model)"
        $partitions = Get-WmiObject -Query "ASSOCIATORS OF {Win32_DiskDrive.DeviceID='$($drive.DeviceID)'} WHERE AssocClass=Win32_DiskDriveToDiskPartition"
        foreach($partition in $partitions) {
          Write-Output "  Partition: $($partition.DeviceID)"
          $volumes = Get-WmiObject -Query "ASSOCIATORS OF {Win32_DiskPartition.DeviceID='$($partition.DeviceID)'} WHERE AssocClass=Win32_LogicalDiskToPartition"
          foreach($volume in $volumes) {
            Write-Output "    Volume: $($volume.DeviceID), Name: $($volume.VolumeName), FileSystem: $($volume.FileSystem)"
            Write-Output "    RESULT LINE: $($volume.DeviceID)|$($volume.VolumeName)|$($volume.FileSystem)|$($volume.Size)|$($volume.FreeSpace)|USB"
          }
        }
      }
    `;
    const usbDrives = await runPowerShell(usbScript);
    if (usbDrives) {
      console.log(usbDrives);
    } else {
      console.log('No USB drives detected with the script');
    }
    
    // Test 4: Alternative approach using DriveType property
    console.log('\n4. Testing alternative detection using DriveType property:');
    const altScript = `
      Get-WmiObject Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 } | ForEach-Object {
        Write-Output "Found removable drive: $($_.DeviceID), VolumeName: $($_.VolumeName), Size: $($_.Size), FreeSpace: $($_.FreeSpace)"
      }
    `;
    const removableDrives = await runPowerShell(altScript);
    if (removableDrives) {
      console.log(removableDrives);
    } else {
      console.log('No removable drives detected with the alternative script');
    }
    
    // Test 5: Check for common issues that could prevent detection
    console.log('\n5. Checking for common issues:');
    
    // Check if running with admin privileges
    const isAdmin = await runPowerShell('[bool](([System.Security.Principal.WindowsIdentity]::GetCurrent()).groups -match "S-1-5-32-544")');
    console.log(`Running with admin privileges: ${isAdmin}`);
    
    // Check PowerShell execution policy
    const executionPolicy = await runPowerShell('Get-ExecutionPolicy');
    console.log(`PowerShell execution policy: ${executionPolicy}`);
    
    console.log('\n--- Windows USB Detection Test Complete ---');
  } catch (error) {
    console.error('Error during Windows USB detection test:', error);
  }
}

// Run platform-specific tests
if (process.platform === 'win32') {
  testWindowsUsbDetection();
} else {
  console.log(`USB detection testing for ${process.platform} is not implemented in this script.`);
} 