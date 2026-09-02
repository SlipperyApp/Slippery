import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { has } from '@/lib/server/env';
import { TelegramLink } from '@/components/app/TelegramLink';

export const metadata: Metadata = {
  title: 'The Telegram bot',
  description: 'Link a chat once, then forward a slip the moment you place it.',
};

const REPLIES: [string, string][] = [
  ['A photo of a slip', 'A field table and Confirm or Edit'],
  ['A slip it cannot read', 'Which field is missing, and how to fix it'],
  ['A duplicate', 'The bet you already have, with Add anyway or Ignore'],
  ['Several bets in one image', 'One reply listing each, Confirm all or Review in app'],
  ['A photo that is not a slip', 'It says so, and reads nothing'],
  ['/today  /week', 'Today’s figures, this week’s figures'],
  ['/open', 'What is running and what it is worth'],
  ['/last', 'The last bet you logged'],
  ['/undo', 'Removes the last bet from this chat within 24 hours'],
  ['/stop', 'Unlinks the chat. Your bets are untouched'],
];

export default async function Linked() {
  const botReady = has('TELEGRAM_BOT_TOKEN') && has('TELEGRAM_WEBHOOK_SECRET');

  return (
    <>
      <div className="row" style={{ marginBottom: 'var(--gap-block)' }}>
        <Link href="/app/import" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Add a bet
        </Link>
      </div>

      <h1>The Telegram bot</h1>
      {/*  What it is and what it is not. It said "Link a chat once. After
           that, forwarding a slip takes about four seconds", which is true and
           which, on the screen a new account is sent to first, reads as the
           step before the product starts working. */}
      <p className="muted" style={{ marginTop: 'var(--s2)' }}>
        One of the four ways in, and the only one you set up first. The other three need nothing
        from this page.
      </p>

      <div className="grid" style={{ marginTop: 'var(--s5)' }}>
        {/*  The real control, not a printed code. What was here was
             accounts.link_code: one permanent code per account, never used up
             and identical every time anybody looked, which is a password to a
             ledger printed on a page. */}
        <TelegramLink className="col-6" skip={{ href: '/app/import', label: 'Add a bet another way' }} />

        <section className="card col-6">
          <h2 className="card__title">What the bot does</h2>
          <ul style={{ marginTop: 'var(--s3)' }}>
            {[
              'Reads a forwarded slip and replies with a field table',
              'Never reads an image from an unlinked chat',
              'Buffers an album for about a second and replies once',
              'Batches several settlements into one message',
              'Asks for a result three hours past an expected finish',
              'Never sends anything about not having bet, or late at night',
            ].map((t) => (
              <li key={t} className="checkitem" style={{ padding: 'var(--s2) 0' }}>
                <Icon name="check" size={15} />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card col-12">
          <h2 className="card__title">What it says back</h2>
          <div className="scroller" tabIndex={0} role="region" aria-label="Bot replies, scrollable" style={{ marginTop: 'var(--s3)' }}>
            <table className="tbl">
              <caption className="sr-only">Bot replies</caption>
              <thead>
                <tr><th scope="col">You send</th><th scope="col">It replies</th></tr>
              </thead>
              <tbody>
                {REPLIES.map(([a, b]) => (
                  <tr key={a}><td className="mono">{a}</td><td>{b}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small dim card__foot">
            Fixed prefixes, so a reply is scannable in a busy chat: READ, TRACKING, FT,
            UNREADABLE, DUPLICATE, PAUSED, LINKED. Slip contents are never logged.
          </p>
        </section>
      </div>

      {!botReady ? (
        <div className="banner" style={{ marginTop: 'var(--s5)' }}>
          <Icon name="alert" size={18} className="banner__icon" />
          <span>
            The bot is not configured on this deployment, so its webhook rejects everything.{' '}
            <Link href="/api/sources">What this deployment has</Link>.
          </span>
        </div>
      ) : null}
    </>
  );
}
