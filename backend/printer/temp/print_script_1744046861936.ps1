$ErrorActionPreference = "Stop"
Start-Transcript -Path "D:\\projects\\vendo-print\\vendo-print\\backend\\printer\\temp\\print_log_1744046861936.txt"
try {
    Write-Host "Starting print job with color mode: Black and White"

    # Save current default printer
    $originalPrinter = (Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE Default=$true").Name
    Write-Host "Original default printer: $originalPrinter"

    # Set target printer as default using elevated command
    Write-Host "Setting printer: EPSON L3210 Series"
    $printUIArguments = 'printui.dll,PrintUIEntry /y /n\"EPSON L3210 Series\"'
    Start-Process -FilePath "rundll32.exe" -ArgumentList $printUIArguments -Wait

    # Configure printer for black and white if specified
    if (true) {
        Write-Host "Configuring black and white settings"

        # Method 1: Use PrintUI
        $colorArguments = 'printui.dll,PrintUIEntry /Xs /n\"EPSON L3210 Series\" ColorMode 2'
        Start-Process -FilePath "rundll32.exe" -ArgumentList $colorArguments -Wait

        # Method 2: Use WMI with elevated permissions
        $printer = Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE Name='EPSON L3210 Series'"
        if ($printer) {
            $devmode = $printer.GetDevMode(1)
            if ($devmode) {
                $devmode.Color = 2
                $printer.SetDevMode($devmode)
                Write-Host "Set printer color mode to Monochrome using WMI"
            }
        }

        # Method 3: Direct registry modification with elevated permissions
        $regPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Printers\EPSON L3210 Series\PrinterDriverData"
        if (Test-Path $regPath) {
            Set-ItemProperty -Path $regPath -Name "ColorMode" -Value 2 -Type DWord
            Write-Host "Set printer color mode to Monochrome in registry"
        }
    }

    # Print using SumatraPDF with explicit settings
    $sumatra = "C:\\Users\\63908\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe"
    $file = "D:\\projects\\vendo-print\\vendo-print\\backend\\printer\\temp\\d2f662dd-962e-457a-a0b4-d18c5e341b1d_printer-test.pdf"

    # Build arguments list
    $sumatraArgs = @()
    $sumatraArgs += "-print-to-default"
    $sumatraArgs += "-silent"
    if (true) {
        $sumatraArgs += "-monochrome"
    }
    $sumatraArgs += "`"$file`""

    Write-Host "Printing with command: $sumatra $($sumatraArgs -join " ")"
    & $sumatra $sumatraArgs

    # Wait for print job to be processed
    Start-Sleep -Seconds 3

    # Restore original default printer
    if ($originalPrinter -and $originalPrinter -ne "EPSON L3210 Series") {
        Write-Host "Restoring original default printer"
        $restoreArguments = 'printui.dll,PrintUIEntry /y /n\"$originalPrinter\"'
        Start-Process -FilePath "rundll32.exe" -ArgumentList $restoreArguments -Wait
    }

    Write-Host "Print job completed successfully"
} catch {
    Write-Error "Error during print job: $_"
    throw
} finally {
    Stop-Transcript
}