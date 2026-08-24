'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import './proto.css';

/* 08 · THERE WAS NO 500.
 *
 * The 404 is the best-written page in this product, and the failure that
 * actually loses somebody's trust had nothing at all — just whatever the
 * framework prints, in a different typeface, saying nothing.
 *
 * Same voice, and one thing the 404 does not have to answer: WHETHER
 * ANYTHING WAS SAVED. That is the only question a person has when a page
 * breaks after they pressed a button, and leaving it unanswered is what
 * makes them press it again.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    /* The digest is the only handle on this failure that exists on both
       sides, so it goes to the console for anyone reading a bug report. */
    console.error('Slippery error', error.digest ?? '', error.message);
  }, [error]);

  return (
    <div className="stage">
      <div className="ph" data-t="periwinkle">
        <main className="body">
          <div className="pane" style={{ padding: '48px 20px', textAlign: 'center' }}>
            <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>That did not load</h1>
            <p className="lsub" style={{ margin: '0 auto 8px', maxWidth: '38ch' }}>
              Something broke on our side, not yours.
            </p>
            {/* The question a person actually has. */}
            <p className="lsub" style={{ margin: '0 auto 22px', maxWidth: '38ch' }}>
              <b>Nothing you had already saved has changed.</b> If you were part way through
              logging a bet, it did not save — check your ledger before entering it again.
            </p>
            <button className="btn" onClick={reset} style={{ display: 'block', width: '100%', maxWidth: 280, margin: '0 auto 10px' }}>
              Try again
            </button>
            <Link className="btn ghost" href="/app" style={{ display: 'block', maxWidth: 280, margin: '0 auto 14px' }}>
              Go to your dashboard
            </Link>
            {error.digest && (
              <p className="note mono" style={{ fontSize: 11, opacity: 0.7 }}>
                Reference {error.digest}
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
