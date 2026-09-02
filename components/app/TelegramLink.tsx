'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { dateTime } from '@/lib/format';

/** Linking a Telegram chat to this account.
 *
 *  The page this replaces printed accounts.link_code, which is permanent,
 *  never used up and the same code every time anybody looked. It was a
 *  password to a ledger, printed on a settings screen, with no expiry and no
 *  way to withdraw it.
 *
 *  THE CODE IS SHOWN ONCE. Only its HMAC is stored, so nothing can put it back
 *  on screen after this render, and the copy says so rather than letting
 *  somebody assume they can come back for it. Losing it costs one press.
 *
 *  THE COUNTDOWN RUNS OFF THE SECONDS THE SERVER GAVE, not off the expiry
 *  timestamp. A phone whose clock is four minutes fast would otherwise show a
 *  live code as expired, and the person would sit there issuing codes that all
 *  look dead.
 *
 *  IT IS NOT A LIVE REGION. A countdown that announces itself every second is
 *  unusable with a screen reader on. The sentence above it is the live region
 *  and it speaks when the state changes, which is the part worth hearing. */

type Chat = { username: string | null; dormant: boolean; linkedAt: string };

type Status = {
  linked: boolean;
  chats: Chat[];
  pendingExpiresAt: string | null;
  botReady: boolean;
  botHandle: string;
};

type Issued = { sendText: string; endsAt: number };

const EXAMPLE = '/start SLIP-ABCD';

/*  The heading is a prop with a default because this card sits under a page
    whose h1 is already "The Telegram bot", and a card repeating the title of
    the page it is on tells a reader nothing about what is inside it. */
export function TelegramLink({ className = '', title = 'Your Telegram chat' }: { className?: string; title?: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [refused, setRefused] = useState('');
  const [issued, setIssued] = useState<Issued | null>(null);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [said, setSaid] = useState('');
  const mounted = useRef(true);

  const load = useCallback(async () => {
    const res = await fetch('/api/telegram/link', { cache: 'no-store' }).catch(() => null);
    if (!mounted.current) return null;
    const body = res ? await res.json().catch(() => null) : null;
    if (!res || !res.ok) {
      setRefused(typeof body?.message === 'string' ? body.message : 'The link status could not be read just now.');
      setStatus(null);
      return null;
    }
    setRefused('');
    setStatus(body as Status);
    return body as Status;
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; };
  }, [load]);

  /*  The countdown, and the poll that goes with it. Without the poll the card
      keeps saying "not linked" after the chat has linked itself, because the
      thing that changed happened in Telegram and this page has no way to know. */
  useEffect(() => {
    if (!issued) return undefined;
    const tick = async () => {
      const seconds = Math.max(0, Math.ceil((issued.endsAt - Date.now()) / 1000));
      setLeft(seconds);
      if (seconds === 0) { setIssued(null); setSaid('That code has expired. Issue another when you are ready.'); return; }
      if (seconds % 5 === 0) {
        const next = await load();
        if (next?.linked) { setIssued(null); setSaid('That chat is linked. Forward a slip when you place one.'); }
      }
    };
    void tick();
    const id = setInterval(() => { void tick(); }, 1000);
    return () => clearInterval(id);
  }, [issued, load]);

  async function post(action: 'issue' | 'revoke' | 'unlink') {
    setBusy(true);
    const res = await fetch('/api/telegram/link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => null) : null;
    setBusy(false);
    if (!res || !res.ok) {
      setSaid(typeof body?.message === 'string' ? body.message : 'That did not go through. Nothing changed.');
      return null;
    }
    return body as Record<string, unknown>;
  }

  async function issue() {
    setCopied(false);
    const body = await post('issue');
    if (!body) return;
    const ttl = Number(body.ttlSeconds) || 0;
    setIssued({ sendText: String(body.sendText ?? ''), endsAt: Date.now() + ttl * 1000 });
    setSaid('A code is ready. Send it to the bot and this card will say so.');
    void load();
  }

  async function cancelCode() {
    const body = await post('revoke');
    if (!body) return;
    setIssued(null);
    setSaid('That code is dead. Nothing can be linked with it now.');
    void load();
  }

  async function unlink() {
    const body = await post('unlink');
    setConfirming(false);
    if (!body) return;
    setIssued(null);
    setSaid('Unlinked. Your bets are untouched and nothing was deleted.');
    void load();
  }

  async function copy() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.sendText);
      setCopied(true);
      setTimeout(() => { if (mounted.current) setCopied(false); }, 2400);
    } catch {
      // A browser that refuses the clipboard still shows the line, which is
      // the thing that matters.
      setCopied(false);
    }
  }

  const handle = status?.botHandle ?? '@SlipperyAppBot';
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

  return (
    <section className={`card ${className}`.trim()}>
      <h2 className="card__title">{title}</h2>

      <p className="small muted" style={{ marginTop: 'var(--s2)' }} aria-live="polite">
        {said || (status === null
          ? (refused || 'Reading where this account stands.')
          : status.linked
            ? 'Slips forwarded from a linked chat land in this ledger.'
            : `Open ${handle}, then send it the line below. The code works once and expires.`)}
      </p>

      {status?.botReady === false ? (
        <p className="small dim" style={{ marginTop: 'var(--s3)' }}>
          The bot is not configured on this deployment, so a code would go nowhere.
        </p>
      ) : null}

      {/*  Signed out or without a database, the card shows the SHAPE of the
           line and says it is an example. A greyed control that looks live is
           worse than no control. */}
      {refused ? (
        <p className="mono dim" style={{ marginTop: 'var(--s4)' }}>
          {EXAMPLE} <span className="small">(an example, not a code)</span>
        </p>
      ) : null}

      {issued ? (
        <div style={{ marginTop: 'var(--s4)' }}>
          <p className="label">Send this to {handle}</p>
          <p className="fig fig--m mono" style={{ letterSpacing: '0.06em' }}>{issued.sendText}</p>

          <div className="row" style={{ gap: 'var(--s3)', marginTop: 'var(--s4)', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--ghost" onClick={copy}>
              <Icon name={copied ? 'check' : 'clipboard'} size={16} />
              {copied ? 'Copied' : 'Copy the line'}
            </button>
            <button type="button" className="btn btn--quiet" onClick={cancelCode} disabled={busy}>
              Cancel this code
            </button>
          </div>

          {/*  Counted down in plain text on purpose: see the note at the top
               about live regions. */}
          <p className="small dim card__foot">
            <span className="mono tnum">{clock}</span> left. It works once, and this is the only time it is shown.
          </p>
        </div>
      ) : null}

      {status && !issued ? (
        <div style={{ marginTop: 'var(--s4)' }}>
          {status.chats.map((c) => (
            <p key={c.linkedAt} className="small">
              {c.username ? `@${c.username}` : 'A chat'} linked {dateTime(c.linkedAt)}
              {c.dormant ? '. The bot is blocked or removed there, so nothing is being read from it.' : '.'}
            </p>
          ))}

          <div className="row" style={{ gap: 'var(--s3)', marginTop: 'var(--s4)', flexWrap: 'wrap' }}>
            {confirming ? null : (
              <button type="button" className="btn btn--primary" onClick={issue} disabled={busy}>
                <Icon name="telegram" size={16} />
                {status.linked ? 'Link another chat' : 'Create a link code'}
              </button>
            )}

            {status.linked && !confirming ? (
              <button type="button" className="btn btn--ghost" onClick={() => setConfirming(true)}>
                Unlink
              </button>
            ) : null}
          </div>

          {/*  Behind a confirmation, and the confirmation says what it costs
               and what it does not. Unlinking is not a delete, and somebody
               who thinks it might be will never press it. */}
          {confirming ? (
            <div style={{ marginTop: 'var(--s4)' }}>
              <p className="small">
                Unlinking stops the bot reading anything from{' '}
                {status.chats.length === 1 ? 'that chat' : 'those chats'}. Every bet you already have stays
                exactly where it is, and you can link again with a new code.
              </p>
              <div className="row" style={{ gap: 'var(--s3)', marginTop: 'var(--s4)', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn--danger" onClick={unlink} disabled={busy}>
                  Yes, unlink
                </button>
                <button type="button" className="btn btn--quiet" onClick={() => setConfirming(false)}>
                  Keep it linked
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
