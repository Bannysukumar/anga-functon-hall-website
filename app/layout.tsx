import type { Metadata } from 'next'
import { Playfair_Display, Poppins } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/lib/hooks/use-auth'
import './globals.css'

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
})

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
})

export const metadata: Metadata = {
  title: 'Anga Function Hall | Luxury Hotel & Venue Booking',
  description: 'Luxury hotel booking platform for premium rooms, halls, dormitory beds and curated hospitality experiences.',
  generator: 'v0.app',
}

export const viewport = {
  themeColor: '#1e160f',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const enableVercelAnalytics = process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS === "true"

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-ZJ80YKPWHG" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-ZJ80YKPWHG');
            `,
          }}
        />
      </head>
      <body className={`${playfairDisplay.variable} ${poppins.variable} font-sans antialiased luxury-bg`}>
        <AuthProvider>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
        {enableVercelAnalytics ? <Analytics /> : null}
      </body>
    </html>
  )
}
