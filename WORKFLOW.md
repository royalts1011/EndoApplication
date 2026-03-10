# Workflow: Blog Header Image Generator

## Overview

This tool automatically generates brand-consistent blog header images (1200×630 px) from a list of blog article titles and content. The key design goal is that all images in a batch feel like a **coherent visual series** — not N random outputs.

---

## End-to-End Pipeline

```
endometriose.app
      │
      ▼
[1] GET /api/fetch-titles        ← scrape latest article titles + URLs (cached 5 min)
      │
      ▼
[2] User reviews / edits titles in the UI
      │
      ▼
[3] POST /api/generate           ← main orchestrator
      │
      ├─▶ [3a] Parallel HTTP scrape of each article URL
      │         → extract body text (.avia_textblock p, up to 2000 chars)
      │
      ├─▶ [3b] ONE Gemini text call (gemini-2.5-flash)
      │         → sends ALL articles together (titles + content)
      │         → returns: seriesConcept + per-article { summary, prompt }
      │
      └─▶ [3c] Sequential image generation (1s delay between calls)
                → gemini-3.1-flash-image-preview  (default)
                → gemini-3-pro-image-preview      (highest quality)
                → Imagen 4.0              (alternative, high quality)
                → Pollinations.ai         (free fallback)
                │
                ▼
[4] Upload images to Firebase Storage → get public URLs
      │
      ▼
[5] Save job metadata + Storage URLs to Firestore
      │
      ▼
[6] Return results to client → display 2-column grid
      │
      ▼
[7] Session saved to localStorage (survives page reload)
```

---

## Step 1 — Fetching Articles from endometriose.app

**File:** [src/app/api/fetch-titles/route.ts](src/app/api/fetch-titles/route.ts)

The server fetches the blog overview page at `https://endometriose.app/aktuelles-2/` and parses the HTML with `node-html-parser`. It targets the CSS selectors `.slide-entry-title a`, `.entry-title a`, and `h3.av-magazine-title a` to collect article links.

**Filtering:** Only URLs with at least two path segments (e.g. `/lernen/thema/`) are kept — this excludes root-level pages like `/danke-fuer-deine-teilnahme/`. Duplicate titles are removed via a `Set`.

The response is **cached for 5 minutes** (`next: { revalidate: 300 }`) to avoid hammering the source site. Article content is intentionally not fetched here — that happens during generation, after the user has confirmed which articles to process.

---

## Step 2 — Article Content Scraping

**File:** [src/app/api/generate/route.ts](src/app/api/generate/route.ts) — `fetchArticleContent()`

When the user clicks **Generate Headers**, the server fetches the full HTML of each article URL in **parallel** (`Promise.all`). It tries several CSS selectors in priority order:

```
.avia_textblock p   ← Avia/Enfold theme (used on endometriose.app)
.entry-content p
article p
.post-content p
```

Paragraphs shorter than 80 characters (nav labels, captions) are discarded. The first 12 qualifying paragraphs are joined and capped at **2000 characters** — enough context for Gemini to understand the article topic without wasting tokens.

If scraping fails or the article has no URL (manual input), the pipeline falls back to the title only.

---

## Step 3 — Prompt Generation: The Cohesion Mechanism

**File:** [src/app/api/generate/route.ts](src/app/api/generate/route.ts) — Gemini text step
**Prompt source:** [src/lib/brand.ts](src/lib/brand.ts) — `BATCH_SERIES_PROMPT`

This is the core of the approach. **All articles are sent to Gemini in a single call**, not one by one. The system prompt instructs the model to:

1. Read each article's title and content carefully
2. Write a 2–3 sentence summary of what the article is about
3. Write a concrete image generation prompt for that specific article
4. **Define a shared `seriesConcept`** — a consistent visual style (color palette + illustration technique) that all images in this batch will follow

The `seriesConcept` is the mechanism that ties all images together. Because Gemini sees the entire batch at once, it can pick a style appropriate for the brand *and* compatible with the full range of topics in the batch.

**Output format** (strict JSON via `responseMimeType: 'application/json'`):
```json
{
  "seriesConcept": "<shared visual style description>",
  "articles": [
    { "summary": "...", "prompt": "..." },
    ...
  ]
}
```

---

## Step 4 — Image Generation

**File:** [src/app/api/generate/route.ts](src/app/api/generate/route.ts) — image generation step

Images are generated **sequentially** with a 1-second delay between calls to respect Gemini API quota limits. Three models are available via the UI dropdown:

| Model | Speed | Quality |
|---|---|---|
| `gemini-3.1-flash-image-preview` | Fast | Good (default) |
| `gemini-3-pro-image-preview` | Slow | Highest |

Each image model call receives both:
- The **style prompt** from Gemini's output (series-consistent, article-specific)
- The **raw article title + full content** as additional grounding

Full prompt structure sent to the image model:
```
ARTICLE TITLE: <title>

ARTICLE CONTENT:
<up to 2000 chars of scraped body text>

VISUAL STYLE INSTRUCTION:
<prompt from step 3>

Create a blog header image (1200×630px, landscape) that visually represents
this article's topic. Follow the visual style instruction. Do not include
any text or typography.
```

The model returns a base64-encoded image.

---

## Step 5 — Storage & Persistence

**Files:** [src/lib/server-history.ts](src/lib/server-history.ts), [src/lib/firebase-admin.ts](src/lib/firebase-admin.ts)

The persistence layer automatically switches based on environment:

| Environment | Images stored in | Job metadata stored in |
|---|---|---|
| Firebase App Hosting | Firebase Storage (`jobs/<jobId>/<index>.jpg`) | Firestore `jobs` collection |
| Local dev | `data/jobs.json` (base64 inline) | `data/jobs.json` |

**Why Firebase Storage?** Firestore documents have a ~1MB size limit. A single 1200×630 base64 image is ~500KB, making direct Firestore storage impossible for multi-image jobs. Images are uploaded to Storage first and the resulting public URLs are stored in Firestore instead.

Each Firestore job document contains:
```json
{
  "titles": [...],
  "summaries": [...],
  "prompts": [...],
  "imageUrls": ["https://storage.googleapis.com/..."],
  "seriesConcept": "...",
  "createdAt": <Firestore Timestamp>
}
```

The Admin SDK on Firebase App Hosting auto-authenticates via **Application Default Credentials** — no service account keys needed in production.

---

## Step 6 — Displaying Results

After all images are generated, the client receives `{ jobId, summaries, prompts, imageUrls, seriesConcept }` and renders:

- A **Visual DNA** banner showing the `seriesConcept`
- A 2-column grid of `ImageResultCard` components
- Each card shows: image, title, collapsible article summary, collapsible image prompt, and action buttons (Download PNG, Copy URL, Regenerate)

The last session (titles, results, seriesConcept) is saved to `localStorage` and restored on the next page load.

---

## Single-Image Regeneration

**File:** [src/app/page.tsx](src/app/page.tsx) — `handleRegenerate()`

When the user clicks **Regenerate** on a single card:

1. `POST /api/generate-prompts` — sends that card's title plus the existing `seriesConcept` as `seriesContext`
2. Gemini is instructed to stay consistent with the established visual DNA
3. `POST /api/generate-images` — generates a new image from the new prompt

The regenerated image replaces only that card — the rest of the batch is unchanged.

---

## History

**Files:** [src/app/history/page.tsx](src/app/history/page.tsx), [src/app/api/history/route.ts](src/app/api/history/route.ts)

The history page fetches all jobs from `/api/history` (Firestore or local file depending on environment). Each job is clickable and opens a full detail view at `/history/[id]` with all images, prompts, summaries, and a bulk ZIP download option. History is shared across all users — on Firebase this means your colleague's generations are visible too.

---

## Brand Style Guide

**File:** [src/lib/brand.ts](src/lib/brand.ts) — `DEFAULT_BRAND_STYLE_GUIDE`

Appended to every Gemini system prompt:

- Warm, empowering, human-centered — never clinical or cold
- Color palette: amber/golden, cream, sand, terracotta, dusty rose, sage green
- Illustration style: soft editorial illustration or warm painterly style
- Always show real people, real situations — no abstract shapes or metaphors
- Warm natural lighting, horizontal landscape format (1200×630px)
- No text or typography in the image

The brand guide can be customized in the **Settings** page. On Firebase it is stored in Firestore `config/brandGuide` and shared across all users. Locally it is saved to `localStorage`.

---

## How Coherence Is Achieved

| # | Mechanism | Where |
|---|---|---|
| 1 | **Single batch Gemini call** — all articles sent together, not independently | `/api/generate`, Gemini step |
| 2 | **`seriesConcept` as shared style anchor** — one description injected into every individual prompt | `BATCH_SERIES_PROMPT` in `brand.ts` |
| 3 | **Content grounding** — image model receives full article body, not just the title | `generateWithGemini()` in `/api/generate` |
| 4 | **`seriesContext` in regeneration** — single-card regeneration preserves the established visual DNA | `/api/generate-prompts` |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| UI | shadcn/ui + Tailwind CSS v4 |
| Prompt generation | Google Gemini 2.5 Flash (`@google/genai`) |
| Image generation | Gemini image models / Imagen 4.0 / Pollinations.ai |
| HTML parsing | `node-html-parser` |
| Database | Firestore (prod) / `data/jobs.json` (local) |
| File storage | Firebase Storage (prod) / inline base64 (local) |
| Session restore | `localStorage` |
| Downloads | JSZip (bulk ZIP) + `/api/proxy-image` (CORS-safe single download) |
| Hosting | Firebase App Hosting (auto-deploy from GitHub `main`) |
