#!/usr/bin/env bash
# Lyricast setup for Linux (and macOS).
set -euo pipefail
cd "$(dirname "$0")"

PY=""
for v in python3.12 python3.13 python3.11 python3.10 python3; do
  if command -v "$v" >/dev/null 2>&1 && "$v" -c 'import sys; sys.exit(0 if (3,10) <= sys.version_info[:2] <= (3,13) else 1)' 2>/dev/null; then
    PY="$v"; break
  fi
done
if [ -z "$PY" ]; then
  echo "Python 3.10 to 3.13 is needed (with venv). For example: sudo apt install python3 python3-venv"; exit 1
fi
echo "Using $PY"
[ -d .venv ] || "$PY" -m venv .venv
VPY=.venv/bin/python
"$VPY" -m pip install --upgrade pip

if [ "$(uname)" = "Linux" ] && command -v nvidia-smi >/dev/null 2>&1; then
  echo "NVIDIA GPU found, installing PyTorch with CUDA..."
  "$VPY" -m pip install --upgrade torch            # Linux wheels on PyPI include CUDA
elif [ "$(uname)" = "Linux" ]; then
  echo "No NVIDIA GPU found, installing the CPU build of PyTorch..."
  "$VPY" -m pip install --upgrade torch --index-url https://download.pytorch.org/whl/cpu
else
  "$VPY" -m pip install --upgrade torch
fi
"$VPY" -m pip install -r requirements.txt
"$VPY" -c "import torch; print('PyTorch', torch.__version__, '| GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'none (CPU)')"

# app menu entry
if [ "$(uname)" = "Linux" ]; then
  mkdir -p "$HOME/.local/share/applications"
  cat > "$HOME/.local/share/applications/lyricast.desktop" <<DESK
[Desktop Entry]
Type=Application
Name=Lyricast
Comment=Lyric video maker
Exec="$(pwd)/run.sh"
Icon=$(pwd)/ui/icon.svg
Terminal=false
Categories=AudioVideo;
DESK
fi
echo
echo "Lyricast is installed. Start it with ./run.sh (or from your app menu)."
echo "The first Auto-time downloads the models (about 1.5 GB), after that it works offline."
