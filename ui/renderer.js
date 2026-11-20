/* Lyricast renderer — draws one frame of a lyric video onto a 2D canvas.
   Stateless: the same (time, template, cues) always gives the same frame,
   so preview and export match exactly. */

const LV_FONTS = {
  'Anton':            '"Anton", Impact, sans-serif',
  'Archivo Black':    '"Archivo Black", "Arial Black", sans-serif',
  'Bebas Neue':       '"Bebas Neue", Impact, sans-serif',
  'Caveat':           '"Caveat", "Comic Sans MS", cursive',
  'Fraunces':         '"Fraunces", Georgia, serif',
  'Outfit':           '"Outfit", "Helvetica Neue", Arial, sans-serif',
  'Playfair Display': '"Playfair Display", Georgia, serif',
  'Space Mono':       '"Space Mono", "Courier New", monospace',
  'Syne':             '"Syne", "Helvetica Neue", sans-serif',
  'Unbounded':        '"Unbounded", "Arial Black", sans-serif'
};
const LV_FONT_CSS = 'https://fonts.googleapis.com/css2?family=Anton&family=Archivo+Black&family=Bebas+Neue&family=Caveat:wght@500;700&family=Fraunces:ital,wght@0,400;0,700;1,400;1,700&family=Outfit:wght@300;500;800&family=Playfair+Display:ital,wght@0,700;1,500&family=Space+Mono:wght@400;700&family=Syne:wght@600;800&family=Unbounded:wght@500;800&display=swap';

const LV_ENUMS = {
  bg: ['solid', 'gradient', 'radial', 'blobs'],
  particles: ['none', 'dots', 'bokeh', 'stars', 'rain', 'embers'],
  layout: ['center', 'lower', 'upper'],
  align: ['center', 'left'],
  anim: ['fade', 'slideUp', 'scale', 'wordPop', 'stamp', 'typewriter', 'karaoke', 'glitch']
};

const LV_DEFAULT = {
  name: 'Untitled',
  bg: { type: 'gradient', colors: ['#1a1a2e', '#16213e'], angle: 135, motion: 0.2 },
  particles: { type: 'none', color: '#ffffff', count: 40, speed: 0.5 },
  font: { family: 'Outfit', weight: 700, size: 0.075, italic: false, uppercase: false, tracking: 0 },
  colors: { text: '#ffffff', highlight: '#ffd166', shadow: 'rgba(0,0,0,0.45)' },
  layout: 'center', align: 'center', anim: 'fade',
  glow: 0, context: false, vignette: 0.3, grain: 0, letterbox: false, pulse: 0.3, spectrum: false
};

const LV_BUILTIN = [
  { id: 'neon-night', name: 'Neon Night',
    bg: { type: 'gradient', colors: ['#0b0221', '#2a0845', '#120136'], angle: 160, motion: 0.35 },
    particles: { type: 'stars', color: '#ffffff', count: 90, speed: 0.4 },
    font: { family: 'Bebas Neue', weight: 400, size: 0.115, uppercase: true, tracking: 0.04 },
    colors: { text: '#ffe8fb', highlight: '#ff3df2', shadow: 'rgba(0,0,0,0)' },
    anim: 'wordPop', glow: 0.9, pulse: 0.6, spectrum: true, vignette: 0.55 },
  { id: 'paper-cut', name: 'Paper Cut',
    bg: { type: 'solid', colors: ['#efe6d2'] },
    font: { family: 'Archivo Black', weight: 400, size: 0.082, uppercase: true, tracking: -0.01 },
    colors: { text: '#151515', highlight: '#d7263d', shadow: 'rgba(0,0,0,0)' },
    anim: 'stamp', grain: 0.7, vignette: 0.18, pulse: 0 },
  { id: 'karaoke-lounge', name: 'Karaoke Lounge',
    bg: { type: 'radial', colors: ['#24426b', '#0b132b'], motion: 0.3 },
    particles: { type: 'bokeh', color: '#a8dadc', count: 18, speed: 0.4 },
    font: { family: 'Outfit', weight: 800, size: 0.07 },
    colors: { text: '#ffffff', highlight: '#ffd166', shadow: 'rgba(0,0,0,0.5)' },
    layout: 'lower', anim: 'karaoke', context: true, vignette: 0.35 },
  { id: 'golden-hour', name: 'Golden Hour',
    bg: { type: 'blobs', colors: ['#ff9a5a', '#ff5e7e', '#6a3093', '#2b1055'], motion: 0.5 },
    particles: { type: 'embers', color: '#ffe0a3', count: 55, speed: 0.6 },
    font: { family: 'Playfair Display', weight: 500, size: 0.082, italic: true },
    colors: { text: '#fff6ea', highlight: '#ffe0a3', shadow: 'rgba(60,10,40,0.45)' },
    anim: 'slideUp', glow: 0.25, vignette: 0.4, letterbox: true },
  { id: 'static-signal', name: 'Static Signal',
    bg: { type: 'solid', colors: ['#060608'] },
    particles: { type: 'rain', color: '#7af0ff', count: 60, speed: 1 },
    font: { family: 'Space Mono', weight: 700, size: 0.064, uppercase: true },
    colors: { text: '#e8f6ff', highlight: '#ff2e63', shadow: 'rgba(0,0,0,0)' },
    anim: 'glitch', grain: 0.9, vignette: 0.65, pulse: 0.4 },
  { id: 'quiet-room', name: 'Quiet Room',
    bg: { type: 'gradient', colors: ['#dde6ea', '#f3ece2'], angle: 120, motion: 0.1 },
    particles: { type: 'dots', color: '#9fb1bd', count: 30, speed: 0.2 },
    font: { family: 'Fraunces', weight: 400, size: 0.068 },
    colors: { text: '#22303c', highlight: '#c06c4f', shadow: 'rgba(0,0,0,0)' },
    align: 'left', anim: 'typewriter', context: true, vignette: 0.08, pulse: 0 }
];

/* ---------- template validation (used for AI output and storage) ---------- */
function lvClamp(v, a, b, d) { v = Number(v); return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; }
function lvColor(c, d) {
  if (typeof c !== 'string') return d;
  c = c.trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(c) || /^rgba?\([\d\s.,%]+\)$/i.test(c) ? c : d;
}
function lvPick(v, list, d) { return list.includes(v) ? v : d; }

function lvSanitize(t) {
  t = t && typeof t === 'object' ? t : {};
  const D = LV_DEFAULT, bg = t.bg || {}, pa = t.particles || {}, f = t.font || {}, c = t.colors || {};
  let colors = Array.isArray(bg.colors) ? bg.colors.map(x => lvColor(x, null)).filter(Boolean).slice(0, 5) : [];
  if (!colors.length) colors = D.bg.colors.slice();
  return {
    id: typeof t.id === 'string' ? t.id : 'tpl-' + Math.random().toString(36).slice(2, 9),
    name: (typeof t.name === 'string' && t.name.trim() ? t.name.trim() : D.name).slice(0, 40),
    custom: !!t.custom,
    bg: { type: lvPick(bg.type, LV_ENUMS.bg, D.bg.type), colors,
          angle: lvClamp(bg.angle, 0, 360, D.bg.angle), motion: lvClamp(bg.motion, 0, 1, D.bg.motion) },
    particles: { type: lvPick(pa.type, LV_ENUMS.particles, 'none'), color: lvColor(pa.color, '#ffffff'),
                 count: Math.round(lvClamp(pa.count, 0, 150, 40)), speed: lvClamp(pa.speed, 0, 2, 0.5) },
    font: { family: LV_FONTS[f.family] ? f.family : D.font.family,
            weight: Math.round(lvClamp(f.weight, 100, 900, D.font.weight) / 100) * 100,
            size: lvClamp(f.size, 0.04, 0.14, D.font.size), italic: !!f.italic, uppercase: !!f.uppercase,
            tracking: lvClamp(f.tracking, -0.05, 0.3, 0) },
    colors: { text: lvColor(c.text, D.colors.text), highlight: lvColor(c.highlight, D.colors.highlight),
              shadow: lvColor(c.shadow, D.colors.shadow) },
    layout: lvPick(t.layout, LV_ENUMS.layout, D.layout),
    align: lvPick(t.align, LV_ENUMS.align, D.align),
    anim: lvPick(t.anim, LV_ENUMS.anim, D.anim),
    glow: lvClamp(t.glow, 0, 1, 0), context: !!t.context,
    vignette: lvClamp(t.vignette, 0, 1, D.vignette), grain: lvClamp(t.grain, 0, 1, 0),
    letterbox: !!t.letterbox, pulse: lvClamp(t.pulse, 0, 1, D.pulse), spectrum: !!t.spectrum
  };
}

/* ---------- helpers ---------- */
function lvRnd(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function lvMod(v, m) { return ((v % m) + m) % m; }
function lvC01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function lvEase(t) { return 1 - Math.pow(1 - t, 3); }
function lvBack(t) { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
function lvAlpha(color, a) {
  if (color[0] === '#') {
    let h = color.slice(1);
    if (h.length === 3) h = h.split('').map(x => x + x).join('');
    const n = parseInt(h.slice(0, 6), 16);
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
  }
  return color;
}

let lvGrainTile = null;
function lvGrain() {
  if (lvGrainTile) return lvGrainTile;
  const c = document.createElement('canvas'); c.width = c.height = 192;
  const g = c.getContext('2d'), d = g.createImageData(192, 192);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = Math.random() * 255;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  return (lvGrainTile = c);
}

function lvFindCue(cues, t) {
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i];
    if (c.start != null && c.end != null && t >= c.start && t < c.end) return i;
  }
  return -1;
}

/* ---------- background layers ---------- */
function lvMediaSize(el) {
  if (!el) return null;
  if (el.tagName === 'VIDEO') return el.readyState >= 2 && el.videoWidth ? [el.videoWidth, el.videoHeight] : null;
  return el.complete && el.naturalWidth ? [el.naturalWidth, el.naturalHeight] : null;
}
function lvCover(ctx, el, W, H) {
  const sz = lvMediaSize(el); if (!sz) return false;
  const k = Math.max(W / sz[0], H / sz[1]), w = sz[0] * k, h = sz[1] * k;
  ctx.drawImage(el, (W - w) / 2, (H - h) / 2, w, h);
  return true;
}
function lvBackground(ctx, W, H, t, tpl, level, media) {
  const b = tpl.bg, cols = b.colors, U = Math.min(W, H);
  if (media && media.el && lvCover(ctx, media.el, W, H)) {
    if (media.dim > 0) { ctx.fillStyle = `rgba(0,0,0,${media.dim})`; ctx.fillRect(0, 0, W, H); }
  } else if (b.type === 'solid' || cols.length === 1) {
    ctx.fillStyle = cols[0]; ctx.fillRect(0, 0, W, H);
  } else if (b.type === 'gradient') {
    const a = (b.angle + Math.sin(t * 0.15) * 40 * b.motion) * Math.PI / 180;
    const r = Math.hypot(W, H) / 2, cx = W / 2, cy = H / 2;
    const g = ctx.createLinearGradient(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else if (b.type === 'radial') {
    const cx = W / 2 + Math.sin(t * 0.2) * W * 0.08 * b.motion, cy = H * 0.45 + Math.cos(t * 0.17) * H * 0.06 * b.motion;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(W, H) * 0.6);
    cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else { // blobs
    ctx.fillStyle = cols[cols.length - 1]; ctx.fillRect(0, 0, W, H);
    const n = cols.length - 1;
    for (let i = 0; i < n; i++) {
      const sp = 0.08 + b.motion * 0.12;
      const x = W * (0.5 + 0.38 * Math.sin(t * sp * (1 + i * 0.37) + i * 2.1));
      const y = H * (0.5 + 0.32 * Math.cos(t * sp * (0.8 + i * 0.29) + i * 1.3));
      const r = Math.max(W, H) * (0.55 - i * 0.06);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, lvAlpha(cols[i], 0.9)); g.addColorStop(1, lvAlpha(cols[i], 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  }
  if (tpl.pulse > 0 && level > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = lvAlpha(tpl.colors.highlight, level * tpl.pulse * 0.16);
    ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  const p = tpl.particles, s = U / 1080;
  if (p.type !== 'none' && p.count > 0) {
    ctx.save();
    for (let k = 0; k < p.count; k++) {
      const r1 = lvRnd(k + 1), r2 = lvRnd(k + 101), r3 = lvRnd(k + 211);
      ctx.fillStyle = p.color;
      if (p.type === 'dots') {
        const x = lvMod(r1 * W + t * p.speed * 30 * (0.4 + r3), W), y = r2 * H + Math.sin(t * 0.4 + k) * 12 * s;
        ctx.globalAlpha = 0.25 + r3 * 0.35;
        ctx.beginPath(); ctx.arc(x, y, (1.5 + r3 * 3) * s, 0, 7); ctx.fill();
      } else if (p.type === 'bokeh') {
        const span = H * 1.3, y = lvMod(r2 * span - t * p.speed * 18 * (0.5 + r3), span) - H * 0.15;
        const x = r1 * W + Math.sin(t * 0.3 + k) * 30 * s, rad = (30 + r3 * 90) * s;
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, lvAlpha(p.color, 0.22)); g.addColorStop(0.7, lvAlpha(p.color, 0.1)); g.addColorStop(1, lvAlpha(p.color, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill();
      } else if (p.type === 'stars') {
        ctx.globalAlpha = 0.15 + 0.85 * Math.abs(Math.sin(t * (0.6 + r3 * 1.8) * p.speed * 2 + k));
        ctx.beginPath(); ctx.arc(r1 * W, r2 * H, (0.8 + r3 * 1.8) * s, 0, 7); ctx.fill();
      } else if (p.type === 'rain') {
        const span = H * 1.2, y = lvMod(r2 * span + t * p.speed * 700 * (0.6 + r3), span) - H * 0.1;
        ctx.globalAlpha = 0.12 + r3 * 0.25;
        ctx.fillRect(r1 * W, y, 1.5 * s, (20 + r3 * 50) * s);
      } else if (p.type === 'embers') {
        const span = H * 1.2, y = H * 1.1 - lvMod(r2 * span + t * p.speed * 60 * (0.5 + r3), span);
        const x = r1 * W + Math.sin(t * (0.5 + r3) + k) * 25 * s;
        ctx.globalAlpha = (0.3 + 0.6 * r3) * lvC01(y / (H * 0.5));
        ctx.shadowColor = p.color; ctx.shadowBlur = 10 * s;
        ctx.beginPath(); ctx.arc(x, y, (1.2 + r3 * 2.5) * s, 0, 7); ctx.fill();
      }
    }
    ctx.restore();
  }
}

function lvSpectrum(ctx, W, H, tpl, bins) {
  if (!tpl.spectrum || !bins || !bins.length) return;
  const n = 48, bw = (W * 0.8) / n, x0 = W * 0.1, base = tpl.letterbox ? H * 0.9 : H;
  ctx.save(); ctx.fillStyle = lvAlpha(tpl.colors.highlight, 0.45);
  for (let i = 0; i < n; i++) {
    const v = bins[Math.floor(i * bins.length / n * 0.7)] / 255;
    const h = Math.max(2, v * v * H * 0.16);
    ctx.fillRect(x0 + i * bw + bw * 0.15, base - h, bw * 0.7, h);
  }
  ctx.restore();
}

function lvOverlays(ctx, W, H, t, tpl) {
  if (tpl.vignette > 0) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${tpl.vignette * 0.75})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (tpl.grain > 0) {
    ctx.save(); ctx.globalAlpha = tpl.grain * 0.09; ctx.globalCompositeOperation = 'overlay';
    const tile = lvGrain(), f = Math.floor(t * 24);
    ctx.translate(-lvRnd(f) * 192, -lvRnd(f + 9) * 192);
    ctx.fillStyle = ctx.createPattern(tile, 'repeat'); ctx.fillRect(0, 0, W + 192, H + 192);
    ctx.restore();
  }
  if (tpl.letterbox && W > H) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H * 0.1); ctx.fillRect(0, H * 0.9, W, H * 0.1);
  }
}

/* ---------- text ---------- */
function lvSetFont(ctx, tpl, px) {
  const f = tpl.font;
  ctx.font = `${f.italic ? 'italic ' : ''}${f.weight} ${px}px ${LV_FONTS[f.family]}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${(f.tracking * px).toFixed(2)}px`;
}

function lvLayout(ctx, W, H, tpl, text, px) {
  const maxW = W * (tpl.align === 'left' ? 0.8 : 0.84), space = ctx.measureText(' ').width;
  const lines = [];
  text.split('\n').forEach(raw => {
    let line = [], lw = 0;
    raw.split(/\s+/).filter(Boolean).forEach(w => {
      const ww = ctx.measureText(w).width;
      if (line.length && lw + space + ww > maxW) { lines.push({ words: line, w: lw }); line = []; lw = 0; }
      lw += (line.length ? space : 0) + ww; line.push({ text: w, w: ww });
    });
    if (line.length) lines.push({ words: line, w: lw });
  });
  return { lines, space, maxW };
}

/* When a line carries real word timings (cue.words = [{ text, start, end }], e.g. from Suno),
   map each word on screen to the moment it is sung. Matching goes letter by letter, so it
   survives words that were split or joined differently and upper-case styles. */
function lvWordClock(cue, words) {
  if (!cue.words || !cue.words.length) return null;
  const norm = s => String(s).toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '');
  const stream = [];
  cue.words.forEach(w => { const n = norm(w.text || ''); for (let i = 0; i < n.length; i++) stream.push(w); });
  if (!stream.length) return null;
  let k = 0;
  return words.map(w => {
    const n = norm(w.text).length;
    const a = stream[Math.min(k, stream.length - 1)], b = stream[Math.min(k + Math.max(1, n) - 1, stream.length - 1)];
    k += n;
    return { s: a.start, e: Math.max(b.end, a.start + 0.05) };
  });
}

function lvDrawCue(ctx, W, H, t, tpl, cue, cues, idx) {
  const U = Math.min(W, H);
  let text = cue.text || '';
  if (tpl.font.uppercase) text = text.toUpperCase();
  let px = tpl.font.size * U * 1.25, L;
  for (let tries = 0; tries < 8; tries++) {
    lvSetFont(ctx, tpl, px); L = lvLayout(ctx, W, H, tpl, text, px);
    if (L.lines.length * px * 1.15 <= H * 0.55 && L.lines.length <= 4) break;
    px *= 0.86;
  }
  const lh = px * 1.15, blockH = L.lines.length * lh;
  const top = H * (tpl.layout === 'lower' ? (tpl.letterbox ? 0.72 : 0.76) : tpl.layout === 'upper' ? 0.26 : 0.5) - blockH / 2;
  const left = W * 0.1;

  // word positions + timing weights
  const words = [];
  let chars = 0;
  L.lines.forEach((ln, li) => {
    let x = tpl.align === 'left' ? left : (W - ln.w) / 2;
    ln.words.forEach(w => {
      words.push({ k: words.length, text: w.text, x, y: top + li * lh + lh / 2, w: w.w, c0: chars, c1: chars + w.text.length });
      chars += w.text.length + 1; x += w.w + L.space;
    });
  });
  const total = Math.max(1, chars - 1);
  const dur = cue.end - cue.start, lt = t - cue.start;
  const clock = lvWordClock(cue, words);
  // with real word times the line is already placed on its first word, so show it almost at once
  const inT = clock ? 0.1 : Math.min(0.25, dur * 0.2), outT = Math.min(0.25, dur * 0.2);
  const aIn = lvEase(lvC01(lt / inT)), aOut = lvC01((cue.end - t) / outT);
  const sing = dur * 0.88;
  const wStart = w => clock ? clock[w.k].s : cue.start + sing * (w.c0 / total);
  const wEnd = w => clock ? clock[w.k].e : cue.start + sing * (w.c1 / total);

  // context lines
  if (tpl.context) {
    const small = px * 0.5;
    lvSetFont(ctx, tpl, small);
    ctx.textBaseline = 'middle'; ctx.textAlign = tpl.align === 'left' ? 'left' : 'center';
    const ax = tpl.align === 'left' ? left : W / 2;
    const prev = cues[idx - 1], next = cues[idx + 1];
    ctx.fillStyle = tpl.colors.text;
    if (prev && prev.end != null && cue.start - prev.end < 4) {
      ctx.globalAlpha = 0.28 * aOut;
      ctx.fillText(tpl.font.uppercase ? prev.text.toUpperCase().replace(/\n/g, ' ') : prev.text.replace(/\n/g, ' '), ax, top - small * 1.4, L.maxW);
    }
    if (next && next.start != null && next.start - cue.end < 4) {
      ctx.globalAlpha = 0.4 * aIn;
      ctx.fillText(tpl.font.uppercase ? next.text.toUpperCase().replace(/\n/g, ' ') : next.text.replace(/\n/g, ' '), ax, top + blockH + small * 1.3, L.maxW);
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
    lvSetFont(ctx, tpl, px);
  }

  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const shadow = () => {
    if (tpl.glow > 0) { ctx.shadowColor = tpl.colors.highlight; ctx.shadowBlur = tpl.glow * px * 0.45; ctx.shadowOffsetY = 0; }
    else { ctx.shadowColor = tpl.colors.shadow; ctx.shadowBlur = px * 0.15; ctx.shadowOffsetY = px * 0.04; }
  };

  const anim = tpl.anim;
  if (anim === 'glitch') {
    const g = lt < 0.4 || (lvRnd(Math.floor(t * 12)) > 0.93);
    const j = g ? (lvRnd(Math.floor(t * 30)) - 0.5) * px * 0.25 : 0;
    const passes = g ? [['#ff2e63', -px * 0.06 + j], ['#00e5ff', px * 0.06 - j], [tpl.colors.text, 0]] : [[tpl.colors.text, 0]];
    ctx.save(); if (g) ctx.globalCompositeOperation = 'lighter';
    passes.forEach(([col, dx]) => {
      ctx.fillStyle = col;
      ctx.globalAlpha = aOut * (g && col !== tpl.colors.text ? 0.8 : 1);
      words.forEach(w => {
        const sliceY = g && lvRnd(w.c0 + Math.floor(t * 20)) > 0.7 ? (lvRnd(w.c0 * 3 + Math.floor(t * 20)) - 0.5) * px * 0.3 : 0;
        ctx.fillText(w.text, w.x + dx + sliceY, w.y);
      });
    });
    ctx.restore();
    return;
  }

  let visChars = Infinity;
  if (anim === 'typewriter' && !clock) visChars = Math.floor(lvC01(lt / Math.max(0.3, dur * 0.6)) * (total + 1));

  words.forEach((w, k) => {
    let alpha = aIn * aOut, sc = 1, dy = 0, rot = 0, txt = w.text, col = tpl.colors.text;
    if (anim === 'slideUp') { dy = (1 - aIn) * px * 0.6; }
    else if (anim === 'scale') { sc = 0.82 + 0.18 * aIn; }
    else if (anim === 'wordPop' || anim === 'stamp') {
      const dl = anim === 'stamp' ? 0.16 : 0.26;
      const p = lvC01((t - wStart(w)) / dl);
      alpha = lvC01(p * 2.5) * aOut;
      if (anim === 'wordPop') { sc = 0.4 + 0.6 * lvBack(p); if (p < 1 && t < wEnd(w)) col = tpl.colors.highlight; }
      else { sc = 1.7 - 0.7 * lvEase(p); rot = (lvRnd(k + w.c0 * 7) - 0.5) * 0.14; if (k % 4 === 2) col = tpl.colors.highlight; }
    } else if (anim === 'typewriter') {
      alpha = aOut;
      if (clock) {                                   // type each word out while it is sung
        const p = lvC01((t - wStart(w)) / Math.max(0.05, wEnd(w) - wStart(w)));
        if (t < wStart(w)) return;
        txt = w.text.slice(0, Math.max(1, Math.ceil(p * w.text.length)));
      } else {
        if (visChars <= w.c0) return;
        txt = w.text.slice(0, visChars - w.c0);
      }
    }
    if (alpha <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const cx = w.x + w.w / 2;
    ctx.translate(cx, w.y + dy); ctx.rotate(rot); ctx.scale(sc, sc);
    shadow();
    ctx.fillStyle = col;
    if (anim === 'karaoke') {
      const fill = lvC01((t - wStart(w)) / Math.max(0.05, wEnd(w) - wStart(w)));
      ctx.globalAlpha = alpha * 0.55; ctx.fillText(txt, -w.w / 2, 0);
      if (fill > 0) {
        ctx.globalAlpha = alpha;
        ctx.beginPath(); ctx.rect(-w.w / 2 - px * 0.1, -px, w.w * fill + px * 0.1, px * 2); ctx.clip();
        ctx.fillStyle = tpl.colors.highlight; ctx.fillText(txt, -w.w / 2, 0);
      }
    } else {
      ctx.fillText(txt, -w.w / 2, 0);
    }
    ctx.restore();
    if (anim === 'typewriter' && (clock ? t >= wStart(w) && t < wEnd(w) : visChars > w.c0 && visChars <= w.c1 && lt < dur * 0.6 + 0.2)) {
      const tw = ctx.measureText(txt).width;
      ctx.fillStyle = tpl.colors.highlight; ctx.globalAlpha = Math.floor(t * 3) % 2 ? 1 : 0.3;
      ctx.fillRect(w.x + tw + px * 0.05, w.y - px * 0.4, px * 0.06, px * 0.8); ctx.globalAlpha = 1;
    }
  });
}

/* Logo and/or text in a corner. brand = { img, text, pos, size, opacity, color } */
function lvBrand(ctx, W, H, tpl, b) {
  if (!b) return;
  const img = b.img && b.img.complete && b.img.naturalWidth ? b.img : null, text = (b.text || '').trim();
  if (!img && !text) return;
  const U = Math.min(W, H), m = U * 0.045, hgt = U * b.size;
  let lw = 0, lh = 0;
  if (img) {
    lh = hgt; lw = hgt * img.naturalWidth / img.naturalHeight;
    if (lw > W * 0.4) { lw = W * 0.4; lh = lw * img.naturalHeight / img.naturalWidth; }
  }
  const fpx = img ? Math.max(12, hgt * 0.42) : Math.max(12, hgt * 0.6);
  ctx.save();
  ctx.font = `700 ${fpx}px "Outfit", "Helvetica Neue", Arial, sans-serif`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  const tw = text ? Math.min(ctx.measureText(text).width, W * 0.5) : 0, gap = lw && tw ? fpx * 0.5 : 0;
  const boxW = lw + gap + tw, boxH = Math.max(lh, fpx);
  const right = b.pos.endsWith('right'), center = b.pos.endsWith('center'), bottom = b.pos.startsWith('bottom');
  const bars = tpl.letterbox && W > H ? H * 0.1 : 0;
  const x = right ? W - m - boxW : center ? (W - boxW) / 2 : m;
  const y = bottom ? H - Math.max(m, bars ? (bars - boxH) / 2 : 0) - boxH : Math.max(m, bars ? (bars - boxH) / 2 : 0);
  ctx.globalAlpha = b.opacity;
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = fpx * 0.3; ctx.shadowOffsetY = fpx * 0.05;
  if (img) ctx.drawImage(img, x, y + (boxH - lh) / 2, lw, lh);
  if (text) {
    ctx.fillStyle = b.color || '#ffffff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(text, x + lw + gap, y + boxH / 2, W * 0.5);
  }
  ctx.restore();
}

/* ---------- lyrics colour ---------- */
function lvHexLuma(c) {
  if (!c || c[0] !== '#') return 0.5;
  let h = c.slice(1); if (h.length === 3) h = h.split('').map(x => x + x).join('');
  const n = parseInt(h.slice(0, 6), 16), lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255);
}
let lvProbeC = null;
const lvAutoState = new WeakMap();
// Brightness (0..1) of the background where the lyrics sit, from a tiny copy of it.
function lvBgLuma(W, H, t, tpl, media) {
  if (!lvProbeC) { lvProbeC = document.createElement('canvas'); lvProbeC.width = 48; lvProbeC.height = 27; }
  const g = lvProbeC.getContext('2d', { willReadFrequently: true });
  g.save(); g.clearRect(0, 0, 48, 27);
  g.scale(48 / W, 27 / H);
  lvBackground(g, W, H, t, { ...tpl, particles: { ...tpl.particles, type: 'none' }, pulse: 0 }, 0, media);
  g.restore();
  const y0 = tpl.layout === 'lower' ? 16 : tpl.layout === 'upper' ? 3 : 9, x0 = tpl.align === 'left' ? 3 : 6;
  const d = g.getImageData(x0, y0, 36, 9).data, lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  let sum = 0; for (let i = 0; i < d.length; i += 4) sum += 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]);
  return sum / (d.length / 4);
}
// color = { mode: 'style' | 'auto' | 'custom', text, highlight }
function lvApplyColor(ctx, W, H, t, tpl, color, media) {
  if (!color || color.mode === 'style') return tpl;
  if (color.mode === 'custom') {
    const text = lvColor(color.text, tpl.colors.text), hl = lvColor(color.highlight, tpl.colors.highlight);
    return { ...tpl, colors: { text, highlight: hl, shadow: lvHexLuma(text) > 0.4 ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.35)' } };
  }
  const L = lvBgLuma(W, H, t, tpl, media);
  // hysteresis so a moving video background doesn't make the text flicker between colours
  let dark = lvAutoState.get(ctx);
  if (dark === undefined) dark = L > 0.3;
  else if (dark && L < 0.22) dark = false;
  else if (!dark && L > 0.38) dark = true;
  lvAutoState.set(ctx, dark);
  const text = dark ? '#121318' : '#ffffff';
  let hl = tpl.colors.highlight;
  const hlL = lvHexLuma(hl);
  if (dark ? hlL > 0.45 : hlL < 0.12) hl = dark ? '#b3122e' : '#ffd166';   // keep the highlight readable too
  return { ...tpl, colors: { text, highlight: hl, shadow: dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.55)' } };
}

/* Main entry. audio = { level: 0..1, bins: Uint8Array | null }
   extra = { bg: { el: <img|video>, dim: 0..1 } | null, brand: {...} | null, color: {...} | null } */
function lvRender(ctx, W, H, t, tpl, cues, audio, extra) {
  const level = audio && audio.level || 0;
  ctx.save();
  ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over';
  lvBackground(ctx, W, H, t, tpl, level, extra && extra.bg);
  lvSpectrum(ctx, W, H, tpl, audio && audio.bins);
  const i = lvFindCue(cues, t);
  if (i >= 0) lvDrawCue(ctx, W, H, t, extra && extra.color ? lvApplyColor(ctx, W, H, t, tpl, extra.color, extra.bg) : tpl, cues[i], cues, i);
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  lvOverlays(ctx, W, H, t, tpl);
  lvBrand(ctx, W, H, tpl, extra && extra.brand);
  ctx.restore();
}

