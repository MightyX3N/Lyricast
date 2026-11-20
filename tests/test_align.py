"""Synthetic test: plant sung words in fake CTC emissions + an energy envelope, add ad-libs
and noise, and check the aligner gets word starts and held-word ends back."""
import os, sys
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lyricast.engine.align import align, HOP
from lyricast.engine.models import DEFAULT_VOCAB
from lyricast.engine.text import split_line

V = DEFAULT_VOCAB
rng = np.random.default_rng(1)


def fake_song(lines, adlibs=True, T=None):
    """Each word: letters spike over its first frames, then the note is held (blank) with high
    energy. Returns em, env, truth[(line, word) -> (start_s, end_s)]."""
    T = T or 20000
    em = np.full((T, 31), -9.0, np.float32)
    em[:, 0] = -0.05                                   # mostly blank
    env = np.full(T, -60.0, np.float32) + rng.normal(0, 2, T).astype(np.float32)
    truth = {}
    t = 150                                           # 3 s intro
    for li, line in enumerate(lines):
        for wi, w in enumerate(split_line(line)):
            if w['adlib'] or not w['chars']:
                continue
            start = t
            for ch in w['chars']:
                em[t, :] = -8; em[t, V[ch]] = -0.1; t += 2
            hold = int(rng.integers(5, 60))           # 0.1 .. 1.2 s held
            end = t + hold
            env[start:end] = -18 + rng.normal(0, 1.5, end - start)
            truth[(li, wi)] = (start * HOP, end * HOP)
            t = end + int(rng.integers(1, 8))
        gap = int(rng.integers(40, 200))
        if adlibs and gap > 80:                       # ad-lib "yeah oh" sung between lines
            a = t + 20
            for ch in 'yeahoh':
                em[a, :] = -8; em[a, V[ch]] = -0.3; a += 2
            env[t + 20:a + 15] = -22
        t += gap
    return em[:t + 100], env[:t + 100], truth


LINES = ["Hey! Make it yours!", "Got a song and words? Bring 'em in,", "Lyricast gets your video rolling (oh yeah)",
         "Auto-match the lines, then make them fit,", "Tap to time them - tweak a little bit.", "SRT ready, Suno import too",
         "A few seconds off? You can tune it through.", "Your song, your style, your video!"]


def check(res, truth, tol_start=0.08, tol_end=0.12):
    bad = []
    for (li, wi), (s, e) in truth.items():
        w = res[li]['words'][wi]
        if abs(w['start'] - s) > tol_start or abs(w['end'] - e) > tol_end:
            bad.append((li, wi, w['text'], round(s, 2), round(e, 2), w['start'], w['end']))
    return bad


def test_auto():
    em, env, truth = fake_song(LINES)
    res = align(em, LINES, V, env_db=env)
    bad = check(res, truth)
    assert not bad, bad[:5]
    assert all(not r['est'] for r in res), [r['score'] for r in res]


def test_no_env():
    em, env, truth = fake_song(LINES)
    res = align(em, LINES, V, env_db=None)
    bad = [b for b in check(res, truth, tol_start=0.08, tol_end=99)]
    assert not bad, bad[:5]


def test_refine_window():
    em, env, truth = fake_song(LINES)
    cues = []
    for li in range(len(LINES)):
        ks = [v for (l, w), v in truth.items() if l == li]
        cues.append((min(k[0] for k in ks) + 1.5, max(k[1] for k in ks) + 1.0))   # 1.5 s off
    res = align(em, LINES, V, env_db=env, mode='refine', cues=cues, window=3.0)
    assert not check(res, truth)


def test_missing_line_is_flagged():
    # the third line is in the lyrics but never sung
    sung = LINES[:2] + LINES[3:]
    em, env, _ = fake_song(sung, adlibs=False)
    res = align(em, LINES, V, env_db=env)
    assert res[2]['est'], [(r['score'], r['est']) for r in res]
    assert sum(r['est'] for r in res) <= 2


def test_noisy_long():
    """4 minutes, 60 lines, random letter noise everywhere, mumbled letters inside words."""
    words = "love you night light fire heart away tonight dance feel time again never forever stay".split()
    lines = [" ".join(rng.choice(words, size=int(rng.integers(4, 9)))) for _ in range(60)]
    em, env, truth = fake_song(lines, T=40000)
    noise = rng.random(em.shape[0]) < 0.06
    for t in np.flatnonzero(noise):                  # stray letters (instruments bleeding through)
        em[t, int(rng.integers(4, 31))] = -1.2
    for t in rng.choice(em.shape[0], em.shape[0] // 40):  # mumbled frames: letters weaker
        em[t] = np.maximum(em[t], -3.0)
    import time
    t0 = time.time()
    res = align(em, lines, V, env_db=env)
    dt = time.time() - t0
    bad = check(res, truth, tol_start=0.1, tol_end=0.2)
    assert len(bad) <= len(truth) * 0.02, (len(bad), len(truth), bad[:5])
    assert dt < 30, dt


if __name__ == '__main__':
    import time
    for f in [test_noisy_long, test_auto, test_no_env, test_refine_window, test_missing_line_is_flagged]:
        t0 = time.time(); f(); print('ok', f.__name__, round(time.time() - t0, 2), 's')
