/**
 * GET  /api/settings  — returns the default brand guide (client stores overrides in localStorage)
 * POST /api/settings  — no-op server-side; client persists to localStorage
 */
import { NextResponse } from 'next/server'
import { DEFAULT_BRAND_STYLE_GUIDE } from '@/lib/brand'

export async function GET() {
  return NextResponse.json({ text: DEFAULT_BRAND_STYLE_GUIDE })
}

export async function POST() {
  // Brand guide is stored in localStorage on the client.
  return NextResponse.json({ ok: true, local: true })
}
