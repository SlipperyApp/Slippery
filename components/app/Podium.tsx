import Link from 'next/link';
import { plural, units as fmtUnits, ordinal } from '@/lib/format';
import { LeagueLine } from '@/components/app/League';
import { pinnedRow } from '@/lib/data/social';
import type { LeagueRow } from '@/lib/data/social';

/** The top three, and then where you are.
 *
 *  IT IS TYPOGRAPHY, NOT A TROPHY. The plinth is a surface block with a
 *  border and three heights, the position is a numeral in the medal colour,
 *  and there is no cup, no laurel and no emoji anywhere near it. An emoji
 *  cannot take the profit or the loss colour, because it rasterises out of
 *  the system font, so a leaderboard drawn with them would print a losing
 *  figure in a colour that says nothing at all.
 *
 *  THE PINNED ROW IS THE POINT OF THE BLOCK. A podium on its own is three
 *  people somebody else knows. The viewer's own row sits under it in exactly
 *  the shape the table below uses, so a person in fourteenth reads their own
 *  figure without scrolling for it, and reads it in the same units and the
 *  same colour as the three above. */
export function Podium({ rows, you, period }: { rows: LeagueRow[]; you: string; period: string }) {
  const top = rows.slice(0, 3);
  const mine = pinnedRow(rows, you);
  if (top.length < 3) return null;

  return (
    <div className="podium-block">
      <ol className="podium">
        {top.map((r) => {
          const u = r.record.units;
          return (
            <li key={r.handle} className={`podium__place podium__place--${r.position}${r.handle === you ? ' podium__place--you' : ''}`}>
              <Link href={`/app/social/person?handle=${r.handle}`} className="podium__name">
                {r.name}{r.handle === you ? <span className="dim league__you">(you)</span> : null}
              </Link>
              <span className="podium__handle mono">@{r.handle}</span>
              <span className={`fig fig--s tnum podium__units ${u > 0 ? 'pos' : u < 0 ? 'neg' : ''}`}>
                {fmtUnits(u, { league: true, sign: true })}
              </span>
              {/*  The bet count is in the plinth rather than left off it.
                   A podium of three figures with nothing saying what they
                   were counted over ranks one lucky Saturday above forty
                   disciplined bets and says nothing about which it is. */}
              <span className="podium__plinth">
                <span className={`podium__pos medal medal--${r.position}`}>{ordinal(r.position)}</span>
                <span className="podium__bets tnum">{plural(r.record.bets, 'bet')}</span>
              </span>
            </li>
          );
        })}
      </ol>

      {/*  `pinnedRow` decides, and a test pins the rule. It is the table's
           own row shape so it reads as part of the same list rather than as
           a summary of it. */}
      {mine ? (
        <div className="podium__pin">
          <p className="label">Where you are, {period}</p>
          <ul>
            <LeagueLine row={mine} mine showSlipBacked={false} />
          </ul>
        </div>
      ) : null}

      {/*  WHY YOUR COUNT HERE IS BIGGER THAN THE ONE ON YOUR DASHBOARD.
           The same account read 259 bets on the dashboard, 355 on the
           balances page and 385 on this plinth. Each is right in its own
           scope and the reason is written down in lib/data/social.ts, where
           yourRecord deliberately folds the whole book because a league
           ranks a person and not a pot. Nothing on the screen said so, so
           three screens simply disagreed with each other about how many bets
           somebody has placed, which is the one thing a tracker cannot do.
           One line, on the component rather than on either page, so a third
           board cannot appear without it. */}
      <p className="small dim podium__scope">
        Counted across every balance a Slipper keeps: a league ranks a person rather than a pot.
      </p>
    </div>
  );
}
