import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { getViewer } from '@/lib/data/session';
import { EmptySocial, SOCIAL_EXAMPLE_NOTE } from '@/components/app/EmptySocial';
import {
  YOU, TRACKING_FEED_MAX, feed, findSlipper, trackingFeed, trackingOptedIn,
} from '@/lib/data/social';
import { ago, dateTime, dayKey, gap, initials, plural, timeOfDay, units as fmtUnits } from '@/lib/format';
import { formatOdds } from '@/lib/odds';

export const metadata: Metadata = {
  title: 'Feed',
  description: 'What Slippers are tracking, and what they have been doing in the app. No results, either way.',
};

/*  There is no streak kind. It was removed with the badge behind it: a line
    reading "captured a slip every day for 30 days" is a volume reward with an
    audience. See the note over feed() in lib/data/social.ts. */
const KIND_ICON: Record<string, 'check' | 'social' | 'upload' | 'shield' | 'trophy' | 'sliders'> = {
  settle: 'check', join: 'social', import: 'upload', 'slip-backed': 'shield',
  group: 'trophy', unit: 'sliders',
};

/*  TWO TABS, NOT TWO SECTIONS.
 *
 *  They are two different kinds of thing and only one of them expires. A
 *  tracking item is true until the event starts and then it is gone; an
 *  activity line is true for ever. Stacked as sections, somebody scrolling
 *  past the first would read the second as a continuation of it, and the
 *  boundary is exactly what carries the rule: everything above it was
 *  captured before the off and nothing above it will ever say how it went.
 *  A tab makes that an edge rather than a gap in the scroll. */
const TABS = [
  { id: 'tracking', label: 'Tracking now' },
  { id: 'activity', label: 'Activity' },
] as const;

export default async function Feed({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { now, data, source } = await getViewer();

  /*  THE SOCIAL GRAPH ON THIS SCREEN IS THE EXAMPLE ACCOUNT'S. It is folded
      out of lib/data/social.ts, which invents the Slippers around
      @tester123, so showing it to a signed-in account would place that
      person first in a league of bets they never placed. Signed out, on the
      marketing site and on /demo, it is exactly the right thing to show. */
  if (source !== 'example') {
    return <EmptySocial title="Feed" note={SOCIAL_EXAMPLE_NOTE} />;
  }

  /*  A kick off time is shown as a clock time only when it is today, and
      which day that is depends on the account's zone rather than the
      server's: a 23:40 off in Dublin is tomorrow in Berlin.

      OFF THE ACCOUNT, LIKE EVERY OTHER PAGE. This was the one screen reading
      the zone off the shell's chrome object, which carried it only to print
      "Times in UK time" under a greeting; both of those are gone, and a
      field kept alive on the chrome for a single date format is a second
      route to a fact the account already states. */
  const tz = data.account.timeZone;
  const wanted = typeof sp.tab === 'string' ? sp.tab : '';
  const tab = TABS.some((t) => t.id === wanted) ? wanted : 'tracking';

  const tracking = trackingFeed(now);
  const optedIn = trackingOptedIn(now);
  const me = findSlipper(YOU, now);
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
        Nothing here says who won what. One half is bets that have not started yet, which go when
        they do; the other is what people have been doing in the app.
      </p>

      <div className="seg seg--gap" role="group" aria-label="Which feed" style={{ marginTop: 'var(--s5)' }}>
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/app/social/feed?tab=${t.id}`}
            className="seg__btn"
            aria-current={t.id === tab ? 'page' : undefined}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/*  THE FEED SCROLLS AND ITS TWO TABS DO NOT. Measured at 1440 by 900:
           1,577 pixels of tracking against the 824 the window leaves, so the
           sentence saying an item goes when the event starts, and the card
           saying why you are not in the list, were both under the fold. The
           heading, the lead and the tabs stay put. */}
      <div className="fitcol fitcol--scroll">
      {tab === 'tracking' ? (
        <>
          <div className="card" style={{ marginTop: 'var(--s4)' }}>
            <div className="card__head">
              <h2 className="card__title">Tracking now</h2>
            </div>

            {tracking.length === 0 ? (
              <p className="small muted" style={{ marginTop: 'var(--s4)' }}>
                Nothing is waiting to start. An item appears when a Slipper who has turned this on
                captures a bet before the off, and it goes when the event starts.
              </p>
            ) : (
              <ul>
                {/*  NO TAIL BUTTON, NO COPY THIS BET, AND NOTHING COUNTING
                     WHO LOOKED AT WHAT. A control that turns somebody else's
                     bet into your bet is a tip with an extra step, and this
                     product does not give tips. There is no affordance on
                     this row but the person's name. */}
                {/*  FIVE CELLS FROM 1000 UP, ONE STACK BELOW IT.
                     At 1920 this row was a name against the left edge of a
                     1620 pixel card with a countdown against the right and
                     everything that matters about the bet stacked underneath
                     in the left third. The cells are siblings now, so a wide
                     window lays them out across and a phone lays them down,
                     and the phone's line order is the one it always had. */}
                {tracking.map((t) => (
                  <li key={t.id} className="brow trk__row">
                    <span className="avatar trk__av" aria-hidden="true">{initials(t.name)}</span>
                    <span className="trk__who">
                      <Link href={`/app/social/person?handle=${t.handle}`} className="brow__title" style={{ textDecoration: 'none' }}>
                        {t.name}
                      </Link>
                    </span>
                    <span className="brow__sub trk__bet">
                      {t.selection} · {t.eventName}
                    </span>
                    <span className="trk__meta">
                      <span className="pill pill--asis mono">{formatOdds(t.price, 'decimal')}</span>
                      <span className="pill pill--asis tnum">{fmtUnits(t.stakeUnits)}</span>
                      <span className="pill">{t.bookmaker}</span>
                    </span>
                    {/*  How far ahead of the off it was captured is the whole
                         claim this row makes, so it has a cell of its own
                         rather than a fourth line under everything else. */}
                    <span className="small dim trk__lead">
                      captured {gap(t.capturedAt, t.startsAt)} before the off
                    </span>
                    <span className="trk__when">
                      <span className="small">in {gap(now, t.startsAt)}</span>
                      <span className="small dim tnum">
                        {dayKey(t.startsAt, tz) === dayKey(now, tz) ? timeOfDay(t.startsAt, tz) : dateTime(t.startsAt, now)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <p className="small dim card__foot">
              {tracking.length >= TRACKING_FEED_MAX
                ? `${TRACKING_FEED_MAX} shown and then it stops. `
                : `${plural(tracking.length, 'bet')}, and then it stops. `}
              A bet is here only while it is still to start. When the event begins the item goes,
              and it is never brought back with a result: a record written after the off is a record
              of the bets somebody felt like writing down.
            </p>
          </div>

          <div className="card" style={{ marginTop: 'var(--s4)' }}>
            <h2 className="card__title">You are not in this list</h2>
            <p className="small muted" style={{ marginTop: 'var(--s3)' }}>
              {me?.tracking
                ? 'Your open bets appear here in units, with no stake and no result.'
                : 'Showing what you are tracking is off, which is what it is for every account until somebody turns it on. '}
              {optedIn.length} of the Slippers you can see have turned it on, and nobody else
              appears above however many bets they capture.
            </p>
            <div className="card__foot">
              <Link href="/app/settings?pane=sharing" className="btn btn--ghost btn--sm">
                <Icon name="sliders" size={15} /> Sharing settings
              </Link>
            </div>
          </div>
        </>
      ) : (
        <div className="card" style={{ marginTop: 'var(--s4)' }}>
          <div className="card__head">
            <h2 className="card__title">Activity</h2>
            <p className="card__note">App actions only</p>
          </div>
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
            That is everything from the last three days. There is no infinite scroll here on purpose,
            and nothing here celebrates a betting outcome.
          </p>
        </div>
      )}
      </div>
    </>
  );
}
