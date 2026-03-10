/**
 * POST /api/generate-images
 *
 * Accepts an array of image prompts and generates one image per prompt.
 * Provider is controlled by IMAGE_PROVIDER env var:
 *   - "gemini" (default): Gemini image generation — model selectable via `model` body param
 *   - "imagen3": Google AI Imagen 3, highest quality
 *   - "pollinations": free, no auth, but unreliable
 *
 * Body: { prompts: string[], model?: string }
 * Returns: { imageUrls: string[] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import type { ImageProvider } from '@/types'

const PROVIDER = (process.env.IMAGE_PROVIDER ?? 'gemini') as ImageProvider
const IMAGE_WIDTH = 1200
const IMAGE_HEIGHT = 630
const DEFAULT_IMAGE_MODEL = 'gemini-2.5-flash-image'

// ─── Gemini image generation ──────────────────────────────────────────────────

async function generateWithGemini(prompt: string, model: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { responseModalities: ['IMAGE'] },
  })
  const part = response.candidates?.[0]?.content?.parts?.[0]
  const base64 = part?.inlineData?.data
  const mimeType = part?.inlineData?.mimeType ?? 'image/jpeg'
  if (!base64) throw new Error('Gemini returned no image data')
  return `data:${mimeType};base64,${base64}`
}

// ─── Imagen 3 ─────────────────────────────────────────────────────────────────

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

// ─── Pollinations (fallback) ──────────────────────────────────────────────────

function pollinationsUrl(prompt: string): string {
  const encoded = encodeURIComponent(prompt)
  return `https://image.pollinations.ai/prompt/${encoded}?width=${IMAGE_WIDTH}&height=${IMAGE_HEIGHT}&nologo=true`
}

// ─── Sequential helper ────────────────────────────────────────────────────────

async function generateSequentially<T>(
  items: string[],
  fn: (item: string) => Promise<T>,
  delayMs = 1000
): Promise<T[]> {
  const results: T[] = []
  for (let i = 0; i < items.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, delayMs))
    results.push(await fn(items[i]))
  }
  return results
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const prompts: string[] = body.prompts
    const model: string = body.model ?? DEFAULT_IMAGE_MODEL

    if (!Array.isArray(prompts) || prompts.length === 0) {
      return NextResponse.json(
        { error: 'prompts must be a non-empty array' },
        { status: 400 }
      )
    }

    let imageUrls: string[]

    if (PROVIDER === 'imagen3') {
      imageUrls = await generateSequentially(prompts, generateWithImagen3)
    } else if (PROVIDER === 'pollinations') {
      imageUrls = prompts.map(pollinationsUrl)
    } else {
      // gemini — sequential with 1s delay to avoid quota exhaustion
      imageUrls = await generateSequentially(prompts, (p) => generateWithGemini(p, model))
    }

    return NextResponse.json({ imageUrls })
  } catch (err) {
    console.error('[generate-images]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate images' },
      { status: 500 }
    )
  }
}
