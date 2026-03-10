/**
 * File-based job history for server-side persistence.
 * Stored at <project-root>/data/jobs.json so all clients on the network share the same history.
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

const DATA_DIR = join(process.cwd(), 'data')
const FILE = join(DATA_DIR, 'jobs.json')
const MAX_JOBS = 50

function readJobs(): ServerJob[] {
  try {
    if (!existsSync(FILE)) return []
    return JSON.parse(readFileSync(FILE, 'utf-8')) as ServerJob[]
  } catch {
    return []
  }
}

function writeJobs(jobs: ServerJob[]) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(FILE, JSON.stringify(jobs, null, 2), 'utf-8')
}

export function listJobs(): ServerJob[] {
  return readJobs()
}

export function getJob(id: string): ServerJob | null {
  return readJobs().find((j) => j.id === id) ?? null
}

export function saveJob(job: Omit<ServerJob, 'id' | 'createdAt'>): ServerJob {
  const newJob: ServerJob = {
    ...job,
    id: Math.random().toString(36).slice(2, 10),
    createdAt: new Date().toISOString(),
  }
  const existing = readJobs()
  writeJobs([newJob, ...existing].slice(0, MAX_JOBS))
  return newJob
}
