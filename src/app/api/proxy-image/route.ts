/**
 * GET /api/proxy-image?url=...
 * Proxies an external image through the server to avoid browser CORS restrictions on download.
 */
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'url parameter is required' }, { status: 400 })
  }

  // Only allow known image hosts
  const allowed = ['image.pollinations.ai', 'storage.googleapis.com', 'firebasestorage.googleapis.com']
  const host = new URL(url).hostname
  if (!allowed.some((h) => host === h || host.endsWith('.' + h))) {
    return NextResponse.json({ error: 'Host not allowed' }, { status: 403 })
  }

  const res = await fetch(url)
  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 })
  }

  const buffer = await res.arrayBuffer()
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'image/png',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
