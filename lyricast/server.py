"""Local HTTP server: serves the editor UI and the engine API on 127.0.0.1 only."""
from __future__ import annotations

import base64
import json
import logging
import mimetypes
import os
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import numpy as np

from . import __version__, pipeline as P
from .paths import data_dir, videos_dir

log = logging.getLogger('lyricast')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UI = os.path.join(ROOT, 'ui')
USERSCRIPT = os.path.join(ROOT, 'userscript', 'lyricast-suno.user.js')
MAX_BODY = 1 << 31

STATE = {'torch': None, 'encoders': None, 'imports': [], 'exports': {}, 'made': set(),
         'on_import': None, 'last_seen': time.time()}


def warm_up():
    """Probe PyTorch / GPU and video encoders in the background so the UI can show them."""
    def go():
        from .engine.models import torch_info
        try:
            STATE['torch'] = torch_info()
        except Exception as e:  # noqa: BLE001
            STATE['torch'] = {'device': 'unavailable', 'error': str(e)}
        try:
            from .engine.audio import encoders
            STATE['encoders'] = encoders()
        except Exception as e:  # noqa: BLE001
            STATE['encoders'] = ['unavailable: ' + str(e)]
        log.info('torch: %s · encoders: %s', STATE['torch'], STATE['encoders'])
    threading.Thread(target=go, daemon=True).start()


def safe_name(s, fallback='lyric video'):
    s = re.sub(r'[\\/:*?"<>|\x00-\x1f]+', ' ', str(s or '')).strip().strip('.')
    return (s or fallback)[:120]


class Handler(BaseHTTPRequestHandler):
    server_version = 'Lyricast'
    protocol_version = 'HTTP/1.1'

    def log_message(self, fmt, *args):  # quiet; errors go to the log file
        pass

    # ---- helpers
    def _host_ok(self):
        host = (self.headers.get('Host') or '').split(':')[0]
        return host in ('127.0.0.1', 'localhost')

    def _send(self, code, body=b'', ctype='application/json', headers=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode()
        elif isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def _err(self, code, msg):
        self._send(code, {'error': msg})

    def _body(self):
        n = int(self.headers.get('Content-Length') or 0)
        if n > MAX_BODY:
            raise ValueError('Too large')
        buf = bytearray(n)
        view = memoryview(buf)
        got = 0
        while got < n:
            k = self.rfile.readinto(view[got:])
            if not k:
                break
            got += k
        return bytes(buf[:got])

    def _json(self):
        return json.loads(self._body() or b'{}')

    # ---- routing
    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        if not self._host_ok():
            return self._err(403, 'Forbidden host')
        u = urlparse(self.path)
        if u.path.startswith('/api/'):
            if not self.headers.get('X-Lyricast'):
                return self._err(403, 'Missing header')
            return self._api('GET', u)
        return self._static(u.path)

    def do_POST(self):
        if not self._host_ok():
            return self._err(403, 'Forbidden host')
        u = urlparse(self.path)
        if not u.path.startswith('/api/') or not self.headers.get('X-Lyricast'):
            return self._err(403, 'Forbidden')
        return self._api('POST', u)

    def _static(self, path):
        if path in ('/', ''):
            path = '/index.html'
        if path.startswith('/lyricast-suno.user.js'):
            f = USERSCRIPT
        else:
            f = os.path.normpath(os.path.join(UI, path.lstrip('/')))
            if not f.startswith(UI + os.sep):
                return self._err(404, 'Not found')
        if not os.path.isfile(f):
            return self._err(404, 'Not found')
        ctype = mimetypes.guess_type(f)[0] or 'application/octet-stream'
        if f.endswith('.js'):
            ctype = 'text/javascript; charset=utf-8'
        elif f.endswith('.css'):
            ctype = 'text/css; charset=utf-8'
        elif f.endswith('.html'):
            ctype = 'text/html; charset=utf-8'
        elif f.endswith('.woff2'):
            ctype = 'font/woff2'
        with open(f, 'rb') as fh:
            data = fh.read()
        self._send(200, data, ctype)

    def _api(self, method, u):
        q = {k: v[-1] for k, v in parse_qs(u.query).items()}
        parts = [p for p in u.path.split('/') if p][1:]
        STATE['last_seen'] = time.time()
        try:
            return self._route(method, parts, q)
        except FileNotFoundError:
            return self._err(404, 'Not found. The song may have been removed from the cache; add it again.')
        except Exception as e:  # noqa: BLE001
            log.exception('api error %s %s', method, self.path)
            return self._err(500, P.friendly(e))

    def _route(self, M, parts, q):
        head = parts[0] if parts else ''
        if M == 'GET' and head == 'ping':
            return self._send(200, {'app': 'lyricast', 'version': __version__})
        if M == 'GET' and head == 'status':
            return self._send(200, {'version': __version__, 'torch': STATE['torch'], 'encoders': STATE['encoders'],
                                    'videos': videos_dir(), 'data': data_dir()})
        if head == 'audio':
            if M == 'POST':
                name = safe_name(self.headers.get('X-Name') or q.get('name'), 'song')
                return self._send(200, P.store_audio(self._body(), name))
            path = P.audio_path(parts[1])
            with open(path, 'rb') as f:
                return self._send(200, f.read(), mimetypes.guess_type(path)[0] or 'application/octet-stream')
        if head == 'timing' and M == 'POST':
            b = self._json()
            lines = [str(x)[:500] for x in b.get('lines', [])]
            if not lines:
                return self._err(400, 'No lyrics')
            cues = [(c.get('start'), c.get('end')) if c else None for c in (b.get('cues') or [])] or None
            job = P.start_job('timing', P.timing_job, b['audio'], lines, b.get('mode', 'auto'), cues,
                              bool(b.get('separate', True)), b.get('options') or {})
            return self._send(200, {'job': job.id})
        if head == 'job':
            job = P.JOBS.get(parts[1])
            if not job:
                return self._err(404, 'No such job')
            if M == 'POST' and parts[2:] == ['cancel']:
                job.cancelled = True
            return self._send(200, job.view())
        if head == 'features' and M == 'GET':
            fps, n = float(q.get('fps', 30)), int(q.get('n', 0))
            level, bins = P.features(parts[1], fps, n)
            return self._send(200, level.astype(np.float32).tobytes() + bins.tobytes(), 'application/octet-stream')
        if head == 'export':
            return self._export(M, parts[1:], q)
        if head == 'reveal' and M == 'POST':
            p = self._json().get('path')
            if p in STATE['made'] or p == videos_dir():
                P.reveal(p)
            return self._send(200, {'ok': True})
        if head == 'open' and M == 'POST':
            p = self._json().get('path')
            if p in STATE['made']:
                P.open_file(p)
            return self._send(200, {'ok': True})
        if head == 'suno' and M == 'POST':
            return self._suno()
        if head == 'imports' and M == 'GET':
            items, STATE['imports'] = STATE['imports'], []
            return self._send(200, items)
        return self._err(404, 'Unknown endpoint')

    def _export(self, M, parts, q):
        if parts == ['start'] and M == 'POST':
            b = self._json()
            W, H, fps = int(b['W']), int(b['H']), float(b['fps'])
            if not (16 <= W <= 7680 and 16 <= H <= 4320 and 1 <= fps <= 120):
                return self._err(400, 'Bad video size')
            base = safe_name(b.get('name'))
            out = os.path.join(videos_dir(), base + '.mp4')
            k = 2
            while os.path.exists(out):
                out = os.path.join(videos_dir(), f'{base} ({k}).mp4')
                k += 1
            ex = P.Export(b['audio'], W, H, fps, out, b.get('encoder'))
            STATE['exports'][ex.id] = ex
            return self._send(200, {'id': ex.id, 'path': out, 'encoder': ex.encoder})
        ex = STATE['exports'].get(parts[0]) if parts else None
        if not ex:
            return self._err(404, 'No such export')
        action = parts[1] if len(parts) > 1 else ''
        if action == 'frame':
            ex.frame(int(q.get('i', 0)), self._body(), int(q.get('n', 1)))
            return self._send(200, {'ok': True, 'written': ex.next})
        if action == 'finish':
            res = ex.finish()
            STATE['exports'].pop(ex.id, None)
            STATE['made'].add(res['path'])
            return self._send(200, res)
        if action == 'cancel':
            ex.cancel()
            STATE['exports'].pop(ex.id, None)
            return self._send(200, {'ok': True})
        return self._err(404, 'Unknown export action')

    def _suno(self):
        b = self._json()
        cues = b.get('cues') or []
        raw = base64.b64decode(b.get('audio') or '')
        if not raw or not isinstance(cues, list):
            return self._err(400, 'Nothing to import')
        title = safe_name(b.get('title'), 'Suno song')
        info = P.store_audio(raw, title + '.mp3')
        STATE['imports'].append({'audio': info['id'], 'title': title, 'cues': cues, 'source': 'suno'})
        cb = STATE.get('on_import')
        if cb:
            try:
                cb()
            except Exception:  # noqa: BLE001
                pass
        return self._send(200, {'ok': True, 'lines': len(cues)})


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = False
    request_queue_size = 64


def serve(port_from=47321, tries=10):
    last = None
    for port in range(port_from, port_from + tries):
        try:
            srv = Server(('127.0.0.1', port), Handler)
        except OSError as e:
            last = e
            continue
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        return srv, port
    raise RuntimeError(f'No free port from {port_from}: {last}')
