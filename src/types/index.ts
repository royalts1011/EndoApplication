export interface ImageResult {
  title: string
  summary?: string
  prompt: string
  imageUrl: string
  index: number
}

export type ImageProvider = 'gemini' | 'pollinations' | 'imagen3'

export interface ArticleInfo {
  title: string
  url: string
  excerpt: string
}
