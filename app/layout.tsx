import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Event Streaming Platform',
  description: 'Private event streaming platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

