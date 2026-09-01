'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';

/** Share one module as a picture.
 *
 *  The image is drawn by /api/share, not scraped off the page: a card
 *  designed to BE an image, 1080 square, which is the shape a camera roll and
 *  every social app want. A DOM screenshot gives you a photograph of a
 *  website instead, at whatever size the window happened to be.
 *
 *  Three ways out, in the order they are likely to work:
 *    the share sheet   phones. Puts it straight into any app, camera roll
 *                      included.
 *    copy              desktop. Straight onto the clipboard as a PNG.
 *    save              always there, because the first two are permissioned
 *                      and the third is not.
 *
 *  Nothing about a bet leaves the account: the card carries the same figures
 *  the module already shows, and the query it is built from is integers. */
export function ShareButton({
  name, label, params,
}: {
  name: string;
  label: string;
  /** The figures, already reduced to integers by the caller. */
  params?: Record<string, string | number>;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<'' | 'copy' | 'share'>('');
  const [said, setSaid] = useState('');

  useEffect(() => {
    if (!open) return;
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) q.set(k, String(v));
    setUrl(`/api/share?${q.toString()}`);
  }, [open, params]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open]);

  const file = async () => {
    const res = await fetch(url);
    const blob = await res.blob();
    return new File([blob], `slippery-${name}.png`, { type: 'image/png' });
  };

  const copy = async () => {
    setBusy('copy'); setSaid('');
    try {
      const f = await file();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': f })]);
      setSaid('Copied.');
    } catch {
      setSaid('This browser would not take an image on the clipboard. Save it instead.');
    } finally { setBusy(''); }
  };

  const send = async () => {
    setBusy('share'); setSaid('');
    try {
      const f = await file();
      const data = { files: [f], title: `Slippery · ${label}` };
      if (navigator.canShare?.(data)) await navigator.share(data);
      else setSaid('No share sheet here. Copy or save it instead.');
    } catch {
      // A cancelled share sheet throws, and a cancelled share is not an error.
      setSaid('');
    } finally { setBusy(''); }
  };

  return (
    <>
      <button
        type="button"
        className="modmenu__btn"
        aria-label={`Share ${label} as an image`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Icon name="share" size={16} />
      </button>

      {open ? (
        <div className="sheet__scrim" onClick={() => setOpen(false)}>
          <div
            className="sheet sheet--share"
            role="dialog"
            aria-modal="true"
            aria-label={`Share ${label}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="spread" style={{ marginBottom: 'var(--gap-block)' }}>
              <p className="card__title">Share {label.toLowerCase()}</p>
              <button type="button" className="modmenu__btn" aria-label="Close" onClick={() => setOpen(false)}>
                <Icon name="close" size={16} />
              </button>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="sharecard" src={url} alt={`A ${label} card, 1080 by 1080`} width={1080} height={1080} />

            <div className="row row--wrap" style={{ gap: 'var(--s3)', marginTop: 'var(--s4)' }}>
              <button type="button" className="btn btn--primary" onClick={send} disabled={busy !== ''}>
                <Icon name="share" size={16} /> Share
              </button>
              <button type="button" className="btn btn--ghost" onClick={copy} disabled={busy !== ''}>
                Copy
              </button>
              <a className="btn btn--ghost" href={url} download={`slippery-${name}.png`}>
                Save
              </a>
            </div>

            <p className="small dim" style={{ marginTop: 'var(--s3)' }} role="status">
              {said || 'The figures on the card are the ones in the module. Nothing else is included.'}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
