
$ErrorActionPreference = "Stop"
Write-Host "===== DIRECT PRINT JOB STARTED ====="
Write-Host "File: D:\projects\vendo-print\vendo-print\backend\printer\temp\2435bde5-15cf-4647-973c-cf093733273b_printer-test.pdf"
Write-Host "Printer: EPSON L3210 Series"
Write-Host "Color: true"

# Create log file
"Print job started at $(Get-Date)" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
"File: D:\projects\vendo-print\vendo-print\backend\printer\temp\2435bde5-15cf-4647-973c-cf093733273b_printer-test.pdf" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
"Printer: EPSON L3210 Series" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
"Color mode: Color" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append

try {
    # Verify file exists
    if (!(Test-Path "D:\projects\vendo-print\vendo-print\backend\printer\temp\2435bde5-15cf-4647-973c-cf093733273b_printer-test.pdf")) {
        $errorMsg = "File not found: D:\projects\vendo-print\vendo-print\backend\printer\temp\2435bde5-15cf-4647-973c-cf093733273b_printer-test.pdf"
        Write-Error $errorMsg
        $errorMsg | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
        exit 1
    }
    
    # List available printers
    "Available printers:" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
    Get-Printer | Select-Object Name, DriverName, PortName | Format-Table | Out-String | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
    
    # Get default printer before changing settings without throwing errors
    $defaultPrinter = $null
    try {
        $defaultPrinter = (Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE Default=$true").Name
        "Current default printer: $defaultPrinter" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
    } catch {
        "Error getting default printer: $_" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
        # Continue anyway - we'll still try to print
    }
    
    # Set our target printer as default
    "Setting EPSON L3210 Series as default printer" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
    try {
        Set-Printer -Name "EPSON L3210 Series" -Default
    } catch {
        "Warning: Could not set default printer: $_" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
        # Continue anyway - direct printing may still work
    }
    
    # Configure printer for color/grayscale
    "Configuring color settings..." | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
    try {
        $printer = Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE Name='EPSON L3210 Series'"
        if ($printer) {
            $devMode = $printer.GetDevMode(1)
            if ($devMode) {
                # Set color mode (1 = Color, 2 = Monochrome)
                $isColorMode = $true
                $colorMode = if ($isColorMode) { 1 } else { 2 }
                $colorModeName = if ($colorMode -eq 1) { "Color" } else { "Grayscale" }
                "Setting color mode to: $colorModeName" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
                $devMode.Color = $colorMode
                
                # Apply settings
                $printer.SetDevMode($devMode)
                "Color settings applied" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
            } else {
                "Warning: Could not get device mode object" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
            }
        } else {
            "Warning: Could not find printer WMI object" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
        }
    } catch {
        "Error configuring printer settings: $_" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
    }
    
    # This is the simplest and most direct way to print a file in PowerShell
    "Sending print command at $(Get-Date)" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
    Write-Host "Sending print command directly..."
    
    # Start printing process using direct method
    Start-Process -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\2435bde5-15cf-4647-973c-cf093733273b_printer-test.pdf" -Verb Print -ErrorAction Stop
    
    # Give it a moment to process
    Write-Host "Print command sent, waiting for processing..."
    "Print command sent, waiting for processing..." | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
    Start-Sleep -Seconds 3
    
    # Wait a bit before trying to restore the default printer - this helps prevent errors
    Start-Sleep -Seconds 5
    
    # Restore original default printer if there was one
    if ($defaultPrinter -and $defaultPrinter -ne "EPSON L3210 Series") {
        "Attempting to restore original default printer: $defaultPrinter" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
        try {
            # First check if the printer exists before trying to set it as default
            $printerExists = Get-Printer -Name $defaultPrinter -ErrorAction SilentlyContinue
            if ($printerExists) {
                # Wait a bit before restoring - this helps prevent the 0x00000709 error
                Start-Sleep -Seconds 2
                
                # Use different methods to restore the default printer, as a fallback strategy
                try {
                    # Method 1: Use Set-Printer cmdlet
                    Set-Printer -Name $defaultPrinter -Default
                    "Default printer restored using Set-Printer" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
                } catch {
                    "Method 1 failed: $_" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
                    
                    # Method 2: Try WScript.Network COM object instead
                    try {
                        $wshNetwork = New-Object -ComObject WScript.Network
                        $wshNetwork.SetDefaultPrinter($defaultPrinter)
                        "Default printer restored using WScript.Network" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
                    } catch {
                        "Method 2 failed: $_" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
                        # We've tried our best - just log the error and continue
                    }
                }
            } else {
                "Original printer '$defaultPrinter' no longer exists, cannot restore" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
            }
        } catch {
            "Error restoring default printer: $_" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
            # Just log this and continue - it's not critical
        }
    } else {
        "No need to restore default printer" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
    }
    
    # Add the success message to log
    "Print job completed successfully at $(Get-Date)" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
    Write-Host "Print job completed successfully"
    exit 0
} catch {
    $errorMsg = "Print error: $_"
    Write-Error $errorMsg
    $errorMsg | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744044638831.txt" -Append
    exit 1
}
