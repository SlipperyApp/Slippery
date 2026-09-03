import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { getViewer } from '@/lib/data/session';
import { visionKey } from '@/lib/server/env';
import { Dropzone } from '@/components/app/Dropzone';

export const metadata: Metadata = {
  title: 'Add a bet',
  description: 'Forward it, upload it, photograph it or type it in. Four ways in, one ledger.',
};

/*  FOUR WAYS IN, AND NONE OF THEM HAS A DEADLINE.
 *
 *  This page opened with "Four ways in. Send it now, while you still do not
 *  know." Slippery reads a slip at any time: the whole of the third card on
 *  this page is bringing in a spreadsheet of bets placed years ago, and the
 *  ledger records, per bet, whether it reached the record before its event
 *  started. That is a fact about a bet. It was being printed here as an
 *  instruction about when a slip may be sent, which is a rule this product
 *  does not have and cannot enforce. */
const WAYS = [
  { href: '/app/import/linked', t: 'Forward it to the bot', s: 'Telegram, straight from the bookmaker app', i: 'telegram' as const },
  { href: '/app/import/manual', t: 'Type it in', s: 'Singles through to a Lucky 63', i: 'edit' as const },
  { href: '/app/import/history', t: 'Import a history', s: 'A CSV from a spreadsheet or another tracker', i: 'upload' as const },
  { href: '/app/import/review', t: 'See the last read', s: 'The confirm screen', i: 'eye' as const },
];

export default async function ImportHome() {
  const { trial, readOnly, slips } = await getViewer();
  const readerReady = Boolean(visionKey());

  return (
    <div className="column column--wide">
      <div className="spread lgr__top">
        <h1>Add a bet</h1>
        {/*  The trial as a line rather than a card with a meter in it. It was
             a full width card carrying a label, a figure, a sentence and a
             progress bar, under four cards, on a screen whose subject is the
             file you are about to choose. */}
        {trial.active ? (
          <p className="small dim">
            {trial.slipsLeft} slips left of {trial.slipsAllowed}. <Link href="/app/settings/plan">Plans</Link>.
          </p>
        ) : (
          <Link href="/app/settings/plan" className="btn btn--ghost btn--sm">See plans</Link>
        )}
      </div>

      {readOnly ? (
        <div className="banner banner--warn" style={{ marginBottom: 'var(--gap-block)' }}>
          <Icon name="lock" size={18} className="banner__icon" />
          <span>
            New slips are paused while the account is read only. The ledger and the export are
            fully live. <Link href="/app/billing/declined">Fix the card</Link>.
          </span>
        </div>
      ) : null}

      {!readerReady ? (
        <div className="banner" style={{ marginBottom: 'var(--gap-block)' }}>
          <Icon name="alert" size={18} className="banner__icon" />
          <span>
            Slip reading is down on this deployment, so an upload would go nowhere. Typing a bet in
            still works and so does an import. <Link href="/api/sources">What this deployment has</Link>.
          </span>
        </div>
      ) : null}

      {/*  THE SAME ANSWER THE ROUTE GIVES. The dropzone was live for an
           account whose trial had run out, so the refusal arrived after the
           upload rather than before it. The sentence is trialState()'s own,
           which is the one place the trial numbers live. */}
      {!slips.allowed && !readOnly ? (
        <div className="banner" style={{ marginBottom: 'var(--gap-block)' }}>
          <Icon name="clock" size={18} className="banner__icon" />
          <span className="grow">
            {slips.message} New slips are paused until there is a plan on the account. Typing a bet
            in still works and so does an import.
          </span>
          <Link href="/app/settings/plan" className="btn btn--ghost btn--sm">See plans</Link>
        </div>
      ) : null}

      <Dropzone enabled={readerReady && slips.allowed} />

      <div className="grid" style={{ marginTop: 'var(--gap-block)' }}>
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
    </div>
  );
}
