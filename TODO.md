# Endo Health — Blog Header Image Generator
## Development Todo List

> **Stack:** Next.js (TypeScript) · Firebase (Hosting + Firestore) · Imagen 3 (Google AI) · Claude API  
> **Dev tool:** Claude Code  
> **Goal:** Internal tool to auto-generate brand-consistent blog header images from blog titles

---

## Phase 1 — Project Setup

- [ ] Initialize Next.js app with TypeScript (`npx create-next-app@latest --typescript`)
- [ ] Set up ESLint + Prettier
- [ ] Install and configure Tailwind CSS
- [ ] Set up Firebase project in Firebase Console
- [ ] Install Firebase SDK (`firebase`, `firebase-admin`)
- [ ] Configure Firebase Hosting (`firebase init hosting`)
- [ ] Set up environment variables (`.env.local`):
  - `ANTHROPIC_API_KEY`
  - `GOOGLE_AI_API_KEY` (for Imagen 3)
  - `FIREBASE_*` config values
- [ ] Add `.env.local` to `.gitignore`
- [ ] Set up Firebase environment variables in CI/hosting config

---

## Phase 2 — Core Image Generation Pipeline

- [ ] Create `/api/generate-prompts` route (Next.js API route)
  - Accepts array of blog titles
  - Calls Claude API with brand style guide system prompt
  - Returns array of image generation prompts
- [ ] Create `/api/generate-images` route
  - Accepts array of prompts
  - Calls **Imagen 3** via Google AI API for each prompt
  - Returns image URLs or base64 data
- [ ] Define and store the Endo Health brand style guide as a shared constant
  - Colors, tone, mood, visual do's and don'ts
  - Used as system prompt context for Claude
- [ ] Add error handling and retries for both API routes
- [ ] Add rate limiting to API routes (to protect API keys)

> **Note on Pollinations.ai:** Use `https://image.pollinations.ai/prompt/{encoded_prompt}` as a free,
> no-auth drop-in **during development** while Imagen 3 access is being set up.
> Replace the image API URL in one place when switching to production.

---

## Phase 3 — Firebase Integration

- [ ] Set up **Firestore** database with a `jobs` collection:
  ```
  jobs/{jobId}
    titles: string[]
    prompts: string[]
    imageUrls: string[]
    status: "pending" | "processing" | "done" | "error"
    createdAt: timestamp
  ```
- [ ] Set up **Firebase Storage** bucket for generated images
  - Store images permanently (don't rely on external image URLs)
  - Images saved as `headers/{jobId}/{index}.png`
- [ ] Write Firestore helpers (`lib/firebase.ts`):
  - `createJob(titles)` → creates a job doc
  - `updateJobStatus(jobId, status)`
  - `saveImageUrls(jobId, urls)`
  - `getJob(jobId)`
- [ ] Add real-time job status listener (Firestore `onSnapshot`) to frontend

---

## Phase 4 — Frontend UI

- [ ] Build main page (`/`) with:
  - Input area: paste or type blog titles (one per line, or a list)
  - "Generate Headers" button
  - Brand style guide preview panel (read-only)
- [ ] Build results grid component:
  - 2-column responsive grid
  - Each card shows: title, generated image, AI prompt used
  - Loading skeleton while image is generating
  - Download button per image (downloads PNG)
  - "Regenerate this image" button per card
- [ ] Add job history sidebar or page (`/history`):
  - Lists past generation jobs from Firestore
  - Click to reload a past job's results
- [ ] Add global loading/error states
- [ ] Make the UI match Endo Health brand (warm tones, amber accent `#F5C842`, serif + mono fonts)

---

## Phase 5 — Image Download & Export

- [ ] Single image download (PNG, 1200×630px)
- [ ] Bulk download as ZIP (`jszip` library)
- [ ] Copy image URL to clipboard button
- [ ] Show image dimensions and file size in card

---

## Phase 6 — Configuration & Admin

- [ ] Brand style guide editor page (`/settings`)
  - Edit the shared style guide text that gets sent to Claude
  - Save to Firestore so it's shared across sessions
- [ ] Blog title import: paste from clipboard or upload a `.txt`/`.csv` file
- [ ] Configurable image dimensions (default: 1200×630)
- [ ] Toggle between image providers:
  - `pollinations` (free, dev)
  - `imagen3` (production)

---

## Phase 7 — Deploy

- [ ] Configure `next.config.ts` for Firebase Hosting (static export or Cloud Functions)
- [ ] Set up Firebase Cloud Functions if using server-side API routes
  - Alternative: deploy API routes via **Vercel** and host static assets on Firebase
- [ ] Add all environment variables to Firebase / hosting config
- [ ] Run `firebase deploy`
- [ ] Test end-to-end in production
- [ ] Set up basic auth or Google Sign-In (Firebase Auth) to protect the tool

---

## Tech Decision Notes

| Decision | Choice | Reason |
|---|---|---|
| Prompt generation | Claude API (claude-sonnet) | Best at understanding brand context and writing cohesive visual prompts |
| Image generation (dev) | Pollinations.ai | Free, no API key, instant setup |
| Image generation (prod) | Imagen 3 (Google AI) | High quality, integrates natively with Firebase ecosystem |
| Database | Firestore | Real-time updates, Firebase native, easy setup |
| Image storage | Firebase Storage | Permanent storage, CDN delivery, same ecosystem |
| Hosting | Firebase Hosting + Cloud Functions | Single platform, easy deploy pipeline |

