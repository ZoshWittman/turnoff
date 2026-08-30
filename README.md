# turnoff

**Turn Off** is a minimalist focus timer that helps you step away, reset your focus, and unplug. Pick a duration, start the countdown, and watch the ring wind down while you take a break from the screen.

Built with [Vite](https://vite.dev/), [React](https://react.dev/), and TypeScript.

## Features

- Preset focus durations (5 / 15 / 25 / 45 minutes)
- Animated circular countdown ring
- Start, pause/resume, and reset controls
- A calm, dark, distraction-free UI

## Getting started

Requires [Node.js](https://nodejs.org/) 20 or newer.

```bash
# Install dependencies
npm install

# Start the dev server (http://localhost:5173)
npm run dev
```

## Available scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server with hot-module reload. |
| `npm run build` | Type-check and build the production bundle to `dist/`. |
| `npm run preview` | Preview the production build locally. |
| `npm run lint` | Run ESLint over the project. |
| `npm run typecheck` | Type-check the project without emitting output. |

## Project structure

```
.
├── index.html          # App entry HTML
├── src/
│   ├── main.tsx        # React entry point
│   ├── App.tsx         # Turn Off timer component
│   ├── App.css         # Component styles
│   └── index.css       # Global styles
├── public/             # Static assets
└── vite.config.ts      # Vite configuration
```

## Cloud Agent environment

This repository is configured for Cursor Cloud Agents via [`.cursor/environment.json`](.cursor/environment.json):

- `install`: `npm ci` restores dependencies from the lockfile.
- `terminals`: a `dev` terminal runs `npm run dev` so the app is available on port `5173`.
