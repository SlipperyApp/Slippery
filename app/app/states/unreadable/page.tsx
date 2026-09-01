import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';

export const metadata: Metadata = {
  title: 'That slip could not be read',
  description: 'Which fields were read, which were not, and what to do about it. Nothing is guessed.',
};

const FIELDS: [string, string, 'high' | 'missing'][] = [
  ['Bookmaker', 'bet365, from the template', 'high'],
  ['Stake', '£15.00', 'high'],
  ['Placed', '30 Aug, 13:42', 'high'],
  ['Selection 1', 'Constitution Hill', 'high'],
  ['Selection 2', 'Not legible', 'missing'],
  ['Price', 'Not legible', 'missing'],
];

export default function Unreadable() {
  const read = FIELDS.filter((f) => f[2] === 'high').length;
  return (
    <div className="column column--wide">
      <span className="pill pill--neg">UNREADABLE</span>
      <h1 style={{ marginTop: 'var(--s4)' }}>
        {read} of {FIELDS.length} fields came off that slip
      </h1>
      <p className="lead" style={{ marginTop: 'var(--s3)' }}>
        Two did not, and neither is being guessed at. A missing price is visible to you; a wrong
        one is not, and a wrong one would sit in your ROI for months.
      </p>

      <div className="card" style={{ marginTop: 'var(--s6)' }}>
        <p className="card__title">What was read</p>
        <ul style={{ marginTop: 'var(--s3)' }}>
          {FIELDS.map(([t, v, c]) => (
            <li key={t} className="brow" style={{ gridTemplateColumns: '20px minmax(0,1fr) auto', gap: 'var(--s3)' }}>
              <Icon name={c === 'high' ? 'check' : 'minus'} size={16} className={`readmark readmark--${c === 'high' ? 'ok' : 'gap'}`} />
              <span className="brow__title">{t}</span>
              <span className={`small ${c === 'high' ? 'mono' : 'muted'}`}>{v}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card" style={{ marginTop: 'var(--s4)' }}>
        <p className="card__title">What usually fixes it</p>
        <ul style={{ marginTop: 'var(--s3)' }}>
          {[
            'A screenshot rather than a photograph of a screen',
            'The whole slip in frame, including the price column',
            'No finger over the bottom of the slip',
            'Full brightness, if it is a photograph of a printed slip',
          ].map((t) => (
            <li key={t} className="checkitem" style={{ padding: 'var(--s2) 0' }}>
              <Icon name="check" size={15} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="row row--wrap" style={{ marginTop: 'var(--s5)', gap: 'var(--s3)' }}>
        <Link href="/app/import" className="btn btn--primary">Send it again</Link>
        <Link href="/app/import/manual" className="btn btn--ghost">Fill in the two gaps by hand</Link>
        <Link href="/app/import/review" className="btn btn--link">Flag it and get the slip back</Link>
      </div>

      <p className="small dim" style={{ marginTop: 'var(--s5)' }}>
        This slip has not been counted against your allowance.
      </p>
    </div>
  );
}
