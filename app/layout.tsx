import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { IconSprite } from '@/components/IconSprite';
import './fonts.css';
import './proto.css';

export const metadata: Metadata = {
  title: 'Slippery',
  description:
    'A bet tracker for UK and Irish bettors. Capture the slip when you place it, not when it wins.',
  applicationName: 'Slippery',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  /* A number in the ledger is a number, not a phone number for iOS Safari to
     turn into a tappable link with its own colour. */
  other: { 'format-detection': 'telephone=no' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0A0C10',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  /* Handed to Next so its own bootstrap scripts carry the nonce the policy
     in middleware.ts requires. */
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="en-GB" data-t="carbon">
      <head>
        {/* No third-party font host. The faces are served from this origin,
            so the policy does not have to allow one and a blocked CDN cannot
            drop the app into a fallback face, which is what stops the ledger's
            tabular figures lining up. */}
        <link rel="preload" href="/fonts/SchibstedGrotesk-400-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/SourceSerif4-400-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/GeistMono-400-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body data-t="carbon">
        <IconSprite />
        {children}
        {/* The tombstone worker at /sw.js unregisters the cache-first worker
            the previous build installed. Registering it is what reaches the
            people who still have the old one. */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(function(){})}`,
          }}
        />
      </body>
    </html>
  );
}
