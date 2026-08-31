import type { Metadata } from 'next';
import { Steps } from '@/components/auth/Steps';
import { PlanPicker } from '@/components/auth/PlanPicker';
import { has } from '@/lib/server/env';

export const metadata: Metadata = {
  title: 'Pick a plan',
  description: 'Today £0.00. The yearly plan starts automatically when the trial ends, and there is deliberately no reminder email.',
  alternates: { canonical: '/signup/plan' },
  robots: { index: false, follow: true },
};

export default function PlanStep() {
  const stripeReady = has('STRIPE_SECRET_KEY') && has('STRIPE_PRICE_MONTHLY') && has('STRIPE_PRICE_YEARLY');
  return (
    <>
      <Steps current={6} />
      <h1>Pick a plan</h1>
      <p className="muted" style={{ marginTop: 'var(--s2)' }}>
        A card is needed to start, and nothing is taken today.
      </p>
      <div style={{ marginTop: 'var(--s6)' }}><PlanPicker stripeReady={stripeReady} /></div>
    </>
  );
}
