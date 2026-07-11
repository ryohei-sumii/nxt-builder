import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { publicEnv } from '@/lib/env.public'

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL),
  title: { default: 'nextjs-builder verify', template: '%s | verify' },
}
export const viewport: Viewport = { themeColor: '#000' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
