@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-LeMondeDeLilaWX.ps1"
if errorlevel 1 (
  echo L'installation du client a echoue.
  pause
  exit /b 1
)
endlocal
