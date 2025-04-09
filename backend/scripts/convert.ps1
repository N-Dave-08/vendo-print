param(
    [string]$inputFile,
    [string]$outputDir,
    [string]$libreOfficePath
)

# Remove any extra quotes and normalize paths
$inputFile = [System.IO.Path]::GetFullPath($inputFile.Trim('"'))
$outputDir = [System.IO.Path]::GetFullPath($outputDir.Trim('"'))
$libreOfficePath = [System.IO.Path]::GetFullPath($libreOfficePath.Trim('"'))

# Kill any existing LibreOffice processes
try { 
    Stop-Process -Name "soffice" -Force -ErrorAction SilentlyContinue 
} catch { }

Write-Host "Converting file: $inputFile"
Write-Host "Output directory: $outputDir"
Write-Host "Using LibreOffice: $libreOfficePath"

# Run LibreOffice conversion
try {
    # Change to the directory containing the input file
    $originalLocation = Get-Location
    Set-Location -Path (Split-Path -Parent $inputFile)
    
    # Get relative paths
    $relativeInput = Split-Path -Leaf $inputFile
    
    Write-Host "Current directory: $(Get-Location)"
    Write-Host "Input file: $relativeInput"
    
    # Start LibreOffice process
    $pinfo = New-Object System.Diagnostics.ProcessStartInfo
    $pinfo.FileName = $libreOfficePath
    $pinfo.RedirectStandardOutput = $true
    $pinfo.RedirectStandardError = $true
    $pinfo.UseShellExecute = $false
    $pinfo.CreateNoWindow = $true
    $pinfo.WorkingDirectory = (Split-Path -Parent $inputFile)
    
    # Build arguments list
    $pinfo.Arguments = "--headless --convert-to pdf:writer_pdf_Export --outdir `"$outputDir`" `"$relativeInput`""
    
    Write-Host "Starting LibreOffice process..."
    Write-Host "Full command: $($pinfo.FileName) $($pinfo.Arguments)"
    
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $pinfo
    
    $process.Start() | Out-Null
    
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    
    Write-Host "Process output: $stdout"
    if ($stderr) {
        Write-Error "Process error: $stderr"
    }
    
    if ($process.ExitCode -ne 0) {
        Write-Error "LibreOffice conversion failed with exit code $($process.ExitCode)"
        exit $process.ExitCode
    }
    
    # Return to original location
    Set-Location -Path $originalLocation
    
} catch {
    Write-Error "Error running LibreOffice: $_"
    # Make sure we return to original location even if there's an error
    if ($originalLocation) {
        Set-Location -Path $originalLocation
    }
    exit 1
}

# Wait for the process to complete
Start-Sleep -Seconds 2 