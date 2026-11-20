"""Where Lyricast keeps its things."""
import os
import subprocess
import sys


def data_dir():
    if sys.platform == 'win32':
        base = os.environ.get('LOCALAPPDATA') or os.path.expanduser('~\\AppData\\Local')
        d = os.path.join(base, 'Lyricast')
    elif sys.platform == 'darwin':
        d = os.path.expanduser('~/Library/Application Support/Lyricast')
    else:
        d = os.path.join(os.environ.get('XDG_DATA_HOME') or os.path.expanduser('~/.local/share'), 'lyricast')
    os.makedirs(d, exist_ok=True)
    return d


def cache_dir():
    d = os.path.join(data_dir(), 'songs')
    os.makedirs(d, exist_ok=True)
    return d


def videos_dir():
    d = None
    if sys.platform.startswith('linux'):
        try:
            d = subprocess.run(['xdg-user-dir', 'VIDEOS'], capture_output=True, text=True, timeout=3).stdout.strip()
            if d == os.path.expanduser('~'):
                d = None
        except Exception:  # noqa: BLE001
            d = None
    d = os.path.join(d or os.path.join(os.path.expanduser('~'), 'Videos'), 'Lyricast')
    os.makedirs(d, exist_ok=True)
    return d
