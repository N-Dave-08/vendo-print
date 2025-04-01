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
import { getDatabase, ref as dbRef, update } from 'firebase/database';
import { firebaseConfig } from '../firebase/firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Helper function to update print progress
const updatePrintProgress = async (printJobId, progress, status) => {
  if (!printJobId) return;

  try {
    await update(dbRef(db, `files/${printJobId}`), {
      progress,
      printStatus: status,
      status: progress >= 100 ? "Done" : "Processing"
    });
  } catch (error) {
    console.error("Error updating print progress:", error);
  }
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


export const printFileWithSumatra = async (filePath, printerName, isColor) => {
  let command = `"C:\\Program Files\\SumatraPDF\\SumatraPDF.exe" -print-to "${printerName}"`;
  if (isColor === false) {
    command += ' -print-settings "monochrome"';
  }
  command += ` "${filePath}"`;

  try {
    const { stdout, stderr } = await execPromise(command);
    if (stderr) {
      throw new Error(stderr);
    }
    return stdout;
  } catch (error) {
    console.error('Error printing file with Sumatra:', error);
    throw error;
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
            if (${isColor} -eq $true) {
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
    ForEach-Object { 
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
      $wshNetwork.SetDefaultPrinter($defaultPrinter);
      Write-Host 'Restored default printer to:' $defaultPrinter;
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
      selectedPageOption,
      customPageRange,
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
        await updatePrintProgress(printJobId, 5, 'Preparing to print...');
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
                await updatePrintProgress(printJobId, 5, 'Firebase token expired. Please try again.');
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
          await updatePrintProgress(printJobId, 5, `Download failed: ${downloadError.message}`);
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
      console.log("Processing PDF with options:", { selectedPageOption, orientation, selectedSize });

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
          await updatePrintProgress(printJobId, 30, 'Sending to printer...');
        } catch (updateError) {
          console.warn(`Could not update print job status in Firebase: ${updateError.message}`);
        }
      }

      // Print the file for the specified number of copies
      const printPromises = [];
      for (let i = 0; i < numCopies; i++) {
        console.log(`Printing copy ${i + 1} of ${numCopies} `);

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
          await updatePrintProgress(printJobId, 100, 'Print job completed');
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
  let filePath = '';
  let processedFilePath = '';
  let wordPrintError = null;

  try {
    const {
      fileName,
      printerName,
      fileUrl,
      isColor,
      selectedPageOption,
      customPageRange,
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
      console.log("Processing PDF with options:", { selectedPageOption, orientation, selectedSize });

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

      // Pass control to the base handler for non-Word documents
      return basePrintFileHandler(req, res);
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
  const { fileUrl, fileName, printerName, copies = 1, isColor = false, orientation = 'portrait', selectedSize = 'Short Bond', printJobId } = req.body;

  try {
    // Update initial progress
    await updatePrintProgress(printJobId, 5, "Downloading file...");

    // Download the file
    const response = await axios({
      method: 'get',
      url: fileUrl,
      responseType: 'stream'
    });

    await updatePrintProgress(printJobId, 15, "Processing document...");

    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    // Generate unique filename
    const uniqueFilename = `${uuidv4()}_${fileName}`;
    const filePath = path.join(tempDir, uniqueFilename);

    // Save file to disk
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    await updatePrintProgress(printJobId, 30, "Configuring printer settings...");

    // Determine file type and use appropriate print method
    const fileExt = path.extname(fileName).toLowerCase();
    let printResult;

    await updatePrintProgress(printJobId, 45, "Preparing to print...");

    if (fileExt === '.pdf') {
      await updatePrintProgress(printJobId, 60, "Sending PDF to printer...");
      printResult = await printFileWithSumatra(filePath, printerName, isColor);
    } else if (['.doc', '.docx'].includes(fileExt)) {
      await updatePrintProgress(printJobId, 60, "Processing Word document...");
      printResult = await printWordDocument(filePath, printerName, isColor, selectedSize, orientation);
    } else if (['.jpg', '.jpeg', '.png'].includes(fileExt)) {
      await updatePrintProgress(printJobId, 60, "Processing image...");
      printResult = await printImageFile(filePath, printerName, isColor, orientation);
    } else {
      throw new Error('Unsupported file type');
    }

    await updatePrintProgress(printJobId, 75, "Printing in progress...");

    // Simulate print completion after a delay (since we can't track actual printer progress)
    setTimeout(async () => {
      await updatePrintProgress(printJobId, 90, "Finishing print job...");

      // Clean up temp file
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }

      // Mark as complete
      setTimeout(async () => {
        await updatePrintProgress(printJobId, 100, "Print job completed");
      }, 1000);
    }, 2000);

    res.json({
      status: 'success',
      message: 'Print job started successfully'
    });

  } catch (error) {
    console.error('Print error:', error);

    // Update Firebase with error status
    if (printJobId) {
      await update(dbRef(db, `files/${printJobId}`), {
        status: "Error",
        progress: 0,
        printStatus: error.message || "Failed to print document"
      });
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

