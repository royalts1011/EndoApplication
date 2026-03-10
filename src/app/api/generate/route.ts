/**
 * POST /api/generate
 *
 * Pipeline:
 *   1. Fetch article content for each article that has a URL (server-side)
 *   2. One Gemini call → summarize each article + generate cohesive image prompts
 *   3. Generate images sequentially (one per article)
 *
 * Body: { articles: { title, url, excerpt? }[], brandGuide?, imageModel? }
 *    OR { titles: string[] }  (fallback when no URL data available)
 * Returns: { jobId, summaries, prompts, imageUrls, seriesConcept }
 */
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { parse } from 'node-html-parser'
import { DEFAULT_BRAND_STYLE_GUIDE, BATCH_SERIES_PROMPT } from '@/lib/brand'
import { saveJob } from '@/lib/server-history'
import type { ImageProvider } from '@/types'

const PROVIDER = (process.env.IMAGE_PROVIDER ?? 'gemini') as ImageProvider
const IMAGE_WIDTH = 1200
const IMAGE_HEIGHT = 630
const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-image-preview'

const SCRAPE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

// ── Content scraping ──────────────────────────────────────────────────────────

async function fetchArticleContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: SCRAPE_HEADERS })
    if (!res.ok) return ''
    const html = await res.text()
    const root = parse(html)

    const selectors = ['.avia_textblock p', '.entry-content p', 'article p', '.post-content p']
    for (const selector of selectors) {
      const text = root
        .querySelectorAll(selector)
        .map((el) => el.text.replace(/\s+/g, ' ').trim())
        .filter((t) => t.length > 80)
        .slice(0, 12)
        .join(' ')
      if (text.length > 200) return text.slice(0, 2000)
    }
    return ''
  } catch {
    return ''
  }
}

// ── Image generation ──────────────────────────────────────────────────────────

async function generateWithGemini(
  prompt: string,
  model: string,
  articleTitle?: string,
  articleContent?: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

  const input = articleContent?.trim()
    ? `ARTICLE TITLE: ${articleTitle}\n\nARTICLE CONTENT:\n${articleContent}\n\n` +
      `VISUAL STYLE INSTRUCTION:\n${prompt}\n\n` +
      `Create a blog header image (1200×630px, landscape) that visually represents this article's topic. ` +
      `Follow the visual style instruction. Do not include any text or typography.`
    : prompt

  const response = await ai.models.generateContent({
    model,
    contents: input,
    config: { responseModalities: ['IMAGE'] },
  })
  const part = response.candidates?.[0]?.content?.parts?.[0]
  const base64 = part?.inlineData?.data
  const mimeType = part?.inlineData?.mimeType ?? 'image/jpeg'
  if (!base64) throw new Error('Gemini returned no image data')
  return `data:${mimeType};base64,${base64}`
}

async function generateWithImagen3(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: '16:9' },
      }),
    }
  )
  if (!res.ok) throw new Error(`Imagen 3 error: ${await res.text()}`)
  const data = await res.json()
  const base64 = data.predictions?.[0]?.bytesBase64Encoded
  if (!base64) throw new Error('Imagen 3 returned no image data')
  return `data:image/png;base64,${base64}`
}

async function generateSequentially<T>(
  items: T[],
  fn: (item: T, index: number) => Promise<string>,
  delayMs = 1000
): Promise<string[]> {
  const results: string[] = []
  for (let i = 0; i < items.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, delayMs))
    results.push(await fn(items[i], i))
  }
  return results
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json()
  const brandGuide: string = body.brandGuide ?? DEFAULT_BRAND_STYLE_GUIDE
  const imageModel: string = body.imageModel ?? DEFAULT_IMAGE_MODEL

  type ArticleInput = { title: string; url?: string; excerpt?: string }
  const articles: ArticleInput[] = body.articles
    ?? (body.titles as string[])?.map((t: string) => ({ title: t }))
    ?? []

  if (articles.length === 0) {
    return NextResponse.json(
      { error: 'articles or titles must be a non-empty array' },
      { status: 400 }
    )
  }

  const titles = articles.map((a) => a.title)

  try {
    // ── Step 1: Fetch article content for selected articles ─────────────────
    const articlesWithContent = await Promise.all(
      articles.map(async (a) => ({
        title: a.title,
        url: a.url ?? '',
        content: a.excerpt?.trim() || (a.url ? await fetchArticleContent(a.url) : ''),
      }))
    )

    // ── Step 2: Gemini summarizes + generates prompts in one call ───────────
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const systemInstruction = BATCH_SERIES_PROMPT + brandGuide

    const articleList = articlesWithContent
      .map((a, i) =>
        a.content
          ? `${i + 1}. Title: "${a.title}"\n   Content: ${a.content}`
          : `${i + 1}. Title: "${a.title}"`
      )
      .join('\n\n')

    const userMessage = `Here are the ${articles.length} blog articles:\n\n${articleList}`

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userMessage,
      config: {
        systemInstruction,
        temperature: 0.9,
        responseMimeType: 'application/json',
      },
    })

    const parsed = JSON.parse(response.text?.trim() ?? '{}')
    const seriesConcept: string = parsed.seriesConcept ?? ''

    const articleResults: { summary?: string; prompt: string }[] =
      parsed.articles ?? parsed.prompts?.map((p: string) => ({ prompt: p })) ?? []

    const summaries: string[] = articleResults.map((a) => a.summary ?? '')
    const prompts: string[] = articleResults.map((a) => a.prompt ?? '')

    // ── Step 3: Generate images sequentially ───────────────────────────────
    let imageUrls: string[]
    if (PROVIDER === 'imagen3') {
      imageUrls = await generateSequentially(prompts, (p) => generateWithImagen3(p))
    } else if (PROVIDER === 'pollinations') {
      const encoded = prompts.map((p) => encodeURIComponent(p))
      imageUrls = encoded.map(
        (e) => `https://image.pollinations.ai/prompt/${e}?width=${IMAGE_WIDTH}&height=${IMAGE_HEIGHT}&nologo=true`
      )
    } else {
      // gemini — image model receives both the style prompt and the article content
      imageUrls = await generateSequentially(prompts, (p, i) =>
        generateWithGemini(p, imageModel, articlesWithContent[i]?.title, articlesWithContent[i]?.content)
      )
    }

    const { id: jobId } = await saveJob({ titles, summaries, prompts, imageUrls, seriesConcept })

    return NextResponse.json({ jobId, summaries, prompts, imageUrls, seriesConcept })
  } catch (err) {
    console.error('[generate]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Generation failed' },
      { status: 500 }
    )
  }
}
