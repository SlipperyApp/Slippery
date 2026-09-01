import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';

export const metadata: Metadata = {
  title: 'What changed',
  description: 'Written as what changed for you, not as what shipped. Newest first.',
  alternates: { canonical: '/changelog' },
  openGraph: {
    title: 'What changed in Slippery',
    description: 'Written as what changed for you, not as what shipped.',
    url: '/changelog',
    images: [{ url: '/og?title=What+changed&sub=For+you%2C+not+for+us', width: 1200, height: 630, alt: 'Slippery changelog' }],
  },
};

/** Written as what changed for the reader, never as what shipped. */
const ENTRIES: { date: string; items: { t: string; s: string }[] }[] = [
  {
    date: '31 August 2026',
    items: [
      { t: 'Your dashboard has one layout now', s: 'The modules stopped moving. Every one has a fixed place and a fixed height, so a figure is where it was yesterday. Nothing to arrange, nothing to lose.' },
      { t: 'One scope bar governs everything below it', s: 'Change the period once and every module follows, and the scope rides in the link so a shared dashboard arrives showing what you were looking at. Three modules deliberately ignore it and say so in their own header.' },
      { t: 'Your headline is two numbers', s: 'Money you won, and money they gave you. Free bets, bonus funds and boosts are separated as the slip is read. A good year built on sign-up offers stops looking like a good year of betting.' },
      { t: 'Four breakdowns became one', s: 'Sport, market, tipster and bookmaker share one module and one control. Rows under five bets are greyed, because profit without volume ranks one lucky bet above forty disciplined ones.' },
      { t: 'Closing line value is gone', s: 'It could not be sourced honestly. An average taken over whichever bets happened to have a closing price overstates itself, and a figure you cannot trust is worse than no figure.' },
    ],
  },
  {
    date: '24 August 2026',
    items: [
      { t: 'A misread slip gives you the credit back', s: 'Every read carries a flag. Press it and the slip goes for a human look and the slip returns to your allowance. Your worst moment with the reader should cost you nothing.' },
      { t: 'Partial cash out stopped lying about the stake', s: 'The eighths are of what is still standing, not of what you originally staked, so a second pull lands on the right base. Pull it as many times as you actually did.' },
      { t: 'Quarter lines settle properly', s: 'Over 2.25 on a 1-1 loses half your stake and returns the other half, which is what your bookmaker did. It used to record a whole loss.' },
    ],
  },
  {
    date: '17 August 2026',
    items: [
      { t: 'Handicaps follow your bookmaker', s: 'bet365 settles Asian, so a -1 on a one goal win is a void. Most others give the handicap draw its own outcome, so the same bet loses. One rule for both was wrong for one of them every time.' },
      { t: 'Nothing is graded from a feed that cannot prove 90 minutes', s: 'Extra time and penalties never counted, but the old grader could not always tell. Now it asks instead. A wrong grade is worse than no grade.' },
      { t: 'Your counts agree with each other', s: 'The banner, the ledger and the facets used to say 486, 482 and 474. They all come from one query now, so the facet total is the row total.' },
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
