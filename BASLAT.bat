@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js bulunamadi. https://nodejs.org/ adresinden Node.js kur.
  pause
  exit /b 1
)
start "Son Yolculuk Sunucusu" cmd /k "node server.mjs"
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"
