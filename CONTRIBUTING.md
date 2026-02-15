# Contributing to Lentando

Thanks for your interest in contributing! Lentando is an open-source substance use and habit tracker built with vanilla JavaScript—no frameworks, no build transforms.

## How to Help

- **Report bugs** — Open an issue with steps to reproduce.
- **Suggest features** — Open an issue describing the use case and why it matters.
- **Submit a PR** — Fork the repo, make your change, and open a pull request.

## Development Setup

```bash
git clone https://github.com/KilledByAPixel/lentando.git
cd lentando
npm install
npm run lint     # Check for lint errors
npm run build    # Minify to dist/
```

To run locally, serve the root directory with any static server (e.g. `npx serve .` or `python -m http.server`).

## Guidelines

- **Vanilla JS only** — No frameworks, no JSX, no build-time transforms. ES6+ is fine.
- **Single-file architecture** — All app logic lives in `code.js`, styles are inline in `index.html`. Don't split into multiple files.
- **Mobile-first** — Test at 320px viewport width.
- **Offline-first** — Never block the UI on a network request. localStorage is primary storage.
- **Accessibility** — Use ARIA attributes, keep keyboard navigation working, support screen readers.
- **Escape user text** — Always use `escapeHTML()` before injecting user input into innerHTML.
- **Run lint before submitting** — `npm run lint` must pass cleanly.

## Code Style

- Use `const` / `let` (never `var`)
- Prefer early returns over deep nesting
- Comment *why*, not *what*

## Sensitive Topic

This app deals with substance use and addiction recovery. Please be thoughtful with language—avoid stigmatizing terms and keep the tone supportive and non-judgmental.

## License

By contributing, you agree that your contributions will be licensed under the [GPL v3](LICENSE).
