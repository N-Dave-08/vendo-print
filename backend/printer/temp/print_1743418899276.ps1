
$ErrorActionPreference = 'Stop'
try {
    # Parameters
    $printer = 'EPSON L3210 Series'
    $file = 'D:\projects\printer\VendoPrint\backend\printer\temp\b49a1109-aaaf-4f77-9395-46f0c563eb90_High-Call-Volume-Script (1).docx'
    $isColor = $false
    $paperSize = 1
    $orientation = 1

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

    # Apply paper size and orientation
    $sections = $doc.Sections
    foreach ($section in $sections) {
        $pageSetup = $section.PageSetup
        $pageSetup.PaperSize = $paperSize
        $pageSetup.Orientation = $orientation
    }

    # Set printer and print
    $word.ActivePrinter = $printer
    $doc.PrintOut()

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
