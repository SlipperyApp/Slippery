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
 *  With no URL set there is no card at all. */

/*  No role under each name. They did the same thing, so the same line twice
 *  is a caption that says nothing and looks like a template. The heading
 *  already says what they did. */
const MAKERS = [
  { name: 'Zhang', src: '/team/zhang.png' },
  { name: 'Aniket', src: '/team/aniket.png' },
];

export function Makers({ tipUrl }: { tipUrl?: string }) {
  return (
    <section className="sect" id="makers">
      <div className={`wrap makers${tipUrl ? '' : ' makers--solo'}`}>
        <div className="makers__who">
          <h2 className="sect__h">
            <span className="setup">Two people made this.</span>
            <span>Zhang and Aniket.</span>
          </h2>
          <p className="sect__p">
            They designed every screen in it.
          </p>

          <ul className="makers__list">
            {MAKERS.map((m) => (
              <li key={m.name}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.src} alt="" className="makers__face" width={64} height={64} />
                <span className="makers__name">{m.name}</span>
              </li>
            ))}
          </ul>
        </div>

        {/*  With no URL there is no card. A tip jar that says "not set up yet"
             is a control announcing its own absence, which is worse on a live
             site than the section simply not having one. */}
        {tipUrl ? (
          <div className="card makers__tip">
            <p className="card__title">Buy them a coffee</p>
            <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
              Nothing here is behind a tip.
            </p>
            <Link
              href={tipUrl}
              className="btn btn--ghost"
              style={{ marginTop: 'var(--s5)' }}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Icon name="heart" size={16} /> Send one
            </Link>
          </div>
        ) : null}
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
