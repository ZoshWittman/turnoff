# WonderFact Kids

A cross-platform trivia app for children ages 5–10. Kids browse bright fact cards, hear them read aloud, save favorites, and ask for brand-new facts. Grown-ups keep API keys behind a math + PIN lock.

The app works immediately with a local library of 120+ facts. Optional AI generation uses a parent-provided key (OpenAI, Anthropic, Gemini, xAI, OpenRouter, or Vercel AI Gateway).

## Features

- Kid Mode: large type, pastel UI, swipeable cards, category chips, Surprise Me, favorites
- Read To Me: Piper neural storyteller in the browser (Amy) when built-in voices are robotic or missing; quality native voices like Samantha still win when present
- Parent Dashboard: math challenge + 4-digit PIN, encrypted BYOK keys, provider/model picker
- Guest play plus optional Google, Apple, Firebase, Supabase, and passkeys
- Offline fallback facts when no key is configured or a provider call fails
- Capacitor config for iOS/Android shells pointed at a hosted server

## Quick start

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Host it on a server

### Node (production)

```bash
npm install
npm run build
npm start
```

The app listens on port 3000. `next.config.ts` uses `output: "standalone"` so the build can also run from the generated `.next/standalone` folder.

### Docker

```bash
docker compose up --build
```

Health check: `GET /api/health`.

## Parent AI keys

1. Tap the lock in the corner.
2. Solve the multiplication puzzle.
3. Set a 4-digit PIN (used to encrypt keys with AES-GCM).
4. Paste a provider key, pick a model, then **Save keys** and **Test connection**.

Keys stay in encrypted `localStorage`. They are sent only to `/api/generate` and are never written to logs.

## Social login (optional)

Set the matching variables in `.env.local`:

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — Google Identity Services
- `NEXT_PUBLIC_APPLE_CLIENT_ID` + `NEXT_PUBLIC_APPLE_REDIRECT_URI` — Apple Sign-In
- Firebase: `NEXT_PUBLIC_FIREBASE_API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `APP_ID`
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Guest explorer mode and passkeys work without those values.

## Native iOS / Android

```bash
npm run cap:add:ios
npm run cap:add:android
CAPACITOR_SERVER_URL=https://your-hosted-url npm run cap:sync
```

Point `CAPACITOR_SERVER_URL` at the hosted Next.js server so native apps can use TTS, storage, and `/api/generate`.

## Tests

```bash
npm test
npm run lint
npm run typecheck
```

## Project layout

- `src/types/index.ts` — Fact, profile, and provider types
- `src/services/aiProvider.ts` — Unified BYOK AI client
- `src/context/AuthContext.tsx` — Guest, Google, Apple, passkeys, parent PIN
- `src/components/ParentModal.tsx` — Parent dashboard
- `src/components/FactCard.tsx` — TTS, favorites, swipe
- `src/App.tsx` — Kid tabs, surprise generator, ask box
