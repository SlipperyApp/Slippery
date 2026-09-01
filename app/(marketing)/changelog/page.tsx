import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';

export const metadata: Metadata = {
  title: 'What changed',
  description: 'What changed for you, newest first.',
  alternates: { canonical: '/changelog' },
  openGraph: {
    title: 'What changed in Slippery',
    description: 'What changed for you, newest first.',
    url: '/changelog',
    images: [{ url: '/og?title=What+changed&sub=For+you%2C+not+for+us', width: 1200, height: 630, alt: 'Slippery changelog' }],
  },
};

/** Written as what changed for the reader, never as what shipped. */
const ENTRIES: { date: string; items: { t: string; s: string }[] }[] = [
  {
    date: '31 August 2026',
    items: [
      { t: 'Your dashboard has one layout now', s: 'Every module has a fixed place and a fixed height. Nothing to arrange, nothing to lose.' },
      { t: 'One scope bar governs everything below it', s: 'Set the period once and every module follows. Three ignore it and say so in their header.' },
      { t: 'Your headline is two numbers', s: 'Money you won, and money they gave you. Free bets, bonus funds and boosts are split out as the slip is read.' },
      { t: 'Four breakdowns became one', s: 'Sport, market, tipster and bookmaker share one module and one control. Rows under five bets are greyed.' },
      { t: 'Closing line value is gone', s: 'It could not be sourced honestly, and a figure you cannot trust is worse than none.' },
    ],
  },
  {
    date: '24 August 2026',
    items: [
      { t: 'A misread slip gives you the credit back', s: 'Press the flag on any read. It goes for a human look and returns to your allowance.' },
      { t: 'Partial cash out stopped lying about the stake', s: 'The eighths are of what is still standing, so a second pull lands on the right base.' },
      { t: 'Quarter lines settle properly', s: 'Over 2.25 on a 1-1 loses half and returns half. It used to record a whole loss.' },
    ],
  },
  {
    date: '17 August 2026',
    items: [
      { t: 'Handicaps follow your bookmaker', s: 'bet365 settles Asian, so a -1 on a one goal win voids. Most others give the handicap draw its own outcome.' },
      { t: 'Nothing is graded from a feed that cannot prove 90 minutes', s: 'Extra time and penalties never counted. The grader asks now instead of guessing.' },
      { t: 'Your counts agree with each other', s: 'The banner, the ledger and the facets come from one query, so the facet total is the row total.' },
    ],
  },
];

export default function Changelog() {
  return (
    <section className="sect">
      <div className="wrap">
        <Breadcrumbs trail={[{ href: '/', label: 'Slippery' }]} page="What changed" />
        <h1 className="sect__h" style={{ fontSize: 'clamp(30px, 6vw, 48px)' }}>
          <span className="setup">What changed for you.</span>
          <span>Not what we happened to ship.</span>
        </h1>
        <div className="column column--wide" style={{ marginTop: 'var(--s7)', marginInline: 0 }}>
          {ENTRIES.map((e) => (
            <section key={e.date} style={{ marginBottom: 'var(--s8)' }}>
              <p className="label">{e.date}</p>
              <ul style={{ marginTop: 'var(--s3)' }}>
                {e.items.map((i) => (
                  <li key={i.t} className="brow" style={{ gridTemplateColumns: '1fr' }}>
                    <p className="brow__title" style={{ fontSize: 'var(--t-body)' }}>{i.t}</p>
                    <p className="small muted" style={{ marginTop: 4, maxWidth: '68ch' }}>{i.s}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
