"""Audio in and out through ffmpeg (the system one if present, else the one bundled by imageio-ffmpeg)."""
from __future__ import annotations

import functools
import shutil
import subprocess
import sys

import numpy as np

NO_WINDOW = 0x08000000 if sys.platform == 'win32' else 0      # don't flash a console on Windows


@functools.lru_cache(None)
def ffmpeg_exe() -> str:
    exe = shutil.which('ffmpeg')
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception as e:  # noqa: BLE001
        raise RuntimeError('ffmpeg was not found. Run the installer again, or install ffmpeg.') from e


def run(args, **kw):
    return subprocess.run([ffmpeg_exe(), *args], capture_output=True, creationflags=NO_WINDOW, **kw)


def decode(path: str, sr: int, channels: int) -> np.ndarray:
    """-> float32 array (channels, n)."""
    p = run(['-v', 'error', '-nostdin', '-i', path, '-vn', '-ac', str(channels), '-ar', str(sr),
             '-f', 'f32le', '-acodec', 'pcm_f32le', '-'])
    if p.returncode != 0 or not p.stdout:
        raise RuntimeError('Could not read this audio file: ' + p.stderr.decode(errors='replace').strip()[-300:])
    x = np.frombuffer(p.stdout, dtype=np.float32)
    return x.reshape(-1, channels).T.copy()


def resample(x: np.ndarray, sr_in: int, sr_out: int) -> np.ndarray:
    if sr_in == sr_out:
        return x
    try:
        import julius
        import torch
        return julius.resample_frac(torch.from_numpy(np.ascontiguousarray(x, dtype=np.float32)), sr_in, sr_out).numpy()
    except Exception:  # noqa: BLE001 - plain linear interpolation as a fallback
        n = int(round(len(x) * sr_out / sr_in))
        return np.interp(np.arange(n) * sr_in / sr_out, np.arange(len(x)), x).astype(np.float32)


@functools.lru_cache(None)
def encoders():
    """Hardware H.264 encoders that actually work on this machine, best first, then libx264."""
    found = []
    for enc in ('h264_nvenc', 'h264_amf', 'h264_qsv', 'h264_videotoolbox'):
        p = run(['-v', 'error', '-f', 'lavfi', '-i', 'color=black:s=256x256:d=0.1', '-frames:v', '2',
                 '-c:v', enc, '-f', 'null', '-'], timeout=30)
        if p.returncode == 0:
            found.append(enc)
    found.append('libx264')
    return found


def video_args(enc: str, quality: str = 'high'):
    q = {'high': 18, 'normal': 22}.get(quality, 20)
    if enc == 'h264_nvenc':
        return ['-c:v', enc, '-preset', 'p5', '-tune', 'hq', '-rc', 'vbr', '-cq', str(q), '-b:v', '0']
    if enc == 'h264_amf':
        return ['-c:v', enc, '-quality', 'quality', '-rc', 'cqp', '-qp_i', str(q), '-qp_p', str(q + 2)]
    if enc == 'h264_qsv':
        return ['-c:v', enc, '-preset', 'slow', '-global_quality', str(q)]
    if enc == 'h264_videotoolbox':
        return ['-c:v', enc, '-q:v', '65']
    return ['-c:v', 'libx264', '-preset', 'medium', '-crf', str(q)]
