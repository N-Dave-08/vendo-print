import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

import { printPdfDirect } from './printer_controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// First check if scanner is available
export const checkScanner = () => {
  return new Promise((resolve, reject) => {
    const checkScript = `
      Write-Output "Checking scanner availability..."
      try {
        $deviceManager = New-Object -ComObject WIA.DeviceManager
        $scanners = @($deviceManager.DeviceInfos | Where-Object { $_.Type -eq 1 })
        
        if ($scanners.Count -gt 0) {
          Write-Output "Found $($scanners.Count) scanner(s)"
          Write-Output ($scanners | ForEach-Object { $_.Properties('Name').Value })
          exit 0
        } else {
          Write-Error "No scanners found"
          exit 1
        }
      } catch {
        Write-Error "Error checking scanner: $_"
        exit 1
      }
    `;

    exec(`powershell.exe -NoProfile -Command "${checkScript}"`,
      { timeout: 10000 }, // 10 second timeout
      (error, stdout, stderr) => {
        if (error) {
          console.error('Scanner check failed:', stderr);
          reject(new Error('Scanner not available. Please check if it is connected and powered on.'));
        } else {
          console.log('Scanner check output:', stdout);
          resolve(stdout);
        }
      });
  });
};

export const scanWithWIA = (outputPath) => {
  console.log('Starting scan with WIA...');
  console.log('Output path:', outputPath);

  return new Promise((resolve, reject) => {
    // Create directory if it doesn't exist
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }

    // Log directory access permissions
    try {
      fs.accessSync(dir, fs.constants.W_OK);
      console.log(`Directory ${dir} is writable`);
    } catch (err) {
      console.error(`Directory ${dir} is not writable:`, err);
    }

    const escapedPath = outputPath.replace(/\\/g, '\\\\');

    // Enhanced script with optimized settings for faster scanning
    const scanScript = `
      try {
        Write-Output "Creating optimized WIA scan..."
        $deviceManager = New-Object -ComObject WIA.DeviceManager
        $device = $null
        
        $scanners = @($deviceManager.DeviceInfos | Where-Object { $_.Type -eq 1 })
        Write-Output "Found $($scanners.Count) scanner(s)"
        
        if ($scanners.Count -eq 0) {
            Write-Error "No scanners found"
            exit 1
        }
        
        # Connect to the first scanner
        $device = ($scanners | Select-Object -First 1).Connect()
        Write-Output "Connected to scanner: $($device.Properties('Name').Value)"
        
        # Configure scan properties for balance of quality and size
        # Lower resolution and bit depth for faster scanning and smaller file size
        $item = $device.Items(1)
        
        # Common properties:
        # 6146 = Horizontal Resolution (DPI)
        # 6147 = Vertical Resolution (DPI)
        # 6148 = Horizontal Start Position
        # 6149 = Vertical Start Position
        # 6150 = Horizontal Extent (width)
        # 6151 = Vertical Extent (height)
        # 4104 = Brightness
        # 4105 = Contrast
        # 4106 = Color Mode (1=B&W, 2=Grayscale, 4=Color)
        
        # Set resolution to 150 DPI (faster)
        try { $item.Properties("6146") = 150 } catch { Write-Output "Could not set horizontal resolution" }
        try { $item.Properties("6147") = 150 } catch { Write-Output "Could not set vertical resolution" }
        
        # Set color mode to color but with compression
        try { $item.Properties("4106") = 4 } catch { Write-Output "Could not set color mode" }
        
        # Start the scan
        Write-Output "Starting scan with optimized settings..."
        $image = $item.Transfer()
        
        # Save the file directly
        Write-Output "Saving to: ${escapedPath}"
        $image.SaveFile("${escapedPath}")
        Start-Sleep -Seconds 2
        
        # Verify file was saved
        if (Test-Path "${escapedPath}") {
            $fileSize = (Get-Item "${escapedPath}").Length
            Write-Output "File saved successfully: $fileSize bytes"
            exit 0
        } else {
            Write-Error "File was not saved to ${escapedPath}"
            exit 1
        }
      } catch {
        Write-Error "Error: $_"
        exit 1
      }
    `;

    // Create a temporary file for the PowerShell script
    const scriptPath = path.join(dir, `scan_script_${Date.now()}.ps1`);
    fs.writeFileSync(scriptPath, scanScript);
    console.log(`Created script file: ${scriptPath}`);

    // Execute the script file directly instead of passing command inline
    console.log('Executing PowerShell script...');
    const command = `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}"`;
    console.log('Command:', command);

    // Increase timeout to 2 minutes (120000ms) for larger scans
    const process = exec(command, { timeout: 120000 }, (error, stdout, stderr) => {
      // Clean up the script file
      try {
        if (fs.existsSync(scriptPath)) {
          fs.unlinkSync(scriptPath);
          console.log('Cleaned up script file');
        }
      } catch (e) {
        console.error('Error cleaning up script file:', e);
      }

      if (error) {
        console.error('Scan error:', stderr);
        reject(new Error(stderr || 'Failed to scan'));
        return;
      }

      // Wait 3 seconds to ensure file has been saved (increased from 2 seconds)
      setTimeout(() => {
        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          console.log(`File exists, size: ${stats.size} bytes`);
          if (stats.size > 0) {
            console.log('Scan completed successfully');
            resolve(stdout);
          } else {
            console.error('File exists but is empty');
            reject(new Error('Scan completed but file is empty'));
          }
        } else {
          console.error('File does not exist after scan');
          reject(new Error('Scan completed but file was not saved'));
        }
      }, 3000);
    });

    process.stdout.on('data', (data) => {
      console.log('PowerShell output:', data);
    });

    process.stderr.on('data', (data) => {
      console.error('PowerShell error:', data);
    });

    process.on('exit', (code) => {
      console.log(`PowerShell process exited with code ${code}`);
    });
  });
};

export const copyHandler = async (req, res) => {
  console.log('Starting copy operation...');
  let outputPath = null;

  try {
    const { printerName } = req.body;
    if (!printerName) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing printerName in request body.'
      });
    }

    console.log('Checking scanner availability...');
    await checkScanner();

    const scansDir = path.join(__dirname, 'scans');
    if (!fs.existsSync(scansDir)) {
      console.log('Creating scans directory...');
      fs.mkdirSync(scansDir, { recursive: true });
    }

    const fileName = `${uuidv4()}.bmp`;
    outputPath = path.join(scansDir, fileName);
    console.log('Will save scan to:', outputPath);

    console.log('Starting scan...');
    await scanWithWIA(outputPath);

    if (!fs.existsSync(outputPath)) {
      throw new Error('Scan failed - no output file generated');
    }

    console.log('Starting print...');
    await printPdfDirect(outputPath, printerName, true);
    console.log('Print completed');

    // Clean up
    if (fs.existsSync(outputPath)) {
      console.log('Cleaning up temporary file...');
      fs.unlinkSync(outputPath);
    }

    console.log('Operation completed successfully');
    return res.json({
      status: 'success',
      message: 'Copy operation completed (scan + print).',
    });

  } catch (error) {
    console.error('Error during copy operation:', error);

    // Clean up on error
    if (outputPath && fs.existsSync(outputPath)) {
      try {
        fs.unlinkSync(outputPath);
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }
    }

    return res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to process copy operation.'
    });
  }
};
