'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import type { ImageResult } from '@/types'
import { downloadImage } from '@/lib/download'

interface Props {
  result: ImageResult
  onRegenerate: (index: number) => void
  isRegenerating?: boolean
}

export function ImageResultCard({ result, onRegenerate, isRegenerating }: Props) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)

  async function handleDownload() {
    try {
      await downloadImage(result.imageUrl, `endo-health-header-${result.index + 1}.png`)
      toast.success('Image downloaded')
    } catch {
      toast.error('Download failed')
    }
  }

  async function handleCopyUrl() {
    await navigator.clipboard.writeText(result.imageUrl)
    toast.success('URL copied to clipboard')
  }

  return (
    <Card className="overflow-hidden group">
      {/* Image */}
      <div className="relative aspect-[1200/630] bg-muted">
        {(!imageLoaded || isRegenerating) && !imageError && (
          <Skeleton className="absolute inset-0 rounded-none" />
        )}
        {!isRegenerating && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={result.imageUrl}
            alt={result.title}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              setImageError(true)
              setImageLoaded(true)
            }}
          />
        )}
        {imageError && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            Failed to load image
          </div>
        )}
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Title */}
        <h3 className="font-semibold leading-snug">{result.title}</h3>

        {/* Article summary */}
        {result.summary && (
          <details className="group/details">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none list-none flex items-center gap-1">
              <span className="font-mono">▶</span>
              <span>Article summary</span>
            </summary>
            <p className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-3 leading-relaxed italic">
              {result.summary}
            </p>
          </details>
        )}

        {/* Image prompt */}
        <details className="group/details">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none list-none flex items-center gap-1">
            <span className="font-mono">▶</span>
            <span>View image prompt</span>
          </summary>
          <p className="mt-2 text-xs text-muted-foreground bg-muted rounded-md p-3 leading-relaxed font-mono">
            {result.prompt}
          </p>
        </details>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={handleDownload} disabled={isRegenerating || !imageLoaded}>
            Download PNG
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyUrl}
            disabled={isRegenerating}
          >
            Copy URL
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onRegenerate(result.index)}
            disabled={isRegenerating}
          >
            {isRegenerating ? 'Regenerating…' : 'Regenerate'}
          </Button>
        </div>

        {/* Size badge */}
        <Badge variant="secondary" className="font-mono text-xs">
          1200 × 630 px
        </Badge>
      </CardContent>
    </Card>
  )
}
