import { NextResponse } from 'next/server'
import { listJobs } from '@/lib/server-history'

export async function GET() {
  return NextResponse.json({ jobs: await listJobs() })
}
