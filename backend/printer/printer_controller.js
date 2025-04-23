// server.js

// Import lahat ng dependencies
import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import util from 'util';
import { fileURLToPath } from 'url';
import { PDFDocument, rgb, degrees } from 'pdf-lib';
import os from 'os';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref as dbRef, update, get } from 'firebase/database';
import { firebaseConfig } from '../firebase/firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Keep track of recent print jobs to prevent duplicates
const recentPrintJobs = new Map();
const completedPrintJobs = new Set(); // Track completed jobs to prevent restart
const activePdfPrintJobs = new Set(); // Track active PDF print jobs
const PRINT_JOB_TRACKING_DURATION = 60000; // 60 seconds
const COMPLETED_JOB_TRACKING_DURATION = 300000; // 5 minutes

// Track print job to prevent duplicates
const trackPrintJob = (printJobId, fileName) => {
  if (!printJobId || !fileName) return false;
  
  // If this job has already been completed, don't process it again
  if (completedPrintJobs.has(printJobId)) {
    console.log(`Job ${printJobId} has already completed, skipping duplicate processing`);
    return true;
  }
  
  const jobKey = `${fileName}-${printJobId}`;
  const now = Date.now();
  
  // Check if we've printed this file recently
  for (const [key, timestamp] of recentPrintJobs.entries()) {
    // Clean up old entries
    if (now - timestamp > PRINT_JOB_TRACKING_DURATION) {
      recentPrintJobs.delete(key);
      continue;
    }
    
    // If this is the same file and it was printed recently, prevent duplicate
    if (key.startsWith(`${fileName}-`) && key !== jobKey) {
      console.log(`Preventing duplicate print of ${fileName} - recently printed with job ${key}`);
      return true;
    }
  }
  
  // Record this print job
  recentPrintJobs.set(jobKey, now);
  return false;
};

// Periodically clean up completed jobs set
setInterval(() => {
  const now = Date.now();
  const expiredJobs = [];
  
  // Check each completed print job
  for (const jobId of completedPrintJobs) {
    // If we have a timestamp for when the job was marked complete
    const timestamp = recentPrintJobs.get(`completed-${jobId}`);
    if (timestamp && now - timestamp > COMPLETED_JOB_TRACKING_DURATION) {
      expiredJobs.push(jobId);
    }
  }
  
  // Remove expired jobs from tracking
  for (const jobId of expiredJobs) {
    completedPrintJobs.delete(jobId);
    recentPrintJobs.delete(`completed-${jobId}`);
  }
  
  if (expiredJobs.length > 0) {
    console.log(`Cleaned up ${expiredJobs.length} expired completed job entries`);
  }
}, 60000); // Check every minute

// Helper function to update print progress
const updatePrintProgress = async (printJobId, progress, status) => {
  if (!printJobId) return;

  // Convert to string if status is a string; otherwise pass undefined for status
  const statusText = typeof status === 'string' ? status : undefined;
  
  // Convert progress value to a descriptive status message if no status message provided
  let statusMessage = statusText;
  
  // If we have a status but it's not a well-formatted message
  if (statusText && !statusText.endsWith('...') && !statusText.includes('Error:')) {
    statusMessage = `${statusText}...`;
  }
  
  // Determine the status code based on progress or provided status
  let statusCode = undefined;
  if (typeof status === 'string' && (status === 'pending' || status === 'processing' || status === 'printing' || status === 'error' || status === 'completed')) {
    statusCode = status;
  } else if (progress >= 100) {
    statusCode = "completed";
  } else if (progress === 0 && statusText && statusText.toLowerCase().includes('error')) {
    statusCode = "error";
  } else if (progress > 75) {
    statusCode = "printing";
  } else if (progress > 0) {
    statusCode = "processing";
  }
  
  // Call the new function with the determined parameters
  return updatePrintJobProgress(printJobId, progress, statusCode, statusMessage);
};

const execPromise = util.promisify(exec);


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const getPrintersFromPowerShell = () => {
  return new Promise((resolve, reject) => {
    const command =
      'powershell.exe -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"';
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Error getting printers:', error);
        return reject(new Error('Failed to retrieve printers'));
      }
      const printerList = stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      resolve(printerList);
    });
  });
};


export const getPrintersHandler = async (req, res) => {
  try {
    const printerNames = await getPrintersFromPowerShell();
    const printers = printerNames.map((name) => ({ name }));
    res.json({ status: 'success', printers });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
};


/**
 * Print a file using OS native commands
 * @param {string} filePath - Path to the file to print
 * @param {string} printerName - Name of the printer to use
 * @param {boolean} isColor - Whether to print in color or monochrome
 * @param {Object} options - Additional print options
 * @param {string} options.duplex - Duplex printing mode: 'none', 'long' (long edge) or 'short' (short edge)
 * @param {string} options.paperSource - Paper source/tray to use
 * @param {string} options.quality - Print quality: 'draft', 'normal', 'high'
 * @returns {Promise<string>} - Output from the print command
 */
export const printFileWithOSCommands = async (filePath, printerName, isColor, options = {}) => {
  const platform = os.platform();
  let command;

  // Default options
  const printOptions = {
    duplex: options.duplex || 'none',
    paperSource: options.paperSource || 'auto',
    quality: options.quality || 'normal',
    hasColorContent: options.hasColorContent || false,
    colorPageCount: options.colorPageCount || 0,
    ...options
  };

  if (platform === 'win32') {
    // Windows printing using PowerShell - FIXED SYNTAX with improved debugging
    command = `powershell.exe -Command "
    $printer = '${printerName}';
    $file = '${filePath.replace(/\\/g, '\\\\')}';
    
    Write-Host '======== PRINT DEBUG INFO ========';
    Write-Host 'Printer: $printer';
    Write-Host 'File: $file';
    Write-Host 'Color Mode: ${isColor ? 'Color' : 'Black & White'}';
    Write-Host 'Has Color Content: ${printOptions.hasColorContent ? 'Yes' : 'No'}';
    Write-Host 'Color Pages Count: ${printOptions.colorPageCount}';
    
    # Check if file exists and is readable
    if (Test-Path -Path $file) {
      $fileInfo = Get-Item $file;
      Write-Host 'File exists, size:' $fileInfo.Length 'bytes';
      Write-Host 'File created:' $fileInfo.CreationTime;
    } else {
      Write-Error 'FILE NOT FOUND: $file' -ErrorAction Continue;
    }
    
    # Check printer status before printing
    try {
      $printerObj = Get-Printer -Name $printer -ErrorAction Stop;
      Write-Host 'Printer status before:' $printerObj.PrinterStatus '(3=Ready, 4=Printing, 5=Warmup, 6=Stopped, 7=Offline)';
      
      # Print jobs before
      Write-Host 'Print jobs before:';
      $beforeJobs = Get-PrintJob -PrinterName $printer -ErrorAction SilentlyContinue;
      if ($beforeJobs) {
        $beforeJobs | ForEach-Object { Write-Host '  - Job:' $_.JobId $_.DocumentName $_.JobStatus };
      } else {
        Write-Host '  No print jobs in queue';
      }
    } catch {
      Write-Warning 'Could not check printer status: $_';
    }
    
    # Save current default printer
    $wshNetwork = New-Object -ComObject WScript.Network;
    $defaultPrinter = $wshNetwork.EnumPrinterConnections() | Select-Object -First 1;
    Write-Host 'Default printer before:' $defaultPrinter;
    
    # Set desired printer as default
    $wshNetwork.SetDefaultPrinter($printer);
    Write-Host 'Set default printer to:' $printer;
    
    # Get printer object for configuration
    if ($printer -ne $null) {
      try {
        $objPrinter = Get-WmiObject -Query \\\"SELECT * FROM Win32_Printer WHERE Name = '$printer'\\\";
        if ($objPrinter -ne $null) {
          $devMode = $objPrinter.GetDevMode(1);
          if ($devMode -ne $null) {
            # Set color mode (1 = Color, 2 = Monochrome)
            # If the document has color and user selected color printing, use color mode
            $colorMode = 2; # Default to Monochrome
            if (${isColor}) {
              $colorMode = 1; # Use Color mode
              Write-Host 'Setting color mode to: Color (user requested)';
            } else {
              Write-Host 'Setting color mode to: Monochrome (user requested)';
            }
            $devMode.Color = $colorMode;
            
            # Set duplex mode (1 = None, 2 = Long Edge, 3 = Short Edge)
            $duplexMode = 1; # Default to simplex
            if ('${printOptions.duplex}' -eq 'long') { $duplexMode = 2 }
            if ('${printOptions.duplex}' -eq 'short') { $duplexMode = 3 }
            $devMode.Duplex = $duplexMode;
            
            # Set print quality
            $qualityValue = 0; # Default/Normal
            if ('${printOptions.quality}' -eq 'draft') { $qualityValue = -1 }
            if ('${printOptions.quality}' -eq 'high') { $qualityValue = 1 }
            $devMode.Quality = $qualityValue;
            
            # Apply settings
            $objPrinter.SetDevMode($devMode);
            Write-Host 'Printer settings applied successfully';
          }
        }
      } catch {
        Write-Warning \\\"Could not configure printer settings. Using default settings. Error: $_\\\";
      }
    }
    
    Write-Host 'Attempting to print file: $file';
    
    # Print the file with more visibility
    $printProcess = Start-Process -FilePath $file -Verb Print -PassThru;
    Write-Host 'Print process started with ID:' $printProcess.Id;
    
    # Wait a moment to let the job start
    Write-Host 'Waiting for print job to initialize...';
    Start-Sleep -Seconds 3;
    
    # Check if job was added to queue
    try {
      $afterJobs = Get-PrintJob -PrinterName $printer -ErrorAction SilentlyContinue;
      Write-Host 'Print jobs after submitting:';
      if ($afterJobs) {
        $afterJobs | ForEach-Object { Write-Host '  - Job:' $_.JobId $_.DocumentName $_.JobStatus };
      } else {
        Write-Host '  No print jobs in queue - this might indicate an issue';
      }
    } catch {
      Write-Warning 'Could not check print queue after submission: $_';
    }
    
    # Now we can terminate the process
    if ($printProcess) {
      Write-Host 'Stopping print process ID:' $printProcess.Id;
      $printProcess | Stop-Process;
    }
    
    # Wait a moment to let print spooler process the job
    Write-Host 'Waiting for print job to process...';
    Start-Sleep -Seconds 5;
    
    # Check printer status after printing
    try {
      $printerObj = Get-Printer -Name $printer -ErrorAction Stop;
      Write-Host 'Printer status after:' $printerObj.PrinterStatus '(3=Ready, 4=Printing, 5=Warmup, 6=Stopped, 7=Offline)';
      
      # Print jobs after waiting
      Write-Host 'Print jobs final check:';
      $finalJobs = Get-PrintJob -PrinterName $printer -ErrorAction SilentlyContinue;
      if ($finalJobs) {
        $finalJobs | ForEach-Object { Write-Host '  - Job:' $_.JobId $_.DocumentName $_.JobStatus };
      } else {
        Write-Host '  No print jobs in queue (either printed or failed to queue)';
      }
    } catch {
      Write-Warning 'Could not check final printer status: $_';
    }
    
    # Check print spooler service
    $spooler = Get-Service -Name Spooler;
    Write-Host 'Print Spooler service status:' $spooler.Status;
    
    # Restore original default printer
    Start-Sleep -Seconds 2;
    try {
      if ($defaultPrinter) {
        $wshNetwork.SetDefaultPrinter($defaultPrinter);
        Write-Host 'Restored default printer to:' $defaultPrinter;
      }
    } catch {
      Write-Warning 'Could not restore default printer: $_';
    }
    
    Write-Host '======== END PRINT DEBUG INFO ========';
    "`;
  } else if (platform === 'darwin') {
    // macOS printing using lp
    const colorOption = isColor ? '' : ' -o ColorModel=Gray';
    const duplexOption = printOptions.duplex === 'none' ? '' :
      ` -o sides=${printOptions.duplex === 'long' ? 'two-sided-long-edge' : 'two-sided-short-edge'}`;
    const qualityOption = ` -o print-quality=${printOptions.quality === 'draft' ? '3' : printOptions.quality === 'high' ? '5' : '4'}`;

    command = `lp -d "${printerName}"${colorOption}${duplexOption}${qualityOption} "${filePath}"`;
  } else {
    // Linux/Unix printing using lp
    const colorOption = isColor ? '' : ' -o ColorModel=Gray';
    const duplexOption = printOptions.duplex === 'none' ? '' :
      ` -o sides=${printOptions.duplex === 'long' ? 'two-sided-long-edge' : 'two-sided-short-edge'}`;
    const qualityOption = ` -o print-quality=${printOptions.quality === 'draft' ? '3' : printOptions.quality === 'high' ? '5' : '4'}`;

    command = `lp -d "${printerName}"${colorOption}${duplexOption}${qualityOption} "${filePath}"`;
  }

  try {
    console.log(`Executing print command: ${command}`);
    const { stdout, stderr } = await execPromise(command);
    if (stderr) {
      console.warn('Warning during print operation:', stderr);
    }
    return stdout;
  } catch (error) {
    console.error('Error printing file with OS commands:', error);
    throw error;
  }
};


/**
 * Print Word documents directly using the Word COM object
 * @param {string} filePath - Path to the Word document to print
 * @param {string} printerName - Name of the printer to use
 * @param {boolean} isColor - Whether to print in color
 * @param {string} selectedSize - Paper size option
 * @param {string} orientation - Page orientation (portrait/landscape)
 * @returns {Promise<string>} - Output from the print command
 */
export const printWordDocument = async (filePath, printerName, isColor = true, selectedSize = "", orientation = "portrait") => {
  try {
    // Create the PowerShell script content
    const scriptContent = `
$ErrorActionPreference = 'Stop'
try {
    # Parameters
    $printer = '${printerName}'
    $file = '${filePath}'
    $isColor = $${isColor}
    
    # Map paper sizes to Word constants
    $paperSizeMap = @{
        "Short Bond" = 1      # wdPaperLetterSmall
        "Letter" = 0          # wdPaperLetter (8.5 x 11)
        "A4" = 9             # wdPaperA4 (8.27 x 11.69)
        "Legal" = 5          # wdPaperLegal (8.5 x 14)
    }
    
    # Default to Letter if selected size isn't available
    $paperSize = if ($paperSizeMap.ContainsKey("${selectedSize}")) { 
        $paperSizeMap["${selectedSize}"]
    } else { 
        0  # Default to Letter
    }
    
    # Word orientation constants: wdOrientPortrait = 0, wdOrientLandscape = 1
    $orientation = if ('${orientation}'.ToLower() -eq 'portrait') { 0 } else { 1 }
    Write-Host "Setting orientation to: $(if($orientation -eq 0){'Portrait'}else{'Landscape'})"

    # Verify file existence
    if (-not (Test-Path $file)) {
        Write-Error 'File not found at the specified path'
        exit 2
    }

    # Use the Word COM object for printing
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false

    # Open the document
    $doc = $word.Documents.Open($file)

    # Try to set paper size and orientation
    try {
        $sections = $doc.Sections
        foreach ($section in $sections) {
            $pageSetup = $section.PageSetup
            try {
                $pageSetup.PaperSize = $paperSize
            } catch {
                Write-Warning "Could not set paper size, using printer default"
            }
            
            try {
                Write-Host "Applying orientation setting..."
                $pageSetup.Orientation = $orientation
                Write-Host "Orientation set successfully"
            } catch {
                Write-Warning "Could not set orientation: $_"
            }
        }
    } catch {
        Write-Warning "Could not set page setup, using printer defaults: $_"
    }

    # Set printer and print
    $word.ActivePrinter = $printer
    
    # Print document with explicit settings
    Write-Host "Sending print command..."
    $doc.PrintOut()

    # Wait briefly for print job to start
    Start-Sleep -Seconds 2

    # Clean up
    $doc.Close($false)
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($doc) | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()

    Write-Host "Print job sent successfully"
    exit 0
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
`

    // Save the script to a temporary file
    const scriptPath = path.join(__dirname, 'temp', `print_${Date.now()}.ps1`)
    await fs.promises.writeFile(scriptPath, scriptContent)

    // Execute the script
    const { stdout, stderr } = await execPromise(`powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}"`)

    // Clean up the temporary script file
    try {
      await fs.promises.unlink(scriptPath)
    } catch (err) {
      console.warn('Could not delete temporary script file:', err)
    }

    if (stderr) {
      throw new Error(stderr)
    }

    console.log('Print output:', stdout)
    return { success: true, message: 'Print job sent successfully' }

  } catch (error) {
    console.error('Print error:', error)
    throw error
  }
};


const processPdf = async (inputFilePath, options) => {

  const existingPdfBytes = fs.readFileSync(inputFilePath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const totalPages = pdfDoc.getPageCount();
  let pagesToKeep = [];


  if (options.pageOption === "All") {
    pagesToKeep = Array.from({ length: totalPages }, (_, i) => i);
  } else if (options.pageOption === "Odd") {
    pagesToKeep = Array.from({ length: totalPages }, (_, i) => i).filter(i => (i + 1) % 2 === 1);
  } else if (options.pageOption === "Even") {
    pagesToKeep = Array.from({ length: totalPages }, (_, i) => i).filter(i => (i + 1) % 2 === 0);
  } else if (options.pageOption === "Custom") {

    const ranges = options.customPageRange.split(',').map(token => token.trim());
    for (const range of ranges) {
      if (range.includes('-')) {
        const [start, end] = range.split('-').map(Number);
        for (let i = start; i <= end; i++) {
          if (i - 1 < totalPages) pagesToKeep.push(i - 1);
        }
      } else {
        const pageNum = Number(range);
        if (pageNum - 1 < totalPages) pagesToKeep.push(pageNum - 1);
      }
    }
    pagesToKeep = [...new Set(pagesToKeep)].sort((a, b) => a - b);
  }

  const newPdfDoc = await PDFDocument.create();
  const copiedPages = await newPdfDoc.copyPages(pdfDoc, pagesToKeep);


  copiedPages.forEach(page => {

    if (options.orientation === "Landscape") {
      page.setRotation(degrees(90));
    }

    if (options.selectedSize) {
      let width, height;
      switch (options.selectedSize) {
        case "Letter 8.5 x 11":
          width = 8.5 * 72; height = 11 * 72; break;
        case "A4 8.3 x 11.7":
          width = 8.3 * 72; height = 11.7 * 72; break;
        case "Legal 8.5 x 14":
          width = 8.5 * 72; height = 14 * 72; break;
        case "Executive 7.25 x 10.5":
          width = 7.25 * 72; height = 10.5 * 72; break;
        case "Tabloid 11 x 17":
          width = 11 * 72; height = 17 * 72; break;
        case "Statement 5.5 x 8.5":
          width = 5.5 * 72; height = 8.5 * 72; break;
        case "B5 6.9 x 9.8":
          width = 6.9 * 72; height = 9.8 * 72; break;
        case "Custom":
          width = Number(options.customWidth) * 72;
          height = Number(options.customHeight) * 72;
          break;
        case "Fit to Cover":
        case "Shrink to Int":

          width = page.getWidth();
          height = page.getHeight();
          break;
        default:
          width = page.getWidth();
          height = page.getHeight();
      }
      page.setSize(width, height);
    }

    newPdfDoc.addPage(page);
  });

  const newPdfBytes = await newPdfDoc.save();
  return newPdfBytes;
};


/**
 * Direct Windows print command as a fallback
 * @param {string} filePath - Path to the file to print 
 * @param {string} printerName - Name of the printer
 * @returns {Promise<string>} - Command output
 */
export const printWindowsDirectWithDll = async (filePath, printerName) => {
  // Create a temporary VBS script that will handle the printing
  const tempScriptPath = path.join(__dirname, `print_script_${Date.now()}.vbs`);
  const fileExt = path.extname(filePath).toLowerCase();

  // Enhanced VBScript to force print with error handling and multiple approaches
  const vbsScript = `
' Printing script with multiple fallback approaches
On Error Resume Next

' Step 1: Get file info
Set fso = CreateObject("Scripting.FileSystemObject")
If Not fso.FileExists("${filePath.replace(/\\/g, '\\\\')}") Then
  WScript.Echo "ERROR: File not found: ${filePath.replace(/\\/g, '\\\\')}"
  WScript.Quit 1
End If

' Set default printer first - this is critical
Set objNetwork = CreateObject("WScript.Network")
strOriginalPrinter = objNetwork.GetDefaultPrinterName
WScript.Echo "Original printer: " & strOriginalPrinter
objNetwork.SetDefaultPrinter "${printerName}"
WScript.Echo "Default printer set to: ${printerName}"

' Wait briefly for printer change to take effect
WScript.Sleep 1000

' Get file extension for specialized handling
strFileExt = LCase(fso.GetExtensionName("${filePath.replace(/\\/g, '\\\\')}"))
WScript.Echo "File type: " & strFileExt

' Attempt Method 1: Shell Application with InvokeVerb
WScript.Echo "Attempting Method 1: Shell Application Print..."
Set objShell = CreateObject("Shell.Application")
Set objFolder = objShell.Namespace("${path.dirname(filePath).replace(/\\/g, '\\\\')}")
Set objFolderItem = objFolder.ParseName("${path.basename(filePath)}")

' Try direct printing
objFolderItem.InvokeVerb "Print"
WScript.Sleep 3000

' Check if Method 1 failed
If Err.Number <> 0 Then
  WScript.Echo "Method 1 error: " & Err.Description
  Err.Clear
  
  ' Attempt Method 2: Word automation for doc/docx files
  If strFileExt = "doc" Or strFileExt = "docx" Then
    WScript.Echo "Attempting Method 2: Word automation..."
    Set objWord = CreateObject("Word.Application")
    objWord.Visible = False
    
    ' Open and print the document
    Set objDoc = objWord.Documents.Open("${filePath.replace(/\\/g, '\\\\')}")
    objWord.ActivePrinter = "${printerName}"
    objDoc.PrintOut
    WScript.Sleep 4000
    
    ' Close Word
    objDoc.Close False
    objWord.Quit
    Set objDoc = Nothing
    Set objWord = Nothing
    
    If Err.Number <> 0 Then
      WScript.Echo "Method 2 error: " & Err.Description
      Err.Clear
    Else
      WScript.Echo "Method 2 successful"
    End If
  End If
  
  ' Attempt Method 3: Direct printing through rundll32
  If Err.Number <> 0 Then
    WScript.Echo "Attempting Method 3: Rundll32 printing..."
    Set objShell = CreateObject("WScript.Shell")
    objShell.Run "rundll32 mshtml.dll,PrintHTML ""${filePath.replace(/\\/g, '\\\\')}""", 0, True
    WScript.Sleep 3000
    
    If Err.Number <> 0 Then
      WScript.Echo "Method 3 error: " & Err.Description
      Err.Clear
    Else
      WScript.Echo "Method 3 successful"
    End If
  End If
Else
  WScript.Echo "Method 1 successful"
End If

' Restore original printer
WScript.Sleep 3000
objNetwork.SetDefaultPrinter strOriginalPrinter
WScript.Echo "Default printer restored to: " & strOriginalPrinter

WScript.Echo "Print operation completed"`;

  try {
    // Write the VBS script to a temp file
    fs.writeFileSync(tempScriptPath, vbsScript);
    console.log('Created enhanced VBS print script at:', tempScriptPath);

    // Execute the VBS script with high priority
    console.log('Executing enhanced VBS print script...');
    const { stdout, stderr } = await execPromise(`cscript //NoLogo "${tempScriptPath}"`);

    if (stderr) {
      console.warn('Warning from VBS print script:', stderr);
    }

    console.log('VBS print output:', stdout);

    // Check if output indicates success
    if (stdout.includes('successful') || !stdout.includes('ERROR:')) {
      console.log('VBS printing appears successful');
    } else {
      console.error('VBS printing might have failed:', stdout);
    }

    // Clean up the script file
    try {
      fs.unlinkSync(tempScriptPath);
      console.log('VBS script file deleted');
    } catch (cleanupErr) {
      console.warn('Could not delete VBS script file:', cleanupErr.message);
    }

    return stdout || 'Print command sent';
  } catch (error) {
    console.error('Error with VBS print script:', error);

    // Try to clean up the script file even if there was an error
    try {
      if (fs.existsSync(tempScriptPath)) {
        fs.unlinkSync(tempScriptPath);
      }
    } catch (cleanupErr) {
      // Ignore cleanup errors
    }

    throw error;
  }
};

/**
 * Direct print for image files using a different approach
 * @param {string} filePath - Path to the image file to print
 * @param {string} printerName - Name of the printer to use
 * @param {boolean} isColor - Whether to print in color or monochrome
 * @returns {Promise<string>} - Output from the print command
 */
export const printImageFile = async (filePath, printerName, isColor = true, orientation = 'portrait') => {
  const platform = os.platform();

  // CRITICAL FIX: Trim trailing spaces from all paths
  filePath = filePath.trim();
  printerName = printerName.trim();

  if (platform === 'win32') {
    try {
      // Create a temporary PS1 script file instead of a giant command line
      const tempScriptPath = path.join(path.dirname(filePath), `print_script_${Date.now()}.ps1`).trim();

      // Create a script that prioritizes SILENT printing methods to avoid interactive dialogs
      const scriptContent = `
# Silent print image script - avoiding interactive dialogs
$filePath = "${filePath.replace(/\\/g, '\\\\').trim()}";
$printerName = "${printerName.trim()}";
$isColor = $${isColor};
$orientation = '${orientation}';

Write-Host "===== SILENT PRINT JOB STARTED =====";
Write-Host "File: $filePath";
Write-Host "Printer: $printerName";
Write-Host "Color: $isColor";
Write-Host "Orientation: $orientation";

# Load required assemblies
Add-Type -AssemblyName System.Drawing;
Add-Type -AssemblyName System.Windows.Forms;

try {
    # Create PrintDocument
    $printDoc = New-Object System.Drawing.Printing.PrintDocument;
    $printDoc.PrinterSettings.PrinterName = $printerName;
    
    # Load the image
    $image = [System.Drawing.Image]::FromFile($filePath);
    
    # Set up print settings
    $printDoc.DefaultPageSettings.Color = $isColor;
    $printDoc.DefaultPageSettings.Landscape = $orientation -eq 'landscape';
    
    Write-Host "Original image dimensions: $($image.Width) x $($image.Height)";
    Write-Host "Page settings - Landscape: $($printDoc.DefaultPageSettings.Landscape)";
    Write-Host "Page bounds: $($printDoc.DefaultPageSettings.Bounds)";
    
    # Create the print handler
    $printDoc.add_PrintPage({
        param($sender, $e)
        
        $bounds = $e.PageBounds;
        Write-Host "Print page bounds: $($bounds.Width) x $($bounds.Height)";
        
        # Calculate scaling while maintaining aspect ratio
        $imageRatio = $image.Width / $image.Height;
        $pageRatio = $bounds.Width / $bounds.Height;
        
        $finalWidth = $bounds.Width;
        $finalHeight = $bounds.Height;
        
        if ($imageRatio > $pageRatio) {
            # Image is wider than page ratio
            $finalHeight = $bounds.Width / $imageRatio;
        } else {
            # Image is taller than page ratio
            $finalWidth = $bounds.Height * $imageRatio;
        }
        
        # Center the image
        $x = ($bounds.Width - $finalWidth) / 2;
        $y = ($bounds.Height - $finalHeight) / 2;
        
        Write-Host "Drawing image at: $x, $y with dimensions: $finalWidth x $finalHeight";
        
        # Create destination rectangle
        $destRect = New-Object System.Drawing.RectangleF($x, $y, $finalWidth, $finalHeight);
        
        # Draw the image
        $e.Graphics.DrawImage($image, $destRect);
    });
    
    # Print the document
    Write-Host "Sending print command...";
    $printDoc.Print();
    
    # Clean up
    $image.Dispose();
    $printDoc.Dispose();
    
    Write-Host "Print command sent successfully";
} catch {
    Write-Error "Printing failed: $_";
    throw;
} finally {
    if ($image) { $image.Dispose(); }
    if ($printDoc) { $printDoc.Dispose(); }
}
`;

      // Write script to temporary file
      fs.writeFileSync(tempScriptPath, scriptContent);
      console.log(`Created silent printing script at: ${tempScriptPath}`);

      // Execute the script file instead of passing everything on command line
      const command = `powershell.exe -ExecutionPolicy Bypass -File "${tempScriptPath}"`;
      console.log(`Executing command: ${command}`);

      const { stdout, stderr } = await execPromise(command);
      console.log(`Print script output: ${stdout}`);

      // Clean up the temp file
      try {
        fs.unlinkSync(tempScriptPath);
      } catch (e) {
        console.warn(`Failed to clean up temp script: ${e.message}`);
      }

      if (stderr && stderr.length > 0) {
        console.warn(`Print script warnings: ${stderr}`);
      }

      // Check if any of the methods reported success
      if (stdout.includes("successfully") || stdout.includes("completed with code: 0") ||
        stdout.includes("Print job found in queue")) {
        return stdout;
      } else {
        console.warn("No print methods reported explicit success. Print may have failed silently.");
        throw new Error("Printing command completed but print job may not have started. Check printer connection and queue.");
      }
    } catch (error) {
      console.error('Error in printImageFile:', error);
      throw error;
    }
  } else if (platform === 'darwin') {
    // macOS printing using lp
    const colorOption = isColor ? '' : ' -o ColorModel=Gray';
    const command = `lp -d "${printerName.trim()}"${colorOption} "${filePath.trim()}"`;

    try {
      const { stdout, stderr } = await execPromise(command);
      if (stderr) {
        console.warn('Warning during image print operation:', stderr);
      }
      return stdout;
    } catch (error) {
      console.error('Error printing image file:', error);
      throw error;
    }
  } else {
    // Linux/Unix printing using lp
    const colorOption = isColor ? '' : ' -o ColorModel=Gray';
    const command = `lp -d "${printerName.trim()}"${colorOption} "${filePath.trim()}"`;

    try {
      const { stdout, stderr } = await execPromise(command);
      if (stderr) {
        console.warn('Warning during image print operation:', stderr);
      }
      return stdout;
    } catch (error) {
      console.error('Error printing image file:', error);
      throw error;
    }
  }
};

/**
 * Download a file from a URL to a local file path
 * @param {string} url - The URL of the file to download
 * @param {string} outputPath - The local path to save the file to
 * @returns {Promise<void>} - A promise that resolves when the download is complete
 */
const downloadFile = async (url, outputPath) => {
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });

    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } catch (error) {
    console.error(`Error downloading file from ${url}:`, error.message);
    throw error;
  }
};

// Function to update print job progress in Firebase
const updatePrintJobProgress = async (jobId, progress, status = "", statusMessage = "") => {
  if (!jobId) {
    console.log("No jobId provided for progress update");
    return;
  }

  try {
    // Check if job exists first
    const jobSnapshot = await get(dbRef(db, `printJobs/${jobId}`));
    if (!jobSnapshot.exists()) {
      console.log(`Job ${jobId} not found in database, can't update progress`);
      return;
    }
    
    const currentJob = jobSnapshot.val();
    
    // Don't revert completed jobs back to a lower progress or non-completed status
    if (currentJob.status === "completed" && 
        (progress < 100 || (status && status !== "completed"))) {
      console.log(`Job ${jobId} is already completed, ignoring update to ${progress}%`);
      return;
    }
    
    // Check if we're trying to update a job that is already completed
    if (completedPrintJobs.has(jobId) && progress < 100) {
      console.log(`Skipping update for already completed job ${jobId} (progress: ${progress}%)`);
      return;
    }
    
    const updateData = {
      progress: progress,
      updatedAt: Date.now(),
    };
    
    if (status) {
      updateData.status = status;
    }
    
    if (statusMessage) {
      updateData.statusMessage = statusMessage;
    }
    
    // If job is being marked as complete
    if (progress >= 100 || status === "completed") {
      // Update tracking sets
      completedPrintJobs.add(jobId);
      recentPrintJobs.set(`completed-${jobId}`, Date.now());
      
      // Ensure completion data is set
      updateData.progress = 100;
      updateData.status = "completed";
      updateData.statusMessage = statusMessage || "Print job completed successfully";
      updateData.completedAt = Date.now();

      // Prepare job data for completedPrints
      const jobData = {
        ...currentJob,
        ...updateData
      };

      // Update color analysis if printed in black and white
      if (jobData.isColor === false) {
        const totalPages = jobData.totalPages || 1;
        jobData.colorAnalysis = {
          hasColoredPages: false,
          coloredPageCount: 0,
          blackAndWhitePageCount: totalPages,
          coloredPages: [],
          blackAndWhitePages: Array.from({ length: totalPages }, (_, i) => i + 1)
        };
      }

      try {
        // First update the printJobs node
        await update(dbRef(db, `printJobs/${jobId}`), updateData);
        
        // Then add to completedPrints node
        await update(dbRef(db, `completedPrints/${jobId}`), jobData);
        
        console.log(`Successfully updated job ${jobId} and added to completedPrints`);
      } catch (error) {
        console.error(`Error updating completion status for job ${jobId}:`, error);
        throw error; // Re-throw to be caught by outer try-catch
      }
    } else {
      // Just update progress if not completing
      await update(dbRef(db, `printJobs/${jobId}`), updateData);
    }
    
    console.log(`Updated job ${jobId} progress to ${progress}%${status ? `, status: ${status}` : ''}`);
    
    // Also send update to the API endpoint for potential future use
    try {
      await axios.post('http://localhost:5000/api/update-print-job', {
        printJobId: jobId,
        progress,
        status,
        statusMessage
      });
    } catch (apiError) {
      // Silently fail on API error since we already updated Firebase directly
      console.warn("Failed to update via API endpoint:", apiError.message);
    }
  } catch (error) {
    console.error("Error updating print job progress:", error);
  }
};

/**
 * Base handler for printing files
 */
const basePrintFileHandler = async (req, res) => {
  let filePath = '';
  let processedFilePath = '';

  try {
    const {
      fileName,
      printerName,
      fileUrl,
      isColor,
      
      
      orientation,
      selectedSize,
      customWidth,
      customHeight,
      copies,
      duplex,
      paperSource,
      quality,
      price,
      contentType,
      printMethod,
      hasColorContent,
      colorPageCount,
      printJobId
    } = req.body;

    console.log("Received print request:", JSON.stringify(req.body, null, 2));

    // Update status in Firebase if printJobId is provided
    if (printJobId) {
      try {
        await updatePrintJobProgress(printJobId, 10, "processing", "Preparing print job...");
        await new Promise(resolve => setTimeout(resolve, 500));
        await updatePrintJobProgress(printJobId, 20, "processing", "Initializing printer...");
        await new Promise(resolve => setTimeout(resolve, 500));
        await updatePrintJobProgress(printJobId, 30, "processing", "Sending to printer...");
      } catch (updateError) {
        console.warn(`Could not update print job status in Firebase: ${updateError.message}`);
      }
    }

    // Basic validation
    if (!printerName || !fileUrl) {
      return res.status(400).json({
        status: 'error',
        error: 'Missing printerName or fileUrl in request body.',
      });
    }

    // Validate printer exists
    const printers = await getPrintersFromPowerShell();
    if (!printers.includes(printerName)) {
      console.error(`Printer not found: "${printerName}".Available printers: ${printers.join(', ')} `);
      return res.status(404).json({
        status: 'error',
        error: `Printer "${printerName}" not found.Available printers: ${printers.join(', ')} `,
      });
    }

    // Ensure documents directory exists
    const documentsDir = path.join(__dirname, 'documents');
    if (!fs.existsSync(documentsDir)) {
      fs.mkdirSync(documentsDir, { recursive: true });
    }

    // Determine file extension from fileName or fileType parameter
    let fileExtension = 'pdf'; // Default extension

    // If fileType is explicitly provided in the request, use that
    if (req.body.fileType) {
      fileExtension = req.body.fileType.toLowerCase();
      console.log(`Using explicitly provided file type: ${fileExtension}`);
    } else if (fileName) {
      const lastDotIndex = fileName.lastIndexOf('.');
      if (lastDotIndex !== -1) {
        fileExtension = fileName.substring(lastDotIndex + 1).toLowerCase();
      }
    }

    console.log(`File type detected: ${fileExtension}`);

    // Download file from URL - FIXED: Removed trailing space in filename
    const downloadedFileName = `${uuidv4()}.${fileExtension}`;
    filePath = path.join(documentsDir, downloadedFileName).trim(); // Ensure no trailing spaces in file path

    try {
      console.log("Downloading file from URL:", fileUrl);

      // Add retry logic for downloading the file
      let retryCount = 0;
      const maxRetries = 2;
      let downloadSuccess = false;
      let lastError = null;

      while (retryCount <= maxRetries && !downloadSuccess) {
        try {
          const response = await axios.get(fileUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });

          fs.writeFileSync(filePath, response.data);
          console.log("File downloaded successfully to:", filePath);
          downloadSuccess = true;
        } catch (downloadAttemptError) {
          lastError = downloadAttemptError;
          console.warn(`Download attempt ${retryCount + 1} failed:`, downloadAttemptError.message);

          // If this is a Firebase Storage URL and we got a 400/403 error (token expired)
          if (fileUrl.includes('firebasestorage.googleapis.com') &&
            (downloadAttemptError.response?.status === 400 ||
              downloadAttemptError.response?.status === 403 ||
              downloadAttemptError.response?.status === 401)) {
            console.log("Firebase token likely expired. Requesting client to refresh URL.");

            // If we have a print job ID, update status
            if (printJobId) {
              try {
                await updatePrintJobProgress(printJobId, 5, "error", "Firebase token expired. Please try again.");
                await update(dbRef(db, `files/${printJobId}`), {
                  status: "Error",
                  printStatus: "URL token expired. Please refresh and try again."
                });
              } catch (updateError) {
                console.warn(`Could not update print job status in Firebase: ${updateError.message}`);
              }
            }

            // Return token expired error immediately - no need to retry further
            return res.status(401).json({
              status: 'error',
              error: 'Firebase Storage token expired. Please refresh the page and try again.',
              details: {
                tokenExpired: true,
                originalError: downloadAttemptError.message
              }
            });
          }

          // Add a small delay before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
          retryCount++;
        }
      }

      // If all attempts failed, throw the last error
      if (!downloadSuccess) {
        throw lastError || new Error("Failed to download file after multiple attempts");
      }

      // Verify file exists and is readable
      if (!fs.existsSync(filePath)) {
        // Try trimming any potential spaces
        const trimmedPath = filePath.trim();
        if (fs.existsSync(trimmedPath)) {
          console.log(`File found at trimmed path: ${trimmedPath}`);
          filePath = trimmedPath;
        } else {
          console.error(`Critical error: Downloaded file not found at: ${filePath}`);
          return res.status(500).json({
            status: 'error',
            error: `File was downloaded but could not be found on disk. This might be a path encoding issue.`
          });
        }
      }
    } catch (downloadError) {
      console.error("Error downloading file:", downloadError.message);

      // If we have a print job ID, update status
      if (printJobId) {
        try {
          await updatePrintJobProgress(printJobId, 5, "error", `Download failed: ${downloadError.message}`);
          await update(dbRef(db, `files/${printJobId}`), {
            status: "Error",
            printStatus: "Failed to download file. Please try again."
          });
        } catch (updateError) {
          console.warn(`Could not update print job status in Firebase: ${updateError.message}`);
        }
      }

      return res.status(400).json({
        status: 'error',
        error: `Failed to download file from URL: ${downloadError.message}`
      });
    }

    // Process PDF if needed - only if the file is actually a PDF
    if (fileExtension === 'pdf' && (selectedPageOption || orientation || selectedSize)) {
      console.log("Processing PDF with options:", {  orientation, selectedSize });

      try {
        const pdfOptions = {
          pageOption: selectedPageOption || "All",
          customPageRange: customPageRange || "",
          orientation: orientation || "Portrait",
          selectedSize: selectedSize || "",
          customWidth: customWidth || 0,
          customHeight: customHeight || 0
        };

        const processedBytes = await processPdf(filePath, pdfOptions);

        // Save the processed PDF to a new file - FIXED: Removed trailing space in processed filename
        const processedFileName = `processed_${downloadedFileName}`;
        processedFilePath = path.join(documentsDir, processedFileName).trim(); // Ensure no trailing spaces
        fs.writeFileSync(processedFilePath, processedBytes);

        console.log("PDF processed successfully and saved to:", processedFilePath);

        // Update the file path to use the processed file
        filePath = processedFilePath;
      } catch (pdfError) {
        console.error("Error processing PDF:", pdfError.message);
        return res.status(500).json({
          status: 'error',
          error: `Failed to process PDF: ${pdfError.message}`
        });
      }
    }

    // Determine if this is an image file - define this variable early so it's available throughout the function
    const isImageFile = ['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(fileExtension.toLowerCase());
    console.log(`File is${isImageFile ? '' : ' not'} an image file`);

    try {
      const numCopies = copies && copies > 0 ? parseInt(copies) : 1;
      const printOptions = {
        duplex,
        paperSource,
        quality,
        hasColorContent,
        colorPageCount
      };

      // Update status in Firebase if printJobId is provided
      if (printJobId) {
        try {
          await updatePrintJobProgress(printJobId, 30, "processing", "Sending to printer");
        } catch (updateError) {
          console.warn(`Could not update print job status in Firebase: ${updateError.message}`);
        }
      }

      // Print the file for the specified number of copies
      const printPromises = [];
      for (let i = 0; i < numCopies; i++) {
        console.log(`Printing copy ${i + 1} of ${numCopies} `);

        // Update progress for each copy
        if (printJobId) {
          await updatePrintJobProgress(printJobId, 40 + (i * 15), "printing", `Printing copy ${i + 1} of ${numCopies}...`);
        }

        // Log color information for debugging
        if (hasColorContent) {
          console.log(`Document contains color content (${colorPageCount || 'unknown'} colored pages detected)`);
        }

        // Choose appropriate printing method based on file type or explicit request
        const useDirectImagePrinting = isImageFile || printMethod === 'direct';

        if (useDirectImagePrinting) {
          console.log(`Using specialized image printing for ${filePath}`);
          printPromises.push(printImageFile(filePath, printerName, isColor, orientation));
        } else {
          // Use the OS native printing commands for other file types
          printPromises.push(printFileWithOSCommands(filePath, printerName, isColor, printOptions));
        }
      }

      await Promise.all(printPromises);
      console.log(`Successfully printed ${numCopies} copies`);

      // Update status to indicate completion
      if (printJobId) {
        await updatePrintJobProgress(printJobId, 90, "printing", "Finishing print job...");
      }

      // Collect diagnostic info after printing completes 
      let diagnosticInfo = {};

      // We need to use os directly here
      try {
        if (os.platform() === 'win32') {
          // Get printer status
          try {
            const { stdout: printerStatus } = await execPromise(`powershell.exe -Command "Get-Printer -Name '${printerName}' | ConvertTo-Json -Depth 1"`);
            if (printerStatus && printerStatus.trim()) {
              try {
                diagnosticInfo.printer = JSON.parse(printerStatus);
              } catch (jsonError) {
                diagnosticInfo.printerRaw = printerStatus;
                diagnosticInfo.printerJsonError = jsonError.message;
              }
            }
          } catch (e) {
            diagnosticInfo.printerError = e.message;
          }

          // Get print jobs
          try {
            const { stdout: jobsOutput } = await execPromise(`powershell.exe -Command "Get-PrintJob -PrinterName '${printerName}' | Select-Object JobId,DocumentName,JobStatus,Pages,Size | ConvertTo-Json -Depth 1"`);
            if (jobsOutput && jobsOutput.trim() !== '') {
              try {
                // Handle both array and single object responses
                if (jobsOutput.trim().startsWith('[')) {
                  diagnosticInfo.jobs = JSON.parse(jobsOutput || '[]');
                } else {
                  // If it's a single object, wrap it in an array
                  diagnosticInfo.jobs = [JSON.parse(jobsOutput)];
                }
              } catch (jsonError) {
                diagnosticInfo.jobsRaw = jobsOutput;
                diagnosticInfo.jobsJsonError = jsonError.message;
              }
            } else {
              diagnosticInfo.jobs = [];
            }
          } catch (e) {
            diagnosticInfo.jobsError = e.message;
          }

          // Get spooler status
          try {
            const { stdout: spoolerStatus } = await execPromise(`powershell.exe -Command "Get-Service -Name Spooler | Select-Object Status | ConvertTo-Json"`);
            if (spoolerStatus && spoolerStatus.trim()) {
              try {
                diagnosticInfo.spooler = JSON.parse(spoolerStatus);
              } catch (jsonError) {
                diagnosticInfo.spoolerRaw = spoolerStatus;
                diagnosticInfo.spoolerJsonError = jsonError.message;
              }
            }
          } catch (e) {
            diagnosticInfo.spoolerError = e.message;
          }
        }
      } catch (diagError) {
        console.warn('Error collecting diagnostic info:', diagError.message);
        diagnosticInfo.error = diagError.message;
      }

      // Update status in Firebase if printJobId is provided
      if (printJobId) {
        try {
          await updatePrintJobProgress(printJobId, 100, "completed", "Print job completed successfully");
        } catch (updateError) {
          console.warn(`Could not update final print job status in Firebase: ${updateError.message}`);
        }
      }

      return res.json({
        status: 'success',
        message: 'Print job sent successfully.',
        success: true,
        details: {
          printer: printerName,
          file: fileName,
          copies: numCopies,
          usedDirectPrinting: isImageFile || printMethod === 'direct',
          colorInfo: {
            isColor,
            hasColorContent: !!hasColorContent,
            colorPageCount: colorPageCount || 0
          },
          diagnostic: diagnosticInfo
        }
      });
    } catch (printError) {
      console.error('Error printing file:', printError.message);
      return res.status(500).json({
        status: 'error',
        error: `Failed to print file: ${printError.message}`
      });
    }
  } catch (error) {
    console.error('Error during print operation:', error);
    return res.status(500).json({ status: 'error', error: error.message });
  } finally {
    // Clean up temporary files
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.warn('Warning: Could not delete temporary file:', e.message);
      }
    }
    if (processedFilePath && fs.existsSync(processedFilePath)) {
      try {
        fs.unlinkSync(processedFilePath);
      } catch (e) {
        console.warn('Warning: Could not delete processed file:', e.message);
      }
    }
  }
};

/**
 * Enhanced print file handler with Word document support
 */
const enhancedPrintFileHandler = async (req, res) => {
  console.log("=== USING ENHANCED PRINT FILE HANDLER FOR WORD DOCUMENTS ===");
  
  let filePath = '';
  let processedFilePath = '';
  let wordPrintError = null;

  try {
    const {
      fileName,
      printerName,
      fileUrl,
      isColor,
      
      
      orientation,
      selectedSize,
      customWidth,
      customHeight,
      copies,
      duplex,
      paperSource,
      quality,
      price
    } = req.body;

    console.log("Received print request:", JSON.stringify(req.body, null, 2));

    // Basic validation
    if (!printerName || !fileUrl) {
      return res.status(400).json({
        status: 'error',
        error: 'Missing printerName or fileUrl in request body.',
      });
    }

    // Validate printer exists
    const printers = await getPrintersFromPowerShell();
    if (!printers.includes(printerName)) {
      console.error(`Printer not found: "${printerName}".Available printers: ${printers.join(', ')}`);
      return res.status(404).json({
        status: 'error',
        error: `Printer "${printerName}" not found.Available printers: ${printers.join(', ')}`,
      });
    }

    // Ensure documents directory exists
    const documentsDir = path.join(__dirname, 'documents');
    if (!fs.existsSync(documentsDir)) {
      fs.mkdirSync(documentsDir, { recursive: true });
    }

    // Determine file extension from fileName or fileType parameter
    let fileExtension = 'pdf'; // Default extension

    // If fileType is explicitly provided in the request, use that
    if (req.body.fileType) {
      fileExtension = req.body.fileType.toLowerCase();
      console.log(`Using explicitly provided file type: ${fileExtension}`);
    } else if (fileName) {
      const lastDotIndex = fileName.lastIndexOf('.');
      if (lastDotIndex !== -1) {
        fileExtension = fileName.substring(lastDotIndex + 1).toLowerCase();
      }
    }

    console.log(`File type detected: ${fileExtension}`);

    // Download file from URL - FIXED: Removed trailing space in filename
    const downloadedFileName = `${uuidv4()}.${fileExtension}`;
    filePath = path.join(documentsDir, downloadedFileName);

    try {
      console.log("Downloading file from URL:", fileUrl);
      const response = await axios.get(fileUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });
      fs.writeFileSync(filePath, response.data);
      console.log("File downloaded successfully");
    } catch (downloadError) {
      console.error("Error downloading file:", downloadError.message);
      return res.status(400).json({
        status: 'error',
        error: `Failed to download file from URL: ${downloadError.message}`
      });
    }

    // Process PDF if needed - only if the file is actually a PDF
    if (fileExtension === 'pdf' && (selectedPageOption || orientation || selectedSize)) {
      console.log("Processing PDF with options:", {  orientation, selectedSize });

      try {
        const pdfOptions = {
          pageOption: selectedPageOption || "All",
          customPageRange: customPageRange || "",
          orientation: orientation || "Portrait",
          selectedSize: selectedSize || "",
          customWidth: customWidth || 0,
          customHeight: customHeight || 0
        };

        const processedBytes = await processPdf(filePath, pdfOptions);

        // Save the processed PDF to a new file - FIXED: Removed trailing space in processed filename
        const processedFileName = `processed_${downloadedFileName}`;
        processedFilePath = path.join(documentsDir, processedFileName);
        fs.writeFileSync(processedFilePath, processedBytes);

        console.log("PDF processed successfully");

        // Update the file path to use the processed file
        filePath = processedFilePath;
      } catch (pdfError) {
        console.error("Error processing PDF:", pdfError.message);
        return res.status(500).json({
          status: 'error',
          error: `Failed to process PDF: ${pdfError.message}`
        });
      }
    }

    // If it's a Word document, try our enhanced printing approach
    if (['doc', 'docx'].includes(fileExtension)) {
      const printResults = [];
      const numCopies = copies && copies > 0 ? parseInt(copies) : 1;

      // First try using the printWordDocument function
      try {
        console.log("Trying specialized Word printing function first...");
        for (let i = 0; i < numCopies; i++) {
          console.log(`Printing Word document copy ${i + 1} of ${numCopies} `);
          const result = await printWordDocument(filePath, printerName, isColor, selectedSize, orientation);
          printResults.push({ copy: i + 1, result, method: "COM" });
        }

        // If we got here, printing succeeded with the first method
        console.log("Word printing succeeded using COM object method");

        // Clean up files
        if (filePath && fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (e) {
            console.warn("Warning: Could not delete file:", e.message);
          }
        }

        return res.json({
          status: 'success',
          message: 'Print job sent successfully.',
          success: true,
          details: {
            printer: printerName,
            file: fileName,
            fileType: fileExtension,
            copies: numCopies,
            results: printResults
          }
        });
      } catch (err) {
        // Store the error but continue to try alternate methods
        wordPrintError = err;
        console.warn("First printing method failed, trying alternative method...", err.message);
      }

      // If the first method failed, try the direct VBS approach
      try {
        console.log("Using VBS direct printing fallback method...");
        for (let i = 0; i < numCopies; i++) {
          console.log(`Printing Word document copy ${i + 1} of ${numCopies} using VBS method`);
          const result = await printWindowsDirectWithDll(filePath, printerName);
          printResults.push({ copy: i + 1, result, method: "VBS" });
        }

        // If we got here, printing succeeded with the fallback method
        console.log("Word printing succeeded using VBS method");

        // Clean up files
        if (filePath && fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (e) {
            console.warn("Warning: Could not delete file:", e.message);
          }
        }

        return res.json({
          status: 'success',
          message: 'Print job sent successfully using alternative method.',
          success: true,
          details: {
            printer: printerName,
            file: fileName,
            fileType: fileExtension,
            copies: numCopies,
            results: printResults,
            note: "Used fallback printing method (VBS)"
          }
        });
      } catch (vbsError) {
        console.error("Both printing methods failed:", vbsError);

        // If we have the first error, include it in the response
        if (wordPrintError) {
          return res.status(500).json({
            status: 'error',
            error: `Failed to print Word document with multiple methods. 
                    COM error: ${wordPrintError.message} 
                    VBS error: ${vbsError.message} `,
            details: {
              comError: wordPrintError.stack,
              vbsError: vbsError.stack
            }
          });
        } else {
          return res.status(500).json({
            status: 'error',
            error: `Failed to print Word document: ${vbsError.message} `,
            details: vbsError.stack
          });
        }
      }
    } else {
      // For non-Word documents, use the original handler logic
      // Clean up first to avoid any conflicts
      if (filePath && fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
      }
      if (processedFilePath && fs.existsSync(processedFilePath)) {
        try { fs.unlinkSync(processedFilePath); } catch (e) { /* ignore */ }
      }

      // DO NOT call basePrintFileHandler to avoid double printing
      // Instead return an error message that this handler only supports Word documents
      return res.status(400).json({
        status: 'error',
        error: 'This specialized handler only supports Word documents. Use the main print endpoint directly.'
      });
    }
  } catch (error) {
    // Clean up any temporary files in case of error
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) { /* ignore cleanup errors */ }
    }
    if (processedFilePath && fs.existsSync(processedFilePath)) {
      try { fs.unlinkSync(processedFilePath); } catch (e) { /* ignore cleanup errors */ }
    }
    console.error('Error during print operation:', error);
    return res.status(500).json({ status: 'error', error: error.message });
  }
};

// Export the enhanced version as the main printFileHandler
export const printFileHandler = async (req, res) => {
  const printJobId = req.body.printJobId || req.body.jobId || Date.now().toString();
  
  if (completedPrintJobs.has(printJobId)) {
    console.log(`Job ${printJobId} has already completed, returning success without reprocessing`);
    return res.json({
      status: 'success',
      message: 'Print job already completed',
      details: {
        isCompleted: true,
        jobId: printJobId
      }
    });
  }
  
  await updatePrintJobProgress(printJobId, 0, "pending", "Starting print job...");

  try {
    const fileName = req.body.fileName || (req.file ? req.file.originalname : 'unknown');
    
    if (trackPrintJob(printJobId, fileName)) {
      console.log(`Detected duplicate print job for "${fileName}" with ID ${printJobId}`);
      return res.json({
        status: 'success',
        message: 'Print job already in progress',
        details: {
          isDuplicate: true,
          originalJobId: printJobId
        }
      });
    }

    // Extract request parameters
    const { 
      printerName, 
      copies = 1, 
      selectedSize = 'Short Bond',
      orientation = 'portrait',
      isColor = true, 
      totalPages: requestedTotalPages = 1,
      fileUrl
    } = req.body;

    if (!fileUrl && !req.file) {
      throw new Error('No file provided for printing');
    }

    if (!printerName) {
      throw new Error('Printer name is required');
    }

    const requestFileType = req.body.fileType ? req.body.fileType.toLowerCase() : '';

    await updatePrintJobProgress(printJobId, 10, "processing", "Preparing document...");

    // Download and process file
    let filePath;
    let actualTotalPages = requestedTotalPages;

    if (req.file) {
      filePath = req.file.path;
      await updatePrintJobProgress(printJobId, 20, "processing", "Processing uploaded file...");
    } else if (fileUrl) {
      await updatePrintJobProgress(printJobId, 20, "processing", "Downloading file...");
      
      const tempDir = path.join(__dirname, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const uniqueId = uuidv4();
      filePath = path.join(tempDir, `${uniqueId}_${fileName || path.basename(fileUrl)}`);
      
      try {
        await downloadFile(fileUrl, filePath);
        await updatePrintJobProgress(printJobId, 40, "processing", "File downloaded successfully");
      } catch (downloadError) {
        console.error('Error downloading file:', downloadError);
        throw new Error(`Failed to download file: ${downloadError.message}`);
      }
    } else {
      throw new Error('Invalid file source');
    }

    // Get file extension and content type
    const fileExt = path.extname(filePath).toLowerCase();
    const contentType = req.body.contentType || '';

    // Determine actual page count for PDFs
    if (fileExt === '.pdf' || requestFileType === 'pdf' || contentType === 'application/pdf') {
      try {
        const pdfBytes = fs.readFileSync(filePath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        actualTotalPages = pdfDoc.getPageCount();
        console.log(`Detected ${actualTotalPages} pages in PDF document`);
        
        // Update the print job with actual page count
        await update(dbRef(db, `printJobs/${printJobId}`), {
          totalPages: actualTotalPages
        });
      } catch (pdfError) {
        console.warn('Could not determine PDF page count:', pdfError);
      }
    }

    // Print options with actual page count
    const printOptions = {
      copies: parseInt(copies) || 1,
      selectedSize,
      orientation,
      totalPages: actualTotalPages
    };

    // Process the file based on its type
    await updatePrintJobProgress(printJobId, 50, "processing", "Processing file for printing...");

    let printResult;
    if (fileExt === '.pdf' || requestFileType === 'pdf' || contentType === 'application/pdf') {
      await updatePrintJobProgress(printJobId, 60, "processing", "Sending PDF to printer...");
      printResult = await printPdfDirect(filePath, printerName, isColor);
    } else if (['.doc', '.docx'].includes(fileExt) || requestFileType === 'doc' || requestFileType === 'docx' || 
               contentType.includes('word') || contentType.includes('officedocument')) {
      await updatePrintJobProgress(printJobId, 60, "processing", "Processing Word document...");
      printResult = await printWordDocument(filePath, printerName, isColor, selectedSize, orientation);
    } else if (['.jpg', '.jpeg', '.png'].includes(fileExt) || 
               requestFileType === 'jpg' || requestFileType === 'jpeg' || requestFileType === 'png' || 
               contentType.includes('image/')) {
      await updatePrintJobProgress(printJobId, 60, "processing", "Processing image...");
      printResult = await printImageFile(filePath, printerName, isColor, orientation);
    } else {
      throw new Error('Unsupported file type');
    }

    await updatePrintJobProgress(printJobId, 75, "printing", "Printing in progress...");

    // Start an asynchronous progress update without blocking the response
    (async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await updatePrintJobProgress(printJobId, 95, "printing", "Finishing print job...");
        
        try {
          fs.unlinkSync(filePath);
        } catch (cleanupError) {
          console.error('Error cleaning up temp file:', cleanupError);
        }

        const jobSnapshot = await get(dbRef(db, `printJobs/${printJobId}`));
        if (!jobSnapshot.exists()) {
          console.error(`Print job ${printJobId} not found for completion`);
          return;
        }

        const jobData = jobSnapshot.val();
        
        // Prepare completion data with actual page count
        const completionData = {
          ...jobData,
          progress: 100,
          status: "completed",
          statusMessage: "Print job completed successfully",
          completedAt: Date.now(),
          totalPages: actualTotalPages, // Ensure actual page count is used
          isColor: isColor // Make sure we store the print mode that was used
        };

        // Update color analysis - if printed in black and white, ALL pages are black and white
        if (!isColor) {
          completionData.colorAnalysis = {
            hasColoredPages: false,
            coloredPageCount: 0,
            blackAndWhitePageCount: actualTotalPages,
            coloredPages: [],
            blackAndWhitePages: Array.from({ length: actualTotalPages }, (_, i) => i + 1)
          };
        }

        // First update printJobs
        await update(dbRef(db, `printJobs/${printJobId}`), completionData);
        
        // Then add to completedPrints
        await update(dbRef(db, `completedPrints/${printJobId}`), completionData);
        
        // Update tracking sets
        completedPrintJobs.add(printJobId);
        recentPrintJobs.set(`completed-${printJobId}`, Date.now());
        
        console.log(`Successfully completed print job ${printJobId} and added to completedPrints`);
      } catch (progressError) {
        console.error('Error updating final print status:', progressError);
      }
    })();

    // Return success immediately
    return res.json({
      status: 'success',
      message: 'Print job started successfully',
      printJobId: printJobId,
      details: {
        actualPages: actualTotalPages
      }
    });

  } catch (error) {
    console.error('Print error:', error);

    if (printJobId) {
      await updatePrintJobProgress(printJobId, 75, "error", `Error: ${error.message || "Failed to print document"}`);
    }

    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to print document'
    });
  }
};

/**
 * Get detailed information about a specific printer
 * @param {string} printerName - Name of the printer to get details for
 * @returns {Promise<Object>} - Printer capabilities and properties
 */
export const getPrinterCapabilities = async (printerName) => {
  const platform = os.platform();

  try {
    // First, verify the printer exists
    const printers = await getPrintersFromPowerShell();
    if (!printers.includes(printerName)) {
      throw new Error(`Printer "${printerName}" not found`);
    }

    // For Windows, use a simpler approach with less PowerShell complexity
    if (platform === 'win32') {
      // Return generic capabilities that will work for most printers
      // We're avoiding the complex PowerShell command that's causing issues
      return {
        name: printerName,
        capabilities: {
          supportsColor: true,
          supportsDuplex: true,
          defaultOrientation: 'Portrait',
          paperSizes: [
            "Letter 8.5 x 11",
            "A4 8.3 x 11.7",
            "Legal 8.5 x 14"
          ],
          status: "Ready"
        }
      };
    }

    // For macOS and Linux
    else if (platform === 'darwin' || platform === 'linux') {
      try {
        const command = `lpstat - l - p "${printerName}" && lpoptions - p "${printerName}" - l`;
        const { stdout } = await execPromise(command);

        const capabilities = {
          name: printerName,
          capabilities: {
            supportsColor: stdout.includes('ColorModel') || stdout.includes('Color'),
            supportsDuplex: stdout.includes('Duplex') || stdout.includes('sides'),
            defaultOrientation: 'Portrait',
            paperSizes: []
          }
        };

        const paperSizeMatch = stdout.match(/PageSize.+:.+/);
        if (paperSizeMatch) {
          capabilities.capabilities.paperSizes = paperSizeMatch[0]
            .split(':')[1]
            .trim()
            .split(/\s+/);
        }

        return capabilities;
      } catch (error) {
        console.error(`Error getting printer capabilities for ${printerName}: `, error);
        return {
          name: printerName,
          capabilities: {
            supportsColor: true,
            supportsDuplex: false,
            defaultOrientation: 'Portrait',
            paperSizes: ["Letter", "A4"]
          }
        };
      }
    }

    // Unsupported platforms
    else {
      throw new Error(`Unsupported platform: ${platform} `);
    }
  } catch (error) {
    console.error('Error getting printer capabilities:', error);

    // Return a fallback response even if there's an error
    return {
      name: printerName,
      capabilities: {
        supportsColor: true,
        supportsDuplex: false,
        defaultOrientation: 'Portrait',
        paperSizes: ["Letter", "A4"]
      },
      error: error.message
    };
  }
};

/**
 * HTTP handler for getting printer capabilities
 */
export const getPrinterCapabilitiesHandler = async (req, res) => {
  try {
    const { printerName } = req.params;
    if (!printerName) {
      return res.status(400).json({
        status: 'error',
        error: 'Printer name is required',
      });
    }

    const capabilities = await getPrinterCapabilities(printerName);
    return res.json({
      status: 'success',
      capabilities,
    });
  } catch (error) {
    console.error('Error getting printer capabilities:', error);
    return res.status(500).json({
      status: 'error',
      error: error.message,
    });
  }
};

/**
 * Test printer connectivity and functionality
 * @param {string} printerName - Name of the printer to test
 * @returns {Promise<Object>} - Test results with status and details
 */
export const testPrinterConnectivity = async (printerName) => {
  const platform = os.platform();
  let testResults = {
    printer: printerName,
    platform,
    timestamp: new Date().toISOString(),
    status: 'unknown',
    tests: {},
    details: []
  };

  try {
    // Step 1: Check if printer exists
    testResults.tests.printerExists = false;
    const printers = await getPrintersFromPowerShell();
    if (printers.includes(printerName)) {
      testResults.tests.printerExists = true;
      testResults.details.push(`Printer "${printerName}" found in system printers list`);
    } else {
      testResults.details.push(`Printer "${printerName}" NOT found in system printers list.Available printers: ${printers.join(', ')} `);
      testResults.status = 'error';
      return testResults;
    }

    // Step 2: Check printer status (Windows only)
    if (platform === 'win32') {
      try {
        const command = `powershell.exe - Command "Get-Printer -Name '${printerName}' | Select-Object Name, PrinterStatus | ConvertTo-Json"`;
        const { stdout } = await execPromise(command);
        const printerInfo = JSON.parse(stdout);
        testResults.tests.printerStatus = printerInfo.PrinterStatus;

        // Map status codes to readable values (3 is "Ready")
        const statusMap = {
          1: "Other", 2: "Unknown", 3: "Ready", 4: "Printing",
          5: "Warmup", 6: "Stopped", 7: "Offline"
        };

        const statusText = statusMap[printerInfo.PrinterStatus] || `Status code: ${printerInfo.PrinterStatus} `;
        testResults.details.push(`Printer status: ${statusText} `);

        if (printerInfo.PrinterStatus !== 3) { // Not "Ready"
          testResults.details.push(`Warning: Printer is not in "Ready" state`);
          if (printerInfo.PrinterStatus === 6 || printerInfo.PrinterStatus === 7) {
            testResults.status = 'error';
            testResults.details.push(`Error: Printer is ${statusText} `);
          }
        }
      } catch (error) {
        testResults.details.push(`Could not check printer status: ${error.message} `);
      }
    }

    // Step 3: Check spooler service (Windows only)
    if (platform === 'win32') {
      try {
        const command = `powershell.exe - Command "Get-Service -Name Spooler | Select-Object Status | ConvertTo-Json"`;
        const { stdout } = await execPromise(command);
        const spoolerStatus = JSON.parse(stdout).Status;

        testResults.tests.spoolerStatus = spoolerStatus;
        testResults.details.push(`Print Spooler service status: ${spoolerStatus} `);

        if (spoolerStatus !== "Running") {
          testResults.status = 'error';
          testResults.details.push(`Error: Print Spooler service is not running`);
        }
      } catch (error) {
        testResults.details.push(`Could not check spooler service: ${error.message} `);
      }
    }

    // Step 4: Try printing a test page
    try {
      // Create a simple text file for testing
      const testDir = path.join(__dirname, 'test');
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      const testFilePath = path.join(testDir, 'printer-test.txt');
      fs.writeFileSync(testFilePath, `This is a printer test page.\nTime: ${new Date().toISOString()} \nPrinter: ${printerName} \n`);

      testResults.details.push("Created test file for printing");

      // Print using a simple direct command
      let printCommand;
      if (platform === 'win32') {
        printCommand = `powershell.exe - Command "& {
$printer = '${printerName}';
$wshNetwork = New - Object - ComObject WScript.Network;
$defaultPrinter = $wshNetwork.EnumPrinterConnections() | Select - Object - First 1;
$wshNetwork.SetDefaultPrinter($printer);
          
          # Print test file silently
Start - Process - FilePath '${testFilePath.replace(/\\/g, '\\\\')}' - Verb Print - PassThru |
  ForEach - Object {
  Start - Sleep - Seconds 1;
  $_ | Stop - Process;
}

$wshNetwork.SetDefaultPrinter($defaultPrinter);
Write - Output 'Test print job submitted';
        }"`;
      } else if (platform === 'darwin' || platform === 'linux') {
        printCommand = `lp -d "${printerName}" "${testFilePath}"`;
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }

      const { stdout } = await execPromise(printCommand);
      testResults.tests.testPrintSubmitted = true;
      testResults.details.push(`Test print submitted: ${stdout.trim()}`);

      // Check if job entered print queue
      if (platform === 'win32') {
        try {
          const { stdout: queueOutput } = await execPromise('powershell.exe -Command "Get-PrintJob -PrinterName $printer -ErrorAction SilentlyContinue | Format-Table -AutoSize"');
          testResults.details.push(`Current print queue status:\n${queueOutput}`);
        } catch (queueErr) {
          testResults.details.push(`Warning: Could not check print queue: ${queueErr.message}`);
        }
      }

      // Clean up the test file
      try {
        fs.unlinkSync(testFilePath);
        testResults.details.push("Cleaned up test file");
      } catch (cleanupErr) {
        testResults.details.push(`Warning: Could not delete test file: ${cleanupErr.message}`);
      }

    } catch (printError) {
      testResults.tests.testPrintSubmitted = false;
      testResults.details.push(`Error submitting test print job: ${printError.message}`);
      testResults.status = 'error';
    }

    // Set final status if not already set
    if (testResults.status === 'unknown') {
      if (testResults.tests.testPrintSubmitted && testResults.tests.printerExists) {
        testResults.status = 'success';
        testResults.details.push("All printer connectivity tests passed");
      } else {
        testResults.status = 'warning';
        testResults.details.push("Some printer connectivity tests failed");
      }
    }

    return testResults;
  } catch (error) {
    testResults.status = 'error';
    testResults.details.push(`Error testing printer connectivity: ${error.message}`);
    return testResults;
  }
};

/**
 * HTTP handler for testing printer connectivity
 */
export const testPrinterConnectivityHandler = async (req, res) => {
  try {
    const { printerName } = req.params;
    if (!printerName) {
      return res.status(400).json({
        status: 'error',
        error: 'Printer name is required',
      });
    }

    const testResults = await testPrinterConnectivity(printerName);
    return res.json({
      status: 'success',
      testResults,
    });
  } catch (error) {
    console.error('Error testing printer connectivity:', error);
    return res.status(500).json({
      status: 'error',
      error: error.message,
    });
  }
};

// Track active PDF print jobs to prevent a job from being processed twice
// activePdfPrintJobs is already declared at the top of the file as a Set

// Function to clean up old PDF print script files
const cleanupOldPrintScripts = () => {
  try {
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) return;
    
    const files = fs.readdirSync(tempDir);
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;
    
    // Find script files and log files that are older than one hour
    const oldFiles = files.filter(filename => {
      // Match print script files and log files
      if (!filename.match(/print_script_\d+\.ps1/) && !filename.match(/print_log_\d+\.txt/)) return false;
      
      try {
        const filePath = path.join(tempDir, filename);
        const stats = fs.statSync(filePath);
        return now - stats.mtime.getTime() > ONE_HOUR;
      } catch (err) {
        return false;
      }
    });
    
    // Delete old files
    if (oldFiles.length > 0) {
      console.log(`Cleaning up ${oldFiles.length} old print script and log files`);
      
      oldFiles.forEach(filename => {
        try {
          fs.unlinkSync(path.join(tempDir, filename));
        } catch (err) {
          console.warn(`Could not delete old file ${filename}: ${err.message}`);
        }
      });
    }
  } catch (err) {
    console.error("Error cleaning up print files:", err);
  }
};

// Run cleanup periodically
setInterval(cleanupOldPrintScripts, 15 * 60 * 1000); // Every 15 minutes

export const printPdfDirect = async (filePath, printerName, isColor = true) => {
  try {
    console.log(`Attempting to print file ${filePath} to printer ${printerName}, color: ${isColor ? 'enabled' : 'disabled'}`);

    // Check if file exists and has size
    if (!fs.existsSync(filePath)) {
      throw new Error('File does not exist');
    }

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new Error('File is empty');
    }

    console.log(`File exists and has size ${stats.size} bytes`);

    // Create a timestamp for unique file names
    const timestamp = Date.now();
    const tempDir = path.join(__dirname, 'temp');
    
    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Create PowerShell script for printing
    const scriptPath = path.join(tempDir, `print_script_${timestamp}.ps1`);
    const logPath = path.join(tempDir, `print_log_${timestamp}.txt`);
    const tempPdfPath = path.join(tempDir, `grayscale_${timestamp}.pdf`);

    // Find SumatraPDF executable
    const possiblePaths = [
      'C:\\Users\\63908\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe',
      'C:\\Users\\63908\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\SumatraPDF.exe',
      path.join(process.env.APPDATA || '', 'Microsoft\\Windows\\Start Menu\\SumatraPDF.exe'),
      'C:\\Program Files\\SumatraPDF\\SumatraPDF.exe',
      'C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe',
      path.join(process.env.LOCALAPPDATA || '', 'SumatraPDF\\SumatraPDF.exe'),
      path.join(process.env.PROGRAMFILES || '', 'SumatraPDF\\SumatraPDF.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || '', 'SumatraPDF\\SumatraPDF.exe')
    ];

    let sumatraPath = null;
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        sumatraPath = testPath;
        console.log('Found SumatraPDF at:', testPath);
        break;
      }
    }

    if (!sumatraPath) {
      throw new Error('SumatraPDF not found. Please install SumatraPDF in a standard location.');
    }

    // Create PowerShell script content with proper PowerShell syntax
    const psScript = [
      '$ErrorActionPreference = "Stop"',
      `Start-Transcript -Path "${logPath.replace(/\\/g, '\\\\')}"`,
      'try {',
      `    Write-Host "Starting print job with color mode: ${isColor ? 'Color' : 'Grayscale'}"`,
      '',
      '    # Check for admin rights',
      '    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)',
      '    Write-Host "Running with admin privileges: $isAdmin"',
      '',
      '    # Save current default printer',
      '    $network = New-Object -ComObject WScript.Network',
      '    try {',
      '        $originalPrinter = $network.GetDefaultPrinterName()',
      '        Write-Host "Original default printer: $originalPrinter"',
      '    } catch {',
      '        $originalPrinter = (Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE Default=$true").Name',
      '        Write-Host "Original default printer (WMI fallback): $originalPrinter"',
      '    }',
      '',
      '    # Set target printer as default',
      `    Write-Host "Setting printer: ${printerName}"`,
      `    $network.SetDefaultPrinter('${printerName}')`,
      '',
      `    $pdfToUse = "${filePath.replace(/\\/g, '\\\\')}"`,
      `    $tempPdf = "${tempPdfPath.replace(/\\/g, '\\\\')}"`,
      '',
      `    if (-not ${isColor ? '$true' : '$false'}) {`,
      '        Write-Host "Creating grayscale PDF version if possible"',
      '        ',
      '        # Check if Ghostscript is installed',
      '        $gsPath = "C:\\Program Files\\gs\\gs*\\bin\\gswin64c.exe"',
      '        $gsExe = Get-ChildItem -Path $gsPath -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName',
      '        ',
      '        if ($gsExe) {',
      '            Write-Host "Using Ghostscript to convert PDF to grayscale: $gsExe"',
      '            $gsArgs = @(',
      '                "-sOutputFile=$tempPdf",',
      '                "-sDEVICE=pdfwrite",',
      '                "-sColorConversionStrategy=Gray",',
      '                "-dProcessColorModel=/DeviceGray",',
      '                "-dCompatibilityLevel=1.4",',
      '                "-dNOPAUSE",',
      '                "-dBATCH",',
      '                $pdfToUse',
      '            )',
      '            ',
      '            try {',
      '                & $gsExe $gsArgs',
      '                if (Test-Path $tempPdf) {',
      '                    Write-Host "Grayscale PDF created successfully"',
      '                    # Use the newly created grayscale PDF',
      '                    $pdfToUse = $tempPdf',
      '                } else {',
      '                    Write-Host "Ghostscript did not create output file, falling back to original PDF"',
      '                }',
      '            } catch {',
      '                Write-Host "Ghostscript conversion failed, falling back to original PDF: $_"',
      '            }',
      '        } else {',
      '            Write-Host "Ghostscript not found, using original PDF with SumatraPDF monochrome settings"',
      '        }',
      '    }',
      '',
      '    # Print using SumatraPDF',
      `    $sumatra = "${sumatraPath.replace(/\\/g, '\\\\')}"`,
      '',
      '    # Build arguments array',
      '    $arguments = @()',
      '    $arguments += "-print-to-default"',
      '    $arguments += "-silent"',
      '',
      `    if (-not ${isColor ? '$true' : '$false'}) {`,
      '        Write-Host "Adding monochrome settings to SumatraPDF"',
      '        $arguments += "-monochrome"',
      '    }',
      '',
      '    $arguments += $pdfToUse',
      '',
      '    Write-Host "Executing SumatraPDF with arguments: $($arguments -join \' \')"',
      '',
      '    # Execute SumatraPDF with arguments',
      '    try {',
      '        if (-not $isAdmin) {',
      '            Write-Host "WARNING: Not running as administrator. Printing may fail or require elevation."',
      '        }',
      '        & $sumatra $arguments',
      '        Write-Host "SumatraPDF command executed successfully"',
      '    } catch {',
      '        Write-Error "Error executing SumatraPDF: $_"',
      '        throw',
      '    }',
      '',
      '    # Wait for print job to be processed',
      '    Write-Host "Waiting for print job to process..."',
      '    Start-Sleep -Seconds 5',
      '',
      '    # Check if print job was added to queue',
      '    try {',
      '        $printJobs = Get-PrintJob -PrinterName $printer -ErrorAction SilentlyContinue',
      '        if ($printJobs) {',
      '            Write-Host "Print jobs found in queue:" $printJobs.Count',
      '            $printJobs | ForEach-Object { Write-Host "Job:" $_.Id $_.DocumentName $_.Status }',
      '        } else {',
      '            Write-Host "No print jobs found in queue. Job may have completed already or failed to start."',
      '        }',
      '    } catch {',
      '        Write-Host "Could not check print queue: $_"',
      '    }',
      '',
      '    # Restore original default printer',
      '    if ($originalPrinter -and $originalPrinter -ne $null) {',
      '        Write-Host "Restoring original default printer"',
      '        $network.SetDefaultPrinter($originalPrinter)',
      '    }',
      '',
      '    # Clean up temporary PDF',
      '    if (Test-Path $tempPdf) {',
      '        Remove-Item $tempPdf -Force',
      '    }',
      '',
      '    Write-Host "Print job completed successfully"',
      '} catch {',
      '    Write-Error "Error during print job: $_"',
      '    throw',
      '} finally {',
      '    Stop-Transcript',
      '}'
    ].join('\n');

    // Write the PowerShell script
    fs.writeFileSync(scriptPath, psScript);
    console.log('Created print script at:', scriptPath);

    try {
      // Execute the PowerShell script
      console.log('Executing PowerShell script for printing...');
      
      // Create an alternative script that attempts elevation if needed
      const elevateScriptPath = path.join(tempDir, `elevate_${timestamp}.ps1`);
      const elevateScriptContent = `
# This script checks if we need admin privileges and attempts to elevate if needed
$needsAdmin = $false
$printerName = "${printerName}"

# Check if the printer requires admin rights to manage
try {
    $printer = Get-Printer -Name $printerName -ErrorAction Stop
    # Some operations might still require admin rights even if we can get the printer
} catch {
    $needsAdmin = $true
    Write-Host "Printer access requires admin rights: $_"
}

# If needed, try to elevate and call the main script
if ($needsAdmin) {
    Write-Host "Attempting to run with elevation..."
    Start-Process powershell.exe -ArgumentList "-ExecutionPolicy Bypass -File '${scriptPath.replace(/\\/g, '\\\\')}'" -Verb RunAs -Wait
} else {
    # Just run the main script directly
    & '${scriptPath.replace(/\\/g, '\\\\')}'
}
`
      fs.writeFileSync(elevateScriptPath, elevateScriptContent);
      
      // First try with the elevation checker
      try {
        const { stdout: elevateOutput, stderr: elevateStderr } = await execPromise(`powershell.exe -ExecutionPolicy Bypass -NoProfile -File "${elevateScriptPath}"`);
        console.log('Elevation script output:', elevateOutput);
        if (elevateStderr) {
          console.warn('Elevation script warnings:', elevateStderr);
        }
      } catch (elevateError) {
        console.warn('Elevation script failed, falling back to direct execution:', elevateError.message);
        // Fall back to regular execution
        const { stdout, stderr } = await execPromise(`powershell.exe -ExecutionPolicy Bypass -NoProfile -File "${scriptPath}"`);
        console.log('Print script output:', stdout);
        if (stderr) {
          console.warn('Print script warnings:', stderr);
        }
      }
      
      // Read the log file for additional debugging
      if (fs.existsSync(logPath)) {
        const log = fs.readFileSync(logPath, 'utf8');
        console.log('Print log contents:', log);
      }

    return "Print command sent to printer";
    } catch (printError) {
      // Read the log file for error details
      let errorDetails = printError.message;
      if (fs.existsSync(logPath)) {
        try {
          const log = fs.readFileSync(logPath, 'utf8');
          errorDetails += `\nLog contents:\n${log}`;
        } catch (logError) {
          console.warn('Could not read log file:', logError);
        }
      }
      throw new Error(`Failed to print: ${errorDetails}`);
    } finally {
      // Clean up temporary files
      try {
        if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
        if (fs.existsSync(logPath)) fs.unlinkSync(logPath);
        if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
        // Clean up the elevation script if it exists
        const elevateScriptPath = path.join(tempDir, `elevate_${timestamp}.ps1`);
        if (fs.existsSync(elevateScriptPath)) fs.unlinkSync(elevateScriptPath);
      } catch (cleanupError) {
        console.warn('Could not clean up temporary files:', cleanupError);
      }
    }
  } catch (error) {
    console.error('Print error:', error);
    throw error;
  }
};


