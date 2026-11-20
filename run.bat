@echo off
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  echo Lyricast is not installed yet. Running install.bat first...
  call install.bat || exit /b 1
)
.venv\Scripts\python.exe -m lyricast %*
if errorlevel 1 pause
