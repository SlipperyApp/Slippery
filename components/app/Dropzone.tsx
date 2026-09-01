'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';

/** The upload path. A file that is not an image or a PDF is refused by name
 *  rather than silently ignored, and nothing is read until a file is
 *  actually chosen. */
export function Dropzone({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement | null>(null);
  const [over, setOver] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'application/pdf'];

  function take(file: File | undefined) {
    if (!file) return;
    if (!ACCEPT.includes(file.type) && !/\.(png|jpe?g|webp|heic|pdf)$/i.test(file.name)) {
      setError(`That is a ${file.type || 'file'} and the reader takes a PNG, JPEG, WebP, HEIC or PDF.`);
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError('That file is over 12MB. A screenshot from a phone is usually well under one.');
      return;
    }
    setError('');
    setName(file.name);
    router.push('/app/import/crop');
  }

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
      >
        <Icon name="camera" size={28} style={{ color: 'var(--ink-3)' }} />
        <p className="card__title" style={{ marginTop: 'var(--s3)' }}>
          {name || 'Drop a slip here'}
        </p>
        <p className="small muted" style={{ marginTop: 'var(--s2)', maxWidth: '44ch' }}>
          A screenshot from the bookmaker app, a photograph of a shop slip, or a PDF. The template
          is detected before anything is parsed.
        </p>
        <input
          ref={input}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.heic,.pdf,image/*,application/pdf"
          className="sr-only"
          id="slip-file"
          onChange={(e) => take(e.target.files?.[0])}
          disabled={!enabled}
        />
        <label htmlFor="slip-file" className="btn btn--primary" style={{ marginTop: 'var(--s5)', cursor: enabled ? 'pointer' : 'not-allowed' }}>
          <Icon name="upload" size={16} /> Choose a file
        </label>
      </div>
      {error ? <p className="field__err" role="alert" style={{ marginTop: 'var(--s3)' }}>{error}</p> : null}
    </div>
  );
}
