# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-05-20

### Added

- **First-launch setup window.** When no API key is configured, instead of erroring out and quitting, the app opens a small settings panel where you can pick the provider, endpoint URL, model, and paste your key. Reopenable any time from the tray "Settings…" menu.
- **OS-encrypted secret storage.** API keys saved through the setup window are encrypted with Electron's `safeStorage` (DPAPI on Windows, Keychain on macOS, libsecret on Linux) and kept in a separate `secret.bin` file. `config.json` continues to never contain the key.
- `Controller.setConfig()` so settings changes apply live without restarting the app (rebuilds the analyzer with the new provider/model/key).

### Changed

- Startup no longer aborts on missing key — only quits if the user closes the setup window without configuring one.

## [0.1.0] - 2026-05-20

Initial public release.

### Added

- Electron-based Windows app that watches the primary display and offers proactive on-screen hints from a vision-language model.
- **Pluggable VLM backend.** Anthropic Claude (native SDK with prompt caching) or any OpenAI-compatible Chat Completions endpoint — OpenAI, Azure, OpenRouter, Groq, Gemini's OpenAI-compat endpoint, and local servers (Ollama, LM Studio, `llama.cpp`, vLLM).
- System-tray UI with pause/resume, "hint now", and quit.
- Global hotkeys: `F8` ask now, `F9` pause/resume, `Ctrl+Shift+F12` quit.
- Pure throttle logic with idle, typing, in-flight, and minimum-interval guards.
- Perceptual-fingerprint screen-change detection (32×32 grayscale) so unchanged screens don't burn API calls.
- Transparent, click-through, multi-monitor-aware hint overlay with edge-flipping placement.
- Config via `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` env var or `%APPDATA%\OpenMagicPointer\config.json`. Local backends skip the API-key requirement.
- Unit, integration, and end-to-end test suites (Vitest + Playwright) — 46 unit/integration tests covering pure logic, Anthropic SDK wiring, and OpenAI-compatible REST wiring.
- Windows installers and portable builds for **x64** and **arm64**.

[Unreleased]: https://github.com/mengzili/openmagicpointer/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/mengzili/openmagicpointer/releases/tag/v0.1.1
[0.1.0]: https://github.com/mengzili/openmagicpointer/releases/tag/v0.1.0
