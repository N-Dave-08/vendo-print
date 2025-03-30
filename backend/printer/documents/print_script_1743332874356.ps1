
# Print image script with multiple fallback methods
$filePath = "D:\\projects\\printer\\VendoPrint\\backend\\printer\\documents\\9a269aa9-f081-4659-8deb-09500b17baa0.jpg ";
$printerName = "EPSON L3210 Series";
$isColor = $false;

Write-Host "===== PRINT JOB STARTED =====";
Write-Host "File: $filePath";
Write-Host "Printer: $printerName";
Write-Host "Color: $isColor";

# Check if file exists and is readable
if (-not (Test-Path -Path $filePath)) {
  Write-Error "File not found: $filePath";
  exit 1;
}

$fileInfo = Get-Item $filePath;
Write-Host "File size: $($fileInfo.Length) bytes";

# Check printer status
try {
  $printerObj = Get-Printer -Name $printerName -ErrorAction Stop;
  $statusCode = $printerObj.PrinterStatus;
  $statusMap = @{
    1="Other"; 2="Unknown"; 3="Ready"; 4="Printing"; 
    5="Warmup"; 6="Stopped"; 7="Offline"
  };
  $statusText = $statusMap[$statusCode];
  Write-Host "Printer status: $statusText ($statusCode)";
  
  if ($statusCode -ne 3 -and $statusCode -ne 4) {
    Write-Warning "Printer is not in Ready or Printing state";
  }
} catch {
  Write-Warning "Could not check printer status: $_";
}

# Save default printer
$wshNetwork = New-Object -ComObject WScript.Network;
$oldDefault = $wshNetwork.EnumPrinterConnections() | Select-Object -First 1;
Write-Host "Default printer was: $oldDefault";
$wshNetwork.SetDefaultPrinter($printerName);
Write-Host "Default printer now: $printerName";

# Try method 1 - Windows Photo Viewer
Write-Host "Method 1: Windows Photo Viewer printing...";
$method1Success = $false;
try {
  $method1 = Start-Process -FilePath "rundll32.exe" -ArgumentList "shimgvw.dll,ImageView_PrintTo `"$filePath`" `"$printerName`"" -Wait -PassThru -NoNewWindow;
  if ($method1.ExitCode -eq 0) {
    Write-Host "Method 1: Print command sent successfully";
    $method1Success = $true;
    
    # Check print queue after method 1
    Start-Sleep -Seconds 2;
    try {
      $queue = Get-PrintJob -PrinterName $printerName;
      if ($queue) {
        Write-Host "Print job found in queue after Method 1";
        Write-Host "Job count: $($queue.Count)";
        foreach ($job in $queue) {
          Write-Host "Job: $($job.JobId) - $($job.DocumentName) - $($job.JobStatus)";
        }
      } else {
        Write-Host "No print jobs in queue after Method 1 (may have printed already or failed to queue)";
      }
    } catch {
      Write-Warning "Could not check print queue: $_";
    }
  } else {
    Write-Warning "Method 1 exited with code: $($method1.ExitCode)";
  }
} catch {
  Write-Warning "Method 1 failed: $_";
}

# Try method 2 if method 1 didn't succeed
if (-not $method1Success) {
  Write-Host "Method 2: Default image handler...";
  try {
    Start-Process -FilePath "$filePath" -Verb Print -Wait;
    Write-Host "Method 2: Print command sent successfully";
    
    # Check print queue after method 2
    Start-Sleep -Seconds 2;
    try {
      $queue = Get-PrintJob -PrinterName $printerName;
      if ($queue) {
        Write-Host "Print job found in queue after Method 2";
      } else {
        Write-Host "No print jobs in queue after Method 2";
      }
    } catch {
      Write-Warning "Could not check print queue: $_";
    }
  } catch {
    Write-Warning "Method 2 failed: $_";
    
    # Try method 3 - MS Paint
    Write-Host "Method 3: MS Paint printing...";
    try {
      $method3 = Start-Process -FilePath "mspaint.exe" -ArgumentList "/p `"$filePath`"" -Wait -PassThru;
      Write-Host "Method 3 completed with code: $($method3.ExitCode)";
      
      # Check print queue after method 3
      Start-Sleep -Seconds 2;
      try {
        $queue = Get-PrintJob -PrinterName $printerName;
        if ($queue) {
          Write-Host "Print job found in queue after Method 3";
        } else {
          Write-Host "No print jobs in queue after Method 3";
        }
      } catch {
        Write-Warning "Could not check print queue: $_";
      }
    } catch {
      Write-Warning "Method 3 failed: $_";
      
      # Try method 4 - Print app protocol
      Write-Host "Method 4: Using Windows 10 Photos app...";
      try {
        $os = Get-WmiObject -Class Win32_OperatingSystem;
        $isWin10 = $os.Version -like "10.*";
        
        if ($isWin10) {
          # Try to use the Photos app in Windows 10/11
          Start-Process "ms-photos:print" -ArgumentList "`"$filePath`"";
          Write-Host "Method 4: Photos app print command sent";
          Start-Sleep -Seconds 5;
        } else {
          Write-Warning "Method 4 skipped: Not running Windows 10/11";
        }
      } catch {
        Write-Warning "Method 4 failed: $_";
        
        # Try method 5 - Last resort direct CMD print
        Write-Host "Method 5: CMD print command...";
        try {
          $cmd = Start-Process -FilePath "cmd.exe" -ArgumentList "/c print `"$filePath`" `"$printerName`"" -Wait -PassThru -NoNewWindow;
          Write-Host "Method 5 completed with code: $($cmd.ExitCode)";
        } catch {
          Write-Warning "Method 5 failed: $_";
        }
      }
    }
  }
}

# Always check if print job was added to the queue
Start-Sleep -Seconds 2;
try {
  $finalQueueCheck = Get-PrintJob -PrinterName $printerName;
  Write-Host "Final print queue check:";
  if ($finalQueueCheck) {
    Write-Host "Job count: $($finalQueueCheck.Count)";
    foreach ($job in $finalQueueCheck) {
      Write-Host "Job: $($job.JobId) - $($job.DocumentName) - $($job.JobStatus)";
    }
  } else {
    Write-Host "No print jobs found in the queue";
  }
} catch {
  Write-Warning "Could not perform final print queue check: $_";
}

# Check printer status again
try {
  $printerObj = Get-Printer -Name $printerName -ErrorAction Stop;
  $statusCode = $printerObj.PrinterStatus;
  $statusText = $statusMap[$statusCode];
  Write-Host "Printer final status: $statusText ($statusCode)";
} catch {
  Write-Warning "Could not check final printer status: $_";
}

# Restore default printer
$wshNetwork.SetDefaultPrinter($oldDefault);
Write-Host "Default printer restored to: $oldDefault";
Write-Host "===== PRINT JOB COMPLETED =====";
