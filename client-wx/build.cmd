@echo off
setlocal

call "%~dp0build-codex.cmd"
if errorlevel 1 exit /b 1

endlocal

