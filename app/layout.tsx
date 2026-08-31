import type { Metadata, Viewport } from 'next';
import { Background } from '@/components/Background';
import { ThemeBoot } from '@/components/ThemeBoot';
import { ThemeProvider } from '@/components/ThemeProvider';
import './globals.css';

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://slippery-iota.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: {
    default: 'Slippery, a bet tracker that captures at placement',
    template: '%s · Slippery',
  },
  description:
    'Forward a bookmaker slip the moment you place it. Slippery reads it, settles it and reports what your record actually says. For UK and Irish bettors.',
  applicationName: 'Slippery',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    type: 'website',
    siteName: 'Slippery',
    locale: 'en_GB',
    images: [{ url: '/og?title=Slippery', width: 1200, height: 630, alt: 'Slippery' }],
  },
  twitter: { card: 'summary_large_image' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0A0A0B',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" data-theme="carbon" suppressHydrationWarning>
      <head>
        <ThemeBoot />
      </head>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <Background />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
