@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js bulunamadi. https://nodejs.org/ adresinden Node.js 20+ kur.
  pause
  exit /b 1
)
if not exist "node_modules\three" (
  echo Ilk kurulum: 3D motoru ve TikTok baglayicisi indiriliyor...
  call npm install
)
start "Son Yolculuk Sunucusu" cmd /k "node server.mjs"
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"
