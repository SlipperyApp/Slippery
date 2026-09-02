import type { Metadata } from 'next';
import { Steps } from '@/components/auth/Steps';
import { UnitPicker } from '@/components/auth/UnitPicker';

export const metadata: Metadata = {
  title: 'Pick your unit',
  description: 'One unit is one normal bet. Every league and every comparison is in units, so a bigger balance is not a bigger score.',
  alternates: { canonical: '/signup/unit' },
  robots: { index: false, follow: true },
};

export default function UnitStep() {
  return (
    <>
      <Steps current={4} />
      <h1>Pick your unit</h1>
      <p className="muted" style={{ marginTop: 'var(--s2)' }}>
        One unit is one normal bet for you. Groups rank in units, never in pounds, so a bigger
        balance is not a bigger score.
      </p>
      <div style={{ marginTop: 'var(--s6)' }}><UnitPicker /></div>
    </>
  );
}
