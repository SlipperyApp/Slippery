import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { getViewer } from '@/lib/data/session';
import { has } from '@/lib/server/env';
import { CopyCode } from '@/components/app/CopyCode';

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
  const { data } = await getViewer();
  const botReady = has('TELEGRAM_BOT_TOKEN') && has('TELEGRAM_WEBHOOK_SECRET');

  return (
    <>
      <div className="row" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/app/import" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Add a bet
        </Link>
      </div>

      <h1>The Telegram bot</h1>
      <p className="muted" style={{ marginTop: 'var(--s2)', maxWidth: '58ch' }}>
        Link a chat once. After that, forwarding a slip screenshot the moment you place it takes
        about four seconds.
      </p>

      <div className="grid" style={{ marginTop: 'var(--s5)' }}>
        <section className="card col-6">
          <h2 className="card__title">Your link code</h2>
          <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
            Open <span className="mono">@SlipperyAppBot</span>, send <span className="mono">/start</span>,
            then send this code. One code, one format, and the bot validates it with the same
            function that generated it.
          </p>
          <CopyCode code={data.account.linkCode} />
          <p className="small dim card__foot">
            A code used somewhere else asks you to confirm the move in the app first. An invalid
            code gets &ldquo;Not a code I recognise&rdquo;, which never reveals whether it exists.
          </p>
        </section>

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
              <li key={t} className="checkitem" style={{ padding: '6px 0' }}>
                <Icon name="check" size={15} />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card col-12">
          <h2 className="card__title">What it says back</h2>
          <div className="scroller" style={{ marginTop: 'var(--s3)' }}>
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
            Fixed prefixes so a reply is scannable in a busy chat: READ, TRACKING, FT, UNREADABLE,
            DUPLICATE, PAUSED, LINKED. No greetings and no exclamation marks. Slip contents are
            never logged, only a chat identifier and a short outcome line.
          </p>
        </section>
      </div>

      {!botReady ? (
        <div className="banner" style={{ marginTop: 'var(--s5)' }}>
          <Icon name="alert" size={18} className="banner__icon" />
          <span>
            The bot is not configured on this deployment, so its webhook rejects everything, which
            is the safe direction. <Link href="/api/sources">What this deployment has</Link>.
          </span>
        </div>
      ) : null}
    </>
  );
}
