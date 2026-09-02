'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { useSlipFlow } from '@/components/app/SlipFlow';
import { REFUSAL_COPY, type RefusalCopy, type SlipRead } from '@/lib/data/read';

/** The read itself, which used to be a timer.
 *
 *  This screen ran five staged ticks on a 620ms clock and then pushed to a
 *  worked example, whatever had been uploaded and whether or not a reader was
 *  configured at all. It is now the request: the ticks are gone, because the
 *  stages of somebody else's inference are not observable from here and
 *  drawing five of them is a claim about progress nobody can make.
 *
 *  What IS shown is what the reader is being asked to do, and one honest
 *  indeterminate state, and then either the fields or the reason. */

const DOING = [
  'Checking it is a slip at all, rather than guessing at a photograph that is not one',
  'Reading the bookmaker, the stake, the price and every selection',
  'Scoring each field on its own, because one bad field must not poison nineteen good ones',
  'Dropping any number it cannot also quote off the image',
];

type Failure = RefusalCopy & { detail?: string; retry: boolean };

export function Analysing() {
  const router = useRouter();
  const flow = useSlipFlow();
  const [failure, setFailure] = useState<Failure | null>(null);
  const [duplicate, setDuplicate] = useState<{ betId: string | null; message: string } | null>(null);
  /*  Set when the person has answered the duplicate question with "read it
   *  anyway". The route takes it as permission to skip the image hash and
   *  read the file, because a second identical screenshot of a second
   *  identical bet is a real thing and refusing it loses a real bet. */
  const [force, setForce] = useState(false);
  const sent = useRef(false);

  const file = flow.cropped ?? flow.pending?.file ?? null;

  useEffect(() => {
    if (!file || sent.current) return;
    sent.current = true;
    const body = new FormData();
    body.append('file', file);
    if (force) body.append('force', '1');

    (async () => {
      try {
        const res = await fetch('/api/extract', { method: 'POST', body });
        const b = await res.json().catch(() => ({} as Record<string, unknown>));

        if (res.ok && b.duplicate) {
          setDuplicate({ betId: (b.betId as string) ?? null, message: String(b.message ?? '') });
          return;
        }
        if (res.ok && b.read) {
          flow.setRead(b.read as SlipRead, (b.sha256 as string) ?? null);
          router.replace('/app/import/review');
          return;
        }
        /*  The route's own copy is used when it sends any, so the message a
         *  person reads is the one the refusal was written for. The table is
         *  the fallback for a proxy or a rate limiter answering instead. */
        const known = REFUSAL_COPY[b.error as keyof typeof REFUSAL_COPY];
        setFailure({
          tag: (b.tag as string) ?? known?.tag ?? 'NOT READ',
          title: (b.title as string) ?? known?.title ?? 'That slip was not read',
          message: (b.message as string) ?? known?.message ?? 'Nothing was read and nothing was written.',
          fix: (b.fix as string) ?? known?.fix ?? 'Send it again, or type the bet in.',
          detail: (b.detail as string) ?? undefined,
          /*  A retry is only offered where trying again can work. A
           *  deployment with no reader configured answers 503 and will answer
           *  503 to the next press too, and a button that cannot succeed is
           *  worse than no button. */
          retry: (res.status >= 500 || res.status === 429) && b.error !== 'not_configured',
        });
      } catch {
        setFailure({
          ...REFUSAL_COPY.unreachable,
          retry: true,
        });
      }
    })();
  }, [file, flow, router, force]);

  if (!file) {
    return (
      <div className="card">
        <p className="card__title">There is no slip to read</p>
        <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
          A slip is held in this tab and nowhere else, so a refresh arrives here with nothing.
          Nothing was read and no allowance was spent.
        </p>
        <Link href="/app/import" className="btn btn--primary" style={{ marginTop: 'var(--s4)' }}>
          Choose a slip <Icon name="arrowRight" size={16} />
        </Link>
      </div>
    );
  }

  /*  A QUESTION, NOT A DEAD END. This screen used to stop here with two links
   *  away from it, so an identical file was silently skipped: the person had
   *  no way to say "that is a second bet, read it". Now it asks, and the
   *  answer that reads it anyway is the first button. */
  if (duplicate) {
    return (
      <div className="card">
        <span className="pill">ALREADY SEEN</span>
        <p className="card__title" style={{ marginTop: 'var(--s3)' }}>You have sent this exact image before</p>
        <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
          {duplicate.message} It was matched on the file itself, before the reader was called, so
          nothing has been spent on it and nothing has been written. If this is a second bet that
          happens to look identical, read it anyway.
        </p>
        <div className="row row--wrap" style={{ marginTop: 'var(--s4)', gap: 'var(--s3)' }}>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => { sent.current = false; setDuplicate(null); setForce(true); }}
          >
            <Icon name="refresh" size={16} /> Read it anyway
          </button>
          <Link href={duplicate.betId ? `/app/ledger?bet=${duplicate.betId}` : '/app/ledger'} className="btn btn--ghost">
            See the bet it matched
          </Link>
          <Link href="/app/import" className="btn btn--ghost">Send a different slip</Link>
        </div>
      </div>
    );
  }

  if (failure) {
    return (
      <div className="card">
        <span className="pill pill--neg">{failure.tag}</span>
        <h2 className="card__title" style={{ marginTop: 'var(--s3)' }}>{failure.title}</h2>
        <p className="small muted" style={{ marginTop: 'var(--s2)' }} role="alert">
          {failure.detail ? `${failure.detail} ` : ''}{failure.message}
        </p>
        <p className="small" style={{ marginTop: 'var(--s3)' }}>{failure.fix}</p>
        <div className="row row--wrap" style={{ marginTop: 'var(--s4)', gap: 'var(--s3)' }}>
          {failure.retry ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => { sent.current = false; setFailure(null); }}
            >
              <Icon name="refresh" size={16} /> Try that again
            </button>
          ) : null}
          <Link href="/app/import/crop" className="btn btn--ghost">Crop it again</Link>
          <Link href="/app/import" className="btn btn--ghost">Send a different image</Link>
          <Link href="/app/import/manual" className="btn btn--link">Type it in instead</Link>
        </div>
        <p className="small dim card__foot">
          This slip has not been counted against your allowance.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <div className="row" style={{ gap: 'var(--s3)' }}>
          <Icon name="refresh" size={18} className="spin" />
          <span className="card__title" role="status">Reading the slip</span>
        </div>
        <ul style={{ marginTop: 'var(--s3)' }}>
          {DOING.map((t) => (
            <li key={t} className="checkitem" style={{ padding: 'var(--s2) 0' }}>
              <Icon name="check" size={15} />
              <span className="small">{t}</span>
            </li>
          ))}
        </ul>
        <div className="meter meter--busy card__foot" style={{ marginTop: 'var(--s4)' }}>
          <span className="meter__fill" />
        </div>
      </div>

      <p className="small dim" style={{ marginTop: 'var(--s4)' }}>
        Usually a few seconds. Nothing is written to your ledger until you have seen what was read
        and confirmed it.
      </p>
    </>
  );
}
