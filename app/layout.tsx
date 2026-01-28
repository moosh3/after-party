import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Da Movies',
  description: "Alec and Mary Kate's Movie Marathon",
  icons: {
    icon: '/assets/logos/icon.jpg',
    shortcut: '/assets/logos/icon.jpg',
    apple: '/assets/logos/icon.jpg',
  },
  openGraph: {
    title: 'Da Movies',
    description: "Alec and Mary Kate's Movie Marathon",
    images: ['/assets/images/title-card.jpeg'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Da Movies',
    description: "Alec and Mary Kate's Movie Marathon",
    images: ['/assets/images/title-card.jpeg'],
  },
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
