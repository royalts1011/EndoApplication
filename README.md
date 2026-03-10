# Endo Health — Blog Header Generator

An internal tool for generating brand-consistent AI blog header images from article titles and content. Built for [endometriose.app](https://endometriose.app).

## What it does

1. **Fetch** — scrapes the latest blog post titles and URLs from endometriose.app
2. **Generate** — sends all articles to Gemini in one call: it reads the content, writes a summary per article, and creates a cohesive set of image prompts with a shared visual style
3. **Images** — generates header images (1200×630px) sequentially using a selected Gemini image model
4. **History** — every generation job is saved and accessible to all team members

## Tech stack

- **Next.js 15** (App Router)
- **Google Gemini** — `gemini-2.5-flash` for prompt generation, `gemini-2.5-flash-image` / `gemini-3-pro-image-preview` for images
- **shadcn/ui + Tailwind CSS v4**
- **File-based job history** (`data/jobs.json`) — shared across the local network

## Local setup

**1. Clone and install**

```bash
git clone <repo-url>
cd endo_health
npm install
```

**2. Set environment variables**

Create a `.env.local` file:

```env
GOOGLE_AI_API_KEY=your_gemini_api_key_here
IMAGE_PROVIDER=gemini
```

Get a Gemini API key at [aistudio.google.com](https://aistudio.google.com).

**3. Run**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploying to Firebase

This app is configured for **Firebase App Hosting** (native Next.js support).

### Prerequisites

- Firebase CLI: `npm install -g firebase-tools`
- A Firebase project with **Firestore** and **App Hosting** enabled

### Steps

```bash
firebase login
firebase init apphosting
```

Connect to your GitHub repo when prompted. Then add the API key as a secret:

```bash
firebase apphosting:secrets:set GOOGLE_AI_API_KEY
```

After that, every push to `main` deploys automatically.

> **Note:** The file-based job history (`data/jobs.json`) does not persist on Firebase's serverless infrastructure. Switch `src/lib/server-history.ts` to use Firestore before deploying.

## Brand style guide

The visual style sent to Gemini can be customized in the **Settings** page. Changes are saved in the browser's localStorage and sent with each generation request.

## Image models

| Model | Speed | Quality |
|---|---|---|
| Gemini 2.5 Flash Image | Fast | Good |
| Gemini 3.1 Flash Image | Medium | Better |
| Gemini 3 Pro Image | Slow | Highest |
