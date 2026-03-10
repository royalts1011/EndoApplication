'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ImageResultCard } from '@/components/ImageResultCard'
import { Button } from '@/components/ui/button'
import { downloadAllAsZip } from '@/lib/download'
import { toast } from 'sonner'
import type { ImageResult } from '@/types'

interface ServerJob {
  id: string
  titles: string[]
  summaries: string[]
  prompts: string[]
  imageUrls: string[]
  seriesConcept: string
  createdAt: string
}

export default function HistoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [job, setJob] = useState<ServerJob | null | undefined>(undefined)

  useEffect(() => {
    fetch(`/api/history/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setJob(data?.job ?? null))
      .catch(() => setJob(null))
  }, [id])

  if (job === undefined) return null

  if (!job) {
    return (
      <div className="space-y-4">
        <Link href="/history" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to history
        </Link>
        <p className="text-muted-foreground">Job not found.</p>
      </div>
    )
  }

  const results: ImageResult[] = job.titles.map((title, i) => ({
    title,
    summary: job.summaries?.[i] ?? '',
    prompt: job.prompts[i] ?? '',
    imageUrl: job.imageUrls[i] ?? '',
    index: i,
  }))

  async function handleBulkDownload() {
    toast.info('Preparing ZIP…')
    try {
      await downloadAllAsZip(
        results.map((r, i) => ({ url: r.imageUrl, filename: `endo-health-header-${i + 1}.png` }))
      )
      toast.success('ZIP downloaded')
    } catch {
      toast.error('Bulk download failed')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/history" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to history
        </Link>
        <span className="text-xs text-muted-foreground font-mono">{job.id}</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {results.length} header{results.length !== 1 ? 's' : ''}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {new Date(job.createdAt).toLocaleString()}
        </p>
      </div>

      {job.seriesConcept && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-4">
          <p className="text-xs font-mono text-primary/70 uppercase tracking-widest mb-1">
            Visual DNA
          </p>
          <p className="text-sm text-foreground/80 leading-relaxed">{job.seriesConcept}</p>
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="outline" onClick={handleBulkDownload}>
          Download all as ZIP
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {results.map((result) => (
          <ImageResultCard
            key={result.index}
            result={result}
            onRegenerate={() => {}}
            isRegenerating={false}
          />
        ))}
      </div>
    </div>
  )
}
