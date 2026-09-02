import type { Metadata } from 'next';
import Link from 'next/link';
import { Steps } from '@/components/auth/Steps';
import { SignupForm } from '@/components/auth/SignupForm';
import { TRIAL_DAYS, TRIAL_SLIPS } from '@/lib/domain/trial';

export const metadata: Metadata = {
  title: 'Create your account',
  description: `Start free for ${TRIAL_DAYS} days or ${TRIAL_SLIPS} slips, whichever runs out first.`,
  alternates: { canonical: '/signup' },
  robots: { index: true, follow: true },
};

/*  Rendered per request, and the reason is in components/auth/useDraft.ts:
    the form is filled from the address, a client hook reading the address on
    a prerendered page has to sit behind a Suspense boundary, and a boundary
    around the form means the prerendered HTML is a spinner where the form
    should be. */
export const dynamic = 'force-dynamic';

export default function Signup() {
  return (
    <>
      <Steps current={1} />
      <h1>Create your account</h1>
      <p className="muted" style={{ marginTop: 'var(--s2)' }}>
        Free for {TRIAL_DAYS} days or {TRIAL_SLIPS} slips, whichever runs out first.
      </p>
      <div style={{ marginTop: 'var(--s6)' }}>
        <SignupForm />
      </div>
      <p className="small muted" style={{ marginTop: 'var(--s6)' }}>
        Already have an account? <Link href="/login">Sign in</Link>.
      </p>
    </>
  );
}
