'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { DEFAULT_BRAND_STYLE_GUIDE } from '@/lib/brand'

export default function SettingsPage() {
  const [brandGuide, setBrandGuide] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [provider, setProvider] = useState<string>('—')

  const LOCAL_KEY = 'endo_health_brand_guide'

  // Load current brand guide from Firestore (via API) or localStorage fallback
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        // If Firebase returned the default, check if user has a local override
        const local = localStorage.getItem(LOCAL_KEY)
        setBrandGuide(local ?? data.text ?? DEFAULT_BRAND_STYLE_GUIDE)
      })
      .catch(() => {
        const local = localStorage.getItem(LOCAL_KEY)
        setBrandGuide(local ?? DEFAULT_BRAND_STYLE_GUIDE)
      })
      .finally(() => setIsLoading(false))

    // Show which provider is active (read-only — set via .env)
    fetch('/api/settings/provider')
      .then((r) => r.json())
      .then((d) => setProvider(d.provider ?? '—'))
      .catch(() => {})
  }, [])

  async function handleSave() {
    setIsSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: brandGuide }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error()
      // Always persist locally so edits survive page reload
      localStorage.setItem(LOCAL_KEY, brandGuide)
      toast.success(data.local ? 'Brand guide saved locally' : 'Brand guide saved')
    } catch {
      toast.error('Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  function handleReset() {
    setBrandGuide(DEFAULT_BRAND_STYLE_GUIDE)
    toast.info('Reset to default — click Save to apply')
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure the brand style guide sent to Claude when generating prompts.
        </p>
      </div>

      {/* Provider info */}
      <div className="flex items-center gap-3 p-4 rounded-xl border bg-muted/40">
        <div className="space-y-1">
          <p className="text-sm font-medium">Image provider</p>
          <p className="text-xs text-muted-foreground">
            Set via <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">IMAGE_PROVIDER</code> in <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">.env.local</code>
          </p>
        </div>
        <Badge variant="outline" className="ml-auto font-mono">
          {provider}
        </Badge>
      </div>

      <Separator />

      {/* Brand guide editor */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Brand style guide</label>
          <button
            onClick={handleReset}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Reset to default
          </button>
        </div>

        <Textarea
          value={isLoading ? 'Loading…' : brandGuide}
          onChange={(e) => setBrandGuide(e.target.value)}
          disabled={isLoading}
          rows={24}
          className="font-mono text-sm resize-y"
        />

        <p className="text-xs text-muted-foreground">
          This text is sent as the system prompt to Claude. Changes are saved to Firestore and shared across sessions.
        </p>

        <Button onClick={handleSave} disabled={isSaving || isLoading}>
          {isSaving ? 'Saving…' : 'Save brand guide'}
        </Button>
      </div>
    </div>
  )
}
