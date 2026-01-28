import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Da Movies',
  description: "Alec and Mary Kate's Movie Marathon",
  icons: {
    icon: '/assets/logos/alecmklogo.png',
    shortcut: '/assets/logos/alecmklogo.png',
    apple: '/assets/logos/alecmklogo.png',
  },
  openGraph: {
    title: 'Da Movies',
    description: "Alec and Mary Kate's Movie Marathon",
    images: ['/assets/images/banner.jpeg'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Da Movies',
    description: "Alec and Mary Kate's Movie Marathon",
    images: ['/assets/images/banner.jpeg'],
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
