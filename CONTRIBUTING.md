# Contributing to OpenMagicPointer

Thanks for considering a contribution. This project is small and opinionated — please read this short doc before opening a PR so we can keep things tight.

## Ground rules

1. **Smallest change that solves the problem.** No speculative abstractions, no drive-by refactors, no reformatting unrelated lines.
2. **Test what you change.** Pure logic goes in `src/main/*.ts` with a unit test in `tests/unit/`. Anything that crosses the Anthropic SDK boundary gets an integration test in `tests/integration/`. UI changes get an e2e in `tests/e2e/`.
3. **Match the existing style.** TypeScript strict, 2-space indent, single quotes, semicolons. If you'd write it differently, do that in your own fork.
4. **Comments explain *why*, not *what*.** Don't restate what the code does; do flag non-obvious constraints, workarounds, or invariants.

## Getting set up

```bash
git clone https://github.com/mengzili/openmagicpointer.git
cd openmagicpointer
npm install
npm test       # should pass before you start
npm start      # local run (needs ANTHROPIC_API_KEY)
```

The end-to-end tests use Playwright. The first time you run `npm run test:e2e`, Playwright may prompt to download browser binaries — for the Electron suite it doesn't need them, so you can decline.

## Pull requests

- Branch from `main`. One concern per PR.
- Use a descriptive title. Conventional prefixes (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`) are encouraged but not required.
- Fill in the PR template — it asks for the user-facing change, the test plan, and screenshots/logs where relevant.
- CI must be green. Run `npm test` locally before pushing.
- Don't bump the version. Maintainers handle releases.

## Reporting bugs

Open an issue using the **Bug report** template. Include:
- OS version (Windows 10/11, build number)
- App version (right-click tray → version line)
- Steps to reproduce
- What you expected vs. what happened
- A screenshot or short clip if possible — but **redact anything sensitive**: the model gets your *cursor area* by design.

Please don't paste API keys, even partially. If you suspect a key has leaked, rotate it from the [Anthropic Console](https://console.anthropic.com/settings/keys) first.

## Security

See [SECURITY.md](SECURITY.md) for the disclosure process. **Do not** file a public issue for security vulnerabilities.

## Code of conduct

Be kind. Assume good intent. No harassment, no personal attacks. Maintainers will close threads that drift into that territory.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
