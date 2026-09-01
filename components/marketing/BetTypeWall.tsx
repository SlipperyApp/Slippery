'use client';

import { useState } from 'react';

/** The UK and Irish bet type zoo. Being reliably best at reading a Lucky 15
 *  is the moat: US built trackers do not attempt it and the nearest
 *  competitor does not own it. Each type carries what it actually is, so the
 *  wall is a reference rather than a list of nouns. */

export const BET_TYPES: { name: string; lines: string; what: string }[] = [
  { name: 'Single', lines: '1 bet', what: 'One selection, one stake.' },
  { name: 'Double', lines: '1 bet', what: 'Two selections, both must land.' },
  { name: 'Treble', lines: '1 bet', what: 'Three selections, all three must land.' },
  { name: 'Accumulator', lines: '1 bet', what: 'Four or more, every leg must land.' },
  { name: 'Each way', lines: '2 parts', what: 'A win part and a place part, settling independently.' },
  { name: 'Trixie', lines: '4 bets', what: 'Three selections: three doubles and a treble.' },
  { name: 'Patent', lines: '7 bets', what: 'Trixie plus the three singles.' },
  { name: 'Yankee', lines: '11 bets', what: 'Four selections: six doubles, four trebles, one four-fold.' },
  { name: 'Lucky 15', lines: '15 bets', what: 'Yankee plus the four singles, with a bonus on one from four.' },
  { name: 'Canadian', lines: '26 bets', what: 'Five selections, doubles upward.' },
  { name: 'Lucky 31', lines: '31 bets', what: 'Canadian plus the five singles.' },
  { name: 'Heinz', lines: '57 bets', what: 'Six selections, doubles upward.' },
  { name: 'Lucky 63', lines: '63 bets', what: 'Heinz plus the six singles.' },
  { name: 'Goliath', lines: '247 bets', what: 'Eight selections, doubles upward. No singles.' },
  { name: 'Bet builder', lines: '1 bet', what: 'Several markets in one fixture. Always asks before grading.' },
  { name: 'Asian quarter line', lines: 'split stake', what: 'Over 2.25 on 1-1 loses half the stake, not all of it.' },
  { name: 'Cash out', lines: 'your action', what: 'Undetectable from a feed, so it is never assumed.' },
  { name: 'Partial cash out', lines: 'eighths', what: 'Of the remaining stake, relabelled after each pull.' },
  { name: 'Free bet', lines: 'stake not returned', what: 'Excluded from turnover, split out of the headline.' },
  { name: 'Boost', lines: 'price uplift', what: 'Flagged as promotional money at ingestion.' },
];

export function BetTypeWall() {
  const [open, setOpen] = useState<string | null>('Lucky 15');
  return (
    <ul className="wall" style={{ marginTop: 'var(--s6)' }}>
      {BET_TYPES.map((t) => {
        const isOpen = open === t.name;
        return (
          <li key={t.name}>
            <button
              type="button"
              className="wall__btn"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : t.name)}
            >
              <span className="wall__n">{t.name}</span>
              <span className="wall__l">{t.lines}</span>
              {isOpen ? <span className="wall__w">{t.what}</span> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
