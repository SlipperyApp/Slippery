import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { getViewer } from '@/lib/data/session';
import { feed } from '@/lib/data/social';
import { ago, initials } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Feed',
  description: 'What Slippers have been doing. App actions only, never betting outcomes.',
};

const KIND_ICON: Record<string, 'spark' | 'social' | 'upload' | 'shield' | 'trophy' | 'pause' | 'sliders'> = {
  streak: 'spark', join: 'social', import: 'upload', 'slip-backed': 'shield',
  group: 'trophy', break: 'pause', unit: 'sliders',
};

export default async function Feed() {
  const { now } = await getViewer();
  const items = feed(now);

  return (
    <>
      <div className="row" style={{ marginBottom: 'var(--gap-block)' }}>
        <Link href="/app/social" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Social
        </Link>
      </div>
      <h1>Feed</h1>
      <p className="muted" style={{ marginTop: 'var(--s2)' }}>
        App actions only. Nothing here says who won what, because celebrating a betting outcome is
        a nudge toward more of them.
      </p>

      <div className="card" style={{ marginTop: 'var(--s5)' }}>
        <ul>
          {items.map((f) => (
            <li key={f.id} className="brow" style={{ gridTemplateColumns: '30px 20px minmax(0,1fr) auto', gap: 'var(--s3)' }}>
              <span className="avatar" aria-hidden="true">{initials(f.name)}</span>
              <Icon name={KIND_ICON[f.kind] ?? 'spark'} size={16} style={{ color: 'var(--ink-3)' }} />
              <span className="brow__title" style={{ fontWeight: 400 }}>
                <Link href={`/app/social/person?handle=${f.handle}`} style={{ fontWeight: 600, textDecoration: 'none' }}>{f.name}</Link>
                {' '}{f.text}
              </span>
              <span className="small dim nowrap">{ago(f.at, now)}</span>
            </li>
          ))}
        </ul>
        <p className="small dim card__foot">
          That is everything from the last three days. There is no infinite scroll here on purpose.
        </p>
      </div>
    </>
  );
}
