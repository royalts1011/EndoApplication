/**
 * Job history — stored in Firestore (production) or local file (dev fallback).
 * Firestore collection: "jobs"
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

export interface ServerJob {
  id: string
  titles: string[]
  summaries: string[]
  prompts: string[]
  imageUrls: string[]
  seriesConcept: string
  createdAt: string // ISO
}

// ── Firestore ─────────────────────────────────────────────────────────────────

const firestoreAvailable = !!(
  process.env.FIREBASE_PROJECT_ID || process.env.K_SERVICE // K_SERVICE is set on Cloud Run / Firebase App Hosting
)

async function firestoreListJobs(): Promise<ServerJob[]> {
  const { getAdminDb } = await import('./firebase-admin')
  const snap = await getAdminDb()
    .collection('jobs')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ServerJob))
}

async function firestoreGetJob(id: string): Promise<ServerJob | null> {
  const { getAdminDb } = await import('./firebase-admin')
  const doc = await getAdminDb().collection('jobs').doc(id).get()
  if (!doc.exists) return null
  return { id: doc.id, ...doc.data() } as ServerJob
}

async function firestoreSaveJob(job: Omit<ServerJob, 'id' | 'createdAt'>): Promise<ServerJob> {
  const { getAdminDb } = await import('./firebase-admin')
  const { FieldValue } = await import('firebase-admin/firestore')
  const ref = await getAdminDb().collection('jobs').add({
    ...job,
    createdAt: FieldValue.serverTimestamp(),
  })
  const createdAt = new Date().toISOString()
  return { id: ref.id, ...job, createdAt }
}

// ── File fallback (local dev without Firebase) ─────────────────────────────

const DATA_DIR = join(process.cwd(), 'data')
const FILE = join(DATA_DIR, 'jobs.json')

function fileListJobs(): ServerJob[] {
  try {
    if (!existsSync(FILE)) return []
    return JSON.parse(readFileSync(FILE, 'utf-8')) as ServerJob[]
  } catch {
    return []
  }
}

function fileGetJob(id: string): ServerJob | null {
  return fileListJobs().find((j) => j.id === id) ?? null
}

function fileSaveJob(job: Omit<ServerJob, 'id' | 'createdAt'>): ServerJob {
  const newJob: ServerJob = {
    ...job,
    id: Math.random().toString(36).slice(2, 10),
    createdAt: new Date().toISOString(),
  }
  const existing = fileListJobs()
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(FILE, JSON.stringify([newJob, ...existing].slice(0, 50), null, 2), 'utf-8')
  return newJob
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function listJobs(): Promise<ServerJob[]> {
  if (firestoreAvailable) return firestoreListJobs()
  return fileListJobs()
}

export async function getJob(id: string): Promise<ServerJob | null> {
  if (firestoreAvailable) return firestoreGetJob(id)
  return fileGetJob(id)
}

export async function saveJob(job: Omit<ServerJob, 'id' | 'createdAt'>): Promise<ServerJob> {
  if (firestoreAvailable) return firestoreSaveJob(job)
  return fileSaveJob(job)
}
