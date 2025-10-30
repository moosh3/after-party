import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'After Party',
  description: 'Live streaming event platform - Watch together, chat, and participate in polls',
  icons: {
    icon: '/assets/logos/alecmklogo.png',
    shortcut: '/assets/logos/alecmklogo.png',
    apple: '/assets/logos/alecmklogo.png',
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

