# 🎵 Musik Konsole

> A minimal, local-first desktop music player built with Electron — pick a folder, browse your tracks, and play them through a warm "hi-fi console" interface.

[![Electron](https://img.shields.io/badge/Electron-34.3.0-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/tests-node%3Atest-blue)](#testing)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](#)
[![License](https://img.shields.io/badge/license-MIT-yellow)](./LICENSE)
[![Status](https://img.shields.io/badge/status-in%20development-orange)](#roadmap)

---

## Overview

**Musik Konsole** is a lightweight Electron desktop app for playing the audio files in a folder you choose. The renderer never touches the file system directly: a small local HTTP server in the main process exposes the library and streams audio (with range support for seeking), keeping `contextIsolation` on and `nodeIntegration` off.

## Features

- 📂 **Folder picker** — choose any folder containing audio files.
- ▶️ **Playback** — play, pause, stop, next, previous.
- 🎚️ **Seek & volume** — draggable progress meter and volume control.
- ⏱️ **Time readout** — current position and total duration (`m:ss`).
- ⌨️ **Keyboard control** — transport without the mouse (see below).
- 📜 **Track list** — numbered list of the folder's tracks with the active one highlighted.
- 💾 **Remembers your folder** — the last folder is restored on the next launch.
- 🟠 **Hi-fi console UI** — warm amber-on-dark theme with an animated equalizer while playing.

### Supported formats

| | Formats |
|---|---|
| **Audio** | MP3 · WAV · FLAC · OGG / OGA / Opus · M4A · AAC · WebA |

The `Content-Type` is derived from the file extension; unsupported files are filtered out of the list.

## Tech stack

| Layer | Technology |
|---|---|
| Shell | [Electron](https://www.electronjs.org/) 34 + [Electron Forge](https://www.electronforge.io/) |
| Backend (main process) | Node.js `http` server — `/api/songs`, `/api/audio/:file` |
| Frontend (renderer) | Vanilla JavaScript, HTML, CSS (no framework, no bundler) |
| Tests | Built-in `node:test` runner |

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18 and npm

### Install & run

```bash
git clone https://github.com/PappenHeim10/Musikplayer
cd Musikplayer
npm install
npm start
```

### Build distributables

```bash
npm run package   # package the app
npm run make      # build installers for the current platform
```

## Usage

1. Click **Ordner wählen** (Choose folder) and select a folder with audio files.
2. The tracks appear in the list — click one to play it.
3. Use the transport bar or the keyboard shortcuts to control playback.

### Keyboard shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `→` | Next track |
| `←` | Previous track |
| `↑` / `↓` | Volume up / down |

> Shortcuts are ignored while a slider is focused, so its native arrow-key behaviour is preserved.

## Architecture

The app is split across three processes/layers:

1. **Main process** (`src/index.js`, `src/server.js`) — creates the window and starts a local HTTP server bound to `127.0.0.1`. It prefers port `3001` and falls back to a free OS-assigned port if that is taken. The selected folder is persisted to `settings.json` in the app's user-data directory.
2. **Preload** (`src/preload.js`) — exposes a minimal, safe `window.electronAPI` over `contextBridge` (folder dialog, API port, folder-selected event).
3. **Renderer** (`src/utils.js`, `src/ui.js`, `src/player.js`, `src/main.js`) — fetches the song list and audio from the local server and drives the UI. Organised under a `window.MP` namespace (classic scripts, since ES-module imports are blocked under `file://`).

**Security:** path-traversal protection on the audio endpoint, CORS restricted to the app's own origin, and DevTools only opened in development.

## Project structure

```
.
├── src/
│   ├── index.js        # main process: window, IPC, server bootstrap, folder persistence
│   ├── server.js       # local HTTP server: endpoints, format/path/range logic
│   ├── preload.js      # contextBridge → window.electronAPI
│   ├── index.html      # markup
│   ├── styles.css      # "hi-fi console" theme
│   ├── utils.js        # pure helpers
│   ├── ui.js           # view layer (DOM refs + rendering)
│   ├── player.js       # audio engine factory
│   └── main.js         # renderer bootstrap & wiring
├── test/
│   └── server.test.js  # unit & integration tests
├── forge.config.js
└── package.json
```

## Testing

Unit and integration tests run on the built-in Node test runner — no extra dependencies:

```bash
npm test
```

## Roadmap

- [ ] Metadata (artist / album / cover from ID3 tags) — [#12](https://github.com/PappenHeim10/Musikplayer/issues/12)
- [ ] Playlist management — [#13](https://github.com/PappenHeim10/Musikplayer/issues/13)
- [ ] Search / filter — [#14](https://github.com/PappenHeim10/Musikplayer/issues/14)
- [ ] Shuffle & repeat — [#15](https://github.com/PappenHeim10/Musikplayer/issues/15)
- [ ] Recursive folder scanning — [#16](https://github.com/PappenHeim10/Musikplayer/issues/16)
- [ ] ESLint setup — [#18](https://github.com/PappenHeim10/Musikplayer/issues/18)

See the [open issues](https://github.com/PappenHeim10/Musikplayer/issues) for details.

## Contributing

Contributions are welcome. If you find a bug or have an idea, please open an issue or a pull request.

## License

Released under the [MIT License](./LICENSE).

## Contact

Questions or suggestions? Reach out at **lastxhunterx.css@gmail.com**.
