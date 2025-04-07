
$ErrorActionPreference = "Stop"
Write-Host "===== DIRECT PRINT JOB STARTED ====="
Write-Host "File: D:\projects\vendo-print\vendo-print\backend\printer\temp\99d0b0b7-b903-4057-9aed-17fa1ad40b2d_printer-test.pdf"
Write-Host "Printer: EPSON L3210 Series"
Write-Host "Color Mode: Black & White"

# Create log file
"Print job started at $(Get-Date)" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744045050005.txt"
"File: D:\projects\vendo-print\vendo-print\backend\printer\temp\99d0b0b7-b903-4057-9aed-17fa1ad40b2d_printer-test.pdf" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744045050005.txt" -Append
"Printer: EPSON L3210 Series" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744045050005.txt" -Append
"Color Mode: Black & White" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744045050005.txt" -Append

try {
    # Verify file exists
    if (!(Test-Path "D:\projects\vendo-print\vendo-print\backend\printer\temp\99d0b0b7-b903-4057-9aed-17fa1ad40b2d_printer-test.pdf")) {
        throw "File not found: D:\projects\vendo-print\vendo-print\backend\printer\temp\99d0b0b7-b903-4057-9aed-17fa1ad40b2d_printer-test.pdf"
    }
    
    # Get current default printer
    $defaultPrinter = $null
    try {
        $defaultPrinter = (Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE Default=$true").Name
        "Current default printer: $defaultPrinter" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744045050005.txt" -Append
    } catch {
        "Error getting default printer: $_" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744045050005.txt" -Append
    }
    
    # Set target printer as default
    try {
        Set-Printer -Name "EPSON L3210 Series" -Default
        "Set EPSON L3210 Series as default printer" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744045050005.txt" -Append
    } catch {
        "Warning: Could not set default printer: $_" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744045050005.txt" -Append
    }
    
    # Configure printer color settings
    try {
        $printer = Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE Name='EPSON L3210 Series'"
        if ($printer) {
            $devMode = $printer.GetDevMode(1)
            if ($devMode) {
                $devMode.Color = 2
                $printer.SetDevMode($devMode)
                "Set printer color mode to Black & White" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744045050005.txt" -Append
            }
        }
    } catch {
        "Warning: Could not set color mode: $_" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744045050005.txt" -Append
    }
    
    # Additional color setting via registry
    try {
        $regPath = "HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Windows"
        $regName = "Device"
        $currentValue = (Get-ItemProperty -Path $regPath -Name $regName).$regName
        if ($currentValue -match "EPSON L3210 Series") {
            $newValue = if (false) { 
                $currentValue -replace ",Monochrome", ",Color" 
            } else { 
                $currentValue -replace ",Color", ",Monochrome" 
            }
            Set-ItemProperty -Path $regPath -Name $regName -Value $newValue
            "Updated registry color settings" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744045050005.txt" -Append
        }
    } catch {
        "Warning: Could not update registry settings: $_" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744045050005.txt" -Append
    }
    
    # Print the file
    "Sending print command..." | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744045050005.txt" -Append
    Start-Process -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\99d0b0b7-b903-4057-9aed-17fa1ad40b2d_printer-test.pdf" -Verb Print -ErrorAction Stop
    
    # Wait for print job to process
    Start-Sleep -Seconds 3
    
    # Restore original default printer
    if ($defaultPrinter -and $defaultPrinter -ne "EPSON L3210 Series") {
        try {
            Start-Sleep -Seconds 2
            Set-Printer -Name $defaultPrinter -Default
            "Restored default printer to: $defaultPrinter" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744045050005.txt" -Append
        } catch {
            "Warning: Could not restore default printer: $_" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744045050005.txt" -Append
        }
    }
    
    "Print job completed successfully" | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744045050005.txt" -Append
    Write-Host "Print job completed successfully"
} catch {
    $errorMsg = "Print error: $_"
    Write-Error $errorMsg
    $errorMsg | Out-File -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\print_log_1744045050005.txt" -Append
    exit 1
}