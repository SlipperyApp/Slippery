import type { Metadata } from 'next';
import Link from 'next/link';
import { Steps } from '@/components/auth/Steps';
import { VerifyForm } from '@/components/auth/VerifyForm';
import { Icon } from '@/components/Icon';
import { canSendEmail } from '@/lib/server/mail';

export const metadata: Metadata = {
  title: 'Check your email',
  description: 'A six digit code, on its own screen, with resend and a way to change the address.',
  alternates: { canonical: '/signup/verify' },
  robots: { index: false, follow: true },
};

/** The screen that says a code is on its way.
 *
 *  It said that on every deployment, including the ones with no email
 *  configured, where the code is generated, hashed, stored and never sent.
 *  So a visitor to production sat on a screen that was lying to them, waiting
 *  for something nobody had sent, with a resend button that would not send it
 *  either.
 *
 *  Every other integration in this product degrades honestly and says which
 *  variable is missing. This one is the first screen a new account sees, so
 *  it is the worst place in the product to be the exception. */
export default async function Verify({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const email = typeof sp.email === 'string' ? sp.email : '';
  const sending = canSendEmail();

  return (
    <>
      <Steps current={2} />
      <h1>{sending ? 'Check your email' : 'No code was sent'}</h1>

      {sending ? (
        <>
          <p className="muted" style={{ marginTop: 'var(--s2)' }}>
            A six digit code is on its way{email ? <> to <span className="mono">{email}</span></> : null}. It
            is good for ten minutes and can be used once.
          </p>
          <p className="small dim" style={{ marginTop: 'var(--s3)' }}>
            The code is stored only as a hash and never written to a log. If it does not arrive,
            check the spam folder.
          </p>
        </>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 'var(--s2)' }}>
            Email is not configured on this deployment, so nothing was sent
            {email ? <> to <span className="mono">{email}</span></> : null}. Your code exists and is
            waiting, and there is no way to read it to you from here.
          </p>
          <div className="banner" style={{ marginTop: 'var(--s4)' }}>
            <Icon name="alert" size={18} className="banner__icon" />
            <span>
              Nothing has been charged and no plan has started.{' '}
              <Link href="/api/sources">What this deployment has</Link>.
            </span>
          </div>
        </>
      )}

      <div style={{ marginTop: 'var(--s6)' }}>
        <VerifyForm email={email} />
      </div>
    </>
  );
}
