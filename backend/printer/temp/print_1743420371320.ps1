
$ErrorActionPreference = 'Stop'
try {
    # Parameters
    $printer = 'EPSON L3210 Series'
    $file = 'D:\projects\printer\VendoPrint\backend\printer\temp\43821544-99c1-45d0-8241-68af50ff3dd8_High-Call-Volume-Script (1).docx'
    $isColor = $false
    
    # Map paper sizes to Word constants
    $paperSizeMap = @{
        "Short Bond" = 1      # wdPaperLetterSmall
        "Letter" = 0          # wdPaperLetter (8.5 x 11)
        "A4" = 9             # wdPaperA4 (8.27 x 11.69)
        "Legal" = 5          # wdPaperLegal (8.5 x 14)
    }
    
    # Default to Letter if selected size isn't available
    $paperSize = if ($paperSizeMap.ContainsKey("Short Bond")) { 
        $paperSizeMap["Short Bond"]
    } else { 
        0  # Default to Letter
    }
    
    # Word orientation constants: wdOrientPortrait = 0, wdOrientLandscape = 1
    $orientation = if ('portrait'.ToLower() -eq 'portrait') { 0 } else { 1 }
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
    $doc.PrintOut(
        Background = $false,
        Orientation = $orientation
    )

    # Wait briefly for print job to start
    Start-Sleep -Seconds 2

    # Clean up
    $doc.Close([ref]$false)
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
