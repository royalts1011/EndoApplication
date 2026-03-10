'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'

interface Job {
  id: string
  titles: string[]
  imageUrls: string[]
  createdAt: string
}

export default function HistoryPage() {
  const [jobs, setJobs] = useState<Job[] | null>(null)

  useEffect(() => {
    fetch('/api/history')
      .then((r) => r.json())
      .then((data) => setJobs(data.jobs ?? []))
      .catch(() => setJobs([]))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">History</h1>
        <p className="text-muted-foreground mt-1">Your last 50 generation jobs.</p>
      </div>

      {jobs === null && (
        <div className="text-muted-foreground text-sm">Loading…</div>
      )}

      {jobs !== null && jobs.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-4">✦</p>
          <p>
            No history yet.{' '}
            <Link href="/" className="text-primary hover:underline">
              Generate your first headers.
            </Link>
          </p>
        </div>
      )}

      {jobs !== null && jobs.length > 0 && (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Link key={job.id} href={`/history/${job.id}`} className="block">
              <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-start gap-4">
                  {job.imageUrls.length > 0 && (
                    <div className="flex gap-1 shrink-0">
                      {job.imageUrls.slice(0, 3).map((url, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={url} alt="" className="w-20 h-11 object-cover rounded-md bg-muted" />
                      ))}
                      {job.imageUrls.length > 3 && (
                        <div className="w-20 h-11 rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground font-mono">
                          +{job.imageUrls.length - 3}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    <span className="text-xs text-muted-foreground font-mono">
                      {new Date(job.createdAt).toLocaleString()}
                    </span>
                    <p className="text-sm font-medium truncate">{job.titles.join(' · ')}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.titles.length} title{job.titles.length !== 1 ? 's' : ''}
                      {job.imageUrls.length > 0 && ` · ${job.imageUrls.length} image${job.imageUrls.length !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono shrink-0">{job.id}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
