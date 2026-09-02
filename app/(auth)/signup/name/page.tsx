import type { Metadata } from 'next';
import { Steps } from '@/components/auth/Steps';
import { NameForm } from '@/components/auth/NameForm';

export const metadata: Metadata = {
  title: 'What other Slippers see',
  description: 'Your display name and handle, plus a referral code if somebody gave you one.',
  alternates: { canonical: '/signup/name' },
  robots: { index: false, follow: true },
};

/*  Rendered per request, and the reason is in components/auth/useDraft.ts:
    the form is filled from the address, a client hook reading the address on
    a prerendered page has to sit behind a Suspense boundary, and a boundary
    around the form means the prerendered HTML is a spinner where the form
    should be. */
export const dynamic = 'force-dynamic';

export default function NameStep() {
  return (
    <>
      <Steps current={3} />
      <h1>What other Slippers see</h1>
      <p className="muted" style={{ marginTop: 'var(--s2)' }}>
        Your name and handle appear in groups you join. Your stakes never do, only your units.
      </p>
      <div style={{ marginTop: 'var(--s6)' }}><NameForm /></div>
    </>
  );
}
