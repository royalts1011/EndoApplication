/**
 * GET  /api/settings  — fetch brand guide (Firestore in prod, default locally)
 * POST /api/settings  — save brand guide to Firestore (prod) or localStorage (local)
 */
import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_BRAND_STYLE_GUIDE } from '@/lib/brand'

const firestoreAvailable = !!(
  process.env.FIREBASE_PROJECT_ID || process.env.K_SERVICE
)

export async function GET() {
  if (firestoreAvailable) {
    try {
      const { getAdminDb } = await import('@/lib/firebase-admin')
      const snap = await getAdminDb().collection('config').doc('brandGuide').get()
      const text = snap.exists ? (snap.data()?.text ?? DEFAULT_BRAND_STYLE_GUIDE) : DEFAULT_BRAND_STYLE_GUIDE
      return NextResponse.json({ text })
    } catch (err) {
      console.error('[settings GET]', err)
    }
  }
  return NextResponse.json({ text: DEFAULT_BRAND_STYLE_GUIDE })
}

export async function POST(req: NextRequest) {
  const { text } = await req.json()
  if (typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }

  if (firestoreAvailable) {
    try {
      const { getAdminDb } = await import('@/lib/firebase-admin')
      await getAdminDb().collection('config').doc('brandGuide').set({ text })
      return NextResponse.json({ ok: true })
    } catch (err) {
      console.error('[settings POST]', err)
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
    }
  }

  // Local dev — client stores in localStorage
  return NextResponse.json({ ok: true, local: true })
}
