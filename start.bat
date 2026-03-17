@echo off
echo === Starting OmniScribe ===

echo [1/3] Starting daemon...
start "OmniScribe Daemon" cmd /k "cd /d C:\GIT Folder\Omniscribe\apps\daemon && .venv\Scripts\activate && python -m omniscribe_daemon.main"

timeout /t 5 /nobreak >nul

echo [2/3] Starting web dashboard...
start "OmniScribe Dashboard" cmd /k "cd /d C:\GIT Folder\Omniscribe\apps\web && pnpm dev"

timeout /t 3 /nobreak >nul

echo [3/3] Starting tray app...
start "OmniScribe Tray" cmd /k "cd /d C:\GIT Folder\Omniscribe\apps\tray && npx electron ."

echo.
echo === All services started ===
echo   Daemon:    http://127.0.0.1:52849
echo   Dashboard: http://localhost:3000
echo   Tray:      System tray icon
