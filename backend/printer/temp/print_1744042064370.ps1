
# Define file and printer
$file = "D:\\projects\\vendo-print\\vendo-print\\backend\\printer\\temp\\ae036c65-2172-49ba-9362-dbf25e7b56e3_1744042050032_printer-test.pdf"
$printerName = "EPSON L3210 Series"
$printColor = $true

Write-Host "===== PDF PRINT JOB STARTED ====="
Write-Host "File: $file"
Write-Host "Printer: $printerName"
Write-Host "Color mode: $($printColor ? 'Color' : 'Black & White')"

# Register temporary event handler for printer dialog
try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName Microsoft.VisualBasic
    
    # Set the printer as default first (needed for some applications)
    Write-Host "Setting default printer to $printerName"
    try {
        Set-Printer -Name $printerName -Default
        Write-Host "Default printer set successfully"
    } catch {
        Write-Warning "Could not set default printer: $_"
    }
    
    # Try to update the printer color settings
    Write-Host "Attempting to configure printer for $($printColor ? 'color' : 'black & white') output"
    try {
        # Use WMI to access the printer driver settings
        $printer = Get-WmiObject -Class Win32_Printer -Filter "Name='$printerName'"
        if ($printer) {
            # Get the printer's DevMode
            $devMode = $printer.GetDevMode(1)
            if ($devMode) {
                # Color mode: 1 = Color, 2 = Monochrome
                $colorMode = if ($printColor) { 1 } else { 2 }
                $devMode.Color = $colorMode
                
                # Apply the settings
                $result = $printer.SetDevMode($devMode)
                Write-Host "Set printer color mode to $($printColor ? 'Color' : 'Monochrome') (result: $result)"
            } else {
                Write-Warning "Could not get printer DevMode"
            }
        } else {
            Write-Warning "Could not find printer WMI object"
        }
    } catch {
        Write-Warning "Error configuring printer settings: $_"
    }
    
    # Create a timer to handle print dialog
    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = 3000  # Check after 3 seconds
    
    # Timer callback to look for and interact with print dialog
    $timer.add_Tick({
        Write-Host "Looking for print dialog..."
        $dialogs = [Microsoft.VisualBasic.Interaction]::AppActivate("Print")
        if ($dialogs) {
            Write-Host "Found print dialog, sending ENTER key"
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
            $timer.Stop()
        }
    })
    
    # Start the timer
    $timer.Start()
    
    # Print the file using the print verb
    Write-Host "Sending print command..."
    
    # Create an application that can handle the print verb
    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = $file
    $processInfo.Verb = "print"
    $processInfo.UseShellExecute = $true
    
    # Start the print process
    $process = [System.Diagnostics.Process]::Start($processInfo)
    
    # Keep script running while timer checks for dialog
    Write-Host "Waiting for print dialog..."
    Start-Sleep -Seconds 10
    
    # Make sure timer is stopped
    $timer.Stop()
    
    Write-Host "Print command sent successfully"
    exit 0
} catch {
    Write-Error "Error printing file: $_"
    exit 1
}
