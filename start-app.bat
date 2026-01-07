@echo off
cd /d "%~dp0"
echo Starting Freight Manager...
start /b node server.js
timeout /t 3 /nobreak > nul
electron .
