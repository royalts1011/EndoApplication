/**
 * Endo Health brand style guide.
 * Sent to Gemini as context for image prompt generation.
 */
export const DEFAULT_BRAND_STYLE_GUIDE = `
## Brand Style
- Warm, empowering, human-centered — never clinical or cold
- Color palette: amber/golden, cream, sand, terracotta, dusty rose, sage green
- Illustration style: soft editorial illustration or warm painterly style
- Always show real people, real situations — no abstract shapes or metaphors
- Warm natural lighting, horizontal landscape format (1200×630px)
- No text or typography in the image
`

/**
 * System prompt for generating image prompts from article titles + content.
 */
export const BATCH_SERIES_PROMPT = `
You are creating blog header images for a health brand. You will receive a list of blog articles, each with a title and content.

For each article:
1. Read the title and content carefully to understand exactly what the article is about
2. Write a 2-3 sentence summary of the article's core topic
3. Write an image generation prompt that directly shows a scene fitting that article

The image prompt must:
- Depict a concrete, recognizable scene based on what the article is actually about
- Show people in real situations — not symbols, not abstract shapes
- Follow the brand style guide below
- Someone reading the article title should immediately recognize it in the image

Also define a shared visual style (color palette + illustration style) that all images in this batch will use, so they look like a coherent series.

## Output format (strict JSON, no markdown):
{
  "seriesConcept": "<shared visual style for this batch>",
  "articles": [
    {
      "summary": "<what this article is about>",
      "prompt": "<image generation prompt>"
    }
  ]
}

The articles array must match the input exactly, in the same order.

## Brand Style Guide:
`
