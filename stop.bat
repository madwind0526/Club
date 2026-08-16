@echo off
setlocal enabledelayedexpansion
echo Stopping Club Management...

for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
    echo Stopping server on port 5173 ^(PID %%P^)...
    taskkill /F /PID %%P >nul 2>&1
)

rem Only closes the Club Management window, not other unrelated Electron apps that may be
rem running (Electron dev processes all share the image name "electron.exe").
taskkill /F /IM electron.exe /FI "WINDOWTITLE eq Club Management*" >nul 2>&1

echo Done.
