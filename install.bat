@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Lyricast setup

rem ---- find Python 3.10 - 3.13 (PyTorch does not support every new Python right away)
set "PY="
for %%v in (3.12 3.13 3.11 3.10) do (
  if not defined PY (
    py -%%v -c "import sys" >nul 2>nul && set "PY=py -%%v"
  )
)
if not defined PY (
  python -c "import sys; sys.exit(0 if (3,10) <= sys.version_info[:2] <= (3,13) else 1)" >nul 2>nul && set "PY=python"
)
if not defined PY (
  echo.
  echo  Python 3.10 to 3.13 is needed. Get Python 3.12 from https://www.python.org/downloads/
  echo  and tick "Add python.exe to PATH" during setup. Then run install.bat again.
  echo.
  pause
  exit /b 1
)
echo Using %PY%

if not exist .venv (
  %PY% -m venv .venv || (echo Could not create the virtual environment. & pause & exit /b 1)
)
set "VPY=.venv\Scripts\python.exe"
"%VPY%" -m pip install --upgrade pip

rem ---- PyTorch: CUDA build for NVIDIA cards (RTX 50xx needs CUDA 12.8 or newer), CPU build otherwise
set "TORCH_OK="
where nvidia-smi >nul 2>nul
if %errorlevel%==0 (
  echo NVIDIA GPU found, installing PyTorch with CUDA...
  for %%c in (cu128 cu130 cu126) do (
    if not defined TORCH_OK (
      "%VPY%" -m pip install --upgrade torch --index-url https://download.pytorch.org/whl/%%c && set "TORCH_OK=1"
    )
  )
)
if not defined TORCH_OK (
  echo Installing PyTorch for the CPU...
  "%VPY%" -m pip install --upgrade torch --index-url https://download.pytorch.org/whl/cpu || (echo PyTorch install failed. & pause & exit /b 1)
)

"%VPY%" -m pip install -r requirements.txt || (echo Installing the other parts failed. & pause & exit /b 1)

"%VPY%" -c "import torch; print('PyTorch', torch.__version__, '| GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'none (CPU)')"

rem ---- desktop shortcut
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Lyricast.lnk'); $s.TargetPath='%~dp0run.bat'; $s.WorkingDirectory='%~dp0'; $s.WindowStyle=7; $s.Save()" >nul 2>nul

echo.
echo  Lyricast is installed. Start it with run.bat or the Lyricast shortcut on your desktop.
echo  The first Auto-time downloads the models (about 1.5 GB), after that it works offline.
echo.
pause
