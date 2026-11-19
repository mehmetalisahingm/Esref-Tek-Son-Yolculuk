@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js bulunamadi. https://nodejs.org/ adresinden Node.js 20+ kur.
  pause
  exit /b 1
)
set NEED_INSTALL=0
if not exist "node_modules\three" set NEED_INSTALL=1
if not exist "node_modules\tiktok-live-connector" set NEED_INSTALL=1
if not exist "node_modules\ws" set NEED_INSTALL=1
if "%NEED_INSTALL%"=="1" (
  echo Paketler kuruluyor: 3D motoru ve TikTok baglayicisi...
  call npm install
  if errorlevel 1 (
    echo.
    echo HATA: npm install basarisiz oldu. Internet baglantini kontrol edip tekrar dene.
    pause
    exit /b 1
  )
)
start "Son Yolculuk Sunucusu" cmd /k "node server.mjs"
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"
