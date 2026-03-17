@echo off
echo === OmniScribe Startup Setup ===
echo.

set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup

echo Creating tray app startup shortcut...
(
echo Set WshShell = CreateObject("WScript.Shell"^)
echo Set shortcut = WshShell.CreateShortcut("%STARTUP%\OmniScribe Tray.lnk"^)
echo shortcut.TargetPath = "C:\GIT Folder\Omniscribe\apps\tray\launch.bat"
echo shortcut.WorkingDirectory = "C:\GIT Folder\Omniscribe\apps\tray"
echo shortcut.WindowStyle = 7
echo shortcut.Description = "OmniScribe System Tray"
echo shortcut.Save
) > "%TEMP%\omniscribe-shortcut.vbs"
cscript //nologo "%TEMP%\omniscribe-shortcut.vbs"
del "%TEMP%\omniscribe-shortcut.vbs"

echo Creating dashboard startup shortcut...
(
echo Set WshShell = CreateObject("WScript.Shell"^)
echo Set shortcut = WshShell.CreateShortcut("%STARTUP%\OmniScribe Dashboard.lnk"^)
echo shortcut.TargetPath = "cmd.exe"
echo shortcut.Arguments = "/c cd /d ""C:\GIT Folder\Omniscribe\apps\web"" && pnpm dev"
echo shortcut.WorkingDirectory = "C:\GIT Folder\Omniscribe\apps\web"
echo shortcut.WindowStyle = 7
echo shortcut.Description = "OmniScribe Web Dashboard"
echo shortcut.Save
) > "%TEMP%\omniscribe-shortcut2.vbs"
cscript //nologo "%TEMP%\omniscribe-shortcut2.vbs"
del "%TEMP%\omniscribe-shortcut2.vbs"

echo.
echo === Done ===
echo Installed to: %STARTUP%
echo   - OmniScribe Tray.lnk (tray app)
echo   - OmniScribe Dashboard.lnk (web dashboard on localhost:3000)
echo.
echo The daemon runs as a Windows Service (install-service.bat).
echo The tray app and dashboard start on login.
echo.
pause
