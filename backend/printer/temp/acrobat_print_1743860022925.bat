
@echo off
echo ADOBE ACROBAT PRINT JOB STARTING

rem Look for Adobe Reader/Acrobat executable 
set ACROBAT_PATH="%ProgramFiles(x86)%\Adobe\Acrobat Reader DC\Reader\AcroRd32.exe"
if not exist %ACROBAT_PATH% set ACROBAT_PATH="%ProgramFiles%\Adobe\Acrobat Reader DC\Reader\AcroRd32.exe"
if not exist %ACROBAT_PATH% set ACROBAT_PATH="%ProgramFiles(x86)%\Adobe\Acrobat DC\Acrobat\Acrobat.exe"
if not exist %ACROBAT_PATH% set ACROBAT_PATH="%ProgramFiles%\Adobe\Acrobat DC\Acrobat\Acrobat.exe"

echo File: "D:\projects\vendo-print\vendo-print\backend\printer\temp\36f6e003-19f1-4fbb-95c0-29a2c0d392d7_EXCUSELETTERRIZAL2.pdf"
echo Printer: "EPSON L3210 Series"
echo Adobe Path: %ACROBAT_PATH%

rem Start Acrobat with print parameter (/t prints silently and should exit automatically)
start /b /wait "" %ACROBAT_PATH% /t "D:\projects\vendo-print\vendo-print\backend\printer\temp\36f6e003-19f1-4fbb-95c0-29a2c0d392d7_EXCUSELETTERRIZAL2.pdf" "EPSON L3210 Series"

rem If Acrobat doesn't close itself (which it should with /t), force close it after a delay
timeout /t 5 /nobreak > nul
taskkill /f /im AcroRd32.exe > nul 2>&1
taskkill /f /im Acrobat.exe > nul 2>&1

echo ADOBE ACROBAT PRINT JOB COMPLETED
