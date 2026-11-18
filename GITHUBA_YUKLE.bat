@echo off
setlocal
cd /d "%~dp0"
where git >nul 2>&1
if errorlevel 1 (
  echo HATA: Git for Windows kurulu degil. https://git-scm.com/download/win
  pause
  exit /b 1
)
if not exist ".git" (
  git init -b main
  if errorlevel 1 goto err
)
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin https://github.com/mehmetalisahingm/Esref-Tek-Son-Yolculuk.git
  if errorlevel 1 goto err
)
git add -A
if errorlevel 1 goto err
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Initial TikTok LIVE funeral procession web game"
  if errorlevel 1 goto err
)
git branch -M main
git push -u origin main
if errorlevel 1 goto err
echo.
echo Kod GitHub'a yuklendi: https://github.com/mehmetalisahingm/Esref-Tek-Son-Yolculuk
pause
exit /b 0
:err
echo.
echo HATA: GitHub'da bos repo olusturuldugundan ve oturum acildigindan emin ol.
pause
exit /b 1
