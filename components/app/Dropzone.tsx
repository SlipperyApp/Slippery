'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { useSlipFlow } from '@/components/app/SlipFlow';
import { PICKABLE_TYPES, REFUSAL_COPY, checkPick, normaliseType } from '@/lib/data/read';

/** The upload path. A file that is not an image or a PDF is refused by name
 *  rather than silently ignored, and the file that is chosen is HELD: before
 *  this it was measured, named on screen, and then dropped on the floor as
 *  the router moved to the next screen. */
export function Dropzone({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const flow = useSlipFlow();
  const [over, setOver] = useState(false);
  const [error, setError] = useState<{ title: string; message: string; fix: string } | null>(null);

  const take = useCallback((file: File | undefined | null) => {
    if (!file) return;
    const bad = checkPick(file);
    if (bad) {
      const copy = REFUSAL_COPY[bad];
      setError({ title: copy.title, message: copy.message, fix: copy.fix });
      return;
    }
    setError(null);
    flow.setPending(file, normaliseType(file.type, file.name) ?? file.type);
    router.push('/app/import/crop');
  }, [flow, router]);

  /*  Paste. A screenshot on a laptop lives on the clipboard and nowhere else
   *  until it is pasted, and every person who tried Cmd+V here got nothing.
   *  The listener is on the document because a paste has no focused target
   *  when nothing is focused, so a dropzone listening to itself never hears
   *  one. */
  useEffect(() => {
    if (!enabled) return;
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.kind === 'file');
      const file = item?.getAsFile();
      if (file) { e.preventDefault(); take(file); }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [enabled, take]);

  return (
    <div>
      <div
        className="card"
        onDragOver={(e) => { if (enabled) { e.preventDefault(); setOver(true); } }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (enabled) take(e.dataTransfer.files?.[0]); }}
        style={{
          alignItems: 'center', textAlign: 'center', padding: 'var(--s8) var(--s5)',
          borderWidth: '1.5px',
          borderColor: over ? 'var(--accent)' : 'var(--line-2)',
          background: over ? 'color-mix(in oklab, var(--accent) 8%, var(--surface))' : undefined,
          borderStyle: enabled ? 'dashed' : 'dotted',
        }}
        {...(enabled ? {} : { 'data-disabled': '' })}
      >
        <Icon name="camera" size={28} style={{ color: 'var(--ink-3)' }} />
        <p className="card__title" style={{ marginTop: 'var(--s3)' }}>
          {flow.pending ? flow.pending.name : 'Drop a slip here'}
        </p>
        <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
          A screenshot from the bookmaker app, a photograph of a shop slip, or a PDF. Paste one
          straight in with Ctrl or Cmd and V.
        </p>
        <input
          type="file"
          accept={[...PICKABLE_TYPES, '.heic', '.heif'].join(',')}
          className="sr-only"
          id="slip-file"
          onChange={(e) => take(e.target.files?.[0])}
          disabled={!enabled}
        />
        <label htmlFor="slip-file" className="btn btn--primary" style={{ marginTop: 'var(--s5)', cursor: enabled ? 'pointer' : 'not-allowed' }}>
          <Icon name="upload" size={16} /> Choose a file
        </label>
      </div>

      {error ? (
        <div className="banner banner--neg" role="alert" style={{ marginTop: 'var(--s3)' }}>
          <Icon name="alert" size={18} className="banner__icon" />
          <span>
            <strong>{error.title}.</strong> {error.message} {error.fix}
          </span>
        </div>
      ) : null}
    </div>
  );
}
