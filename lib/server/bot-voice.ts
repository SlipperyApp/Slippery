/* WHAT THE BOT SAYS.
 *
 * Fixed scannable prefixes, no greetings, no exclamation marks. It is a
 * ledger, not a chatbot: somebody scrolling a Telegram thread needs to find
 * the line that matters, and a prefix does that where a sentence does not.
 *
 * Slip contents never appear in a log. These strings are the only thing that
 * leaves, and the only identifiers in them are the person's own.
 */
export const PREFIXES = ['READ', 'TRACKING', 'FT', 'UNREADABLE', 'DUPLICATE', 'PAUSED', 'LINKED'] as const;

export const BOT = {
  askForCode: 'Send the code from Settings in the app. It looks like SLIP-4F2K.',
  linked: (handle: string) => `LINKED to ${handle}. Forward a slip when you place it.`,
  notACode: 'Not a code I recognise.',
  codeUsedElsewhere: 'That code is on another account. Confirm the move in the app first.',
  chatOnAnotherAccount: 'This chat is already linked to another account. Send /stop first.',
  alreadyLinked: (handle: string) => `LINKED to ${handle}. Send /stop to unlink.`,
  stopped: 'Unlinked. Your bets are untouched.',
  notASlip: 'That is not a slip I can read. Send the slip itself.',
  unreadable: (fields: string[]) =>
    `UNREADABLE. Missing ${fields.join(', ')}. Reply with the value and I will merge it in.`,
  duplicate: 'DUPLICATE of a bet already logged. Add anyway or ignore.',
  paused: 'PAUSED. This account is read only. Your ledger and export still work.',
  trialOver: (ran: 'days' | 'slips') =>
    ran === 'slips'
      ? 'PAUSED. Trial slips used up. Choose a plan to keep logging.'
      : 'PAUSED. Trial has ended. Choose a plan to keep logging.',
  rateLimited: (seconds: number) => `PAUSED. Too many at once. Try again in ${seconds} seconds.`,
  readerDown: 'Cannot read slips right now, nothing lost, send it again shortly.',
  unknown: 'Send /help for what I can do.',
  wrongDocument: 'I read images and PDFs. Send the slip as a photo or a PDF.',
  alreadySaved: 'Already saved.',
  help: [
    '/today  profit today',
    '/week  profit this week',
    '/open  what is still running',
    '/last  the last bet logged',
    '/undo  remove the last bet from this chat, within 24 hours',
    '/stop  unlink this chat',
  ].join('\n'),
};

export const fieldTable = (b: {
  stake_pence: number | null; odds: number | null; selection: string | null;
  event_name: string | null; bookmaker: string | null; legs: unknown[];
}) => {
  /* A gap says "not read" in words. A dash reads as a value somebody could
     mistake for zero, and the whole point of the table is to show exactly
     which field needs filling in. */
  const gap = 'not read';
  const money = (p: number | null) => (p == null ? gap : '£' + (p / 100).toFixed(2));
  const lines = [
    `READ${b.legs.length > 1 ? ' · ' + b.legs.length + ' legs' : ''}${b.bookmaker ? ' · ' + b.bookmaker : ''}`,
    b.event_name ?? gap,
    b.selection ?? gap,
    `${b.odds ?? gap} · ${money(b.stake_pence)}${b.odds && b.stake_pence ? ' → ' + money(Math.round(b.stake_pence * b.odds)) : ''}`,
  ];
  return lines.join('\n');
};

/* Several bets in one image get one reply listing each, not one message per
   bet: a thread of six near-identical messages is unreadable. */
export const severalBets = (n: number) => `READ · ${n} bets in that image. Confirm all, or review in the app.`;

export const settledLine = (name: string, plPence: number, todayPence: number) =>
  `FT ${name} ${plPence >= 0 ? '+' : '−'}£${Math.abs(plPence / 100).toFixed(2)} · today ${todayPence >= 0 ? '+' : '−'}£${Math.abs(todayPence / 100).toFixed(2)}`;
