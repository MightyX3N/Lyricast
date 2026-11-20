"""Long-running work (timing, export) as jobs the UI polls."""
from __future__ import annotations

import hashlib
import json
import logging
import os
import shutil
import subprocess
import sys
import threading
import time
import traceback
import uuid

import numpy as np

from .engine import audio as A
from .engine.align import HOP, align, vocal_envelope
from .paths import cache_dir

log = logging.getLogger('lyricast')
GPU_LOCK = threading.Lock()                      # one model run at a time


class Job:
    def __init__(self, kind):
        self.id = uuid.uuid4().hex[:12]
        self.kind = kind
        self.state = 'running'
        self.stage = 'Starting…'
        self.progress = None
        self.result = None
        self.error = None
        self.cancelled = False
        self.t0 = time.time()

    def set(self, stage=None, progress=None):
        if stage is not None:
            self.stage = stage
        self.progress = progress

    def view(self):
        return {'id': self.id, 'kind': self.kind, 'state': self.state, 'stage': self.stage,
                'progress': self.progress, 'result': self.result, 'error': self.error,
                'elapsed': round(time.time() - self.t0, 1)}


JOBS: dict[str, Job] = {}


def start_job(kind, fn, *args):
    job = Job(kind)
    JOBS[job.id] = job

    def run():
        try:
            job.result = fn(job, *args)
            job.state = 'done'
        except InterruptedError:
            job.state = 'cancelled'
        except Exception as e:  # noqa: BLE001
            log.error('job %s failed:\n%s', kind, traceback.format_exc())
            job.error = friendly(e)
            job.state = 'error'
    threading.Thread(target=run, daemon=True).start()
    return job


def friendly(e):
    s = str(e) or e.__class__.__name__
    low = s.lower()
    if 'no kernel image' in low or 'sm_120' in low:
        return ('Your GPU is newer than this PyTorch build. Run the installer again so it installs the CUDA 12.8 '
                'build of PyTorch, or set LYRICAST_CPU=1 to use the CPU. (' + s[:200] + ')')
    if 'out of memory' in low:
        return 'Ran out of memory. Close other GPU apps or set LYRICAST_CPU=1. (' + s[:200] + ')'
    if any(k in low for k in ('connection', 'resolve', 'offline', 'max retries', 'timed out', 'ssl')):
        return 'Could not download the model. The first run needs an internet connection. (' + s[:200] + ')'
    if isinstance(e, ModuleNotFoundError):
        return f'{s}. Run the installer again (install.bat / install.sh).'
    return s


# ---------------------------------------------------------------- audio store
def store_audio(data: bytes, name: str) -> dict:
    key = hashlib.sha1(data).hexdigest()[:20]
    d = os.path.join(cache_dir(), key)
    os.makedirs(d, exist_ok=True)
    ext = os.path.splitext(name)[1].lower()[:6] or '.audio'
    path = os.path.join(d, 'source' + ext)
    if not os.path.exists(path):
        with open(path + '.part', 'wb') as f:
            f.write(data)
        os.replace(path + '.part', path)
    meta = {'name': name, 'path': path}
    with open(os.path.join(d, 'meta.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f)
    return {'id': key, 'name': name}


def audio_path(key: str) -> str:
    if not key or not key.isalnum():
        raise ValueError('Unknown audio')
    with open(os.path.join(cache_dir(), key, 'meta.json'), encoding='utf-8') as f:
        return json.load(f)['path']


def _cached(key, name, make):
    p = os.path.join(cache_dir(), key, name)
    if os.path.exists(p):
        try:
            return np.load(p)
        except Exception:  # noqa: BLE001
            pass
    arr = make()
    np.save(p + '.tmp.npy', arr)
    os.replace(p + '.tmp.npy', p)
    return arr


# ---------------------------------------------------------------- timing
def timing_job(job: Job, key: str, lines: list[str], mode: str, cues, separate: bool, options: dict):
    from .engine import models as M
    path = audio_path(key)
    t_start = time.time()
    report = {'device': None, 'separated': separate}
    W = {'sep': (0.0, 0.55), 'em': (0.55, 0.9), 'al': (0.9, 1.0)} if separate else {'em': (0.0, 0.85), 'al': (0.85, 1.0)}

    def stage(name):
        a, b = W[name]
        return lambda s, p: job.set(s, None if p is None else a + (b - a) * p)

    cancel = lambda: job.cancelled  # noqa: E731
    with GPU_LOCK:
        job.set('Reading the song…', 0)
        M.device()
        report['device'] = M.torch_info().get('gpu') or 'CPU'
        if separate:
            def sep():
                wav = A.decode(path, 44100, 2)
                v = M.separate_vocals(wav, stage('sep'), cancel)
                return A.resample(v, 44100, 16000).astype(np.float32)
            t0 = time.time()
            voice = _cached(key, 'vocals16k.npy', sep)
            report['separate_s'] = round(time.time() - t0, 1)
        else:
            voice = _cached(key, 'mix16k.npy', lambda: A.decode(path, 16000, 1)[0])
        t0 = time.time()
        tag = 'vocals' if separate else 'mix'

        vpath = os.path.join(cache_dir(), key, f'vocab-{tag}.json')

        def emit():
            em, vocab = M.emissions(voice, stage('em'), cancel)
            with open(vpath, 'w', encoding='utf-8') as f:
                json.dump(vocab, f)
            return em.astype(np.float16)
        em = _cached(key, f'emissions-{tag}.npy', emit).astype(np.float32)
        report['emissions_s'] = round(time.time() - t0, 1)
        try:
            with open(vpath, encoding='utf-8') as f:
                vocab = json.load(f)
        except OSError:
            vocab = M.DEFAULT_VOCAB

    job.set('Lining up every word…', W['al'][0])
    env = vocal_envelope(voice, em.shape[0]) if separate else None
    t0 = time.time()
    res = align(em, lines, vocab, env_db=env, mode=mode, cues=cues,
                star_penalty=float(options.get('star_penalty', 2.5)),
                window=float(options.get('window', 4.0)),
                progress=lambda f, al=stage('al'): al(None, f), cancel=cancel)
    report['align_s'] = round(time.time() - t0, 1)
    report['total_s'] = round(time.time() - t_start, 1)
    report['frames'] = int(em.shape[0])
    report['flagged'] = sum(r['est'] for r in res)
    log.info('timing done: %s', report)
    return {'lines': res, 'report': report}


# ---------------------------------------------------------------- features
def features(key: str, fps: float, n_frames: int):
    path = audio_path(key)
    mono = _cached(key, 'mix44k.npy', lambda: A.decode(path, 44100, 1)[0])
    from .engine.features import analyser_frames
    return analyser_frames(mono, 44100, fps, n_frames)


# ---------------------------------------------------------------- export
class Export:
    """Raw RGBA frames in (any order, numbered), H.264 MP4 out, song muxed in."""

    def __init__(self, key, W, H, fps, out_path, encoder=None):
        self.id = uuid.uuid4().hex[:12]
        self.W, self.H, self.fps = W, H, fps
        self.out = out_path
        self.tmp = out_path + '.part.mp4'
        self.next = 0
        self.pending = {}
        self.lock = threading.Condition()
        self.error = None
        self.encoder = encoder or A.encoders()[0]
        src = audio_path(key)
        args = [A.ffmpeg_exe(), '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{W}x{H}',
                '-r', str(fps), '-i', '-', '-i', src, '-map', '0:v', '-map', '1:a',
                *A.video_args(self.encoder), '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k',
                '-shortest', '-movflags', '+faststart', self.tmp]
        log.info('export: %s', ' '.join(args))
        self.proc = subprocess.Popen(args, stdin=subprocess.PIPE, stderr=subprocess.PIPE,
                                     creationflags=A.NO_WINDOW)
        self.err_buf = b''
        threading.Thread(target=self._drain, daemon=True).start()

    def _drain(self):
        for line in self.proc.stderr:
            self.err_buf = (self.err_buf + line)[-4000:]

    def frame(self, index: int, data: bytes, count: int = 1):
        size = self.W * self.H * 4
        if len(data) != size * count:
            raise ValueError(f'Frame size mismatch: got {len(data)} bytes, expected {size * count}')
        with self.lock:
            # keep at most ~16 frames waiting for an earlier one
            while index > self.next + 16 and not self.error:
                self.lock.wait(5)
            self.pending[index] = (data, count)
            while self.next in self.pending:
                buf, n = self.pending.pop(self.next)
                try:
                    self.proc.stdin.write(buf)
                except (BrokenPipeError, OSError):
                    self.error = 'The video encoder stopped: ' + self.err_buf.decode(errors='replace')[-400:]
                    break
                self.next += n
            self.lock.notify_all()
        if self.error:
            raise RuntimeError(self.error)

    def finish(self):
        try:
            self.proc.stdin.close()
        except OSError:
            pass
        rc = self.proc.wait()
        if rc != 0:
            msg = self.err_buf.decode(errors='replace')[-600:]
            if self.encoder != 'libx264':
                log.warning('%s failed (%s), the next export will use libx264', self.encoder, msg)
                A.encoders.cache_clear()
            raise RuntimeError('ffmpeg failed: ' + msg)
        os.replace(self.tmp, self.out)
        return {'path': self.out, 'size': os.path.getsize(self.out), 'frames': self.next, 'encoder': self.encoder}

    def cancel(self):
        try:
            self.proc.kill()
        except OSError:
            pass
        try:
            os.remove(self.tmp)
        except OSError:
            pass


def reveal(path: str):
    """Show a file in the system file manager."""
    if sys.platform == 'win32':
        subprocess.Popen(['explorer', '/select,', os.path.normpath(path)])
    elif sys.platform == 'darwin':
        subprocess.Popen(['open', '-R', path])
    else:
        target = path if os.path.isdir(path) else os.path.dirname(path)
        opener = shutil.which('xdg-open') or shutil.which('gio')
        if opener:
            subprocess.Popen([opener, target] if 'xdg' in opener else [opener, 'open', target])


def open_file(path: str):
    if sys.platform == 'win32':
        os.startfile(path)  # noqa: S606
    elif sys.platform == 'darwin':
        subprocess.Popen(['open', path])
    else:
        opener = shutil.which('xdg-open')
        if opener:
            subprocess.Popen([opener, path])
