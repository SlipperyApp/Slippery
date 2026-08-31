/** The history import.
 *
 *  A dry run is the DEFAULT and it writes nothing. Anything that cannot be
 *  split reliably goes to a resolve step rather than being guessed at: a team
 *  or market name containing an ampersand is exactly the case that turned
 *  multiples into one row joined by "&" last time. */

export type DryRunCounts = {
  rowsRead: number;
  wouldCreate: number;
  wouldMerge: number;
  duplicateSkip: number;
  needsYou: number;
  unparseable: number;
};

export type Unresolved = {
  id: string;
  raw: string;
  why: string;
  /** The split the reader would guess at, offered but never applied silently. */
  suggestion: string[];
};

export const DRY_RUN: DryRunCounts = {
  rowsRead: 1284,
  wouldCreate: 1197,
  wouldMerge: 54,
  duplicateSkip: 19,
  needsYou: 14,
  unparseable: 0,
};

export const UNRESOLVED: Unresolved[] = [
  {
    id: 'u1',
    raw: 'Brighton & Hove Albion to win & Over 2.5 goals',
    why: 'Two ampersands, and one of them is inside a club name.',
    suggestion: ['Brighton & Hove Albion to win', 'Over 2.5 goals'],
  },
  {
    id: 'u2',
    raw: 'Both teams to score & win & Draw no bet',
    why: 'The first market contains the word the splitter uses.',
    suggestion: ['Both teams to score & win', 'Draw no bet'],
  },
  {
    id: 'u3',
    raw: 'Sheffield Wed & Sheffield Utd both to win',
    why: 'One selection about two teams, or two selections. It cannot be told from the text.',
    suggestion: ['Sheffield Wed & Sheffield Utd both to win'],
  },
  {
    id: 'u4',
    raw: 'Over 2.25 & Under 3.25',
    why: 'Two quarter lines in one string, each of which splits its own stake.',
    suggestion: ['Over 2.25', 'Under 3.25'],
  },
  {
    id: 'u5',
    raw: 'A. Isak anytime & Newcastle -1',
    why: 'A player market, which never grades from a feed, combined with a handicap.',
    suggestion: ['A. Isak anytime', 'Newcastle -1'],
  },
];

export const COLUMN_GUESSES: { theirs: string; ours: string; sure: boolean }[] = [
  { theirs: 'Date', ours: 'Kick-off (event_at)', sure: true },
  { theirs: 'Selection', ours: 'Selection', sure: true },
  { theirs: 'Stake', ours: 'Stake', sure: true },
  { theirs: 'Odds', ours: 'Price, decimal', sure: true },
  { theirs: 'Bookie', ours: 'Bookmaker', sure: true },
  { theirs: 'Result', ours: 'First settlement event', sure: true },
  { theirs: 'Returns', ours: 'Returned', sure: true },
  { theirs: 'Notes', ours: 'Note', sure: true },
  { theirs: 'Tipster', ours: 'Tipster', sure: false },
  { theirs: 'Comp', ours: 'Competition', sure: false },
];
