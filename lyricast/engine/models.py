"""The two neural models: Demucs (vocal separation) and MMS wav2vec2 (letter emissions).

Both are loaded lazily, kept in memory between runs, and run on the GPU when
PyTorch can see one (CUDA), otherwise on the CPU.
"""
from __future__ import annotations

import logging
import os
import threading
import time

import numpy as np

log = logging.getLogger('lyricast')

ALIGNER_ID = os.environ.get('LYRICAST_ALIGNER', 'MahmoudAshraf/mms-300m-1130-forced-aligner')
DEMUCS_ID = os.environ.get('LYRICAST_DEMUCS', 'htdemucs')

_chars = "a i e n o u t s r m k l d g h y b p w c v j z f ' q x".split()
DEFAULT_VOCAB = {'<blank>': 0, '<pad>': 1, '</s>': 2, '<unk>': 3, **{c: i + 4 for i, c in enumerate(_chars)}}

_lock = threading.Lock()
_cache = {}


def torch_info():
    try:
        import torch
    except Exception as e:  # noqa: BLE001
        return {'torch': None, 'device': 'unavailable', 'error': f'PyTorch is not installed ({e})'}
    info = {'torch': torch.__version__, 'cuda': torch.version.cuda, 'device': 'cpu', 'gpu': None}
    try:
        if torch.cuda.is_available():
            info['device'] = 'cuda'
            info['gpu'] = torch.cuda.get_device_name(0)
            free, total = torch.cuda.mem_get_info()
            info['vram_gb'] = round(total / 2**30, 1)
    except Exception as e:  # noqa: BLE001
        info['cuda_error'] = str(e)
    return info


def device():
    import torch
    if os.environ.get('LYRICAST_CPU'):
        return torch.device('cpu')
    try:
        if torch.cuda.is_available():
            torch.zeros(1, device='cuda')          # catches "no kernel image" on unsupported GPUs
            return torch.device('cuda')
    except Exception as e:  # noqa: BLE001
        log.warning('CUDA present but unusable, using CPU: %s', e)
    return torch.device('cpu')


def _hf_cache_bytes():
    root = os.environ.get('HF_HUB_CACHE') or os.path.join(
        os.environ.get('HF_HOME') or os.path.join(os.path.expanduser('~'), '.cache', 'huggingface'), 'hub')
    tot = 0
    for d, _, fs in os.walk(root):
        for f in fs:
            try:
                tot += os.path.getsize(os.path.join(d, f))
            except OSError:
                pass
    return tot


def _with_download_watch(fn, stage):
    """Run fn() while reporting how much the model cache has grown (first-run downloads)."""
    done = threading.Event()
    base = _hf_cache_bytes()

    def watch():
        while not done.wait(1.0):
            grown = _hf_cache_bytes() - base
            if grown > 2**20:
                stage(f'Downloading the model · {grown / 2**20:.0f} MB so far (first run only)', None)

    th = threading.Thread(target=watch, daemon=True)
    th.start()
    try:
        return fn()
    finally:
        done.set()


# ---------------------------------------------------------------- aligner (MMS)
def load_aligner(stage=lambda s, p: None):
    with _lock:
        if 'aligner' in _cache:
            return _cache['aligner']
        import torch
        from transformers import Wav2Vec2ForCTC
        dev = device()
        stage('Loading the vocal aligner…', None)

        def load():
            return Wav2Vec2ForCTC.from_pretrained(ALIGNER_ID)
        model = _with_download_watch(load, stage)
        vocab = dict(DEFAULT_VOCAB)
        try:
            from transformers import AutoTokenizer
            tok = AutoTokenizer.from_pretrained(ALIGNER_ID)
            v = tok.get_vocab()
            if all(c in v for c in 'abcdefghijklmnopqrstuvwxyz'):
                vocab = v
        except Exception as e:  # noqa: BLE001
            log.info('tokenizer not loaded, using built-in vocab: %s', e)
        model.eval().to(dev)
        if dev.type == 'cuda':
            model.half()
        _cache['aligner'] = (model, vocab, dev)
        return _cache['aligner']


def emissions(wav16k: np.ndarray, stage=lambda s, p: None, cancel=lambda: False,
              chunk_s=30.0, ctx_s=2.0):
    """Log-probabilities (T, V) at 50 frames/s for a mono 16 kHz signal. Long audio is cut
    into windows with overlapping context so every frame sees ±2 s around it."""
    import torch
    model, vocab, dev = load_aligner(stage)
    x = np.asarray(wav16k, dtype=np.float32)
    x = (x - x.mean()) / (x.std() + 1e-7)
    hop = 320
    n = len(x)
    T = n // hop
    chunk = int(chunk_s * 16000) // hop * hop
    ctx = int(ctx_s * 16000) // hop * hop
    outs = []
    t0 = time.time()
    starts = list(range(0, max(n, 1), chunk))
    with torch.inference_mode():
        for i, s in enumerate(starts):
            if cancel():
                raise InterruptedError()
            a, b = max(0, s - ctx), min(n, s + chunk + ctx)
            seg = torch.from_numpy(x[a:b]).to(dev)[None]
            if dev.type == 'cuda':
                seg = seg.half()
            logits = model(seg).logits[0].float()
            lp = torch.log_softmax(logits, dim=-1).cpu().numpy()
            off = (s - a) // hop
            want = min(chunk, n - s) // hop
            got = lp[off:off + want]
            if len(got) < want:                      # model output a frame short at the very end
                got = np.concatenate([got, np.repeat(got[-1:], want - len(got), 0)])
            outs.append(got)
            el = time.time() - t0
            left = el / (i + 1) * (len(starts) - i - 1)
            stage('Listening for every letter' + (f' · about {left:.0f} s left' if left > 3 else '…'), (i + 1) / len(starts))
    em = np.concatenate(outs, 0)[:T] if outs else np.zeros((0, len(vocab)), np.float32)
    return em.astype(np.float32), vocab


# ---------------------------------------------------------------- separation (Demucs)
def load_demucs(stage=lambda s, p: None):
    with _lock:
        if 'demucs' in _cache:
            return _cache['demucs']
        from demucs.pretrained import get_model
        dev = device()
        stage('Loading the vocal separator…', None)
        model = _with_download_watch(lambda: get_model(DEMUCS_ID), stage)
        model.eval().to(dev)
        _cache['demucs'] = (model, dev)
        return _cache['demucs']


def separate_vocals(wav44: np.ndarray, stage=lambda s, p: None, cancel=lambda: False):
    """(2, n) float32 stereo at 44.1 kHz -> (n,) mono vocals at 44.1 kHz."""
    import torch
    from demucs.apply import apply_model
    model, dev = load_demucs(stage)
    wav = torch.from_numpy(np.ascontiguousarray(wav44, dtype=np.float32))
    if wav.shape[0] == 1:
        wav = wav.repeat(2, 1)
    ref = wav.mean(0)
    mu, sd = ref.mean(), ref.std() + 1e-8
    mix = ((wav - mu) / sd)[None]
    n = mix.shape[-1]
    t0 = time.time()

    def cb(d):
        if cancel():
            raise InterruptedError()
        if d.get('state') != 'end':
            return
        models = max(1, d.get('models', 1))
        p = (d.get('model_idx_in_bag', 0) + min(1.0, (d.get('segment_offset', 0) + 1) / n)) / models
        el = time.time() - t0
        left = el / max(p, 1e-3) * (1 - p)
        stage('Separating the vocals from the music' + (f' · about {left:.0f} s left' if p > 0.05 and left > 3 else '…'), p)

    with torch.inference_mode():
        try:
            out = apply_model(model, mix, shifts=0, split=True, overlap=0.25, device=dev, callback=cb, progress=False)
        except RuntimeError as e:
            if dev.type == 'cuda' and 'out of memory' in str(e).lower():
                torch.cuda.empty_cache()
                stage('Not enough GPU memory, separating on the CPU…', None)
                out = apply_model(model.cpu(), mix, shifts=0, split=True, overlap=0.25, device='cpu', callback=cb)
                model.to(dev)
            else:
                raise
    vi = model.sources.index('vocals')
    voc = out[0, vi] * sd + mu
    if dev.type == 'cuda':
        torch.cuda.empty_cache()
    return voc.mean(0).cpu().numpy().astype(np.float32)
