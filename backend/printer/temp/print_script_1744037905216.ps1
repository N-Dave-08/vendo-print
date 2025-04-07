
$ErrorActionPreference = "Stop"
Write-Host "===== DIRECT PRINT JOB STARTED ====="
Write-Host "File: D:\projects\vendo-print\vendo-print\backend\printer\temp\0af1f439-1dad-4464-8fd8-1a3e60af5b3c_1744037889387_printer-test.pdf"
Write-Host "Printer: EPSON L3210 Series"
Write-Host "Color: true"

try {
    # Verify file exists
    if (!(Test-Path "D:\projects\vendo-print\vendo-print\backend\printer\temp\0af1f439-1dad-4464-8fd8-1a3e60af5b3c_1744037889387_printer-test.pdf")) {
        Write-Error "File not found: D:\projects\vendo-print\vendo-print\backend\printer\temp\0af1f439-1dad-4464-8fd8-1a3e60af5b3c_1744037889387_printer-test.pdf"
        exit 1
    }

    # Save current default printer
    $wshNetwork = New-Object -ComObject WScript.Network
    $defaultPrinter = $wshNetwork.GetDefaultPrinter()
    Write-Host "Original default printer: $defaultPrinter"

    # Set our target printer as default
    $wshNetwork.SetDefaultPrinter("EPSON L3210 Series")
    Write-Host "Set default printer to: EPSON L3210 Series"

    # Simple direct print using Start-Process
    Write-Host "Sending print command..."
    Start-Process -FilePath "D:\projects\vendo-print\vendo-print\backend\printer\temp\0af1f439-1dad-4464-8fd8-1a3e60af5b3c_1744037889387_printer-test.pdf" -Verb Print -Wait
    Write-Host "Print command completed"

    # Check print queue
    Start-Sleep -Seconds 2
    try {
        $queue = Get-PrintJob -PrinterName "EPSON L3210 Series"
        if ($queue) {
            Write-Host "Print job found in queue:"
            $queue | ForEach-Object { Write-Host "Job: $($_.JobId) - $($_.DocumentName) - $($_.JobStatus)" }
        } else {
            Write-Host "No print jobs in queue (may have printed already)"
        }
    } catch {
        Write-Warning "Could not check print queue: $_"
    }

    # Restore original default printer
    $wshNetwork.SetDefaultPrinter($defaultPrinter)
    Write-Host "Restored default printer to: $defaultPrinter"

    Write-Host "Print job completed successfully"
    exit 0
} catch {
    Write-Error "Print error: $_"
    exit 1
} finally {
    # Always try to restore the default printer
    try {
        $wshNetwork.SetDefaultPrinter($defaultPrinter)
    } catch {
        Write-Warning "Could not restore default printer: $_"
    }
}
