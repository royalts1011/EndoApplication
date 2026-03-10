/**
 * GET /api/settings/provider
 * Returns the active image provider (read from env, not editable at runtime).
 */
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    provider: process.env.IMAGE_PROVIDER ?? 'pollinations',
  })
}
