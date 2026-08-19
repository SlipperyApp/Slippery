import type { Metadata, Viewport } from 'next';
import { IconSprite } from '@/components/IconSprite';
import './proto.css';

export const metadata: Metadata = {
  title: 'Slippery',
  description:
    'A bet tracker for UK and Irish bettors. Capture the slip when you place it, not when it wins.',
  applicationName: 'Slippery',
  other: { 'format-detection': 'telephone=no' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0A0F1E',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" data-t="periwinkle">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* The prototype names Schibsted Grotesk and Spline Sans Mono in its
            font stacks but only ever loads Poppins, so on any machine without
            them installed it silently fell back to the system sans and the
            tabular figures in the ledger stopped lining up. Loading all three
            is the fix; it is the one prototype bug worth naming. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@700;800&family=Schibsted+Grotesk:wght@400;500;600;700;800&family=Spline+Sans+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body data-t="periwinkle">
        <IconSprite />
        {children}
      </body>
    </html>
  );
}
