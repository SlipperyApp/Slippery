import type { Metadata } from 'next';
import { Steps } from '@/components/auth/Steps';
import { UnitPicker } from '@/components/auth/UnitPicker';

export const metadata: Metadata = {
  title: 'Pick your unit',
  description: 'One unit is one normal bet. Every league and every comparison is in units, so a bigger balance is not a bigger score.',
  alternates: { canonical: '/signup/unit' },
  robots: { index: false, follow: true },
};

/*  Rendered per request, and the reason is in components/auth/useDraft.ts:
    the form is filled from the address, a client hook reading the address on
    a prerendered page has to sit behind a Suspense boundary, and a boundary
    around the form means the prerendered HTML is a spinner where the form
    should be. */
export const dynamic = 'force-dynamic';

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
