/**
 * POST /api/generate-prompts
 *
 * Generates a cohesive series of image prompts from blog titles.
 * All titles are sent in ONE Gemini call so it can establish shared
 * visual DNA — ensuring the images feel like a series, not N random outputs.
 *
 * Body: { titles: string[], brandGuide?: string, seriesContext?: string }
 *   seriesContext: optional — pass the existing seriesConcept when regenerating
 *                 a single card so the new prompt stays consistent.
 *
 * Returns: { prompts: string[], seriesConcept: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { DEFAULT_BRAND_STYLE_GUIDE, BATCH_SERIES_PROMPT } from '@/lib/brand'

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const titles: string[] = body.titles
    const brandGuide: string = body.brandGuide ?? DEFAULT_BRAND_STYLE_GUIDE
    const seriesContext: string = body.seriesContext ?? ''

    if (!Array.isArray(titles) || titles.length === 0) {
      return NextResponse.json(
        { error: 'titles must be a non-empty array' },
        { status: 400 }
      )
    }

    const systemInstruction = BATCH_SERIES_PROMPT + brandGuide

    const contextNote = seriesContext
      ? `\n\nIMPORTANT: This prompt is being regenerated as part of an existing series. The established visual DNA is: "${seriesContext}". Stay consistent with it.`
      : ''

    const userMessage =
      `Here are the ${titles.length} blog titles:\n` +
      titles.map((t, i) => `${i + 1}. ${t}`).join('\n') +
      contextNote

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userMessage,
      config: {
        systemInstruction,
        temperature: 0.9,
        responseMimeType: 'application/json',
      },
    })

    const raw = response.text?.trim() ?? '{}'
    const parsed = JSON.parse(raw)

    const prompts: string[] = parsed.prompts ?? []
    const seriesConcept: string = parsed.seriesConcept ?? seriesContext

    if (prompts.length !== titles.length) {
      console.warn(`[generate-prompts] Expected ${titles.length} prompts, got ${prompts.length}`)
    }

    return NextResponse.json({ prompts, seriesConcept })
  } catch (err) {
    console.error('[generate-prompts]', err)
    return NextResponse.json(
      { error: 'Failed to generate prompts' },
      { status: 500 }
    )
  }
}
