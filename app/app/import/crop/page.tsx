import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Cropper } from '@/components/app/Cropper';

export const metadata: Metadata = {
  title: 'Crop the slip',
  description: 'Trim to the slip itself. Less around it means a cleaner template match.',
};

export default function Crop() {
  return (
    <>
      <div className="row" style={{ marginBottom: 'var(--gap-block)' }}>
        <Link href="/app/import" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Add a bet
        </Link>
      </div>
      <div className="column">
        <h1>Crop to the slip</h1>
        <p className="muted" style={{ marginTop: 'var(--s2)' }}>
          Optional, and usually not needed. It helps when a photograph has a table in it, because
          the reader works on the slip, not on the room. Drag a rectangle, or tab to a corner and
          use the arrow keys.
        </p>
        <div style={{ marginTop: 'var(--s5)' }}><Cropper /></div>
      </div>
    </>
  );
}
