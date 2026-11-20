// ==UserScript==
// @name         Lyricast for Suno
// @namespace    lyricast
// @version      3.0
// @description  Send a Suno song (MP3 + Suno's word-timed lyrics) straight into the Lyricast desktop app.
// @match        https://suno.com/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      amazonaws.com
// @connect      127.0.0.1
// @connect      localhost
// @homepageURL  https://github.com/MightyX3N/Lyricast
// @downloadURL  http://127.0.0.1:47321/lyricast-suno.user.js
// @updateURL    http://127.0.0.1:47321/lyricast-suno.user.js
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const VERSION = '3.0';
  const PORTS = [47321, 47322, 47323, 47324, 47325, 47326, 47327, 47328, 47329, 47330];
  const API = 'https://studio-api.prod.suno.com';
  const PANEL_ID = 'lyricast-suno-v30';
  const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const C = { deck: '#191b21', well: '#22252d', line: '#2e323c', text: '#ece9e2', dim: '#9a9ca6', tape: '#f2c14e', reel: '#7dd3c7', warn: '#ff7a6b' };
  const LOGO = `<svg width="22" height="22" viewBox="0 0 28 28" aria-hidden="true"><rect x="1" y="5" width="26" height="18" rx="4" fill="none" stroke="${C.tape}" stroke-width="2"/><circle cx="9" cy="14" r="3.2" fill="${C.tape}"/><circle cx="19" cy="14" r="3.2" fill="${C.tape}"/><path d="M9 14h10" stroke="${C.tape}" stroke-width="2"/></svg>`;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const log = (...a) => console.log('[Lyricast]', ...a);

  /* ---------------- shared panel look ---------------- */
  function css() {
    if (document.getElementById(PANEL_ID + '-css')) return;
    const st = document.createElement('style'); st.id = PANEL_ID + '-css';
    st.textContent = `
#${PANEL_ID}{position:fixed;right:16px;bottom:96px;z-index:2147483000;width:256px;background:${C.deck};color:${C.text};border:1px solid ${C.line};border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:10px;font:13px/1.45 "Instrument Sans","Helvetica Neue",Arial,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.55);pointer-events:auto}
#${PANEL_ID} *{box-sizing:border-box}
#${PANEL_ID} .lc-top{display:flex;align-items:center;gap:8px;font:800 16px/1 "Bricolage Grotesque","Helvetica Neue",Arial,sans-serif;letter-spacing:-.02em}
#${PANEL_ID} .lc-v{font:500 10px ui-monospace,Menlo,monospace;color:${C.dim};letter-spacing:0}
#${PANEL_ID} .lc-x{margin-left:auto;background:none;border:0;color:${C.dim};font-size:16px;cursor:pointer;padding:2px 4px;line-height:1}
#${PANEL_ID} .lc-x:hover{color:${C.text}}
#${PANEL_ID} .lc-go{border:0;border-radius:999px;background:${C.tape};color:#1b1606;font:600 13px "Instrument Sans","Helvetica Neue",Arial,sans-serif;padding:9px 14px;cursor:pointer}
#${PANEL_ID} .lc-go:hover{background:#ffd36a}
#${PANEL_ID} .lc-go:disabled{opacity:.5;cursor:default}
#${PANEL_ID} button:focus-visible{outline:2px solid ${C.tape};outline-offset:2px}
#${PANEL_ID} .lc-bar{height:4px;background:${C.well};border-radius:2px;overflow:hidden}
#${PANEL_ID} .lc-bar i{display:block;height:100%;width:0;background:${C.tape};transition:width .2s}
#${PANEL_ID} .lc-st{font-size:12px;color:${C.dim};min-height:1.45em;overflow-wrap:anywhere}
#${PANEL_ID} .lc-st.ok{color:${C.reel}} #${PANEL_ID} .lc-st.err{color:${C.warn}}`;
    document.head.appendChild(st);
  }

  /* ================= Suno side ================= */
  const songId = () => (location.pathname.match(/^\/song\/([0-9a-f-]{36})/i) || [])[1] || null;
  function cookie(name) { const p = `; ${document.cookie}`.split(`; ${name}=`); return p.length > 1 ? p[p.length - 1].split(';')[0] : null; }
  async function token() {
    try { if (W.Clerk && W.Clerk.session && W.Clerk.session.getToken) { const t = await W.Clerk.session.getToken(); if (t) return t; } } catch (_) {}
    const c = cookie('__session');
    if (c) return c;
    throw new Error('Log in to Suno first.');
  }
  async function api(path, body) {
    const headers = { Authorization: `Bearer ${await token()}` };
    if (body) {
      // the same extra headers Suno's own page sends with this request
      headers['Content-Type'] = 'application/json';
      headers['browser-token'] = JSON.stringify({ token: btoa(JSON.stringify({ timestamp: Date.now() })) });
      const dev = cookie('suno_device_id') || cookie('ajs_anonymous_id');
      if (dev) headers['device-id'] = decodeURIComponent(dev).replace(/^"|"$/g, '');
    }
    const r = await fetch(API + path, body ? { method: 'POST', headers, body: JSON.stringify(body), credentials: 'include' } : { headers });
    if (r.status === 429) return { ok: false, reason: 'rate_limited', message: 'Too many requests' };
    if (!r.ok) throw new Error(`Suno answered ${r.status} for ${path.split('?')[0]}`);
    const text = await r.text();
    try { return text ? JSON.parse(text) : {}; } catch (_) { return { raw: text }; }
  }
  function title() {
    const og = document.querySelector('meta[property="og:title"]');
    return ((og && og.content) || document.title || 'Suno song').replace(/\s*\|\s*Suno.*$/i, '').replace(/[\\/:*?"<>|]+/g, '').trim() || 'Suno song';
  }

  // Suno's word timings -> lyric lines that keep every word's own time.
  // Lines follow Suno's own line breaks ("\n" on a word) and section tags like [Verse]; nothing is guessed from pauses.
  function lines(words) {
    const out = []; let cur = null;
    const flush = () => { if (cur && cur.words.length) { cur.text = cur.words.map(w => w.text).join(' ').replace(/\s+([,.!?;:…])/g, '$1'); out.push(cur); } cur = null; };
    for (const w of words) {
      const raw = w.word || '';
      const text = raw.replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
      if (/^\s*\n/.test(raw) || /\[[^\]]*\]/.test(raw)) flush();
      if (text) {
        if (cur && cur.words.length >= 24) flush();
        if (!cur) cur = { words: [] };
        cur.words.push({ text, start: +(+w.start_s).toFixed(3), end: +(+w.end_s).toFixed(3) });
      }
      if (/\n\s*$/.test(raw)) flush();
    }
    flush();
    return out.map((l, i) => {
      const next = out[i + 1], first = l.words[0], last = l.words[l.words.length - 1];
      const end = last.end + 0.4;
      return { start: first.start, end: +(next ? Math.min(end, next.words[0].start - 0.05) : end).toFixed(2), text: l.text, words: l.words };
    });
  }
  async function lyrics(id) {
    const d = await api(`/api/gen/${id}/aligned_lyrics/v2/`);
    if (!Array.isArray(d && d.aligned_words) || !d.aligned_words.length) throw new Error('This song has no synced lyrics yet (instrumental, or Suno is still processing it).');
    return lines(d.aligned_words);
  }

  // Suno's own Download → MP3: ask for the file, wait while Suno prepares it, then fetch the link it gives.
  function findUrl(o) {
    if (typeof o === 'string') return /^https:\/\/\S+\.mp3(\?|$)/i.test(o) || /^https:\/\/[^/]*amazonaws\.com\//i.test(o) ? o : null;
    if (o && typeof o === 'object') for (const v of Object.values(o)) { const u = findUrl(v); if (u) return u; }
    return null;
  }
  async function mp3(id, ui) {
    let url = null, authorized = false, backoff = 5000;
    for (let i = 0, t0 = Date.now(); !url; i++) {
      const d = await api(`/api/download/clip/${id}?format=mp3`);
      url = findUrl(d);
      if (url) break;
      if (d && d.ok === false) {
        // the first download of a song has to be authorized, exactly like Suno's own Download button does
        if (d.reason === 'not_authorized' && !authorized) {
          ui('Authorizing the download with Suno…', 0.2);
          const a = await api('/api/download/authorize', { item_id: id, item_type: 'clip' });
          log('authorize answered', a);
          authorized = true;
          continue;
        }
        // "too many downloads at once": Suno wants a pause, not a refusal
        if (/rate|too.?many|limit|beat|slow/i.test(`${d.reason} ${d.message}`)) {
          if (Date.now() - t0 > 150000) throw new Error('Suno kept asking to slow down. Wait a few minutes and try again.');
          for (let left = Math.round(backoff / 1000); left > 0; left--) { ui(`Suno asked to slow down, retrying in ${left} s…`, 0.2); await sleep(1000); }
          backoff = Math.min(backoff * 2, 30000);
          continue;
        }
        throw new Error(`Suno refused the download: ${d.message || d.reason || 'no reason given'}`);
      }
      if (Date.now() - t0 > 150000) throw new Error('Suno did not finish preparing the MP3. Try again in a minute.');
      ui('Suno is preparing the MP3…', 0.2 + Math.min(0.3, i * 0.03));
      log('download not ready yet', d);
      await sleep(2500);
    }
    log('download link', url.split('?')[0]);
    const r = await new Promise((resolve, reject) => GM_xmlhttpRequest({
      method: 'GET', url, responseType: 'arraybuffer', timeout: 180000,
      onprogress: e => e.total && ui('Downloading the MP3…', 0.5 + 0.45 * e.loaded / e.total),
      onload: resolve, onerror: () => reject(new Error('The MP3 download failed.')), ontimeout: () => reject(new Error('The MP3 download timed out.'))
    }));
    if (r.status !== 200) throw new Error(`The MP3 download answered ${r.status}.`);
    const buf = r.response;
    const u8 = buf instanceof ArrayBuffer ? new Uint8Array(buf) : ArrayBuffer.isView(buf) ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) : new Uint8Array(buf);
    const isMp3 = (u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) || (u8[0] === 0xff && (u8[1] & 0xe0) === 0xe0);
    if (!isMp3) throw new Error('What Suno sent is not an MP3 file.');
    return u8;
  }
  function b64(u8) {
    let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }

  // The desktop app listens on 127.0.0.1 (port 47321, or the next free one).
  function local(method, port, path, body) {
    return new Promise((resolve, reject) => GM_xmlhttpRequest({
      method, url: `http://127.0.0.1:${port}${path}`, timeout: body ? 120000 : 1500,
      headers: { 'X-Lyricast': '1', 'Content-Type': 'application/json' }, data: body,
      onload: r => r.status === 200 ? resolve(JSON.parse(r.responseText || '{}')) : reject(new Error(`Lyricast answered ${r.status}: ${r.responseText.slice(0, 200)}`)),
      onerror: () => reject(new Error('unreachable')), ontimeout: () => reject(new Error('timeout'))
    }));
  }
  async function findApp() {
    for (const p of PORTS) {
      try { const r = await local('GET', p, '/api/ping'); if (r.app === 'lyricast') return p; } catch (_) {}
    }
    throw new Error('Lyricast is not running. Start the Lyricast app, then press Send again.');
  }
  async function send(id, ui) {
    ui('Looking for the Lyricast app…', 0.02);
    const port = await findApp();
    ui('Fetching the timed lyrics…', 0.05);
    const cues = await lyrics(id);
    ui('Asking Suno for the MP3…', 0.15);
    const audio = await mp3(id, ui);
    ui('Sending to Lyricast…', 0.97);
    await local('POST', port, '/api/suno', JSON.stringify({ id, title: title(), cues, audio: b64(audio) }));
    log('sent', cues.length, 'lines and', Math.round(audio.length / 1024), 'KB of MP3');
    ui(`Sent “${title()}” to Lyricast.`, 1, true);
  }

  function panel(id) {
    const old = document.getElementById(PANEL_ID); if (old) old.remove();
    css();
    const p = document.createElement('div'); p.id = PANEL_ID; p.dataset.song = id;
    p.innerHTML = `<div class="lc-top">${LOGO} Lyricast <span class="lc-v">v${VERSION}</span><button class="lc-x" type="button" aria-label="Hide">&#x2715;</button></div>
      <button class="lc-go" type="button">Send to Lyricast</button>
      <div class="lc-bar" hidden><i></i></div>
      <div class="lc-st">Sends the MP3 and Suno's timed lyrics to the Lyricast app.</div>`;
    const go = p.querySelector('.lc-go'), bar = p.querySelector('.lc-bar'), st = p.querySelector('.lc-st');
    const ui = (msg, pct, ok) => { st.textContent = msg; st.className = 'lc-st' + (ok ? ' ok' : ''); bar.hidden = pct == null || ok; if (pct != null) bar.firstElementChild.style.width = Math.round(pct * 100) + '%'; };
    p.querySelector('.lc-x').onclick = () => p.remove();
    go.onclick = async () => {
      go.disabled = true;
      try { await send(id, ui); }
      catch (e) { console.warn('[Lyricast]', e); st.textContent = e.message; st.className = 'lc-st err'; bar.hidden = true; }
      finally { go.disabled = false; }
    };
    document.body.appendChild(p);
  }
  function sunoSide() {
    let last = null;
    setInterval(() => {
      if (location.pathname === last) return;
      last = location.pathname;
      const id = songId();
      if (id) panel(id); else { const p = document.getElementById(PANEL_ID); if (p) p.remove(); }
    }, 700);
  }

  sunoSide();
})();
