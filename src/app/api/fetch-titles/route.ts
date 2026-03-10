/**
 * GET /api/fetch-titles
 *
 * Returns the 10 most recent blog post titles + URLs from endometriose.app.
 * Content fetching is intentionally NOT done here — it happens in /api/generate
 * after the user has selected which articles to process.
 *
 * Returns: { articles: { title, url }[] }
 */
import { NextResponse } from 'next/server'
import { parse } from 'node-html-parser'

const SOURCE_URL = 'https://endometriose.app/aktuelles-2/'
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

export async function GET() {
  try {
    const res = await fetch(SOURCE_URL, {
      headers: HEADERS,
      next: { revalidate: 300 }, // cache for 5 min
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch page: ${res.status}` },
        { status: 502 }
      )
    }

    const html = await res.text()
    const root = parse(html)

    // Blog posts live under /impulse/, /lernen/, /wissen/, etc. (two path segments deep).
    // Root-level pages like /danke-fuer-deine-teilnahme/ are excluded.
    const seen = new Set<string>()
    const articles = root
      .querySelectorAll('.slide-entry-title a, .entry-title a, h3.av-magazine-title a')
      .filter((el) => {
        const title = el.text.trim()
        const href = el.getAttribute('href') ?? ''
        const path = href.replace(/^https?:\/\/[^/]+/, '')
        const segments = path.split('/').filter(Boolean)
        if (!title || segments.length < 2) return false
        if (seen.has(title)) return false
        seen.add(title)
        return true
      })
      .slice(0, 10)
      .map((el) => ({
        title: el.text.trim(),
        url: el.getAttribute('href') ?? '',
        excerpt: '', // filled in during /api/generate
      }))

    return NextResponse.json({
      articles,
      titles: articles.map((a) => a.title),
      source: SOURCE_URL,
    })
  } catch (err) {
    console.error('[fetch-titles]', err)
    return NextResponse.json(
      { error: 'Failed to fetch articles from website' },
      { status: 500 }
    )
  }
}
