
@echo off
echo Starting print job for EPSON L3210 Series...

:: Save current default printer
for /f "tokens=*" %%a in ('wmic printer get name^,default ^| findstr TRUE') do set DefaultPrinter=%%a
set DefaultPrinter=%DefaultPrinter:TRUE=%
set DefaultPrinter=%DefaultPrinter: =%

:: Set target printer as default
rundll32.exe printui.dll,PrintUIEntry /y /n "EPSON L3210 Series"

:: Print the file using mshta (Windows built-in)
mshta "javascript:var fso = new ActiveXObject('Scripting.FileSystemObject'); var shell = new ActiveXObject('WScript.Shell'); try { var app = new ActiveXObject('Shell.Application'); app.ShellExecute('D:\\projects\\vendo-print\\vendo-print\\backend\\printer\\temp\\b4a47b92-70b2-42ff-bbb6-595977079c8d_printer-test.pdf', '', '', 'print', 0); } catch(e) { shell.Popup('Error: ' + e.message); } close();"

:: Wait for print to start
timeout /t 2 /nobreak > nul

:: Set color mode via registry if printer supports it
reg add "HKCU\Software\Microsoft\Windows NT\CurrentVersion\Windows" /v "Color" /t REG_DWORD /d 0 /f

:: Restore original default printer
rundll32.exe printui.dll,PrintUIEntry /y /n "%DefaultPrinter%"

echo Print job completed
