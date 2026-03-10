# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server on localhost:3000
npm run build    # Production build (catches TypeScript errors)
npm run lint     # ESLint
```

## Environment Variables

Required in `.env.local`:
- `GEMINI_API_KEY` — Google AI API key (Gemini text + image generation)
- `IMAGE_PROVIDER` — `gemini` (default), `imagen3`, or `pollinations`
- `FIREBASE_STORAGE_BUCKET` — e.g. `<project-id>.firebasestorage.app`
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — only needed for local dev with Firebase; on Firebase App Hosting, ADC handles auth automatically

## Architecture

### Pipeline
```
User input (titles or auto-fetched from endometriose.app)
  → POST /api/generate
      1. Parallel scrape article content (.avia_textblock p, up to 2000 chars each)
      2. ONE Gemini text call (gemini-2.5-flash) → { seriesConcept, articles[{ summary, prompt }] }
      3. Sequential image generation (1s delay) → base64 data URIs
      4. Upload images to Firebase Storage → public URLs
      5. Save job to Firestore jobs/{jobId}
  → Client renders results grid + Visual DNA banner
```

### Persistence — dual-mode
`src/lib/server-history.ts` switches automatically:
- **Firebase App Hosting** (`K_SERVICE` env set): Firestore + Storage
- **Local dev** (no `K_SERVICE`, no `FIREBASE_PROJECT_ID`): `data/jobs.json` + inline base64

### Key files

| File | Purpose |
|---|---|
| `src/lib/brand.ts` | `DEFAULT_BRAND_STYLE_GUIDE` + `BATCH_SERIES_PROMPT` — the system prompt sent to Gemini |
| `src/lib/server-history.ts` | Job persistence (Firestore in prod, file fallback locally) |
| `src/lib/firebase-admin.ts` | Lazy-init Admin SDK — `getAdminDb()` and `getAdminStorage()`; always call inside handlers, never at module level |
| `src/lib/local-history.ts` | `saveLastSession` / `loadLastSession` — localStorage session restore only |
| `src/lib/download.ts` | Single PNG download + bulk ZIP via JSZip |
| `src/types/index.ts` | `ImageResult`, `ImageProvider`, `ArticleInfo` |

### API Routes

| Route | Description |
|---|---|
| `POST /api/generate` | Full pipeline: scrape → prompts → images → Storage → Firestore |
| `POST /api/generate-prompts` | Gemini text step only; used for single-card regeneration |
| `POST /api/generate-images` | Image generation step only; accepts `model` param |
| `GET /api/fetch-titles` | Scrapes latest articles from endometriose.app (5-min cache) |
| `GET/POST /api/settings` | Read/write brand guide (Firestore in prod, default locally) |
| `GET /api/settings/provider` | Returns active `IMAGE_PROVIDER` env value |
| `GET /api/history` | List all jobs from Firestore or local file |
| `GET /api/history/[id]` | Get single job |
| `GET /api/proxy-image` | CORS-safe image proxy for downloads |

### Pages

| Page | Description |
|---|---|
| `/` | Title input, generate, 2-col results grid with Visual DNA banner |
| `/history` | Shared job history (all users); clickable items |
| `/history/[id]` | Full job detail — images, prompts, summaries, ZIP download |
| `/settings` | Brand style guide editor (saved to Firestore or localStorage) |

### Firestore schema
```
jobs/{jobId}
  titles: string[]
  summaries: string[]
  prompts: string[]
  imageUrls: string[]   ← Firebase Storage public URLs (not base64)
  seriesConcept: string
  createdAt: Timestamp

config/brandGuide
  text: string
```

### Image models (selectable in UI)

| Model | Default |
|---|---|
| `gemini-3.1-flash-image-preview` | ✓ |
| `gemini-3-pro-image-preview` | |

### Single-card regeneration
Calls `/api/generate-prompts` (with existing `seriesConcept` as `seriesContext`) then `/api/generate-images`. Does not write to Firestore/history.

## Deployment

Hosted on **Firebase App Hosting** — auto-deploys from `main` branch. Config in `apphosting.yaml`. Secrets managed via Firebase Secret Manager (`GEMINI_API_KEY`).

## Brand

- Accent: `#F5C842` (amber) → `oklch(0.82 0.165 85)`
- Image dimensions: 1200×630 px (blog header / OG format)
- Brand guide editable at `/settings`; sent as system prompt to Gemini on every generation
