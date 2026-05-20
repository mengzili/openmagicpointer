# OpenMagicPointer

[![CI](https://github.com/mengzili/openmagicpointer/actions/workflows/ci.yml/badge.svg)](https://github.com/mengzili/openmagicpointer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/mengzili/openmagicpointer?include_prereleases&sort=semver)](https://github.com/mengzili/openmagicpointer/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2B-0078D6)](https://github.com/mengzili/openmagicpointer/releases)

An open-source, proactive on-screen assistant for Windows — a transparent alternative to closed-source helpers like Google Gemini's Magic Pointer. OpenMagicPointer quietly watches what's on your screen and, only when it would clearly help, drops a one-sentence hint next to your cursor.

It uses **your own** VLM backend — Anthropic Claude, OpenAI, Azure OpenAI, OpenRouter, Groq, Google Gemini (via its OpenAI-compatible endpoint), or anything running locally (Ollama, LM Studio, llama.cpp, vLLM). Nothing is sent anywhere else.

> Status: early preview (v0.1.0). Works end-to-end on Windows 10/11. APIs and config schema may still change.

---

## Why this exists

Modern OSes are growing AI overlays that watch your screen and offer help. The good ones are unobtrusive; the bad ones are intrusive, opaque about what they send, and tightly coupled to one vendor.

OpenMagicPointer is the small, auditable version:

- **Local-first by default.** Screen captures stay on your machine until *you* (or the idle heuristic) trigger an analysis call. There is no telemetry, no analytics, no third-party endpoints other than the Anthropic API you authenticate with.
- **Conservative.** Defaults to silence. A hint only appears when the model is reasonably confident it would help — false positives are explicitly worse than false negatives in the system prompt.
- **Yours to read.** Every prompt, throttle decision, and capture path is in this repository. No hidden behaviors.

## Features

- 🟦 **Tiny floating bubble** that appears near your cursor with a single short sentence — then fades away.
- ⏱️ **Idle-based polling.** Only considers asking when you've stopped moving the mouse and typing for a few seconds.
- ⌨️ **Hotkeys.** `F8` to ask now, `F9` to pause/resume, `Ctrl+Shift+F12` to quit.
- 📌 **System tray.** Click to ask, right-click for pause/resume/quit.
- 🔁 **Change-aware throttling.** Skips API calls when the screen hasn't meaningfully changed (perceptual fingerprint of a 32×32 downsample).
- 🖼️ **Multi-monitor aware.** The bubble appears on the monitor your cursor is on and flips sides when it would overflow.
- 🔌 **BYO backend.** Anthropic Claude or any OpenAI-compatible endpoint (OpenAI, Azure, OpenRouter, Gemini OpenAI-compat, Ollama, LM Studio, llama.cpp, vLLM, …).

## Screenshot

> A small hint bubble appears next to your cursor when — and only when — the model thinks it would help.

*(Screenshot coming in a future release. For now, see the [overlay CSS](src/overlay/overlay.css) for the visual design.)*

## Install

### Option A — download a prebuilt release (recommended)

Grab the latest installer or portable build from the [Releases page](https://github.com/mengzili/openmagicpointer/releases/latest):

| Artifact                                             | When to pick it                              |
| ---------------------------------------------------- | -------------------------------------------- |
| `OpenMagicPointer-Setup-<version>-x64.exe`           | Most Windows 10/11 PCs (Intel/AMD 64-bit).   |
| `OpenMagicPointer-Setup-<version>-arm64.exe`         | Windows on ARM (Surface Pro X, Copilot+ PCs).|
| `OpenMagicPointer-<version>-x64-portable.exe`        | No-install, run-from-anywhere x64 build.     |
| `OpenMagicPointer-<version>-arm64-portable.exe`      | No-install ARM64 build.                      |

Checksums are in `SHA256SUMS.txt` on the release.

### Option B — build from source

Requirements: **Node.js ≥ 20**, **npm ≥ 10**, Windows 10/11. (macOS/Linux can build and run dev mode for hacking, but the input-capture path is Windows-tested.)

```bash
git clone https://github.com/mengzili/openmagicpointer.git
cd openmagicpointer
npm install
npm run build
npm start            # run from source
npm run dist         # produce installers + portables in release/
```

## Configure

OpenMagicPointer talks to one of two kinds of backend:

- `provider: "anthropic"` — uses the [Anthropic SDK](https://docs.anthropic.com/) directly. Best output quality on Claude models.
- `provider: "openai"` — talks to any **OpenAI-compatible** Chat Completions endpoint. That includes OpenAI itself, Azure OpenAI, [OpenRouter](https://openrouter.ai/), Groq, Together, Google Gemini's [OpenAI-compat endpoint](https://ai.google.dev/gemini-api/docs/openai), and most local servers — [Ollama](https://ollama.com/) (`/v1`), [LM Studio](https://lmstudio.ai/), `llama.cpp` server, vLLM, etc.

Set the config in either of two ways:

1. **Environment variable** — `ANTHROPIC_API_KEY` (for the Anthropic provider) or `OPENAI_API_KEY` (for the OpenAI-compatible provider). Recommended.
2. **Config file** — `%APPDATA%\OpenMagicPointer\config.json`. Examples below.

### Example: Anthropic Claude (default)

```json
{
  "provider": "anthropic",
  "model": "claude-opus-4-7",
  "apiKey": "sk-ant-…"
}
```

### Example: OpenAI GPT-4o

```json
{
  "provider": "openai",
  "baseURL": "https://api.openai.com/v1",
  "model": "gpt-4o-mini",
  "apiKey": "sk-…"
}
```

### Example: local Ollama with a vision model

```json
{
  "provider": "openai",
  "baseURL": "http://localhost:11434/v1",
  "model": "llava",
  "apiKey": ""
}
```

(Local URLs — `localhost`, `127.0.0.1`, `*.local` — skip the API-key check.)

### Example: OpenRouter (any vision model on any provider)

```json
{
  "provider": "openai",
  "baseURL": "https://openrouter.ai/api/v1",
  "model": "google/gemini-2.5-flash",
  "apiKey": "sk-or-…"
}
```

### Full config schema

| Key                  | Default                                         | Meaning                                                                    |
| -------------------- | ----------------------------------------------- | -------------------------------------------------------------------------- |
| `provider`           | `"anthropic"`                                   | `"anthropic"` or `"openai"` (any OpenAI-compatible endpoint).              |
| `apiKey`             | env var (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY`) | API key. Never written back to disk by the app.                            |
| `baseURL`            | provider default                                | Custom endpoint URL. Required when targeting a non-OpenAI OpenAI-compat server. |
| `model`              | `claude-opus-4-7`                               | Vision-capable model ID for the chosen provider.                           |
| `pollIntervalMs`     | `4000`                                          | How often to check whether a query is warranted.                           |
| `idleThresholdMs`    | `6000`                                          | Idle time before considering the user "stuck enough" to analyse.           |
| `minQueryIntervalMs` | `20000`                                         | Hard floor on time between API calls. Hotkey ignores this.                 |
| `hintDurationMs`     | `12000`                                         | How long a hint stays on screen.                                           |
| `maxImageDim`        | `1280`                                          | Long-edge cap for screen captures sent to the VLM.                         |
| `hotkeyAsk`          | `F8`                                            | Force an immediate analysis.                                               |
| `hotkeyPause`        | `F9`                                            | Toggle pause/resume.                                                       |
| `hotkeyQuit`         | `Ctrl+Shift+F12`                                | Quit the app.                                                              |

Hotkey strings are [Electron accelerators](https://www.electronjs.org/docs/latest/api/accelerator).

## Usage

After install, OpenMagicPointer lives in the **system tray** (blue dot = active, grey = paused).

- **Left-click the tray icon** — ask for a hint now.
- **Right-click the tray icon** — pause/resume, ask now, quit, version.
- **`F8`** — same as "ask now" (works globally, anywhere).
- **`F9`** — pause/resume.
- **`Ctrl+Shift+F12`** — quit.

When the app decides a hint would help, a small bubble fades in next to your cursor for ~12 seconds and then fades out. It never steals focus and mouse clicks pass straight through it.

## How it works

```
                ┌──────────────────────────────────────────────┐
                │  Main process (Electron)                     │
                │                                              │
   ┌─────────┐  │  ┌──────────────┐    ┌────────────────┐      │
   │ uiohook ├──┼─►│ ActivityTracker├──►│  Throttle      │      │
   │ (input) │  │  └──────────────┘    │  (pure fn)     │      │
   └─────────┘  │                       └────────┬───────┘      │
                │  ┌────────────────┐            │              │
                │  │ desktopCapturer├──┐         ▼              │
                │  └────────────────┘  │  ┌────────────────┐    │
                │  ┌────────────────┐  ├─►│   Controller   ├──┐ │
                │  │   fingerprint  │◄─┘  └────────┬───────┘  │ │
                │  └────────────────┘            │             │ │
                │                                ▼             │ │
                │                       ┌────────────────┐     │ │
                │                       │   Analyzer     ├──── ┼─┼─► api.anthropic.com
                │                       │  (Claude API)  │     │ │
                │                       └────────┬───────┘     │ │
                │                                ▼             │ │
                │                       ┌────────────────┐     │ │
                │                       │ OverlayWindow  │◄────┘ │
                │                       └────────────────┘       │
                └──────────────────────────────────────────────┘
                                              │
                                              ▼
                          ┌───────────────────────────────┐
                          │  Renderer: bubble (HTML+CSS)  │
                          └───────────────────────────────┘
```

- [`src/main/capture.ts`](src/main/capture.ts) — input tracking + downscaled screen captures via Electron's `desktopCapturer`.
- [`src/main/fingerprint.ts`](src/main/fingerprint.ts) — coarse perceptual hash so unchanged screens don't trigger API calls.
- [`src/main/throttle.ts`](src/main/throttle.ts) — pure decision function: enabled? idle long enough? not typing? not throttled? not already in flight?
- [`src/main/analyzer.ts`](src/main/analyzer.ts) — thin facade that dispatches to a provider strategy ([`providers/anthropic.ts`](src/main/providers/anthropic.ts) for the Anthropic SDK with prompt caching + structured JSON output, [`providers/openai.ts`](src/main/providers/openai.ts) for any OpenAI-compatible chat-completions endpoint via plain `fetch`).
- [`src/main/controller.ts`](src/main/controller.ts) — orchestrates the loop and dispatches results to the overlay.
- [`src/main/overlay-window.ts`](src/main/overlay-window.ts) — transparent, always-on-top, click-through `BrowserWindow`.
- [`src/overlay/`](src/overlay) — the bubble's HTML/CSS/JS.

## Privacy

This app sees your screen. Read this part.

- **What gets captured.** A downscaled PNG of your primary display (long edge ≤ `maxImageDim`, default 1280px) plus your cursor coordinates and an idle-time number.
- **When.** Either when *you* press `F8`, or when the throttle decides — see [throttle.ts](src/main/throttle.ts). The screen is captured *before* any API call; if the [perceptual fingerprint](src/main/fingerprint.ts) is unchanged since last call, the image is discarded locally without being sent.
- **Where it goes.** Only to the backend URL you configured (`api.anthropic.com` by default, or whatever you set `baseURL` to). No analytics, no crash reporting, no third-party endpoints beyond the one you picked. With a local backend (Ollama, LM Studio, llama.cpp) **nothing leaves your machine** at all.
- **Where it's stored.** Nowhere by the app. Your backend's retention policy applies — e.g. [Anthropic's policy](https://www.anthropic.com/legal/privacy), [OpenAI's policy](https://openai.com/policies/row-privacy-policy/), or, for local models, nowhere at all.
- **Sensitive content.** The system prompt explicitly tells the model to return "no hint" for privacy-sensitive content (banking, medical, private chats). This is best-effort, not a guarantee. **If you don't want something analysed, press `F9` or quit before opening it.**

## Development

```bash
npm install          # install deps + native module prebuilds
npm run build        # tsc + copy overlay assets
npm start            # build, then launch Electron locally
npm run dev          # same, with --dev (devtools)
npm run test:unit    # vitest: unit + integration
npm run test:e2e     # playwright: full Electron e2e
npm test             # both
npm run pack         # unpacked app dir (debug-friendly)
npm run dist         # signed installers + portables (per arch)
```

### Repo layout

```
src/
  main/        Electron main-process TypeScript (controller, capture, throttle, …)
  overlay/     Renderer: tiny HTML page that draws the bubble
scripts/       Build helpers (overlay asset copy)
tests/
  unit/        Vitest: pure fns (throttle, fingerprint, position, png, config)
  integration/ Vitest: Analyzer ↔ Anthropic mock
  e2e/         Playwright: real Electron app + a VLM-quality harness
```

### Tests

- **Unit / integration** — `npm run test:unit`. Pure logic and Analyzer wiring. Mocks the Anthropic client; no key required.
- **End-to-end** — `npm run test:e2e`. Launches the real Electron app with `MAGICPOINTER_TEST=1` and drives it through Playwright.
- **VLM quality harness** — `tests/e2e/vlm-quality.spec.ts` exercises the analyzer on a small bank of screenshots to track hint quality over time.

### Coding style

See [CONTRIBUTING.md](CONTRIBUTING.md). TL;DR: small, surgical changes; no speculative abstractions; tests for new behavior.

## Roadmap

- [ ] Code-signed installers
- [ ] Native Google Gemini backend (currently supported via Gemini's OpenAI-compat endpoint)
- [ ] Per-app allow/deny list (don't analyse when these windows are focused)
- [ ] Hint history pane
- [ ] macOS + Linux input-capture parity

## Comparison

| | OpenMagicPointer | Closed vendor "Magic Pointer"-style helpers |
|---|---|---|
| Source code | MIT, public | Closed |
| Backend | Your key — Claude, OpenAI, Gemini, Ollama, … | Vendor-locked, opaque billing |
| Telemetry | None | Varies, often on by default |
| Captures sent | Only on idle/hotkey, after change-detection | Often continuous |
| Hotkey/tray | Yes, configurable | Varies |
| Audit-friendly | Read [analyzer.ts](src/main/analyzer.ts) | n/a |

## Contributing

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). For security issues see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 Zili Meng.

## Acknowledgements

- [Electron](https://www.electronjs.org/) — desktop runtime.
- [Anthropic Claude](https://www.anthropic.com/) — the vision model that decides whether a hint is warranted.
- [`uiohook-napi`](https://github.com/SnosMe/uiohook-napi) — global input tracking.
- Inspired by closed-source "magic pointer"-style assistants — this is the version you can read.
