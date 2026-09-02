import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';
import { EndCard } from '@/components/MarketingChrome';

export const metadata: Metadata = {
  title: 'Safer gambling',
  description:
    'Free, confidential help, 24 hours a day, and the constraints Slippery puts on itself so that a record does not become a reason to bet more.',
  alternates: { canonical: '/safer-gambling' },
  openGraph: {
    title: 'Safer gambling',
    description: 'Free, confidential help, and the constraints Slippery puts on itself.',
    url: '/safer-gambling',
    images: [{ url: '/og?title=Safer+gambling&sub=Free+and+confidential%2C+24+hours+a+day', width: 1200, height: 630, alt: 'Safer gambling' }],
  },
};

const HELP = [
  { t: 'National Gambling Helpline', s: '0808 8020 133. Free and confidential, 24 hours a day, every day.', href: 'tel:08088020133' },
  { t: 'BeGambleAware', s: 'Advice, self assessment and a live chat, at any hour.', href: 'https://www.begambleaware.org' },
  { t: 'GamCare', s: 'Support and treatment across Great Britain.', href: 'https://www.gamcare.org.uk' },
  { t: 'GAMSTOP', s: 'Self exclude from every licensed online operator in Great Britain, in one place.', href: 'https://www.gamstop.co.uk' },
  { t: 'Gambling Care, Ireland', s: 'Support in Ireland, including for family members.', href: 'https://www.gamblingcare.ie' },
  { t: 'Gamban', s: 'Blocking software for phones and computers.', href: 'https://gamban.com' },
];

const CONSTRAINTS = [
  'No notification is ever sent about not having bet.',
  'No notification is ever framed as losing your place in a league.',
  'Nothing is sent late at night, for any reason.',
  'A division change reads "Moving to League One next month", never "RELEGATED".',
  'Slippery celebrates app actions, such as importing a history, and never a betting outcome.',
  'Nothing counts how many days you have bet on, and no badge is earned by betting on more of them. A reward for volume is a reward for volume whatever it is called.',
  'A take a break control pauses notifications and leagues without touching your ledger. It does not try to talk you out of it.',
  'No copy anywhere implies guaranteed winnings, or that betting solves money problems.',
];

export default function SaferGambling() {
  return (
    <section className="sect">
      <div className="wrap">
        <Breadcrumbs trail={[{ href: '/', label: 'Slippery' }]} page="Safer gambling" />
        <span className="pill">18+</span>
        <h1 className="sect__h" style={{ marginTop: 'var(--s4)', fontSize: 'clamp(28px, 5.5vw, 46px)' }}>
          <span className="setup">A red and green grid is an engagement mechanic.</span>
          <span>So is a leaderboard.</span>
        </h1>
        <p className="sect__p">
          Slippery tells you the truth about your record, and a truthful record is sometimes an
          uncomfortable one. Nothing here is designed to make you bet more.
        </p>

        <div className="grid" style={{ marginTop: 'var(--s7)' }}>
          {HELP.map((h) => (
            <a
              key={h.t}
              className="card col-4"
              href={h.href}
              rel="noopener noreferrer"
              target={h.href.startsWith('http') ? '_blank' : undefined}
              style={{ textDecoration: 'none' }}
            >
              <span className="spread">
                <span className="card__title">{h.t}</span>
                <Icon name="arrowUpRight" size={16} />
              </span>
              <span className="small muted" style={{ display: 'block', marginTop: 'var(--s2)' }}>{h.s}</span>
            </a>
          ))}
        </div>

        <div className="card" style={{ marginTop: 'var(--s6)' }}>
          <p className="card__title">What Slippery will not do</p>
          <ul style={{ marginTop: 'var(--s4)' }}>
            {CONSTRAINTS.map((c) => (
              <li key={c} className="checkitem" style={{ padding: 'var(--s2) 0' }}>
                <Icon name="check" size={16} />
                <span>{c}</span>
              </li>
            ))}
          </ul>
          <p className="small dim card__foot">
            If any of this stops being true, it is a bug and it will be treated as one.
          </p>
        </div>

        <div style={{ marginTop: 'var(--s5)' }}>
          <EndCard
            title="Take a break"
            actions={
              <Link href="/app/settings" className="btn btn--ghost">
                Open Settings <Icon name="arrowRight" size={16} />
              </Link>
            }
          >
            One control, in Settings, under Account. It pauses every notification and takes you
            out of the monthly leagues. Your ledger, history and export are untouched.
          </EndCard>
        </div>
      </div>
    </section>
  );
}
