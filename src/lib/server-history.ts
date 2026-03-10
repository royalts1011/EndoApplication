/**
 * Job history — Firestore + Storage (production) or local file (dev fallback).
 * Firestore collection: "jobs"
 * Storage path: jobs/<jobId>/<index>.jpg
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

// ── Detect environment ────────────────────────────────────────────────────────

const firestoreAvailable = !!(
  process.env.FIREBASE_PROJECT_ID || process.env.K_SERVICE
)

// ── Storage upload helper ─────────────────────────────────────────────────────

async function uploadImages(jobId: string, imageUrls: string[]): Promise<string[]> {
  const { getAdminStorage } = await import('./firebase-admin')
  const bucket = getAdminStorage().bucket()

  return Promise.all(
    imageUrls.map(async (url, i) => {
      // Already a remote URL (e.g. pollinations) — keep as-is
      if (!url.startsWith('data:')) return url

      const matches = url.match(/^data:([^;]+);base64,(.+)$/)
      if (!matches) return url

      const mimeType = matches[1]
      const buffer = Buffer.from(matches[2], 'base64')
      const ext = mimeType.split('/')[1] ?? 'jpg'
      const filePath = `jobs/${jobId}/${i}.${ext}`

      const file = bucket.file(filePath)
      await file.save(buffer, { metadata: { contentType: mimeType } })
      await file.makePublic()

      return `https://storage.googleapis.com/${bucket.name}/${filePath}`
    })
  )
}

// ── Firestore ─────────────────────────────────────────────────────────────────

async function firestoreListJobs(): Promise<ServerJob[]> {
  const { getAdminDb } = await import('./firebase-admin')
  const snap = await getAdminDb()
    .collection('jobs')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get()
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      ...data,
      createdAt:
        typeof data.createdAt?.toDate === 'function'
          ? data.createdAt.toDate().toISOString()
          : data.createdAt ?? new Date().toISOString(),
    } as ServerJob
  })
}

async function firestoreGetJob(id: string): Promise<ServerJob | null> {
  const { getAdminDb } = await import('./firebase-admin')
  const doc = await getAdminDb().collection('jobs').doc(id).get()
  if (!doc.exists) return null
  const data = doc.data()!
  return {
    id: doc.id,
    ...data,
    createdAt:
      typeof data.createdAt?.toDate === 'function'
        ? data.createdAt.toDate().toISOString()
        : data.createdAt ?? new Date().toISOString(),
  } as ServerJob
}

async function firestoreSaveJob(job: Omit<ServerJob, 'id' | 'createdAt'>): Promise<ServerJob> {
  const { getAdminDb } = await import('./firebase-admin')
  const { FieldValue } = await import('firebase-admin/firestore')

  // Create the Firestore doc first to get an ID
  const ref = getAdminDb().collection('jobs').doc()
  const jobId = ref.id

  // Upload base64 images to Storage, get back public URLs
  const imageUrls = await uploadImages(jobId, job.imageUrls)

  await ref.set({
    ...job,
    imageUrls,
    createdAt: FieldValue.serverTimestamp(),
  })

  return { id: jobId, ...job, imageUrls, createdAt: new Date().toISOString() }
}

// ── File fallback (local dev) ─────────────────────────────────────────────────

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
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(
    FILE,
    JSON.stringify([newJob, ...fileListJobs()].slice(0, 50), null, 2),
    'utf-8'
  )
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
