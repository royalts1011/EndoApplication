# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Endo Health — Blog Header Image Generator**: Internal tool to auto-generate brand-consistent blog header images from blog titles.

## Tech Stack

- **Framework:** Next.js (TypeScript) with API routes
- **Hosting:** Firebase Hosting + Cloud Functions
- **Database:** Firestore (`jobs` collection)
- **Image Storage:** Firebase Storage (`headers/{jobId}/{index}.png`)
- **Prompt Generation:** Claude API (claude-sonnet)
- **Image Generation (dev):** Pollinations.ai — `https://image.pollinations.ai/prompt/{encoded_prompt}` (no auth)
- **Image Generation (prod):** Imagen 3 (Google AI API)
- **Styling:** Tailwind CSS, brand accent `#F5C842` (amber), serif + mono fonts

## Commands

Once the project is scaffolded (Phase 1):

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run test         # Run tests (if configured)
```

## Environment Variables

Required in `.env.local`:
- `ANTHROPIC_API_KEY`
- `GOOGLE_AI_API_KEY` (Imagen 3)
- `FIREBASE_*` config values

## Architecture

### API Routes (`/api/`)
- `generate-prompts` — accepts `titles: string[]`, calls Claude API with brand style guide system prompt, returns `prompts: string[]`
- `generate-images` — accepts `prompts: string[]`, calls Imagen 3 (or Pollinations.ai in dev), returns image URLs

### Firebase Layer (`lib/firebase.ts`)
Firestore helpers: `createJob(titles)`, `updateJobStatus(jobId, status)`, `saveImageUrls(jobId, urls)`, `getJob(jobId)`

### Firestore Schema
```
jobs/{jobId}
  titles: string[]
  prompts: string[]
  imageUrls: string[]
  status: "pending" | "processing" | "done" | "error"
  createdAt: timestamp
```

### Frontend Pages
- `/` — main page: title input, brand guide preview, results grid (2-col, 1200×630px images)
- `/history` — past jobs from Firestore with real-time `onSnapshot` listener
- `/settings` — brand style guide editor (saved to Firestore)

### Image Provider Toggle
The image provider (Pollinations vs Imagen 3) should be switchable in one place. Use Pollinations during development, swap to Imagen 3 for production.

## Deployment

Firebase Hosting + Cloud Functions, or Vercel (API routes) + Firebase (static assets):

```bash
firebase deploy
```

API routes require Cloud Functions if using Firebase Hosting. See `next.config.ts` for export settings.
