import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your ledger. A reset link is one tap away and does not go through the attempt limit.',
  alternates: { canonical: '/login' },
};

export default async function Login({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const reset = sp.reset === '1';
  return (
    <>
      <h1>Sign in</h1>
      <p className="muted" style={{ marginTop: 'var(--s2)' }}>
        Your ledger is where you left it.
      </p>
      <div style={{ marginTop: 'var(--s6)' }}><LoginForm startWithReset={reset} /></div>
      <p className="small muted" style={{ marginTop: 'var(--s6)' }}>
        No account yet? <Link href="/signup">Start free</Link>. Or{' '}
        <Link href="/app">look at the example account</Link> without one.
      </p>
    </>
  );
}
