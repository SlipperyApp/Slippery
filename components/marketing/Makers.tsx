import Link from 'next/link';
import { Icon } from '@/components/Icon';

/** The two people who designed this, and a tip jar.
 *
 *  THE TIP JAR IS NOT A PAYMENT PAGE. It links out to whatever
 *  NEXT_PUBLIC_TIP_URL points at and takes no card details, holds no money
 *  and touches no account state. That matters more here than on most
 *  products: the entire legal position of Slippery is that it never accepts
 *  bets, holds money or pays winnings, and a tip that looked like it lived
 *  inside the product would blur the one line the product cannot blur.
 *
 *  With no URL set it says so rather than rendering a dead button. A control
 *  that goes nowhere is worse than an absent one. */

const MAKERS = [
  {
    name: 'Zhang',
    src: '/team/zhang.png',
    did: 'Design and the interface',
  },
  {
    name: 'Aniket',
    src: '/team/aniket.png',
    did: 'Design and the interface',
  },
];

export function Makers({ tipUrl }: { tipUrl?: string }) {
  return (
    <section className="sect" id="makers">
      <div className="wrap makers">
        <div className="makers__who">
          <h2 className="sect__h">
            <span className="setup">Two people made this.</span>
            <span>Zhang and Aniket.</span>
          </h2>
          <p className="sect__p">
            They designed every screen in it, including the calendar.
          </p>

          <ul className="makers__list">
            {MAKERS.map((m) => (
              <li key={m.name}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.src} alt="" className="makers__face" width={64} height={64} />
                <span>
                  <span className="makers__name">{m.name}</span>
                  <span className="makers__did">{m.did}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card makers__tip">
          <p className="card__title">Buy them a coffee</p>
          <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
            Nothing here is behind a tip.
          </p>
          {tipUrl ? (
            <Link
              href={tipUrl}
              className="btn btn--ghost"
              style={{ marginTop: 'var(--s5)' }}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Icon name="heart" size={16} /> Send one
            </Link>
          ) : (
            <p className="small dim" style={{ marginTop: 'var(--s5)' }}>
              Not set up yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/** The discreet version, for the footer of the landing page. */
export function MadeBy() {
  return (
    <p className="small dim madeby">
      Designed by <Link href="/#makers">Zhang and Aniket</Link>.
    </p>
  );
}
