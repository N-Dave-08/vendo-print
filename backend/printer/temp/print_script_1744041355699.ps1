
$ErrorActionPreference = "Stop"
Write-Host "===== DIRECT PRINT JOB STARTED ====="
Write-Host "File: D:\projects\vendo-print\vendo-print\backend\printer\temp\4f575ad5-1938-4906-a200-a32854f3c30f_1744041342171_printer-test.pdf"
Write-Host "Printer: EPSON L3210 Series"
Write-Host "Color: true"

# Create log file
"Print job started at $(Get-Date)" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744041355699.txt" -Append
"File: D:\projects\vendo-print\vendo-print\backend\printer\temp\4f575ad5-1938-4906-a200-a32854f3c30f_1744041342171_printer-test.pdf" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744041355699.txt" -Append
"Printer: EPSON L3210 Series" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744041355699.txt" -Append
"Color mode: Color" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744041355699.txt" -Append

try {
    # Verify file exists
    if (!(Test-Path "D:\projects\vendo-print\vendo-print\backend\printer\temp\4f575ad5-1938-4906-a200-a32854f3c30f_1744041342171_printer-test.pdf")) {
        $errorMsg = "File not found: D:\projects\vendo-print\vendo-print\backend\printer\temp\4f575ad5-1938-4906-a200-a32854f3c30f_1744041342171_printer-test.pdf"
        Write-Error $errorMsg
        $errorMsg | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744041355699.txt" -Append
        exit 1
    }
    
    # List available printers
    "Available printers:" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744041355699.txt" -Append
    Get-Printer | Select-Object Name, DriverName, PortName | Format-Table | Out-String | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744041355699.txt" -Append
    
    # Get default printer before changing settings
    $defaultPrinter = (Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE Default=$true").Name
    "Current default printer: $defaultPrinter" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744041355699.txt" -Append
    
    # Set our target printer as default
    "Setting EPSON L3210 Series as default printer" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744041355699.txt" -Append
    Set-Printer -Name "EPSON L3210 Series" -Default
    
    # Configure printer for color/grayscale
    "Configuring color settings..." | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744041355699.txt" -Append
    try {
        $printer = Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE Name='EPSON L3210 Series'"
        if ($printer) {
            $devMode = $printer.GetDevMode(1)
            if ($devMode) {
                # Set color mode (1 = Color, 2 = Monochrome)
                $isColorMode = $true
                $colorMode = if ($isColorMode) { 1 } else { 2 }
                $colorModeName = if ($colorMode -eq 1) { "Color" } else { "Grayscale" }
                "Setting color mode to: $colorModeName" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744041355699.txt" -Append
                $devMode.Color = $colorMode
                
                # Apply settings
                $printer.SetDevMode($devMode)
                "Color settings applied" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744041355699.txt" -Append
            } else {
                "Warning: Could not get device mode object" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744041355699.txt" -Append
            }
        } else {
            "Warning: Could not find printer WMI object" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744041355699.txt" -Append
        }
    } catch {
        "Error configuring printer settings: $_" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744041355699.txt" -Append
    }
    
    # This is the simplest and most direct way to print a file in PowerShell
    "Sending print command at $(Get-Date)" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744041355699.txt" -Append
    Write-Host "Sending print command directly..."
    
    Start-Process -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\4f575ad5-1938-4906-a200-a32854f3c30f_1744041342171_printer-test.pdf" -Verb Print -ErrorAction Stop
    
    # Give it a moment to process
    Write-Host "Print command sent, waiting for processing..."
    "Print command sent, waiting for processing..." | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744041355699.txt" -Append
    Start-Sleep -Seconds 3
    
    # Restore original default printer if there was one
    if ($defaultPrinter -and $defaultPrinter -ne "EPSON L3210 Series") {
        "Restoring original default printer: $defaultPrinter" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744041355699.txt" -Append
        try {
            Set-Printer -Name $defaultPrinter -Default
        } catch {
            "Error restoring default printer: $_" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744041355699.txt" -Append
        }
    }
    
    # Add the success message to log
    "Print job completed successfully at $(Get-Date)" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744041355699.txt" -Append
    Write-Host "Print job completed successfully"
    exit 0
} catch {
    $errorMsg = "Print error: $_"
    Write-Error $errorMsg
    $errorMsg | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744041355699.txt" -Append
    exit 1
}
