import { Icon } from '@/components/Icon';

/** The three steps, as three cards, on a page that scrolls at exactly the
 *  speed you scroll it.
 *
 *  WHAT WAS HERE. A 260svh track with a position: sticky stage inside it, a
 *  passive scroll listener converting scroll position into a step index, and
 *  proximity snap points. It never intercepted a wheel or a touch and it
 *  never called preventDefault, which is the polite end of scroll jacking,
 *  and it is still scroll jacking: two and a half screens of scrolling bought
 *  three cards, and the page did not go where the scroll said.
 *
 *  It is a list now. The steps are numbered, the timing sits on the number's
 *  line, and the whole thing costs one screen. Nothing here reads scroll
 *  position, so there is no listener, no track, no snap and no client
 *  JavaScript at all. */

const STEPS = [
  {
    k: 'place',
    when: 'The moment',
    title: 'You place the bet.',
    body: 'Wherever you already bet. Slippery is never between you and the bookmaker, and it never takes a stake.',
    icon: 'slip' as const,
  },
  {
    k: 'send',
    when: 'Four seconds',
    title: 'You forward the slip.',
    body: 'Before the first whistle, while you still do not know. That is the part that makes the record true.',
    icon: 'telegram' as const,
  },
  {
    k: 'settle',
    when: 'Later, on its own',
    title: 'It settles itself.',
    body: 'Ninety minute scores only. Anything uncertain asks you rather than grading it wrong.',
    icon: 'check' as const,
  },
];

export function Sequence() {
  return (
    <section className="sect" aria-label="How a bet gets into Slippery">
      <div className="wrap">
        <ol className="jack__steps">
          {STEPS.map((s, i) => (
            <li key={s.k} className="jack__step">
              <span className="jack__num mono">
                {String(i + 1).padStart(2, '0')}
                <span className="jack__when">{s.when}</span>
              </span>
              <span className="jack__body">
                <span className="jack__title">{s.title}</span>
                <span className="jack__text">{s.body}</span>
              </span>
              <Icon name={s.icon} size={22} className="jack__icon" />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
