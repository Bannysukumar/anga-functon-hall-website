import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/lib/hooks/use-auth'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Anga Function Hall - Book Premium Venues & Services',
  description: 'Book function halls, rooms, dormitories, dining halls and more. Instant availability, secure payments, and hassle-free booking experience.',
  generator: 'v0.app',
}

export const viewport = {
  themeColor: '#3b5fc0',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <AuthProvider>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
