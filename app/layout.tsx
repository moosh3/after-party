import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'After Party',
  description: "Alec and Mary Kate's After Party",
  icons: {
    icon: '/assets/logos/alecmklogo.png',
    shortcut: '/assets/logos/alecmklogo.png',
    apple: '/assets/logos/alecmklogo.png',
  },
  openGraph: {
    title: 'After Party',
    description: "Alec and Mary Kate's After Party",
    images: ['/assets/images/event-poster.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'After Party',
    description: "Alec and Mary Kate's After Party",
    images: ['/assets/images/event-poster.png'],
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
