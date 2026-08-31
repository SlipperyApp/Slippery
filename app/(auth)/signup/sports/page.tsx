import type { Metadata } from 'next';
import { Steps } from '@/components/auth/Steps';
import { SportsPicker } from '@/components/auth/SportsPicker';

export const metadata: Metadata = {
  title: 'Sports and bookmakers',
  description: 'Football, tennis and horse racing, and the bookmakers you actually use, grouped the way their slips are laid out.',
  alternates: { canonical: '/signup/sports' },
  robots: { index: false, follow: true },
};

export default function SportsStep() {
  return (
    <>
      <Steps current={5} />
      <h1>Sports and bookmakers</h1>
      <p className="muted" style={{ marginTop: 'var(--s2)' }}>
        The reader picks a bookmaker template before it parses a slip, so telling it which books you
        use makes it better at reading yours.
      </p>
      <div style={{ marginTop: 'var(--s6)' }}><SportsPicker /></div>
    </>
  );
}
