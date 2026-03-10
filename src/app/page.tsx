'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ImageResultCard } from '@/components/ImageResultCard'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { downloadAllAsZip } from '@/lib/download'
import { saveLastSession, loadLastSession } from '@/lib/local-history'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ArticleInfo, ImageResult } from '@/types'

const IMAGE_MODELS = [
  { value: 'gemini-3.1-flash-image-preview', label: 'Gemini 3.1 Flash Image', description: 'Fast & good quality' },
  { value: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image', description: 'Highest quality' },
] as const

type ImageModelValue = typeof IMAGE_MODELS[number]['value']

export default function HomePage() {
  const [titlesInput, setTitlesInput] = useState('')
  const [fetchedArticles, setFetchedArticles] = useState<ArticleInfo[]>([])
  const [results, setResults] = useState<ImageResult[]>([])
  const [seriesConcept, setSeriesConcept] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [isFetchingTitles, setIsFetchingTitles] = useState(false)
  const [imageModel, setImageModel] = useState<ImageModelValue>('gemini-3.1-flash-image-preview')


  // Restore last session on mount
  useEffect(() => {
    const session = loadLastSession<{ titlesInput: string; results: ImageResult[]; seriesConcept: string }>()
    if (session) {
      if (session.titlesInput) setTitlesInput(session.titlesInput)
      if (session.results?.length) setResults(session.results)
      if (session.seriesConcept) setSeriesConcept(session.seriesConcept)
    }
  }, [])

  const titles = titlesInput
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)

  async function handleFetchFromWebsite() {
    setIsFetchingTitles(true)
    try {
      const res = await fetch('/api/fetch-titles')
      if (!res.ok) throw new Error()
      const data = await res.json()
      const articles: ArticleInfo[] = data.articles ?? []
      if (!articles.length) throw new Error('No articles found')
      setFetchedArticles(articles)
      setTitlesInput(articles.map((a) => a.title).join('\n'))
      const withContent = articles.filter((a) => a.excerpt).length
      toast.success(
        `Fetched ${articles.length} articles from endometriose.app` +
        (withContent ? ` (${withContent} with content)` : '')
      )
    } catch {
      toast.error('Could not fetch articles from the website')
    } finally {
      setIsFetchingTitles(false)
    }
  }

  async function handleGenerate() {
    if (titles.length === 0) {
      toast.error('Please enter at least one blog title')
      return
    }
    setIsLoading(true)
    setResults([])
    setSeriesConcept('')

    const fetchedTitles = fetchedArticles.map((a) => a.title)
    const articlesMatch =
      fetchedArticles.length === titles.length &&
      titles.every((t, i) => t === fetchedTitles[i])

    const brandGuide = localStorage.getItem('endo_health_brand_guide') ?? undefined

    const body = articlesMatch
      ? { articles: fetchedArticles, imageModel, brandGuide }
      : { titles, imageModel, brandGuide }

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Generation failed')
      }
      const data = await res.json()
      setCurrentJobId(data.jobId)
      const seriesConceptValue = data.seriesConcept ?? ''
      const newResults = titles.map((title, i) => ({
        title,
        summary: data.summaries?.[i] ?? '',
        prompt: data.prompts[i] ?? '',
        imageUrl: data.imageUrls[i] ?? '',
        index: i,
      }))
      setSeriesConcept(seriesConceptValue)
      setResults(newResults)

      saveLastSession({ titlesInput, results: newResults, seriesConcept: seriesConceptValue })

      toast.success(`Generated ${titles.length} header${titles.length > 1 ? 's' : ''}`)
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleRegenerate(index: number) {
    const title = results[index]?.title
    if (!title) return
    setRegeneratingIndex(index)
    try {
      const promptRes = await fetch('/api/generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titles: [title],
          seriesContext: seriesConcept,
        }),
      })
      if (!promptRes.ok) throw new Error()
      const { prompts } = await promptRes.json()

      const imgRes = await fetch('/api/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompts, model: imageModel }),
      })
      if (!imgRes.ok) throw new Error()
      const { imageUrls } = await imgRes.json()

      setResults((prev) =>
        prev.map((r) =>
          r.index === index
            ? { ...r, prompt: prompts[0], imageUrl: imageUrls[0] }
            : r
        )
      )
      toast.success('Image regenerated')
    } catch {
      toast.error('Regeneration failed')
    } finally {
      setRegeneratingIndex(null)
    }
  }

  async function handleBulkDownload() {
    if (results.length === 0) return
    toast.info('Preparing ZIP…')
    try {
      await downloadAllAsZip(
        results.map((r, i) => ({
          url: r.imageUrl,
          filename: `endo-health-header-${i + 1}.png`,
        }))
      )
      toast.success('ZIP downloaded')
    } catch {
      toast.error('Bulk download failed')
    }
  }


  const hasArticleContext = fetchedArticles.length > 0 &&
    fetchedArticles.length === titles.length &&
    fetchedArticles.every((a, i) => a.title === titles[i])

  const selectedModel = IMAGE_MODELS.find((m) => m.value === imageModel)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Blog Header Generator
        </h1>
        <p className="text-muted-foreground mt-1">
          AI establishes a shared visual style across all headers, grounded in each article&apos;s actual content.
        </p>
      </div>

      {/* ── Input panel ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Blog titles</label>
            {hasArticleContext && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">
                + article content
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button
              onClick={handleFetchFromWebsite}
              disabled={isFetchingTitles}
              className="text-primary hover:underline cursor-pointer disabled:opacity-50"
            >
              {isFetchingTitles ? 'Fetching…' : 'Fetch from endometriose.app'}
            </button>
          </div>
        </div>

        <Textarea
          placeholder={
            '10 Tips for Managing Endometriosis Pain\nUnderstanding Hormonal Cycles\nHow to Talk to Your Doctor About Endo'
          }
          value={titlesInput}
          onChange={(e) => {
            setTitlesInput(e.target.value)
            setFetchedArticles([])
          }}
          rows={6}
          className="font-mono text-sm resize-y"
        />

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {titles.length} title{titles.length !== 1 ? 's' : ''} · one per line
            {hasArticleContext && ' · article content loaded'}
          </p>
          <div className="flex items-center gap-2">
            {results.length > 0 && (
              <Button variant="outline" onClick={handleBulkDownload}>
                Download all as ZIP
              </Button>
            )}

            {/* Model selector */}
            <Select value={imageModel} onValueChange={(v) => setImageModel(v as ImageModelValue)}>
              <SelectTrigger className="w-52">
                <SelectValue>
                  {selectedModel?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {IMAGE_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    <div>
                      <p className="font-medium text-sm">{m.label}</p>
                      <p className="text-xs text-muted-foreground">{m.description}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={handleGenerate}
              disabled={isLoading || titles.length === 0}
              className="min-w-36"
            >
              {isLoading ? 'Generating…' : 'Generate Headers'}
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {/* ── Loading skeletons ── */}
      {isLoading && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-muted/40 px-5 py-4 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {titles.map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[1200/630] w-full rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {!isLoading && results.length > 0 && (
        <div className="space-y-6">
          {seriesConcept && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-4">
              <p className="text-xs font-mono text-primary/70 uppercase tracking-widest mb-1">
                Visual DNA
              </p>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {seriesConcept}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {results.length} header{results.length !== 1 ? 's' : ''} generated
            </h2>
            {currentJobId && (
              <span className="text-xs text-muted-foreground font-mono">
                job: {currentJobId}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {results.map((result) => (
              <ImageResultCard
                key={result.index}
                result={result}
                onRegenerate={handleRegenerate}
                isRegenerating={regeneratingIndex === result.index}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && results.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-4">✦</p>
          <p>Enter blog titles above and click Generate to get started.</p>
        </div>
      )}
    </div>
  )
}
