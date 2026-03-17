@echo off
echo === OmniScribe Service Installer ===
echo This must be run as Administrator.
echo.

set NSSM=C:\GIT Folder\Omniscribe\nssm.exe
set PYTHON=C:\GIT Folder\Omniscribe\apps\daemon\.venv\Scripts\python.exe
set DAEMON_DIR=C:\GIT Folder\Omniscribe\apps\daemon

echo [1/4] Removing old service if exists...
"%NSSM%" stop OmniScribe 2>nul
"%NSSM%" remove OmniScribe confirm 2>nul

echo [2/4] Installing OmniScribe daemon service...
"%NSSM%" install OmniScribe "%PYTHON%" -m omniscribe_daemon.main
"%NSSM%" set OmniScribe AppDirectory "%DAEMON_DIR%"
"%NSSM%" set OmniScribe DisplayName "OmniScribe Daemon"
"%NSSM%" set OmniScribe Description "OmniScribe audio capture, transcription, and sync daemon"
"%NSSM%" set OmniScribe Start SERVICE_AUTO_START
"%NSSM%" set OmniScribe AppStdout C:\Users\Juan Barahona\.omniscribe\daemon.log
"%NSSM%" set OmniScribe AppStderr C:\Users\Juan Barahona\.omniscribe\daemon-error.log
"%NSSM%" set OmniScribe AppRotateFiles 1
"%NSSM%" set OmniScribe AppRotateBytes 5242880
"%NSSM%" set OmniScribe AppStopMethodSkip 6
"%NSSM%" set OmniScribe AppExit Default Restart
"%NSSM%" set OmniScribe AppRestartDelay 5000

echo [3/4] Starting service...
"%NSSM%" start OmniScribe

echo [4/4] Checking status...
"%NSSM%" status OmniScribe

echo.
echo === Done ===
echo The OmniScribe daemon will now:
echo   - Start automatically on boot
echo   - Restart if it crashes
echo   - Log to C:\Users\Juan Barahona\.omniscribe\daemon.log
echo.
echo To manage:
echo   nssm stop OmniScribe
echo   nssm start OmniScribe
echo   nssm restart OmniScribe
echo   nssm remove OmniScribe confirm
echo.
pause
