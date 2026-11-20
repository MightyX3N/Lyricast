"""Start Lyricast: local server + app window.

  python -m lyricast            app window (falls back to a browser app window)
  python -m lyricast --browser  open in the default browser instead
  python -m lyricast --server   only run the server (prints the address)
"""
import argparse
import json
import logging
import os
import shutil
import subprocess
import sys
import time
import urllib.request
import webbrowser

from . import __version__
from .paths import data_dir

PORT = int(os.environ.get('LYRICAST_PORT', 47321))


def setup_logging():
    path = os.path.join(data_dir(), 'lyricast.log')
    try:
        if os.path.getsize(path) > 5 * 2**20:
            os.replace(path, path + '.old')
    except OSError:
        pass
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s',
                        handlers=[logging.FileHandler(path, encoding='utf-8'), logging.StreamHandler(sys.stdout)])
    logging.getLogger('lyricast').info('Lyricast %s · Python %s · %s', __version__, sys.version.split()[0], sys.platform)


def running_instance():
    try:
        req = urllib.request.Request(f'http://127.0.0.1:{PORT}/api/ping', headers={'X-Lyricast': '1'})
        with urllib.request.urlopen(req, timeout=1) as r:
            return json.load(r).get('app') == 'lyricast'
    except Exception:  # noqa: BLE001
        return False


def find_chromium():
    names = ['msedge', 'chrome', 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'brave', 'brave-browser']
    for n in names:
        p = shutil.which(n)
        if p:
            return p
    if sys.platform == 'win32':
        for base in [os.environ.get('PROGRAMFILES(X86)'), os.environ.get('PROGRAMFILES'), os.environ.get('LOCALAPPDATA')]:
            for rel in [r'Microsoft\Edge\Application\msedge.exe', r'Google\Chrome\Application\chrome.exe']:
                if base and os.path.isfile(os.path.join(base, rel)):
                    return os.path.join(base, rel)
    return None


def app_window(url, log):
    """pywebview first (WebView2 on Windows, GTK/Qt on Linux), then a Chromium --app window."""
    try:
        import webview
        from .server import STATE
        win = webview.create_window('Lyricast', url, width=1500, height=960, min_size=(900, 600), background_color='#111216')

        def raise_window():
            try:
                win.restore()
                win.show()
            except Exception:  # noqa: BLE001
                pass
        STATE['on_import'] = raise_window
        webview.start(private_mode=False, storage_path=os.path.join(data_dir(), 'webview'))
        return True
    except Exception as e:  # noqa: BLE001
        log.info('pywebview not available (%s), trying a browser app window', e)
    exe = find_chromium()
    if exe:
        prof = os.path.join(data_dir(), 'browser-profile')
        p = subprocess.Popen([exe, f'--app={url}', f'--user-data-dir={prof}', '--no-first-run',
                              '--no-default-browser-check', '--window-size=1500,960'])
        p.wait()
        # some browsers hand the window to an already running process and exit at once
        if time.time() - START > 15:
            return True
        log.info('browser exited early; keeping the server running')
        wait_idle()
        return True
    return False


def wait_idle():
    """Run until the UI has been gone for a while (it polls every few seconds)."""
    from .server import STATE
    while time.time() - STATE['last_seen'] < 120:
        time.sleep(5)


START = time.time()


def main():
    ap = argparse.ArgumentParser(prog='lyricast')
    ap.add_argument('--browser', action='store_true', help='open in the default browser')
    ap.add_argument('--server', action='store_true', help='only run the server')
    a = ap.parse_args()
    setup_logging()
    log = logging.getLogger('lyricast')
    if running_instance() and not a.server:
        url = f'http://127.0.0.1:{PORT}/'
        log.info('Lyricast is already running at %s', url)
        webbrowser.open(url)
        return
    from .server import serve, warm_up
    srv, port = serve(PORT)
    warm_up()
    url = f'http://127.0.0.1:{port}/'
    print(f'Lyricast is running at {url}  (close this window to quit)', flush=True)
    try:
        if a.server:
            while True:
                time.sleep(3600)
        if a.browser or not app_window(url, log):
            webbrowser.open(url)
            wait_idle()
    except KeyboardInterrupt:
        pass
    finally:
        srv.shutdown()


if __name__ == '__main__':
    main()
