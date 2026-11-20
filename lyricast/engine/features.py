"""Per-frame audio features for offline rendering, matching what the live preview gets
from the browser's AnalyserNode (fftSize 256 -> 128 byte bins, -100..-30 dB)."""
import numpy as np


def analyser_frames(mono: np.ndarray, sr: int, fps: float, n_frames: int, bins: int = 128,
                    smoothing_60fps: float = 0.78):
    win = 2048
    group = max(1, (win // 2) // bins)
    w = np.blackman(win).astype(np.float32)
    x = np.pad(np.asarray(mono, dtype=np.float32), (win, win))
    k = smoothing_60fps ** (60.0 / fps)
    prev = np.zeros(bins, np.float32)
    level = np.zeros(n_frames, np.float32)
    out = np.zeros((n_frames, bins), np.uint8)
    for i in range(n_frames):
        c = int(i / fps * sr) + win
        seg = x[c - win // 2:c + win // 2]
        if len(seg) < win:
            seg = np.pad(seg, (0, win - len(seg)))
        mag = np.abs(np.fft.rfft(seg * w))[:win // 2] / win * 4
        mag = mag[:bins * group].reshape(bins, group).max(1)
        prev = k * prev + (1 - k) * mag
        db = 20 * np.log10(prev + 1e-12)
        b = np.clip((db + 100) / 70 * 255, 0, 255)
        out[i] = b.astype(np.uint8)
        level[i] = min(1.0, float(b[:24].sum()) / (24 * 200))
    return level, out
