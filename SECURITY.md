# Security policy

## Supported versions

OpenMagicPointer is pre-1.0. Security fixes target the latest minor release only.

| Version  | Supported |
| -------- | --------- |
| 0.1.x    | ✅        |
| < 0.1    | ❌        |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Use one of the private channels below:

1. **GitHub Security Advisories** (preferred) — [Report a vulnerability](https://github.com/mengzili/openmagicpointer/security/advisories/new). This keeps the report private until a fix lands.
2. **Email** — `zilim@ust.hk` with subject prefix `[openmagicpointer-security]`. Include a clear reproduction.

Please give us a reasonable window (typically 90 days, less for actively exploited issues) before public disclosure. We'll credit reporters in release notes unless you ask us not to.

## What's in scope

The kinds of issues we want to hear about:

- Remote code execution in the renderer, main, or preload scripts.
- Sandbox escapes or context-isolation bypasses in the overlay window.
- Leakage of the Anthropic API key (to disk in plaintext beyond the config file, to logs, to network destinations other than `api.anthropic.com`).
- Captures being sent without satisfying the throttle/hotkey conditions documented in the [README](README.md#privacy).
- Memory-safety bugs in the small native bits (`uiohook-napi` integration).

## What's out of scope

- Prompt-injection attacks that cause the model to return undesirable hints. The model output is treated as untrusted display text, not code. Patches that improve resilience are welcome through normal PRs.
- Anthropic API security itself — report those to Anthropic.
- Denial of service that requires local code execution to set up.
- Issues in dependencies that have an upstream advisory already; please open a normal PR bumping the version instead.

## Hardening notes for users

- Treat your `ANTHROPIC_API_KEY` like a password. Prefer the environment variable over storing it in `config.json`.
- Pause the app (`F9`) before opening sensitive content. The model is told to return "no hint" for sensitive screens but this is a best-effort heuristic, not a guarantee.
- Releases are not yet code-signed. Verify SHA-256 checksums against `SHA256SUMS.txt` on the [release page](https://github.com/mengzili/openmagicpointer/releases/latest) before running.
