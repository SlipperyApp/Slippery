'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';

const PRESETS = [
  { id: 'none', label: 'Whole image', inset: 0 },
  { id: 'tight', label: 'Trim the edges', inset: 6 },
  { id: 'tighter', label: 'Slip only', inset: 14 },
];

/** A real control: the preview changes, the chosen inset is carried forward,
 *  and Skip goes straight on. */
export function Cropper() {
  const router = useRouter();
  const [preset, setPreset] = useState('tight');
  const [rotation, setRotation] = useState(0);
  const inset = PRESETS.find((p) => p.id === preset)?.inset ?? 0;

  return (
    <>
      <div className="card" style={{ padding: 'var(--s4)' }}>
        <div
          style={{
            position: 'relative', aspectRatio: '3 / 4', borderRadius: 'var(--r-ctl)',
            overflow: 'hidden', background: 'var(--surface-2)',
          }}
        >
          {/* A stand-in for the uploaded image, drawn rather than fetched, so
              the control can be seen working without a file. */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', inset: `${inset}%`,
              transform: `rotate(${rotation}deg)`,
              transition: 'inset 180ms var(--ease), transform 220ms var(--ease)',
              border: '2px solid var(--accent)',
              borderRadius: '8px',
              background: 'repeating-linear-gradient(180deg, color-mix(in oklab, var(--ink) 8%, transparent) 0 2px, transparent 2px 26px)',
            }}
          />
          <p className="small dim" style={{ position: 'absolute', left: 12, bottom: 10 }}>
            Crop preview
          </p>
        </div>

        <div className="seg" role="group" aria-label="Crop" style={{ marginTop: 'var(--s4)' }}>
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className="seg__btn" aria-pressed={preset === p.id} onClick={() => setPreset(p.id)}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="row" style={{ marginTop: 'var(--s3)', gap: 'var(--s4)' }}>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setRotation((r) => (r + 270) % 360)}>
            <Icon name="refresh" size={15} /> Rotate left
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setRotation((r) => (r + 90) % 360)}>
            <Icon name="refresh" size={15} /> Rotate right
          </button>
          <span className="small dim tnum">{rotation}&deg;</span>
        </div>
      </div>

      <div className="row" style={{ marginTop: 'var(--s5)', gap: 'var(--s3)' }}>
        <button type="button" className="btn btn--primary grow" onClick={() => router.push('/app/import/analysing')}>
          Read this slip <Icon name="arrowRight" size={16} />
        </button>
        <button type="button" className="btn btn--link" onClick={() => router.push('/app/import/analysing')}>
          Skip the crop
        </button>
      </div>
    </>
  );
}
