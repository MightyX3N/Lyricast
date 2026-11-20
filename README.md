# Lyricast

Free lyric video maker for your desktop (Windows and Linux). Add a song and its lyrics, let Lyricast find where every word is sung, pick a style, and export an MP4.

Everything runs on your own computer. Songs, lyrics and videos never leave it.

## What the app does better than the website

- **Timing from the isolated vocals.** Demucs splits the voice from the music first, so drums and synths can't be mistaken for singing.
- **Every word, not just every line.** Meta's MMS forced aligner finds each letter in the vocal track. The loudness of the vocal then decides how long each word is held, so a stretched word stays lit for as long as it is sung.
- **Ad-libs and intros are skipped.** Anything that is not in your lyrics (intros, instrumental breaks, "yeah", backing vocals) is absorbed instead of pulling lines out of place. Put ad-libs in `(parentheses)` to show them without forcing them onto the lead vocal.
- **Refine timing** keeps each line near its current time (from an SRT, a Suno import or Tap to sync) and tightens it word by word. The search range is adjustable.
- **Fast export.** Frames are rendered offline, not in real time. They are encoded with ffmpeg on the GPU when possible (NVENC, AMF or Quick Sync), with libx264 as the fallback. The MP4 goes to `Videos/Lyricast`.
- **Suno import** goes straight into the app through the Tampermonkey helper. No tabs open.

## Install

You need **Python 3.10–3.13** ([python.org](https://www.python.org/downloads/); on Windows tick *Add python.exe to PATH*).

**Windows:** double-click `install.bat`, then `run.bat` (or the *Lyricast* desktop shortcut).

**Linux:** `./install.sh`, then `./run.sh` (or *Lyricast* in your app menu).

The installer picks the right PyTorch build:

- With an NVIDIA card, it installs the CUDA build. CUDA 12.8 or newer is needed for RTX 50-series cards, and the installer tries that first.
- Without one, it installs the CPU build.

The first **Auto-time** downloads the models, about 1.5 GB in total. They are cached, so after that Lyricast works offline.

On Windows the app opens in its own window (WebView2). On Linux it opens as an app window in Chrome, Chromium or Edge if one is installed, otherwise in your default browser.

## Use

1. Add the song (MP3, WAV, OGG, M4A, FLAC…).
2. Paste the lyrics, one line per line. Section labels like `[Chorus]` are skipped. An SRT works too, including Suno's word-level export.
3. **Auto-time from song.** The chip in the top bar shows whether timing runs on your GPU or your CPU. Lines the aligner was unsure about turn yellow; click a line to jump there.
4. Pick a style, a background and your brand, then **Render video**.

## Suno

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. With Lyricast running, open `http://127.0.0.1:47321/lyricast-suno.user.js` (or use *Import from Suno → Install the helper* in the app).
3. On a Suno song page, press **Send to Lyricast**. The song and Suno's word timing arrive in the app.
4. Run **Refine timing** to tighten the timing to the vocals.

## Troubleshooting

- **Log file:** `%LOCALAPPDATA%\Lyricast\lyricast.log` on Windows, `~/.local/share/lyricast/lyricast.log` on Linux. Every timing run logs the device it used and how long each step took.
- **"Your GPU is newer than this PyTorch build":** run the installer again. To force the CPU instead, set `LYRICAST_CPU=1`.
- **Freeing space:** the cache of separated vocals lives in the `songs` folder next to the log. It is safe to delete.
- **Port:** Lyricast listens on `127.0.0.1:47321`, or the next free port. Only this computer can reach it.

## Development

```
python -m lyricast --browser     # open in your normal browser
python -m lyricast --server      # server only
python tests/test_align.py       # aligner tests on synthetic data
```

Layout:

| Path | What it holds |
|---|---|
| `ui/` | The editor: `renderer.js` draws frames for both the preview and the export, `app.js` holds the editor logic. |
| `lyricast/server.py` | The local API. |
| `lyricast/pipeline.py` | Jobs, caching and export. |
| `lyricast/engine/` | Separation, emissions, alignment and audio features. |
| `userscript/` | The Suno helper. |

## Licences

- Demucs: MIT.
- MMS forced-alignment model weights (`MahmoudAshraf/mms-300m-1130-forced-aligner`): **CC BY-NC 4.0**, which means non-commercial use only. Set `LYRICAST_ALIGNER` to use another wav2vec2 CTC model with the same letter vocabulary.
- Fonts: SIL Open Font License, via Fontsource.
