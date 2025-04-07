// Final test script for PowerShell execution
import { exec } from 'child_process';

// Direct PowerShell test - minimal script
console.log('Starting final direct PowerShell test...');

// Try with different quoting and escaping
const cmds = [
  // Test 1: Basic command with backtick escaping
  'powershell.exe -Command "Get-WmiObject Win32_LogicalDisk | Where-Object { `$_.DriveType -eq 2 } | Select-Object -Property DeviceID"',
  
  // Test 2: Double-quote the entire command
  'powershell.exe -Command \"Get-WmiObject Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 } | Select-Object -Property DeviceID\"',
  
  // Test 3: Use Format-List instead of Select-Object
  'powershell.exe -Command "Get-WmiObject Win32_LogicalDisk | Where-Object { `$_.DriveType -eq 2 } | Format-List DeviceID"',
  
  // Test 4: Simple DriveType command only
  'powershell.exe -Command "Get-WmiObject Win32_LogicalDisk | Format-List DeviceID, DriveType"',
  
  // Test 5: Direct WMI query for removable drives
  'powershell.exe -Command "Get-WmiObject -Query \"SELECT DeviceID FROM Win32_LogicalDisk WHERE DriveType=2\""'
];

// Run each command in sequence
function runNextCommand(index) {
  if (index >= cmds.length) {
    console.log('All tests complete');
    return;
  }
  
  const cmd = cmds[index];
  console.log(`\n\nTest ${index+1}:`);
  console.log('Executing command:', cmd);
  
  exec(cmd, (error, stdout, stderr) => {
    console.log(`Command ${index+1} execution complete`);
    
    if (error) {
      console.error('Error:', error);
      console.error('Stderr:', stderr);
    } else {
      console.log('Command output:');
      console.log(stdout);
      
      // Try to parse the output
      const driveLetters = stdout.match(/([A-Z]:)/g) || [];
      console.log('Detected drive letters:', driveLetters);
      
      if (driveLetters.length === 0) {
        console.log('No drives detected from the output');
      } else {
        console.log(`Found ${driveLetters.length} drives:`, driveLetters.join(', '));
      }
    }
    
    // Run the next command
    runNextCommand(index + 1);
  });
}

// Start the test sequence
runNextCommand(0); 