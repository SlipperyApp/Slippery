import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { getViewer } from '@/lib/data/session';
import { visionKey, has } from '@/lib/server/env';
import { Dropzone } from '@/components/app/Dropzone';

export const metadata: Metadata = {
  title: 'Add a bet',
  description: 'Forward it, upload it, photograph it or type it in. Four ways in, one ledger.',
};

const WAYS = [
  { href: '/app/import/linked', t: 'Forward it to the bot', s: 'Telegram, straight from the bookmaker app. The fastest of the four.', i: 'telegram' as const },
  { href: '/app/import/manual', t: 'Type it in', s: 'Singles through to a Lucky 63, legs and all.', i: 'edit' as const },
  { href: '/app/import/history', t: 'Import a history', s: 'A CSV from a spreadsheet or another tracker. Dry run first.', i: 'upload' as const },
  { href: '/app/import/review', t: 'See the last read', s: 'The confirm screen, with what the reader found on each field.', i: 'eye' as const },
];

export default async function ImportHome() {
  const { trial, readOnly } = await getViewer();
  const readerReady = Boolean(visionKey());

  return (
    <>
      <h1>Add a bet</h1>
      <p className="muted" style={{ marginTop: 'var(--s2)', maxWidth: '58ch' }}>
        Capture at placement. A record made before you know how it went cannot quietly become only
        the bets you wanted to remember.
      </p>

      {readOnly ? (
        <div className="banner banner--neg" style={{ marginTop: 'var(--s5)' }}>
          <Icon name="lock" size={18} className="banner__icon" />
          <span>
            New slips are paused while the account is read only. The ledger and the export are
            fully live. <Link href="/app/billing/declined">Fix the card</Link>.
          </span>
        </div>
      ) : null}

      {!readerReady ? (
        <div className="banner" style={{ marginTop: 'var(--s5)' }}>
          <Icon name="alert" size={18} className="banner__icon" />
          <span>
            Slip reading is down on this deployment, so an upload would go nowhere. Typing a bet in
            still works and so does an import. <Link href="/api/sources">What this deployment has</Link>.
          </span>
        </div>
      ) : null}

      <div style={{ marginTop: 'var(--s5)' }}>
        <Dropzone enabled={readerReady && !readOnly} />
      </div>

      <div className="grid" style={{ marginTop: 'var(--s5)' }}>
        {WAYS.map((w) => (
          <Link key={w.href} href={w.href} className="card col-6" style={{ textDecoration: 'none' }}>
            <span className="spread">
              <span className="card__title">{w.t}</span>
              <Icon name={w.i} size={20} style={{ color: 'var(--accent)' }} />
            </span>
            <span className="small muted" style={{ display: 'block', marginTop: 'var(--s2)' }}>{w.s}</span>
          </Link>
        ))}
      </div>

      <div className="card" style={{ marginTop: 'var(--s5)' }}>
        <p className="label">Your trial</p>
        <p className="fig fig--m" style={{ marginTop: 4 }}>
          {trial.active ? `${trial.slipsLeft} slips left` : 'Trial over'}
        </p>
        <p className="small muted" style={{ marginTop: 'var(--s2)' }}>{trial.message}</p>
        <div className="meter" style={{ marginTop: 'var(--s3)' }}>
          <span
            className="meter__fill"
            style={{ width: `${Math.round((trial.slipsUsed / Math.max(1, trial.slipsAllowed)) * 100)}%` }}
          />
        </div>
        <p className="small dim card__foot">
          Whichever runs out first is what stops an upload.
        </p>
      </div>
    </>
  );
}
