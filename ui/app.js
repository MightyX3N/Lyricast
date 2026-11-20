(() => {
'use strict';
const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('lyricast.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('lyricast.' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('lyricast.' + k); } catch {} }
};
// Talks to the local Lyricast engine (this app's own server on 127.0.0.1).
async function api(path, opts = {}) {
  const headers = { 'X-Lyricast': '1', ...(opts.headers || {}) };
  let body = opts.body;
  if (opts.json !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(opts.json); }
  const r = await fetch('/api/' + path, { method: opts.method || (body ? 'POST' : 'GET'), headers, body });
  if (!r.ok) { let m = `Engine returned ${r.status}`; try { m = (await r.json()).error || m; } catch {} throw new Error(m); }
  return opts.raw ? r : r.json();
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------------- state ---------------- */
const DEMO_SRT = "1\n00:00:00,319 --> 00:00:01,688\nHey! Make it yours!\n\n2\n00:00:01,774 --> 00:00:10,473\nHey! Make it yours!\n\n3\n00:00:10,484 --> 00:00:12,899\nGot a song and words? Bring ’em in,\n\n4\n00:00:12,952 --> 00:00:14,984\nLyricast gets your video rolling.\n\n5\n00:00:15,048 --> 00:00:17,394\nAuto-match the lines, then make them fit,\n\n6\n00:00:17,474 --> 00:00:19,787\nTap to time them—tweak a little bit.\n\n7\n00:00:19,867 --> 00:00:22,021\nSRT ready, Suno import too,\n\n8\n00:00:22,101 --> 00:00:24,343\nA few seconds off? You can tune it through.\n\n9\n00:00:24,348 --> 00:00:25,425\nYour browser’s where it stays,\n\n10\n00:00:25,479 --> 00:00:27,239\nNo uploads, no stored files—\n\n11\n00:00:27,271 --> 00:00:28,851\nMake it yours in just a few clicks,\n\n12\n00:00:28,899 --> 00:00:32,019\nThen sit back and smile!\n\n13\n00:00:32,032 --> 00:00:34,420\nLyricast, line it up, let it play,\n\n14\n00:00:34,452 --> 00:00:36,283\nPick your look, put your own spin on the frame.\n\n15\n00:00:36,343 --> 00:00:38,665\nYouTube, TikTok—ready to go,\n\n16\n00:00:38,713 --> 00:00:41,994\nYour song, your style, your video!\n\n17\n00:00:42,101 --> 00:00:45,931\nLyricast, make it yours today,\n\n18\n00:00:45,984 --> 00:00:51,242\nWe’re your ghost editor, clearing the way.\n\n19\n00:00:51,251 --> 00:00:53,412\nBring your logo, bring a picture or a scene,\n\n20\n00:00:53,446 --> 00:00:55,737\nChoose paper cut or karaoke-screen.\n\n21\n00:00:55,782 --> 00:00:58,277\nGolden hour, quiet room, signal style,\n\n22\n00:00:58,309 --> 00:01:00,539\nNeon-night colors—make the words go wild.\n\n23\n00:01:00,599 --> 00:01:03,231\nUse your own AI key, kept in your browser,\n\n24\n00:01:03,271 --> 00:01:05,613\nSet your own look, make your edits even bolder.\n\n25\n00:01:05,627 --> 00:01:06,994\nNo branding that you don’t want,\n\n26\n00:01:07,048 --> 00:01:08,099\nNo credit that you need—\n\n27\n00:01:08,139 --> 00:01:09,375\nExport it for your favorite feed,\n\n28\n00:01:09,415 --> 00:01:12,791\nAnd let your lyrics lead!\n\n29\n00:01:12,803 --> 00:01:15,271\nLyricast, line it up, let it play,\n\n30\n00:01:15,303 --> 00:01:17,134\nPick your look, put your own spin on the frame.\n\n31\n00:01:17,194 --> 00:01:19,516\nYouTube, TikTok—ready to go,\n\n32\n00:01:19,564 --> 00:01:22,846\nYour song, your style, your video!\n\n33\n00:01:22,952 --> 00:01:26,702\nLyricast, make it yours today,\n\n34\n00:01:26,756 --> 00:01:32,007\nWe’re your ghost editor, clearing the way.\n\n35\n00:01:32,013 --> 00:01:34,743\nIf you love it, toss a buck our way,\n\n36\n00:01:34,780 --> 00:01:36,888\nEverything’s free—we hope you’ll stay!\n\n37\n00:01:36,995 --> 00:01:39,287\nOh yea, oh yea, make the words shine,\n\n38\n00:01:39,319 --> 00:01:41,586\nYour browser, your art, your time!\n\n39\n00:01:41,594 --> 00:01:44,075\nLyricast, line it up, let it play,\n\n40\n00:01:44,107 --> 00:01:45,938\nPick your look, put your own spin on the frame.\n\n41\n00:01:45,998 --> 00:01:48,319\nYouTube, TikTok—ready to go,\n\n42\n00:01:48,367 --> 00:01:51,728\nYour song, your style, your video!\n\n43\n00:01:51,835 --> 00:01:55,479\nLyricast, make it yours today,\n\n44\n00:01:55,505 --> 00:02:02,381\nWe’re your ghost editor—out of the way!\n\n45\n00:02:02,414 --> 00:02:08,404\nOh yea, oh yea!\n\n46\n00:02:08,511 --> 00:02:12,606\nLyricast—make it yours!\n";
const DEMO_AUDIO = 'make-it-yours.mp3', DEMO_NAME = 'Make It Yours (demo song)';

const S = {
  mode: 'text',          // 'text' | 'srt'
  cues: [],              // {start, end, text}
  audioURL: null, audioName: '', duration: 0,
  demo: true, demoT: 0, demoPlaying: true, demoDur: 0,
  tplId: store.get('tpl', 'neon-night'),
  custom: (store.get('templates', []) || []).map(t => lvSanitize({ ...t, custom: true })),
  format: '1920x1080'
};
const audio = new Audio(); audio.preload = 'auto';
let actx = null, srcNode, analyser, monitor, bins = null;

const allTemplates = () => [...LV_BUILTIN.map(t => lvSanitize(t)), ...S.custom];
const tpl = () => allTemplates().find(t => t.id === S.tplId) || lvSanitize(LV_BUILTIN[0]);

/* ---------------- time formatting ---------------- */
const fmt = (s, dec = 1) => {
  if (s == null || !isFinite(s)) return '';
  const m = Math.floor(s / 60), r = s - m * 60;
  return `${m}:${r.toFixed(dec).padStart(dec ? 3 + dec : 2, '0')}`;
};
const parseT = str => {
  str = String(str).trim(); if (!str) return null;
  const m = str.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  return m ? (+(m[1] || 0)) * 60 + +m[2] : null;
};

/* ---------------- lyrics parsing ---------------- */
function parseSRT(txt) {
  // Accepts real-world SRT: missing blank lines between blocks, no hour field,
  // "," "." or ":" before milliseconds, BOM, Windows line endings, <i>/{\an8} tags.
  const TS = /(?:(\d+):)?(\d{1,2}):(\d{1,2})[,.:](\d{1,3})\s*-->\s*(?:(\d+):)?(\d{1,2}):(\d{1,2})[,.:](\d{1,3})/;
  const sec = (h, m, s, ms) => (+h || 0) * 3600 + +m * 60 + +s + +String(ms).padEnd(3, '0') / 1000;
  const rows = txt.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  const out = []; let cur = null;
  const push = () => { if (cur && cur.text.trim()) { cur.text = cur.text.trim(); out.push(cur); } cur = null; };
  for (let i = 0; i < rows.length; i++) {
    const line = rows[i].trim(), m = line.match(TS);
    if (m) {
      push();
      cur = { start: sec(m[1], m[2], m[3], m[4]), end: sec(m[5], m[6], m[7], m[8]), text: '' };
      continue;
    }
    if (!cur) continue;
    if (!line) { if (cur.text) push(); continue; }
    if (/^\d+$/.test(line) && i + 1 < rows.length && TS.test(rows[i + 1])) { push(); continue; } // block number
    const t = line.replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim();
    if (t) cur.text += (cur.text ? '\n' : '') + t;
  }
  push();
  out.forEach(c => { if (c.start === 0 && c.end === 0) c.start = c.end = null; else if (!(c.end > c.start)) c.end = c.start + 2; });
  return out.sort((a, b) => (a.start ?? Infinity) - (b.start ?? Infinity));
}
// [Intro], [Verse 1], (Chorus), {Bridge} on their own line are section labels, not lyrics
const isLabel = l => /^\s*[\[({][^\])}]*[\])}]\s*$/.test(l);
const textLines = txt => txt.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(l => l && !isLabel(l));
function fromText(txt) {
  const lines = textLines(txt), old = S.cues;
  return lines.map((text, i) => ({ text, start: old[i] ? old[i].start : null, end: old[i] ? old[i].end : null, est: old[i] ? !!old[i].est : false }));
}
function toSRT(cues) {
  const ts = t => {
    t = Math.max(0, t || 0);
    const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = Math.floor(t) % 60, ms = Math.round((t % 1) * 1000) % 1000;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  };
  return cues.map((c, i) => `${i + 1}\n${c.start == null ? '00:00:00,000 --> 00:00:00,000' : ts(c.start) + ' --> ' + ts(c.end ?? c.start + 2)}\n${c.text}`).join('\n\n') + '\n';
}
/* Word-level SRT (one entry per word, like Suno's aligned-words export) -> lyric lines that keep
   every word's own time. Suno marks its line breaks inside the export: a blank line right after the
   timestamp means a new line starts at this word; an extra blank line after a word ends the line.
   Section tags like [Verse] also start a new line. Returns null for normal line-level SRT. */
function parseWordSRT(txt) {
  const rows = txt.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  const TS = /(?:(\d+):)?(\d{1,2}):(\d{1,2})[,.:](\d{1,3})\s*-->\s*(?:(\d+):)?(\d{1,2}):(\d{1,2})[,.:](\d{1,3})/;
  const sec = (h, m, s, ms) => (+h || 0) * 3600 + +m * 60 + +s + +String(ms).padEnd(3, '0') / 1000;
  const items = [];
  for (let i = 0; i < rows.length; i++) {
    const m = rows[i].match(TS); if (!m) continue;
    let j = i + 1; const body = [];
    while (j < rows.length && !TS.test(rows[j]) && !(/^\s*\d+\s*$/.test(rows[j]) && j + 1 < rows.length && TS.test(rows[j + 1]))) { body.push(rows[j]); j++; }
    const text = body.filter(l => l.trim()).join(' ');
    const tag = /\[[^\]]*\]/.test(text);
    const word = text.replace(/\[[^\]]*\]/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    let trail = 0; for (let k = body.length - 1; k >= 0 && !body[k].trim(); k--) trail++;
    const atEnd = j >= rows.length;
    items.push({ word, start: sec(m[1], m[2], m[3], m[4]), end: sec(m[5], m[6], m[7], m[8]),
                 before: tag || (body.length > 1 && !body[0].trim()), after: !atEnd && trail >= 2 });
    i = j - 1;
  }
  const real = items.filter(x => x.word);
  if (real.length < 8) return null;
  const perEntry = real.reduce((a, x) => a + x.word.split(' ').length, 0) / real.length;
  if (perEntry > 1.6) return null;                          // normal SRT: several words per entry
  const marked = items.some(x => x.before || x.after);
  const lines = []; let cur = null, prev = null;
  const flush = () => { if (cur && cur.words.length) lines.push(cur); cur = null; };
  for (const x of items) {
    let brk = x.before || (prev && prev.after);
    if (!marked && cur && prev) {                            // no markers: guess from pauses and sentence ends
      const gap = x.start - prev.end;
      brk = gap > 0.7 || (gap > 0.3 && /^[A-ZÆØÅÄÖÜ]/.test(x.word)) || /[.!?]$/.test(prev.word) || cur.words.length >= 10;
    }
    if (cur && (x.start - cur.words[cur.words.length - 1].end > 2.5 || cur.words.length >= 24)) brk = true;
    if (brk) flush();
    if (x.word) { if (!cur) cur = { words: [] }; cur.words.push({ text: x.word, start: x.start, end: x.end }); }
    prev = x.word ? x : prev;
    if (x.after) flush();
  }
  flush();
  return lines.map((l, i) => {
    const w = l.words, next = lines[i + 1];
    const end = w[w.length - 1].end + 0.4;
    return { start: +w[0].start.toFixed(2), end: +(next ? Math.min(end, next.words[0].start - 0.05) : end).toFixed(2),
             text: w.map(x => x.text).join(' ').replace(/\s+([,.!?;:…])/g, '$1'), words: w };
  });
}
// Word times stay with their lines through edits and format switches (matched by line number and text).
function rememberWords(cues) { S.wordCache = cues.map(c => c.words ? { text: c.text, start: c.start, words: c.words } : null); }
function forgetWords() { S.wordCache = null; S.cues.forEach(c => { c.words = null; }); }
function attachWords() {
  if (!S.wordCache) return;
  S.cues.forEach((c, i) => {
    const w = S.wordCache[i];
    if (!w || c.start == null || w.text.replace(/\s+/g, ' ') !== c.text.replace(/\s+/g, ' ')) { c.words = null; return; }
    const d = c.start - w.start;
    c.words = w.words.map(x => ({ text: x.text, start: +(x.start + d).toFixed(3), end: +(x.end + d).toFixed(3) }));
  });
}

function lyricsChanged() {
  const v = $('lyrics').value;
  if (S.mode === 'text' && /-->/.test(v)) setMode('srt', false);
  const wordLevel = S.mode === 'srt' ? parseWordSRT(v) : null;
  if (wordLevel && wordLevel.length) {
    // show the grouped lines in the box; the word times are kept on the side
    rememberWords(wordLevel);
    $('lyrics').value = toSRT(wordLevel);
    S.cues = parseSRT($('lyrics').value);
    attachWords();
    $('lyrNote').textContent = `${wordLevel.reduce((a, c) => a + c.words.length, 0)} timed words grouped into ${S.cues.length} lines`;
    renderCues();
    return;
  }
  S.cues = S.mode === 'srt' ? parseSRT(v) : fromText(v);
  attachWords();
  if (S.mode === 'srt' && v.trim() && !S.cues.length) $('lyrNote').textContent = 'No timed lines found. Check the SRT format.';
  else {
    const labels = S.mode === 'text' ? v.split('\n').filter(l => l.trim() && isLabel(l)).length : 0;
    $('lyrNote').textContent = `${S.cues.length} line${S.cues.length === 1 ? '' : 's'}` + (labels ? ` · ${labels} section label${labels === 1 ? '' : 's'} like [Chorus] skipped` : '');
  }
  renderCues();
}
function setMode(m, reparse = true) {
  S.mode = m;
  $('modeText').setAttribute('aria-pressed', m === 'text'); $('modeSrt').setAttribute('aria-pressed', m === 'srt');
  $('lyrics').placeholder = m === 'srt' ? '1\n00:00:12,400 --> 00:00:15,900\nFirst line of the song\n\n2\n00:00:16,000 --> 00:00:19,200\nSecond line' : 'One lyric line per line.\nBlank lines and labels like [Chorus] are skipped.';
  if (reparse) lyricsChanged();
}
// Switching format converts what is in the box; the timings are kept either way.
function switchMode(m) {
  if (m === S.mode) return;
  const saved = S.cues.map(c => ({ ...c })), flat = c => c.text.replace(/\n/g, ' ');
  if (m === 'srt') {
    S.plainText = $('lyrics').value;
    $('lyrics').value = saved.length ? toSRT(saved) : '';
  } else {
    const lines = saved.map(flat);
    const same = S.plainText != null && textLines(S.plainText).join('\n') === lines.join('\n');
    $('lyrics').value = same ? S.plainText : lines.join('\n');
  }
  setMode(m, false);
  S.cues = [];
  lyricsChanged();
  if (S.cues.length === saved.length) S.cues.forEach((c, i) => { if (flat(c) === flat(saved[i])) { c.start = saved[i].start; c.end = saved[i].end; c.est = saved[i].est; c.words = saved[i].words || null; } });
  renderCues();
}
/* ---------------- timing ---------------- */
function totalDur() { return S.demo ? S.demoDur : (S.duration || 0); }
function spread() {
  const n = S.cues.length; if (!n) return;
  const D = totalDur() || n * 3.2;
  const lead = S.demo ? 0.6 : Math.min(8, D * 0.06), tail = S.demo ? 0.4 : Math.min(4, D * 0.03);
  const step = (D - lead - tail) / n;
  forgetWords();
  S.cues.forEach((c, i) => { c.est = false; c.start = +(lead + i * step).toFixed(2); c.end = +(lead + (i + 1) * step - 0.08).toFixed(2); });
  renderCues();
}
function renderCues() {
  const box = $('cues'); box.innerHTML = '';
  let missing = 0;
  S.cues.forEach((c, i) => {
    if (c.start == null || c.end == null) missing++;
    const row = document.createElement('div'); row.className = 'cue'; row.setAttribute('role', 'listitem'); row.dataset.i = i;
    const mk = (key, label) => {
      const inp = document.createElement('input'); inp.value = fmt(c[key], 2); inp.placeholder = '–:––'; inp.setAttribute('aria-label', `${label} of line ${i + 1}`);
      if (c[key] == null) inp.classList.add('missing'); else if (c.est) { inp.classList.add('est'); inp.title = 'Estimated. Check this one.'; }
      inp.addEventListener('change', () => { const v = parseT(inp.value);
        if (key === 'start' && c.words && c.start != null && v != null) { const d = v - c.start; c.words = c.words.map(x => ({ ...x, start: x.start + d, end: x.end + d })); if (S.wordCache && S.wordCache[i]) S.wordCache[i] = { text: c.text, start: v, words: c.words }; }
        c[key] = v; c.est = false; row.querySelectorAll('input').forEach(x => { x.classList.remove('est'); x.title = ''; }); inp.value = fmt(v, 2); inp.classList.toggle('missing', v == null); updateSyncCount(); });
      return inp;
    };
    const tx = document.createElement('span'); tx.className = 'txt'; tx.textContent = c.text.replace(/\n/g, ' / '); tx.title = 'Jump here';
    tx.addEventListener('click', () => { if (c.start != null) seek(c.start); });
    row.append(mk('start', 'Start'), mk('end', 'End'), tx); box.append(row);
  });
  updateSyncCount();
}
function updateSyncCount() {
  const n = S.cues.length, timed = S.cues.filter(c => c.start != null && c.end != null).length;
  $('syncCount').textContent = n ? `${timed}/${n} timed` : '';
  const est = S.cues.filter(c => c.est && c.start != null).length;
  if (n && timed === n && est) {
    $('syncNote').className = 'note';
    $('syncNote').innerHTML = `<span class="legend"></span>${est === 1 ? '1 line' : est + ' lines'} could not be matched to the vocals with confidence (yellow). Click a line to jump there and check it.`;
    return;
  }
  $('syncNote').className = 'note' + (n && timed < n ? ' warn' : '');
  $('syncNote').textContent = n && timed < n
    ? `${n - timed} line${n - timed === 1 ? ' has' : 's have'} no timing yet. Tap to sync, or spread them evenly and adjust.`
    : 'Auto-time lines your lyrics up with the vocals. Refine timing snaps existing times (from Tap, SRT or by hand) to where each line is sung. Tap to sync lets you do it by hand with Space.';
}

/* ---------------- audio ---------------- */
function ensureCtx() {
  if (actx) return;
  actx = new (window.AudioContext || window.webkitAudioContext)();
  srcNode = actx.createMediaElementSource(audio);
  analyser = actx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.78;
  monitor = actx.createGain();
  srcNode.connect(analyser); srcNode.connect(monitor); monitor.connect(actx.destination);
  bins = new Uint8Array(analyser.frequencyBinCount);
}
function uploadAudio(file) {
  return api('audio', { method: 'POST', body: file, headers: { 'X-Name': encodeURIComponent(file.name).slice(0, 400), 'content-type': 'application/octet-stream' } })
    .then(r => r.id);
}
function loadAudio(file, onReady, knownId) {
  if (!file) return;
  if (S.audioURL) URL.revokeObjectURL(S.audioURL);
  S.audioURL = URL.createObjectURL(file); S.audioName = file.name; S.audioFile = file;
  S.upload = knownId ? Promise.resolve(knownId) : uploadAudio(file);
  S.upload.catch(() => {});
  audio.src = S.audioURL; audio.load();
  const wasDemo = S.demo || S.demoSong, isDemo = file.name === DEMO_NAME;
  audio.onloadedmetadata = () => {
    S.duration = audio.duration; S.demo = false; S.demoPlaying = false; S.demoSong = isDemo;
    $('trackName').textContent = file.name; $('trackDur').textContent = fmt(audio.duration, 0);
    $('track').hidden = false; $('drop').hidden = isDemo ? false : true; $('demoBadge').hidden = !isDemo;
    if (!isDemo && wasDemo && $('lyrics').value.trim() === DEMO_SRT.trim()) { $('lyrics').value = ''; S.cues = []; S.plainText = null; setMode('text'); }
    seek(0); setPlayIcon(false);
    if (onReady) onReady();
  };
  audio.onerror = () => { $('lyrNote').textContent = ''; alertNote('That file could not be read as audio. Try MP3, WAV, OGG or M4A.'); };
}
function alertNote(msg) { const n = $('expNote'); n.textContent = msg; n.className = 'note warn'; }
function unloadAudio() {
  audio.pause(); audio.removeAttribute('src'); audio.load();
  if (S.audioURL) URL.revokeObjectURL(S.audioURL);
  S.audioURL = null; S.duration = 0; S.demo = true; S.demoSong = false; S.demoT = 0; S.demoPlaying = false; S.audioFile = null; S.upload = null;
  $('track').hidden = true; $('drop').hidden = false; $('demoBadge').hidden = false;
  if (!S.cues.length) { loadDemoLyrics(); loadDemoSong(); }
  setPlayIcon(false);
}
const now = () => S.demo ? S.demoT : audio.currentTime;
const playing = () => S.demo ? S.demoPlaying : !audio.paused;
function setPlayIcon(p) { $('icoPlay').toggleAttribute('hidden', p); $('icoPause').toggleAttribute('hidden', !p); $('playBtn').setAttribute('aria-label', p ? 'Pause' : 'Play'); }
function toggle() {
  if (S.demo) { S.demoPlaying = !S.demoPlaying; setPlayIcon(S.demoPlaying); return; }
  ensureCtx(); actx.resume();
  if (audio.paused) audio.play(); else audio.pause();
}
audio.addEventListener('play', () => setPlayIcon(true));
audio.addEventListener('pause', () => setPlayIcon(false));
function seek(t) { if (S.demo) S.demoT = t; else audio.currentTime = Math.max(0, Math.min(t, S.duration || 0)); syncBgVideo(t, true); }

/* ---------------- preview loop ---------------- */
const view = $('view'), vctx = view.getContext('2d');
let last = performance.now(), lastCue = -2, scrubbing = false;
function sizeView() {
  const [w, h] = S.format.split('x').map(Number), k = 960 / Math.max(w, h);
  view.width = Math.round(w * k); view.height = Math.round(h * k);
}
function audioLevel(t) {
  if (!S.demo && analyser && !audio.paused) {
    analyser.getByteFrequencyData(bins);
    let s = 0; for (let i = 0; i < 24; i++) s += bins[i];
    return { level: Math.min(1, s / (24 * 200)), bins };
  }
  if (S.demo) { // fake a beat when the demo song could not be loaded
    const b = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 1.05)), 8);
    const fake = new Uint8Array(64).map((_, i) => 255 * Math.max(0, 0.75 - i / 80) * (0.55 + 0.45 * b) * (0.7 + 0.3 * Math.sin(t * 4 + i)));
    return { level: S.demoPlaying ? b * 0.8 : 0, bins: fake };
  }
  return { level: 0, bins: null };
}
function frame(ts) {
  const dt = (ts - last) / 1000; last = ts;
  if (S.demo && S.demoPlaying) { S.demoT += dt; if (S.demoT > S.demoDur) S.demoT = 0; }
  const t = now();
  if (exporting) { requestAnimationFrame(frame); return; }
  syncBgVideo(t, false);
  lvRender(vctx, view.width, view.height, t, tpl(), S.cues, audioLevel(t), extras());
  const D = totalDur();
  $('tNow').textContent = fmt(t); $('tDur').textContent = fmt(D, 0);
  if (!scrubbing && D) $('scrub').value = Math.round((t / D) * 1000);
  const ci = lvFindCue(S.cues, t);
  if (ci !== lastCue) {
    document.querySelectorAll('.cue.now').forEach(e => e.classList.remove('now'));
    const row = document.querySelector(`.cue[data-i="${ci}"]`);
    if (row) {
      row.classList.add('now');
      const box = $('cues');
      if (playing() && (row.offsetTop < box.scrollTop || row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight))
        box.scrollTop = row.offsetTop - box.clientHeight / 2 + row.offsetHeight / 2;
    }
    lastCue = ci;
  }
  requestAnimationFrame(frame);
}
$('scrub').addEventListener('input', e => { scrubbing = true; seek((e.target.value / 1000) * totalDur()); });
$('scrub').addEventListener('change', () => { scrubbing = false; });
$('playBtn').addEventListener('click', toggle);

/* ---------------- style strip ---------------- */
const thumbCues = [{ start: 0, end: 3, text: 'Turn the quiet into sound' }];
function renderStyles() {
  const box = $('styles'); box.innerHTML = '';
  allTemplates().forEach(t => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sty'; b.setAttribute('aria-pressed', t.id === S.tplId);
    const c = document.createElement('canvas'); c.width = 320; c.height = 180;
    const lab = document.createElement('span'); lab.innerHTML = `<b></b><em>${t.custom ? 'AI' : t.anim}</em>`; lab.querySelector('b').textContent = t.name;
    b.append(c, lab);
    b.addEventListener('click', () => { S.tplId = t.id; store.set('tpl', t.id); renderStyles(); });
    if (t.custom) {
      const d = document.createElement('span'); d.className = 'del'; d.setAttribute('role', 'button'); d.tabIndex = 0; d.textContent = '×'; d.title = 'Delete this style';
      const kill = e => { e.stopPropagation(); S.custom = S.custom.filter(x => x.id !== t.id); store.set('templates', S.custom); if (S.tplId === t.id) S.tplId = 'neon-night'; renderStyles(); };
      d.addEventListener('click', kill); d.addEventListener('keydown', e => { if (e.key === 'Enter') kill(e); });
      b.append(d);
    }
    box.append(b);
    lvRender(c.getContext('2d'), 320, 180, 2.2, t, thumbCues, { level: 0.3, bins: new Uint8Array(64).fill(120) });
  });
  const ai = document.createElement('button'); ai.type = 'button'; ai.className = 'sty ai';
  ai.innerHTML = '<div><b>+ Create with AI</b><br><span class="note">Describe a look, get a new style</span></div>';
  ai.addEventListener('click', openAI); box.append(ai);
  $('styleName').textContent = tpl().name;
}

/* ---------------- auto-time & refine (local engine) ---------------- */
// Demucs isolates the vocals, MMS finds every letter, and the vocal's own loudness
// tells how long each word is held. All of it runs in the Python engine.
let autoBusy = false, autoMode = 'auto', autoJob = null, ENGINE = null;
function engineText() {
  const t = ENGINE && ENGINE.torch;
  if (!t) return 'Checking the engine…';
  if (!t.torch) return 'The timing engine is not installed (PyTorch missing). Run install.bat / install.sh again. ' + (t.error || '');
  if (t.gpu) return `Runs on your GPU: ${t.gpu}. A 4-minute song takes well under a minute.`;
  return 'Runs on your CPU' + (t.cuda_error ? ` (GPU not usable: ${t.cuda_error})` : '') + '. A 4-minute song takes a few minutes; an NVIDIA GPU is much faster.';
}
function openAuto(mode) {
  const say = t => { $('syncNote').className = 'note warn'; $('syncNote').textContent = t; };
  if (S.demo || !S.audioFile) return say('Add your song first, then the timing can be matched to it.');
  if (!S.cues.length) { $('lyrics').focus(); return say('Paste your lyrics first, one line per line.'); }
  if (mode === 'refine' && S.cues.some(c => c.start == null)) return say('Refine needs a time on every line first. Use Auto-time, Tap to sync, Spread evenly or an SRT file, then refine.');
  autoMode = mode;
  $('autoTitle').textContent = mode === 'refine' ? 'Refine timing' : 'Auto-time from the song';
  $('autoIntro').textContent = mode === 'refine'
    ? 'Keeps every line near its current time and finds exactly where each word is sung and how long it is held. Good after an SRT, a Suno import or Tap to sync.'
    : 'Finds where every word of your lyrics is sung and how long it is held. Ad-libs, backing vocals and instrumental parts are skipped. Put ad-libs in (parentheses) so they are shown but never forced onto the lead vocal.';
  $('autoSep').checked = store.get('separate', true);
  $('autoWinRow').hidden = mode !== 'refine';
  $('autoWin').value = store.get('window', 4); $('autoWinOut').textContent = $('autoWin').value + ' s';
  $('autoDev').textContent = engineText();
  $('autoErr').hidden = true; $('autoRun').hidden = !autoBusy; $('autoGo').disabled = autoBusy;
  $('autoDlg').showModal();
}
$('autoWin').addEventListener('input', e => { $('autoWinOut').textContent = e.target.value + ' s'; });
function autoUI(stage, pct) {
  $('autoRun').hidden = false;
  if (stage != null) $('autoStage').textContent = stage;
  if (pct != null) { $('autoBar').style.width = (pct * 100).toFixed(1) + '%'; $('autoPct').textContent = Math.round(pct * 100) + '%'; }
  else { $('autoPct').textContent = ''; }
}
function autoStop(msg) {
  autoBusy = false; autoJob = null; $('autoGo').disabled = false;
  if (msg) { $('autoErr').textContent = msg; $('autoErr').hidden = false; }
}
async function runAuto() {
  if (autoBusy) return;
  autoBusy = true; $('autoGo').disabled = true; $('autoErr').hidden = true;
  const lines = S.cues.map(c => c.text.replace(/\n/g, ' '));
  const separate = $('autoSep').checked; store.set('separate', separate);
  const win = +$('autoWin').value; store.set('window', win);
  const mode = autoMode;
  autoUI('Handing the song to the engine…', 0);
  let id, job;
  try { id = await S.upload; }
  catch (e) { return autoStop('Could not hand the song to the engine: ' + e.message); }
  try {
    job = (await api('timing', { json: { audio: id, lines, mode, separate, options: { window: win },
      cues: S.cues.map(c => ({ start: c.start, end: c.end })) } })).job;
  } catch (e) { return autoStop('Timing failed: ' + e.message); }
  autoJob = job;
  while (autoBusy && autoJob === job) {
    await sleep(350);
    let v;
    try { v = await api('job/' + job); } catch (e) { return autoStop('Lost contact with the engine: ' + e.message); }
    if (autoJob !== job) return;
    if (v.state === 'running') { autoUI(v.stage, v.progress); continue; }
    if (v.state === 'cancelled') return autoStop();
    if (v.state === 'error') return autoStop('Timing failed: ' + v.error);
    const res = v.result.lines, rep = v.result.report || {};
    if (res.length !== S.cues.length) return autoStop('The lyrics changed while timing was running. Run it again.');
    S.cues.forEach((c, i) => { c.start = res[i].start; c.end = res[i].end; c.est = res[i].est; c.words = res[i].words; });
    rememberWords(S.cues);
    if (S.mode === 'srt') $('lyrics').value = toSRT(S.cues);
    renderCues(); autoStop(); $('autoDlg').close(); $('autoRun').hidden = true;
    const flagged = res.filter(r => r.est).length;
    if (!flagged) {
      $('syncNote').className = 'note';
      $('syncNote').textContent = `Timed ${res.length} lines word by word in ${rep.total_s ?? '?'} s on ${rep.device || 'this computer'}${rep.separated ? ', from the isolated vocals' : ''}. Click any line to jump there.`;
    }
    seek(S.cues[0].start > 1 ? S.cues[0].start - 1 : 0);
    return;
  }
}
function cancelAuto() {
  if (autoBusy && autoJob) api(`job/${autoJob}/cancel`, { method: 'POST' }).catch(() => {});
  autoBusy = false; autoJob = null; $('autoGo').disabled = false; $('autoRun').hidden = true;
}
$('autoBtn').addEventListener('click', () => openAuto('auto'));
$('refineBtn').addEventListener('click', () => openAuto('refine'));
$('autoGo').addEventListener('click', runAuto);
$('autoCancel').addEventListener('click', () => { cancelAuto(); $('autoDlg').close(); });
$('autoClose').addEventListener('click', () => { cancelAuto(); $('autoDlg').close(); });
$('autoDlg').addEventListener('cancel', cancelAuto);

/* ---------------- tap to sync ---------------- */
let syncI = -1, syncOn = false;
function startSync() {
  if (!S.cues.length) { $('lyrics').focus(); return; }
  if (S.demo) { S.demoT = 0; S.demoPlaying = true; } else { ensureCtx(); actx.resume(); audio.currentTime = 0; audio.play(); }
  forgetWords();
  S.cues.forEach(c => { c.start = null; c.end = null; c.est = false; });
  syncI = 0; syncOn = true; $('sync').hidden = false; showSync(); $('tapHit').focus();
}
function showSync() {
  const c = S.cues;
  $('syncStep').textContent = syncI < c.length ? `Line ${syncI + 1} of ${c.length}` : 'Last line';
  $('sPrev').textContent = c[syncI - 1] ? c[syncI - 1].text : '';
  $('sCur').textContent = syncI < c.length ? c[syncI].text : 'Tap when the last line ends';
  $('sNxt').textContent = c[syncI + 1] ? c[syncI + 1].text : '';
  $('tapHit').textContent = syncI < c.length ? 'TAP' : 'END';
}
function tap() {
  const t = +now().toFixed(2), c = S.cues;
  if (syncI > 0 && c[syncI - 1].end == null) c[syncI - 1].end = Math.max(c[syncI - 1].start + 0.2, t - 0.05);
  if (syncI < c.length) { c[syncI].start = t; syncI++; showSync(); }
  else { c[c.length - 1].end = t; stopSync(); }
}
function undoTap() {
  if (syncI <= 0) return;
  syncI--; const c = S.cues; c[syncI].start = null; c[syncI].end = null;
  if (syncI > 0) c[syncI - 1].end = null;
  const back = syncI > 0 ? c[syncI - 1].start : 0; seek(Math.max(0, back - 1)); showSync();
}
function stopSync() {
  syncOn = false; $('sync').hidden = true;
  const c = S.cues, last = c.findLastIndex(x => x.start != null);
  if (last >= 0 && c[last].end == null) c[last].end = c[last].start + 4;
  if (S.demo) S.demoPlaying = true; else audio.pause();
  renderCues();
}
$('tapBtn').addEventListener('click', startSync);
$('tapHit').addEventListener('click', tap);
$('spreadBtn').addEventListener('click', spread);
document.addEventListener('keydown', e => {
  if (syncOn) {
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); tap(); }
    else if (e.code === 'Backspace') { e.preventDefault(); undoTap(); }
    else if (e.code === 'Escape') { e.preventDefault(); stopSync(); }
    return;
  }
  const tag = (e.target.tagName || '').toLowerCase();
  if (e.code === 'Space' && !['input', 'textarea', 'select', 'button'].includes(tag) && !$('aiDlg').open && !$('autoDlg').open) { e.preventDefault(); toggle(); }
});
audio.addEventListener('ended', () => { if (syncOn) tap(); });

/* ---------------- inputs ---------------- */
$('audioIn').addEventListener('change', e => loadAudio(e.target.files[0]));
$('trackX').addEventListener('click', unloadAudio);
const drop = $('drop');
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => { const f = [...e.dataTransfer.files]; const a = f.find(x => x.type.startsWith('audio')); const l = f.find(x => /\.(srt|txt)$/i.test(x.name)); if (a) loadAudio(a); if (l) readLyrics(l); });
function readLyrics(file) {
  const r = new FileReader();
  r.onload = () => { const txt = String(r.result); S.cues = []; S.plainText = null; setMode(/-->/.test(txt) || /\.srt$/i.test(file.name) ? 'srt' : 'text', false); $('lyrics').value = txt; lyricsChanged(); };
  r.readAsText(file);
}
$('lyrIn').addEventListener('change', e => e.target.files[0] && readLyrics(e.target.files[0]));
let lyrT; $('lyrics').addEventListener('input', () => { clearTimeout(lyrT); lyrT = setTimeout(lyricsChanged, 250); });
$('modeText').addEventListener('click', () => switchMode('text'));
$('modeSrt').addEventListener('click', () => switchMode('srt'));
$('format').addEventListener('change', e => { S.format = e.target.value; sizeView(); });

/* ---------------- export (offline, frame by frame) ---------------- */
// Every frame is drawn here with the same renderer as the preview, then handed to the
// engine, which encodes it with ffmpeg (on the GPU when it can) and adds the song.
let expCancelled = false, expId = null;
function seekVideo(v, t) {
  return new Promise(res => {
    const target = v.duration ? t % v.duration : 0;
    if (Math.abs(v.currentTime - target) < 0.004) return res();
    let done = false;
    const fin = () => { if (done) return; done = true; v.removeEventListener('seeked', fin); res(); };
    v.addEventListener('seeked', fin); v.currentTime = target; setTimeout(fin, 1500);
  });
}
function showDone(res) {
  const box = $('expDone'); box.hidden = false; box.innerHTML = '';
  const name = document.createElement('span'); name.className = 'grow'; name.title = res.path;
  name.textContent = `${res.path.split(/[\\/]/).pop()} · ${(res.size / 1048576).toFixed(1)} MB`;
  const open = document.createElement('button'); open.className = 'btn primary'; open.type = 'button'; open.textContent = 'Play video';
  open.onclick = () => api('open', { json: { path: res.path } }).catch(() => {});
  const show = document.createElement('button'); show.className = 'btn'; show.type = 'button'; show.textContent = 'Show in folder';
  show.onclick = () => api('reveal', { json: { path: res.path } }).catch(() => {});
  box.append(name, open, show);
}
async function startExport() {
  $('expNote').className = 'note';
  if (S.demo || !S.upload) { alertNote('Add your song first. The demo has no audio to put in the video.'); return; }
  if (!S.cues.some(c => c.start != null)) { alertNote('Time your lyrics first, with Auto-time, Tap to sync or Spread evenly.'); return; }
  const [W, H] = $('format').value.split('x').map(Number), fps = +$('fps').value;
  const D = S.duration, n = Math.ceil(D * fps);
  audio.pause();
  expCancelled = false; exporting = true; expId = null;
  $('expBtn').disabled = true; $('expCancel').hidden = false; $('expProg').hidden = false; $('expDone').hidden = true;
  $('expBar').style.width = '0%'; $('expTime').textContent = '';
  $('expNote').textContent = 'Preparing…';
  const vid = S.bg && S.bg.type === 'video' ? bgVideo : null;
  if (vid) vid.pause();
  let err = null;
  try {
    const id = await S.upload;
    const fb = await (await api(`features/${id}?fps=${fps}&n=${n}`, { raw: true })).arrayBuffer();
    const levels = new Float32Array(fb, 0, n), allBins = new Uint8Array(fb, n * 4, n * 128);
    const name = (S.audioName.replace(/\.[^.]+$/, '') || 'lyric video') + ' - lyric video';
    const ex = await api('export/start', { json: { audio: id, W, H, fps, name } });
    expId = ex.id;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    const look = tpl(), extra = extras();
    const inflight = new Set(), t0 = performance.now();
    $('expNote').textContent = `Rendering · encoder: ${ex.encoder.replace('h264_', '').toUpperCase()}`;
    for (let i = 0; i < n && !expCancelled && !err; i++) {
      const t = i / fps;
      if (vid) await seekVideo(vid, t);
      lvRender(cx, W, H, t, look, S.cues, { level: levels[i], bins: allBins.subarray(i * 128, i * 128 + 128) }, extra);
      const px = cx.getImageData(0, 0, W, H).data;
      const p = api(`export/${ex.id}/frame?i=${i}`, { method: 'POST', body: px, headers: { 'content-type': 'application/octet-stream' } })
        .then(() => {}, e => { err = err || e; });
      inflight.add(p); p.finally(() => inflight.delete(p));
      if (inflight.size >= 3) await Promise.race(inflight);
      if (i % 12 === 0) {
        vctx.drawImage(cv, 0, 0, view.width, view.height);
        const el = (performance.now() - t0) / 1000, rate = (i + 1) / el, left = (n - i - 1) / rate;
        $('expBar').style.width = (100 * (i + 1) / n).toFixed(1) + '%';
        $('expTime').textContent = `${fmt(t, 0)} / ${fmt(D, 0)} · ${rate.toFixed(0)} fps · ${left > 60 ? Math.ceil(left / 60) + ' min' : Math.ceil(left) + ' s'} left`;
      }
    }
    await Promise.all(inflight);
    if (err) throw err;
    if (expCancelled) { await api(`export/${ex.id}/cancel`, { method: 'POST' }).catch(() => {}); $('expNote').textContent = 'Render cancelled.'; return; }
    $('expNote').textContent = 'Finishing the file…';
    const res = await api(`export/${ex.id}/finish`, { method: 'POST' });
    const secs = ((performance.now() - t0) / 1000).toFixed(0);
    $('expNote').textContent = `Saved in ${secs} s with ${res.encoder.replace('h264_', '').toUpperCase()}.`;
    showDone(res);
  } catch (e) {
    if (expId) api(`export/${expId}/cancel`, { method: 'POST' }).catch(() => {});
    alertNote('Render failed: ' + e.message);
  } finally {
    exporting = false; expId = null;
    $('expBtn').disabled = false; $('expCancel').hidden = true; $('expProg').hidden = true;
    syncBgVideo(now(), true);
  }
}
$('expBtn').addEventListener('click', startExport);
$('expCancel').addEventListener('click', () => { expCancelled = true; });

/* ---------------- AI styles ---------------- */
const AI_MODELS = { anthropic: 'claude-sonnet-5-5', openai: '' };
const IDEAS = ['Rainy city at night, slow and moody', 'Bright summer pop, bouncy words', '90s VHS home video', 'Old church hymn sheet, candlelight', 'Synthwave sunset drive', 'Black metal, harsh and cold'];
function aiCfg() { return store.get('ai', { provider: 'anthropic', key: '', model: AI_MODELS.anthropic }); }
function updateAiBtn() { const c = aiCfg(); $('aiDot').classList.toggle('on', !!c.key); $('aiLabel').textContent = c.key ? `AI ready · ${c.provider === 'openai' ? 'OpenAI' : 'Claude'}` : 'Add AI key'; }
function openAI() {
  const c = aiCfg();
  $('aiProv').value = c.provider; $('aiKey').value = c.key || ''; $('aiModel').value = c.model || AI_MODELS[c.provider];
  $('aiModel').placeholder = c.provider === 'openai' ? 'Model name, e.g. from your OpenAI dashboard' : 'claude-sonnet-5-5';
  $('aiErr').hidden = true; $('aiDlg').showModal();
}
$('aiProv').addEventListener('change', e => { $('aiModel').value = AI_MODELS[e.target.value]; $('aiModel').placeholder = e.target.value === 'openai' ? 'Model name, e.g. from your OpenAI dashboard' : 'claude-sonnet-5-5'; });
IDEAS.forEach(i => { const b = document.createElement('button'); b.type = 'button'; b.textContent = i; b.onclick = () => $('aiPrompt').value = i; $('aiIdeas').append(b); });
$('aiBtn').addEventListener('click', openAI);
['aiClose', 'aiCancel'].forEach(id => $(id).addEventListener('click', () => $('aiDlg').close()));
$('aiForget').addEventListener('click', () => { const c = aiCfg(); c.key = ''; store.set('ai', c); $('aiKey').value = ''; updateAiBtn(); });

const SYS = `You design styles for a lyric video renderer. Reply with ONE JSON object and nothing else. Schema (all keys optional, unknown keys ignored):
{
 "name": string (2-3 evocative words),
 "bg": { "type": "solid"|"gradient"|"radial"|"blobs", "colors": [2-5 hex colors; for blobs the LAST color is the base], "angle": 0-360, "motion": 0-1 },
 "particles": { "type": "none"|"dots"|"bokeh"|"stars"|"rain"|"embers", "color": hex, "count": 0-150, "speed": 0-2 },
 "font": { "family": one of ${Object.keys(LV_FONTS).map(f => '"' + f + '"').join(', ')}, "weight": 100-900, "size": 0.05-0.12 (fraction of the short side), "italic": bool, "uppercase": bool, "tracking": -0.05-0.3 },
 "colors": { "text": hex, "highlight": hex, "shadow": "rgba(...)" },
 "layout": "center"|"lower"|"upper", "align": "center"|"left",
 "anim": "fade"|"slideUp"|"scale"|"wordPop"|"stamp"|"typewriter"|"karaoke"|"glitch",
 "glow": 0-1, "context": bool (show previous/next line faintly), "vignette": 0-1, "grain": 0-1, "letterbox": bool, "pulse": 0-1 (background flashes on the beat), "spectrum": bool (audio bars at the bottom)
}
Rules: keep text readable against the background (strong contrast). Fonts: Anton/Bebas Neue/Archivo Black/Unbounded are loud display faces; Playfair Display/Fraunces are serifs; Caveat is handwriting; Space Mono is typewriter; Outfit/Syne are clean sans. Match the requested mood.`;

async function callAI(cfg, user) {
  if (cfg.provider === 'openai') {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.key },
      body: JSON.stringify({ model: cfg.model, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: SYS }, { role: 'user', content: user }] })
    });
    const j = await r.json(); if (!r.ok) throw new Error(j.error && j.error.message || `OpenAI returned ${r.status}`);
    return j.choices[0].message.content;
  }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: cfg.model, max_tokens: 1200, system: SYS, messages: [{ role: 'user', content: user }] })
  });
  const j = await r.json(); if (!r.ok) throw new Error(j.error && j.error.message || `Anthropic returned ${r.status}`);
  return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
}
$('aiGo').addEventListener('click', async () => {
  const cfg = { provider: $('aiProv').value, key: $('aiKey').value.trim(), model: $('aiModel').value.trim() };
  const err = $('aiErr'); err.hidden = true;
  if (!cfg.key) { err.textContent = 'Paste an API key first.'; err.hidden = false; return; }
  if (!cfg.model) { err.textContent = 'Enter a model name.'; err.hidden = false; return; }
  const want = $('aiPrompt').value.trim();
  if (!want) { err.textContent = 'Describe the look you want.'; err.hidden = false; return; }
  store.set('ai', cfg); updateAiBtn();
  let user = `Style request: ${want}`;
  if ($('aiUseLyrics').checked && S.cues.length && !S.demo) user += `\n\nThe song's lyrics, for mood only:\n${S.cues.slice(0, 40).map(c => c.text).join('\n')}`;
  const go = $('aiGo'); go.disabled = true; go.innerHTML = '<span class="spin"></span> Creating…';
  try {
    const txt = await callAI(cfg, user);
    const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
    if (a < 0 || b < a) throw new Error('The AI did not return a style. Try again or reword the description.');
    const t = lvSanitize({ ...JSON.parse(txt.slice(a, b + 1)), id: 'ai-' + Date.now().toString(36), custom: true });
    S.custom.push(t); store.set('templates', S.custom);
    S.tplId = t.id; store.set('tpl', t.id); renderStyles();
    $('aiDlg').close();
  } catch (e) {
    err.textContent = /fetch/i.test(e.message) ? 'Could not reach the provider. Check your connection and key.' : e.message;
    err.hidden = false;
  } finally { go.disabled = false; go.textContent = 'Create style'; }
});

/* ---------------- background & brand ---------------- */
S.bg = null;                      // { type: 'image'|'video', el, url, name }
const bgVideo = document.createElement('video');
bgVideo.muted = true; bgVideo.loop = true; bgVideo.playsInline = true; bgVideo.preload = 'auto';
const logoImg = new Image();
const brandDefaults = { text: '', pos: 'bottom-right', size: 7, opacity: 85, color: '#ffffff', logo: '' };
S.brand = { ...brandDefaults, ...(store.get('brand', {}) || {}) };
let exporting = false;

function extras() {
  return {
    bg: S.bg ? { el: S.bg.el, dim: +$('bgDim').value / 100 } : null,
    brand: { img: S.brand.logo ? logoImg : null, text: S.brand.text, pos: S.brand.pos,
             size: S.brand.size / 100, opacity: S.brand.opacity / 100, color: S.brand.color },
    color: S.color
  };
}
function syncBgVideo(t, hard) {
  if (!S.bg || S.bg.type !== 'video' || !bgVideo.duration || exporting) return;
  const want = playing();
  if (want && bgVideo.paused) bgVideo.play().catch(() => {});
  if (!want && !bgVideo.paused) bgVideo.pause();
  if (hard || !want) {
    const target = t % bgVideo.duration;
    if (Math.abs(bgVideo.currentTime - target) > 0.25) bgVideo.currentTime = target;
  }
}
function setBgMode(type) {
  ['bgStyle', 'bgImg', 'bgVid'].forEach(id => $(id).setAttribute('aria-pressed', false));
  $(type === 'image' ? 'bgImg' : type === 'video' ? 'bgVid' : 'bgStyle').setAttribute('aria-pressed', true);
  $('bgDimRow').hidden = !type;
}
function clearBg() {
  if (S.bg) { if (S.bg.type === 'video') { bgVideo.pause(); bgVideo.removeAttribute('src'); bgVideo.load(); } URL.revokeObjectURL(S.bg.url); }
  S.bg = null; $('bgName').textContent = ''; setBgMode(null);
}
let bgWant = null;
$('bgStyle').addEventListener('click', clearBg);
$('bgImg').addEventListener('click', () => { bgWant = 'image'; $('bgFile').accept = 'image/*'; $('bgFile').value = ''; $('bgFile').click(); });
$('bgVid').addEventListener('click', () => { bgWant = 'video'; $('bgFile').accept = 'video/*'; $('bgFile').value = ''; $('bgFile').click(); });
$('bgFile').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const type = f.type.startsWith('video') ? 'video' : f.type.startsWith('image') ? 'image' : bgWant;
  const url = URL.createObjectURL(f);
  const done = el => { clearBg(); S.bg = { type, el, url, name: f.name }; $('bgName').textContent = f.name; setBgMode(type); syncBgVideo(now(), true); if (S.color.mode === 'style') setColorMode('auto'); };
  const fail = () => { URL.revokeObjectURL(url); $('bgName').textContent = `Could not open ${f.name}. Try JPG, PNG or WebP for images, MP4 or WebM for video.`; };
  if (type === 'video') {
    const prev = S.bg && S.bg.type === 'video' ? S.bg : null;
    if (prev) { URL.revokeObjectURL(prev.url); S.bg = null; }
    bgVideo.onloadeddata = () => done(bgVideo); bgVideo.onerror = fail;
    bgVideo.src = url; bgVideo.load();
  } else {
    const im = new Image(); im.onload = () => done(im); im.onerror = fail; im.src = url;
  }
});
$('bgDim').addEventListener('input', e => { $('bgDimOut').textContent = e.target.value + '%'; });

function saveBrand() {
  const ok = (() => { try { localStorage.setItem('lyricast.brand', JSON.stringify(S.brand)); return true; } catch { return false; } })();
  if (!ok && S.brand.logo) {
    try { localStorage.setItem('lyricast.brand', JSON.stringify({ ...S.brand, logo: '' })); } catch {}
    $('brandNote').textContent = 'This logo is too large to remember between visits. It still works for this session; a smaller PNG or SVG will be remembered.';
  }
}
function showBrand() {
  const b = S.brand;
  $('brandText').value = b.text; $('brandPos').value = b.pos; $('brandColor').value = b.color;
  $('brandSize').value = b.size; $('brandSizeOut').textContent = b.size + '%';
  $('brandOp').value = b.opacity; $('brandOpOut').textContent = b.opacity + '%';
  if (b.logo) { logoImg.src = b.logo; $('logoPrev').src = b.logo; }
  $('logoPrev').hidden = $('logoX').hidden = !b.logo;
  $('logoBtn').firstChild.textContent = b.logo ? 'Change logo' : 'Add logo';
}
$('logoIn').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { S.brand.logo = String(r.result); showBrand(); saveBrand(); };
  r.readAsDataURL(f); e.target.value = '';
});
$('logoX').addEventListener('click', () => { S.brand.logo = ''; logoImg.removeAttribute('src'); showBrand(); saveBrand(); });
$('brandText').addEventListener('input', e => { S.brand.text = e.target.value; saveBrand(); });
$('brandPos').addEventListener('change', e => { S.brand.pos = e.target.value; saveBrand(); });
$('brandColor').addEventListener('input', e => { S.brand.color = e.target.value; saveBrand(); });
$('brandSize').addEventListener('input', e => { S.brand.size = +e.target.value; $('brandSizeOut').textContent = e.target.value + '%'; saveBrand(); });
$('brandOp').addEventListener('input', e => { S.brand.opacity = +e.target.value; $('brandOpOut').textContent = e.target.value + '%'; saveBrand(); });
showBrand();

/* ---------------- lyrics colour ---------------- */
S.color = { mode: 'style', text: '#ffffff', highlight: '#ffd166', ...(store.get('color', {}) || {}) };
function setColorMode(m) {
  S.color.mode = m; store.set('color', S.color);
  [['colStyle', 'style'], ['colAuto', 'auto'], ['colCustom', 'custom']].forEach(([id, v]) => $(id).setAttribute('aria-pressed', v === m));
  $('colPick').hidden = m !== 'custom'; $('colNote').hidden = m !== 'auto';
}
$('colStyle').addEventListener('click', () => setColorMode('style'));
$('colAuto').addEventListener('click', () => setColorMode('auto'));
$('colCustom').addEventListener('click', () => setColorMode('custom'));
$('colText').value = S.color.text; $('colHl').value = S.color.highlight;
$('colText').addEventListener('input', e => { S.color.text = e.target.value; store.set('color', S.color); });
$('colHl').addEventListener('input', e => { S.color.highlight = e.target.value; store.set('color', S.color); });
setColorMode(S.color.mode);

/* ---------------- Suno import ---------------- */
$('sunoBtn').addEventListener('click', () => $('sunoDlg').showModal());
['sunoClose', 'sunoCancel'].forEach(id => $(id).addEventListener('click', () => $('sunoDlg').close()));
// The Tampermonkey helper posts songs to the engine; this picks them up.
async function importSong(m) {
  if (!m || !Array.isArray(m.cues) || !m.audio) return;
  if (exporting) { S.queued = m; return; }                    // never swap the song in the middle of a render
  S.importing = true;
  const blob = await (await api('audio/' + m.audio, { raw: true })).blob();
  const cues = m.cues
    .filter(c => c && typeof c.text === 'string' && isFinite(c.start) && isFinite(c.end))
    .map(c => ({ start: +c.start, end: +c.end, text: c.text.slice(0, 300),
                 words: Array.isArray(c.words) ? c.words.filter(w => w && typeof w.text === 'string' && isFinite(w.start) && isFinite(w.end)).map(w => ({ text: w.text.slice(0, 60), start: +w.start, end: +w.end })) : null }));
  const title = String(m.title || 'Suno song').replace(/[\\/:*?"<>|]+/g, '').slice(0, 120);
  audio.pause();
  if ($('sunoDlg').open) $('sunoDlg').close();
  loadAudio(new File([blob], `${title}.mp3`, { type: 'audio/mpeg' }), () => {
    S.cues = []; S.plainText = null;
    setMode('srt', false);
    rememberWords(cues);
    $('lyrics').value = toSRT(cues);
    lyricsChanged();
    $('syncNote').className = 'note';
    $('syncNote').textContent = `Imported from Suno with Suno's own word timing (${cues.length} lines). Use Refine timing to tighten it to the vocals.`;
  }, m.audio);
}
async function pollImports() {
  try {
    if (S.queued && !exporting) { const q = S.queued; S.queued = null; await importSong(q); }
    const items = await api('imports');
    for (const m of items) await importSong(m);
  } catch {}
  setTimeout(pollImports, 1500);
}
async function pollStatus() {
  try {
    ENGINE = await api('status');
    const t = ENGINE.torch;
    if (t) {
      $('engineDot').className = 'dot ' + (t.gpu ? 'on' : t.torch ? '' : 'warn');
      $('engineLabel').textContent = t.gpu ? 'GPU · ' + t.gpu.replace(/^NVIDIA\s+/i, '').replace(/GeForce\s+/i, '') : t.torch ? 'CPU' : 'Engine not installed';
      $('engineChip').title = engineText();
      if ($('autoDlg').open) $('autoDev').textContent = engineText();
      return;
    }
  } catch {
    $('engineDot').className = 'dot warn'; $('engineLabel').textContent = 'Engine offline';
  }
  setTimeout(pollStatus, 1500);
}

/* ---------------- demo song ---------------- */
function loadDemoLyrics() {
  S.cues = []; S.plainText = null;
  setMode('srt', false); $('lyrics').value = DEMO_SRT; lyricsChanged();
  const last = S.cues[S.cues.length - 1];
  S.demoDur = last ? last.end + 1.5 : 30;
}
// The demo is a real song. If it can't be fetched (page opened as a file, file missing),
// the preview plays silently on the same timing instead.
async function loadDemoSong() {
  try {
    const r = await fetch(DEMO_AUDIO);
    if (!r.ok) throw new Error(r.status);
    const blob = await r.blob();
    if (!S.demo || S.importing) return;           // the user already added a song, or one is being imported
    loadAudio(new File([blob], DEMO_NAME, { type: blob.type || 'audio/mpeg' }), () => seek(S.cues[0] ? S.cues[0].start + 0.6 : 0));
  } catch {
    S.demoT = S.cues[0] ? S.cues[0].start + 0.6 : 0; S.demoPlaying = true; setPlayIcon(true);
  }
}

/* ---------------- boot ---------------- */
loadDemoLyrics();
S.demoT = S.cues[0] ? S.cues[0].start + 0.6 : 0;
sizeView(); updateAiBtn(); renderStyles(); setPlayIcon(false);
loadDemoSong();
document.documentElement.dataset.lyricast = 'ready';
requestAnimationFrame(frame);
pollStatus(); pollImports();
if (document.fonts) {
  Promise.all(Object.keys(LV_FONTS).flatMap(f => [document.fonts.load(`700 40px "${f}"`), document.fonts.load(`italic 500 40px "${f}"`), document.fonts.load(`400 40px "${f}"`)]))
    .catch(() => {}).then(() => renderStyles());
  document.fonts.ready.then(() => renderStyles());
}
})();
