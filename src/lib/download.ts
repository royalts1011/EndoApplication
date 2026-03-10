/**
 * Image download utilities for single and bulk (ZIP) downloads.
 */
import JSZip from 'jszip'

/**
 * Download a single image as PNG.
 * Works with both direct URLs and base64 data URLs.
 */
export async function downloadImage(url: string, filename: string): Promise<void> {
  let blob: Blob

  if (url.startsWith('data:')) {
    // base64 data URL (e.g. from Imagen 3)
    const res = await fetch(url)
    blob = await res.blob()
  } else {
    // Remote URL — fetch via proxy to avoid CORS issues
    const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`)
    if (!res.ok) throw new Error('Failed to fetch image')
    blob = await res.blob()
  }

  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(objectUrl)
}

/**
 * Download multiple images as a ZIP file.
 */
export async function downloadAllAsZip(
  images: { url: string; filename: string }[]
): Promise<void> {
  const zip = new JSZip()
  const folder = zip.folder('endo-health-headers')!

  await Promise.all(
    images.map(async ({ url, filename }) => {
      let blob: Blob
      if (url.startsWith('data:')) {
        const res = await fetch(url)
        blob = await res.blob()
      } else {
        const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`)
        if (!res.ok) return
        blob = await res.blob()
      }
      folder.file(filename, blob)
    })
  )

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const objectUrl = URL.createObjectURL(zipBlob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = 'endo-health-headers.zip'
  a.click()
  URL.revokeObjectURL(objectUrl)
}
