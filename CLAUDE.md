# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Endo Health — Blog Header Image Generator**: Internal tool to auto-generate brand-consistent blog header images from blog titles.

## Commands

```bash
npm run dev      # Start dev server on localhost:3000
npm run build    # Production build (also catches TypeScript errors)
npm run lint     # ESLint
```

## Environment Variables

Fill in `.env.local` before running:
- `GOOGLE_AI_API_KEY` — Google AI API key (prompt generation via Gemini + image generation)
- `NEXT_PUBLIC_FIREBASE_*` — Firebase client config (from Firebase Console)
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — Firebase Admin (server-side)
- `IMAGE_PROVIDER` — `gemini` (default, uses `gemini-2.5-flash-image`), `imagen3`, or `pollinations` (free, no key needed)

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **shadcn/ui** + **Tailwind CSS v4** — UI components, brand palette in [src/app/globals.css](src/app/globals.css)
- **@google/genai** — prompt generation via `gemini-2.5-flash`
- **Firebase** — Firestore (jobs + config), Admin SDK (server-side)
- **JSZip** — bulk ZIP download

## Architecture

### Data flow
```
User input (titles or auto-fetched from endometriose.app)
  → POST /api/generate (orchestrator)
      → Gemini 2.5 Flash → { prompts[], seriesConcept }
      → Gemini / Imagen 3 / Pollinations → imageUrls[]
      → Firestore: jobs/{jobId} { titles, prompts, imageUrls, seriesConcept, status }
  → Client renders results grid
```

### Key files

| File | Purpose |
|---|---|
| [src/lib/brand.ts](src/lib/brand.ts) | Brand style guide constant + Gemini system prompt (`BATCH_SERIES_PROMPT`) |
| [src/lib/firebase.ts](src/lib/firebase.ts) | Client-side Firestore helpers + real-time listeners |
| [src/lib/firebase-admin.ts](src/lib/firebase-admin.ts) | Server-side Admin SDK — use `getAdminDb()` inside handlers only (lazy init) |
| [src/lib/download.ts](src/lib/download.ts) | Single PNG download + bulk ZIP via JSZip |
| [src/types/index.ts](src/types/index.ts) | Shared types: `Job`, `JobStatus`, `ImageResult`, `ImageProvider` |

### API Routes

| Route | Description |
|---|---|
| `POST /api/generate` | Full pipeline: titles → prompts → images → Firestore |
| `POST /api/generate-prompts` | Gemini step only; returns `{ prompts[], seriesConcept }` |
| `POST /api/generate-images` | Image generation step only; `model` body param overrides default |
| `GET /api/fetch-titles` | Scrapes 10 latest blog titles from endometriose.app |
| `GET/POST /api/settings` | Read/write brand guide in Firestore |
| `GET /api/settings/provider` | Returns active `IMAGE_PROVIDER` env value |
| `GET /api/history` | List all jobs; `DELETE` to clear all |
| `GET /api/history/[id]` | Get single job; `DELETE` to remove |
| `GET /api/proxy-image` | Proxies external image URLs for CORS-safe download |

### Pages

| Page | Description |
|---|---|
| `/` | Title input, generate button, results grid (2-col), file import |
| `/history` | Real-time list of past jobs from Firestore |
| `/settings` | Brand guide editor (saves to Firestore `config/brandGuide`) |

### Firestore Schema
```
jobs/{jobId}
  titles: string[]
  prompts: string[]
  imageUrls: string[]
  seriesConcept: string   ← shared visual DNA returned by Gemini; passed back on single-card regen
  status: "pending" | "processing" | "done" | "error"
  createdAt: timestamp

config/brandGuide
  text: string   ← overrides DEFAULT_BRAND_STYLE_GUIDE from brand.ts
```

### Important implementation notes
- `firebase-admin.ts` uses lazy init — always call `getAdminDb()` / `getAdminStorage()` inside request handlers, never at module level, to avoid build-time crashes with empty env vars.
- Image provider is controlled by `IMAGE_PROVIDER` env. Default is `gemini` (`gemini-2.5-flash-image`). Pollinations returns plain URLs (no API call); Gemini and Imagen 3 return base64 data URLs.
- Single-image regenerate calls `/api/generate-prompts` + `/api/generate-images` separately (skips Firestore write).

## Brand

- Accent color: `#F5C842` (amber) → `oklch(0.82 0.165 85)` in CSS vars
- Warm cream background, serif + mono typography (Geist)
- Image dimensions: 1200×630px (blog header / OG format)
