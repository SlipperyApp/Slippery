import type { Metadata } from 'next';
import { Steps } from '@/components/auth/Steps';
import { VerifyForm } from '@/components/auth/VerifyForm';

export const metadata: Metadata = {
  title: 'Check your email',
  description: 'A six digit code, on its own screen, with resend and a way to change the address.',
  alternates: { canonical: '/signup/verify' },
  robots: { index: false, follow: true },
};

export default async function Verify({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const email = typeof sp.email === 'string' ? sp.email : '';
  return (
    <>
      <Steps current={2} />
      <h1>Check your email</h1>
      <p className="muted" style={{ marginTop: 'var(--s2)' }}>
        A six digit code is on its way{email ? <> to <span className="mono">{email}</span></> : null}. It
        is good for ten minutes and can be used once.
      </p>
      <p className="small dim" style={{ marginTop: 'var(--s3)' }}>
        The code is stored only as a hash and never written to a log. If it does not arrive, check the spam folder.
      </p>
      <div style={{ marginTop: 'var(--s6)' }}>
        <VerifyForm email={email} />
      </div>
    </>
  );
}
