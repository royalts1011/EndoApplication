# Workflow: Blog Header Image Generator

## Overview

This tool automatically generates brand-consistent blog header images (1200×630 px) from a list of blog article titles. The key design goal is that all images in a batch feel like a **coherent visual series** — not 10 random outputs.

---

## End-to-End Pipeline

```
endometriose.app
      │
      ▼
[1] GET /api/fetch-titles        ← scrape latest 10 article titles + URLs
      │
      ▼
[2] User selects titles / edits the list in the UI
      │
      ▼
[3] POST /api/generate           ← main orchestrator
      │
      ├─▶ [3a] Parallel HTTP scrape of each article URL
      │         → extract body text (up to 2000 chars per article)
      │
      ├─▶ [3b] ONE Gemini call (gemini-2.5-flash, text-only)
      │         → sends ALL articles together
      │         → returns: seriesConcept + per-article { summary, prompt }
      │
      └─▶ [3c] Sequential image generation (one per prompt)
                → gemini-2.5-flash-image  (default)
                → Imagen 4.0              (high quality, optional)
                → Pollinations.ai         (free fallback)
                │
                ▼
           [4] Save job to data/jobs.json
                │
                ▼
           [5] Return results to client → display 2-column grid
```

---

## Step 1 — Fetching Articles from endometriose.app

**File:** [src/app/api/fetch-titles/route.ts](src/app/api/fetch-titles/route.ts)

The server fetches the blog overview page at `https://endometriose.app/aktuelles-2/` and parses the HTML with `node-html-parser`. It targets the CSS selectors `.slide-entry-title a`, `.entry-title a`, and `h3.av-magazine-title a` to collect article links.

**Deduplication and filtering:** Only URLs with at least two path segments (e.g. `/lernen/thema/`) are kept — this excludes root-level pages like `/danke-fuer-deine-teilnahme/`. Duplicate titles are skipped via a `Set`. The result is the 10 most recent articles with their titles and URLs.

The response is cached for 5 minutes (`next: { revalidate: 300 }`) to avoid hammering the source site. Content is intentionally **not** fetched here — that happens later, after the user has confirmed which articles to process.

---

## Step 2 — Article Content Scraping

**File:** [src/app/api/generate/route.ts](src/app/api/generate/route.ts) — `fetchArticleContent()`

When the user clicks **Generate Headers**, the server fetches the full HTML of each article URL in **parallel** (`Promise.all`). It tries several content selectors in priority order:

```
.avia_textblock p   ← Avia theme (used on endometriose.app)
.entry-content p
article p
.post-content p
```

Paragraphs shorter than 80 characters (nav labels, captions) are discarded. The first 12 qualifying paragraphs are joined and capped at **2000 characters** — enough context for Gemini to understand what the article is truly about, without wasting tokens.

If a URL is not available (manual input mode) or scraping fails, the pipeline falls back gracefully to using only the title.

---

## Step 3 — Prompt Generation: The Cohesion Mechanism

**File:** [src/app/api/generate/route.ts](src/app/api/generate/route.ts) — Gemini step
**Prompt source:** [src/lib/brand.ts](src/lib/brand.ts) — `BATCH_SERIES_PROMPT`

This is the core of the approach. **All articles are sent to Gemini in a single call**, not one by one. The system prompt instructs the model to:

1. Read each article's title and content
2. Write a 2–3 sentence summary of what the article is about
3. Write an image generation prompt that shows a concrete, recognizable scene for that article
4. **Define a shared `seriesConcept`** — a consistent visual style (color palette + illustration technique) that all images in this batch will follow

The `seriesConcept` is the mechanism that ties all images together. Because Gemini sees the entire batch at once, it can pick a style that is appropriate for the brand *and* compatible with the diversity of topics. For example:

> *"Warm editorial illustration style with golden-hour light, soft amber and cream tones, impressionistic brushwork, real women in everyday health-related situations"*

Every individual prompt inherits that style. The result is that images feel like they were illustrated by the same artist for the same publication — even though the topics (diet, pain management, doctor conversations, hormones) are very different.

**Output format** (strict JSON, parsed server-side):
```json
{
  "seriesConcept": "<shared style description>",
  "articles": [
    { "summary": "...", "prompt": "..." },
    ...
  ]
}
```

The `responseMimeType: 'application/json'` config forces Gemini to return valid JSON, eliminating markdown wrapper issues.

---

## Step 4 — Image Generation

**File:** [src/app/api/generate/route.ts](src/app/api/generate/route.ts) — image generation step

Images are generated **sequentially** (one at a time, 1-second delay between calls) to respect API quota limits. Three Gemini image models are available, selectable in the UI:

| Model | Label | Notes |
|---|---|---|
| `gemini-2.5-flash-image` | Gemini 2.5 Flash Image | Fast & cheap (default) |
| `gemini-3.1-flash-image-preview` | Gemini 3.1 Flash Image | Better quality |
| `gemini-3-pro-image-preview` | Gemini 3 Pro Image | The highest quality |

All three use the same generation logic. The model receives both:
- The **style prompt** from Gemini's own output (the `seriesConcept`-grounded per-article prompt)
- The **article title and full content** as additional context

This dual-input approach means the image model doesn't just follow a text description — it is grounded in the actual article content. The full prompt sent to the image model looks like:

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

The model returns a base64-encoded image which is sent directly to the client as a `data:image/jpeg;base64,...` URL.

---

## Step 5 — Persisting and Displaying Results

**File:** [src/lib/server-history.ts](src/lib/server-history.ts)

After all images are generated, the job is saved to `data/jobs.json` on the server (max 50 jobs, newest first). Each job stores: `titles`, `summaries`, `prompts`, `imageUrls`, `seriesConcept`, and a timestamp.

The client receives `{ jobId, summaries, prompts, imageUrls, seriesConcept }` and renders a 2-column grid. The **Visual DNA** box at the top of the results shows the `seriesConcept` so the user can see what shared style was applied. The last session is also saved to `localStorage` so results survive a page reload.

---

## Single-Image Regeneration

**File:** [src/app/page.tsx](src/app/page.tsx) — `handleRegenerate()`

When the user clicks regenerate on a single card:

1. `POST /api/generate-prompts` — sends only that card's title, **plus the existing `seriesConcept`** as `seriesContext`
2. The prompt instructs Gemini: *"Stay consistent with the established visual DNA: `<seriesConcept>`"*
3. `POST /api/generate-images` — generates the new image from the new prompt

This ensures a regenerated card doesn't break the visual consistency of the rest of the batch.

---

## How Images Become a Coherent Series

The coherence is achieved through three deliberate design choices:

| # | Mechanism | Where |
|---|---|---|
| 1 | **Single batch Gemini call** — all articles processed together, not independently | `/api/generate`, Gemini step |
| 2 | **`seriesConcept` as shared style anchor** — one description of palette + illustration style, injected into every individual prompt | `BATCH_SERIES_PROMPT` in `brand.ts` |
| 3 | **Content grounding** — each image is informed by the actual article body, not just the title, so scenes are specific and recognizable while still following the shared style | `generateWithGemini()` in `/api/generate` |

Without mechanism #1, each prompt would be generated in isolation — Gemini might choose a different illustration style for each article. Without mechanism #2, the image model would interpret the same style words differently per call. Without mechanism #3, images might look stylistically similar but visually generic (stock-photo clichés), failing the brand requirement to show *real situations*.

---

## Brand Constraints

**File:** [src/lib/brand.ts](src/lib/brand.ts) — `DEFAULT_BRAND_STYLE_GUIDE`

The brand guide is appended to every Gemini system prompt:

- Warm, empowering, human-centered — never clinical or cold
- Color palette: amber/golden, cream, sand, terracotta, dusty rose, sage green
- Illustration style: soft editorial illustration or warm painterly style
- Always show real people, real situations — no abstract shapes or metaphors
- Warm natural lighting, horizontal landscape format (1200×630px)
- No text or typography in the image

The brand guide can be overridden per-request (via the `/settings` page, saved to `data/jobs.json`) — so the style can evolve without touching code.

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| UI | shadcn/ui + Tailwind CSS v4 |
| Prompt generation | Google Gemini 2.5 Flash (`@google/genai`) |
| Image generation | Gemini 2.5 Flash Image / Imagen 4.0 / Pollinations.ai |
| HTML parsing | `node-html-parser` |
| Persistence | JSON file (`data/jobs.json`) + `localStorage` |
| Downloads | JSZip (bulk ZIP) + `/api/proxy-image` (CORS-safe single download) |
