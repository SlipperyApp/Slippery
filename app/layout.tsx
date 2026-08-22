import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { IconSprite } from '@/components/IconSprite';
import './fonts.css';
import './proto.css';

export const metadata: Metadata = {
  /* 24 · THE GROWTH LOOP IS INVITE LINKS AND A TELEGRAM BOT, and neither of
     them had a card. A link pasted into a group chat rendered as a bare URL.
     metadataBase is required or Next emits relative og:image URLs, which
     every scraper ignores. */
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://slippery-iota.vercel.app'),
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
  openGraph: {
    type: 'website',
    siteName: 'Slippery',
    title: 'Slippery — don\u2019t let your profit slip',
    description:
      'Forward a slip when you place it. Slippery reads it, tracks it live, settles it, and shows what your record actually says.',
    locale: 'en_GB',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Slippery' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Slippery — don\u2019t let your profit slip',
    description: 'Capture the bet when you place it, not when it wins.',
    images: ['/og.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  /* Carbon's --bg is #0C0E13; the status bar was sitting a shade off it. */
  themeColor: '#0C0E13',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  /* Handed to Next so its own bootstrap scripts carry the nonce the policy
     in middleware.ts requires. */
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="en-GB" data-t="carbon">
      <head>
        {/* 24 · THE THEME FLASHED CARBON ON EVERY COLD LOAD.
            data-t is written server side with no idea what the visitor
            chose, so seven of the eight themes painted the wrong one and
            then corrected. This runs before first paint and is deliberately
            tiny and synchronous — anything async is too late by definition. */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('slippery.theme');" +
              "if(t){document.documentElement.dataset.t=t;" +
              "var m=document.querySelector('meta[name=theme-color]');" +
              "if(m)m.content=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()||m.content;}}catch(e){}",
          }}
        />
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
            /* Deferred to after load so it does not compete with first
               paint. The tombstone still reaches everybody; it just stops
               being the thing holding up the first frame. */
            __html:
              `addEventListener('load',function(){if('serviceWorker' in navigator){` +
              `navigator.serviceWorker.register('/sw.js').catch(function(){})}})`,
          }}
        />
      </body>
    </html>
  );
}
