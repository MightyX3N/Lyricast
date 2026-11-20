"""Forced alignment of known lyrics to CTC emissions.

The acoustic model (MMS wav2vec2, see models.py) gives, for every 20 ms frame of
the vocal track, how likely each letter is. This module finds the single best
path through the whole song that sings every lyric letter in order (Viterbi),
with a "star" token that is allowed to soak up anything that is not in the
lyrics: intros, instrumental breaks, ad-libs, backing vocals, breaths.

CTC models fire short spikes for letters, so a held note is mostly "blank".
The real length of each word is therefore recovered from the energy of the
separated vocal track: a word lasts while the voice keeps sounding, up to the
next word.
"""
from __future__ import annotations

import numpy as np

from .text import split_line

HOP = 0.02                     # seconds per emission frame (320 samples @ 16 kHz)
BLANK = 0
LETTERS = slice(4, None)       # vocab ids 4.. are a-z and '

NEG = np.float32(-1e30)


def _lse(a, axis=-1):
    m = a.max(axis=axis, keepdims=True)
    return (m + np.log(np.exp(a - m).sum(axis=axis, keepdims=True))).squeeze(axis)


def build_labels(lines_words, vocab):
    """Turn lines of words into the CTC label sequence.

    Returns labels (list of vocab ids, -1 = STAR) and an owner per label:
    ('char', line, word) / ('star', line_or_None, [word indices]).
    """
    labels, owner = [], []

    def star(line, words):
        if labels and labels[-1] == -1:          # merge neighbouring stars
            if line is not None and owner[-1][1] is None:
                owner[-1] = ('star', line, owner[-1][2])
            owner[-1][2].extend(words)
            return
        labels.append(-1)
        owner.append(('star', line, list(words)))

    star(None, [])
    for li, words in enumerate(lines_words):
        pending = []
        for wi, w in enumerate(words):
            if w['adlib'] or not w['chars']:
                pending.append(wi)
                continue
            if pending:
                star(li, pending)
                pending = []
            elif wi > 0 and labels and labels[-1] != -1:
                star(li, [])                     # optional slack between words
            for ch in w['chars']:
                labels.append(vocab.get(ch, vocab.get('<unk>', 3)))
                owner.append(('char', li, wi))
        star(li if pending else None, pending)
    return labels, owner


def vocal_envelope(vocals16k: np.ndarray, n_frames: int) -> np.ndarray:
    """RMS energy in dB per 20 ms frame (40 ms window)."""
    x = np.asarray(vocals16k, dtype=np.float32)
    pad = np.pad(x, (320, 960))
    idx = np.arange(n_frames) * 320 + 200            # frame centre, offset by the pad
    win = 640
    cs = np.concatenate([[0.0], np.cumsum(pad.astype(np.float64) ** 2)])
    a = np.clip(idx, 0, len(pad) - win)
    e = (cs[a + win] - cs[a]) / win
    return (10 * np.log10(e + 1e-10)).astype(np.float32)


def align(em, lines, vocab, env_db=None, mode='auto', cues=None, star_penalty=2.5,
          inner_penalty=4.5, window=4.0, progress=None, cancel=None):
    """em: (T, V) log-probs at 50 frames/s. lines: list of lyric line strings.
    env_db: vocal energy per frame (from the separated vocals) or None.
    mode 'refine' keeps every line within `window` seconds of cues[i] (start, end).
    Returns [{start, end, est, score, words: [{text, start, end}]}] per line."""
    em = np.asarray(em, dtype=np.float32)
    T, V = em.shape
    words = [split_line(t) for t in lines]
    labels, owner = build_labels(words, vocab)
    if not any(o[0] == 'char' for o in owner):
        raise ValueError('None of the lyrics can be aligned (no letters a-z after romanising).')

    nb = _lse(em[:, LETTERS])
    star_between = np.logaddexp(em[:, BLANK], nb - star_penalty)
    star_inner = np.logaddexp(em[:, BLANK], nb - inner_penalty)
    # star labels between lines use the cheap score, slack inside a line the expensive one
    em_ext = np.concatenate([em, star_between[:, None], star_inner[:, None]], axis=1)
    STAR_B, STAR_I = V, V + 1
    lab_ids = []
    for x, o in zip(labels, owner):
        if x != -1:
            lab_ids.append(x)
        else:
            inner = o[1] is not None and not o[2]
            lab_ids.append(-2 if inner else -1)
    seq = [STAR_I if x == -2 else (STAR_B if x == -1 else x) for x in lab_ids]

    bands = None
    if mode == 'refine' and cues:
        w = int(window / HOP)
        blo = np.zeros(len(seq), dtype=np.int64)
        bhi = np.full(len(seq), T, dtype=np.int64)
        for k, o in enumerate(owner):
            li = o[1]
            if o[0] == 'char' or (o[0] == 'star' and li is not None and not o[2]):
                c = cues[li]
                if c and c[0] is not None:
                    s0 = int(c[0] / HOP)
                    e0 = int((c[1] if c[1] is not None else c[0] + 4) / HOP)
                    blo[k] = max(0, s0 - w)
                    bhi[k] = min(T, max(e0, s0 + 1) + w)
        bands = (blo, bhi)

    path = viterbi(em_ext, np.asarray(seq, dtype=np.int64), bands, progress, cancel)

    # frames per label
    L = len(seq)
    first = np.full(L, -1, dtype=np.int64)
    last = np.full(L, -1, dtype=np.int64)
    lab_of_frame = np.where(path % 2 == 1, (path - 1) // 2, -1)
    for t in np.flatnonzero(lab_of_frame >= 0):
        k = lab_of_frame[t]
        if first[k] < 0:
            first[k] = t
        last[k] = t

    # word spans from their letters
    out = []
    for li, ws in enumerate(words):
        out.append({'words': [{'text': w['text'], 's': None, 'e': None, 'adlib': w['adlib'] or not w['chars'],
                               'score': []} for w in ws]})
    for k, o in enumerate(owner):
        if o[0] == 'char':
            _, li, wi = o
            w = out[li]['words'][wi]
            if w['s'] is None:
                w['s'] = first[k]
            w['e'] = last[k] + 1
            w['score'].append(float(em_ext[first[k]:last[k] + 1, seq[k]].max()))
        elif o[2] and o[1] is not None:
            # ad-libs: spread over the stretch the star soaked up
            li, wis = o[1], o[2]
            a, b = int(first[k]), int(last[k]) + 1
            n = len(wis)
            for j, wi in enumerate(wis):
                w = out[li]['words'][wi]
                w['s'] = a + (b - a) * j / n
                w['e'] = a + (b - a) * (j + 1) / n

    # fill anything still missing (words with no letters at line edges, ad-lib-only lines)
    flat = [(li, wi) for li in range(len(out)) for wi in range(len(out[li]['words']))]
    known = [i for i, (li, wi) in enumerate(flat) if out[li]['words'][wi]['s'] is not None]
    for i, (li, wi) in enumerate(flat):
        w = out[li]['words'][wi]
        if w['s'] is not None:
            continue
        prev = max([j for j in known if j < i], default=None)
        nxt = min([j for j in known if j > i], default=None)
        a = out[flat[prev][0]]['words'][flat[prev][1]]['e'] if prev is not None else 0
        b = out[flat[nxt][0]]['words'][flat[nxt][1]]['s'] if nxt is not None else T
        span = [j for j in range(prev + 1 if prev is not None else 0, nxt if nxt is not None else len(flat))]
        pos = span.index(i)
        w['s'] = a + (b - a) * pos / len(span)
        w['e'] = a + (b - a) * (pos + 1) / len(span)
        w['adlib'] = True

    _extend_words(out, env_db, T)

    # lines, scores, confidence
    res = []
    scores = []
    for li, L_ in enumerate(out):
        ws = L_['words']
        core = [w for w in ws if not w['adlib']] or ws
        sc = [x for w in core for x in w['score']]
        score = float(np.mean(sc)) if sc else -10.0
        scores.append(score)
        start = min(w['s'] for w in core)
        end = max(w['e'] for w in ws)
        res.append({'start': start * HOP, 'end': end * HOP, 'score': score,
                    'words': [{'text': w['text'], 'start': round(w['s'] * HOP, 3), 'end': round(w['e'] * HOP, 3)} for w in ws]})
    med = float(np.median(scores)) if scores else 0.0
    for li, r in enumerate(res):
        n = max(1, len(r['words']))
        squeezed = (r['end'] - r['start']) < 0.09 * n
        r['est'] = bool(r['score'] < med - 2.0 or r['score'] < -4.5 or squeezed)
        r['start'] = round(r['start'], 3)
        r['end'] = round(max(r['end'], r['start'] + 0.3), 3)
        r['score'] = round(r['score'], 3)
    for i in range(len(res) - 1):                       # never overlap the next line
        nxt = res[i + 1]['start']
        if res[i]['end'] > nxt - 0.02 and nxt > res[i]['start'] + 0.1:
            res[i]['end'] = round(nxt - 0.02, 3)
    return res


def viterbi(em_ext, seq, bands=None, progress=None, cancel=None):
    """Best CTC path through em_ext (T, V) for label ids `seq`; returns the state per frame
    (odd state 2k+1 = label k, even = blank). bands: optional (lo, hi) frames per label."""
    T = em_ext.shape[0]
    L = len(seq)
    S = 2 * L + 1
    lab = np.zeros(S, dtype=np.int64)
    lab[1::2] = seq
    skip = np.zeros(S, dtype=bool)
    skip[3::2] = lab[3::2] != lab[1:-2:2]
    if T < L:
        raise ValueError('The song is too short for these lyrics.')
    lo = hi = None
    if bands is not None:
        blo, bhi = bands
        lo = np.zeros(S, dtype=np.int64)
        hi = np.full(S, T, dtype=np.int64)
        lo[1::2], hi[1::2] = blo, bhi
        lo[2:-1:2] = np.minimum(blo[:-1], blo[1:])
        hi[2:-1:2] = np.maximum(bhi[:-1], bhi[1:])
    bt = np.zeros((T, S), dtype=np.int8)
    dp = np.full(S, NEG, dtype=np.float32)
    dp[0] = em_ext[0, lab[0]]
    dp[1] = em_ext[0, lab[1]]
    if lo is not None:
        dp[(lo > 0) | (hi < 0)] = NEG
    c1 = np.empty(S, dtype=np.float32)
    c2 = np.empty(S, dtype=np.float32)
    noskip = ~skip
    step = max(1, T // 100)
    for t in range(1, T):
        c1[0] = NEG
        c1[1:] = dp[:-1]
        c2[:2] = NEG
        c2[2:] = dp[:-2]
        c2[noskip] = NEG
        m1 = c1 > dp
        best = np.where(m1, c1, dp)
        m2 = c2 > best
        best = np.where(m2, c2, best)
        bt[t] = m1.astype(np.int8) + m2.astype(np.int8) * (2 - m1.astype(np.int8))
        dp = best + em_ext[t, lab]
        if lo is not None:
            dp[(lo > t) | (hi < t)] = NEG
        if t % step == 0:
            if cancel and cancel():
                raise InterruptedError()
            if progress:
                progress(t / T)
    s = S - 1 if dp[S - 1] >= dp[S - 2] else S - 2
    if dp[s] <= NEG / 2:
        raise ValueError('No alignment fits the time limits.')
    path = np.empty(T, dtype=np.int64)
    for t in range(T - 1, -1, -1):
        path[t] = s
        s -= int(bt[t, s])
    return path


def _extend_words(out, env_db, T):
    """Word ends: a CTC letter spike marks where a word is recognised, not how long it is
    held. Extend each word while the separated vocal keeps sounding, up to the next word.
    Starts move back a little onto the vocal onset when the voice was already sounding."""
    seq = [w for L in out for w in L['words']]
    line_of = [li for li, L in enumerate(out) for _ in L['words']]
    if env_db is None:
        core = [i for i, w in enumerate(seq) if not w['adlib']]
        for n_, i in enumerate(core):
            w = seq[i]
            nxt = seq[core[n_ + 1]]['s'] if n_ + 1 < len(core) else T
            gap = nxt - w['e']
            w['e'] = nxt if gap < 30 else w['e'] + 15     # 0.6 s / 0.3 s
        _settle_adlibs(seq)
        return
    env = np.asarray(env_db, dtype=np.float32)
    floor = float(np.percentile(env, 10))
    thr_line = {}
    for li, L in enumerate(out):
        a = int(min(w['s'] for w in L['words']))
        b = int(max(w['e'] for w in L['words'])) + 1
        seg = env[max(0, a):min(T, b + 25)]
        peak = float(np.percentile(seg, 90)) if len(seg) else floor + 30
        thr_line[li] = max(floor + 8.0, peak - 16.0)
    core = [i for i, w in enumerate(seq) if not w['adlib']]
    for n_, i in enumerate(core):
        w = seq[i]
        thr = thr_line[line_of[i]]
        j = core[n_ + 1] if n_ + 1 < len(core) else None
        nxt = int(seq[j]['s']) if j is not None else T
        same_line = j is not None and line_of[j] == line_of[i]
        limit = nxt if same_line else min(nxt, int(w['e']) + 250)   # hold at most 5 s past a line
        e = int(w['e'])
        while e < limit and e < T and env[e] > thr:
            e += 1
        w['e'] = max(w['e'], min(e, limit))
        # onset: up to 0.1 s earlier if the voice is already up and the previous word is over
        prev_end = int(seq[core[n_ - 1]]['e']) if n_ > 0 else 0
        s = int(w['s'])
        k = s
        while k - 1 >= max(prev_end, s - 5) and env[k - 1] > thr:
            k -= 1
        w['s'] = k
    _settle_adlibs(seq)


def _settle_adlibs(seq):
    """Ad-lib / unpronounceable words never overlap the sung words around them."""
    for i, w in enumerate(seq):
        if not w['adlib']:
            continue
        prev = next((seq[j]['e'] for j in range(i - 1, -1, -1) if not seq[j]['adlib']), None)
        nxt = next((seq[j]['s'] for j in range(i + 1, len(seq)) if not seq[j]['adlib']), None)
        if prev is not None and w['s'] < prev:
            w['s'] = prev
        if nxt is not None and w['e'] > nxt:
            w['e'] = nxt
        if w['e'] <= w['s']:
            w['e'] = w['s'] + 10
