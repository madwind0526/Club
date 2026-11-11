@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo Checking for an existing server on port 5175...

for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":5175" ^| findstr "LISTENING"') do (
    echo Found existing server on port 5175 ^(PID %%P^) - stopping it...
    taskkill /F /PID %%P >nul 2>&1
)

echo Starting Club Management...
start "" /min C:\Claude\open-url.bat http://127.0.0.1:5175
call npm start
