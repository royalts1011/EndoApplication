import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Link from 'next/link'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Endo Health — Header Generator',
  description: 'Generate brand-consistent blog header images for Endo Health',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        {/* ── Top nav ── */}
        <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link
              href="/"
              className="font-semibold text-lg tracking-tight hover:text-primary transition-colors"
            >
              <span className="text-primary">Endo</span> Health
              <span className="text-muted-foreground font-mono text-sm ml-2 font-normal">
                header gen
              </span>
            </Link>
            <nav className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link
                href="/"
                className="hover:text-foreground transition-colors"
              >
                Generate
              </Link>
              <Link
                href="/history"
                className="hover:text-foreground transition-colors"
              >
                History
              </Link>
              <Link
                href="/settings"
                className="hover:text-foreground transition-colors"
              >
                Settings
              </Link>
            </nav>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>

        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  )
}
