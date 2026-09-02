/** The Telegram bot.
 *
 *  Three rules that are not optional, and each is a defect that has already
 *  happened somewhere:
 *
 *  1. Verify X-Telegram-Bot-Api-Secret-Token on EVERY request and 401 on a
 *     mismatch, or anybody guessing the URL can write into people's ledgers.
 *  2. Return 200 immediately and process after, deduping on update_id.
 *     Telegram retries any non-200, and a slow read otherwise creates
 *     duplicate bets.
 *  3. answerCallbackQuery on EVERY callback, or the button spins forever
 *     despite the write having succeeded.
 *
 *  Slip contents are never logged. Only a chat identifier and a short outcome
 *  line, which is what the privacy policy commits to. */

import { timingSafeEqual } from 'node:crypto';
import { has, read } from './env';
import { CURRENCY_SYMBOL, CURRENCY_WORD, type Currency } from '@/lib/format';

export function botReady(): boolean {
  return has('TELEGRAM_BOT_TOKEN') && has('TELEGRAM_WEBHOOK_SECRET');
}

/** Constant time, because a timing oracle on a shared secret is a real one. */
export function verifySecret(header: string | null): boolean {
  const expected = read('TELEGRAM_WEBHOOK_SECRET');
  if (!expected || !header) return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(header, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

async function api(method: string, body: Record<string, unknown>): Promise<unknown> {
  const token = read('TELEGRAM_BOT_TOKEN');
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    return await res.json();
  } catch {
    return null;
  }
}

export const sendMessage = (chatId: number, text: string, extra: Record<string, unknown> = {}) =>
  api('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true, ...extra });

export const sendChatAction = (chatId: number, action = 'typing') =>
  api('sendChatAction', { chat_id: chatId, action });

/** Called on EVERY callback, success or failure, or the button spins forever. */
export const answerCallbackQuery = (id: string, text?: string) =>
  api('answerCallbackQuery', { callback_query_id: id, text });

export const getFile = (fileId: string) => api('getFile', { file_id: fileId });

/** Fixed, scannable prefixes. No greetings and no exclamation marks. */
export const PREFIX = {
  read: 'READ',
  tracking: 'TRACKING',
  ft: 'FT',
  unreadable: 'UNREADABLE',
  duplicate: 'DUPLICATE',
  paused: 'PAUSED',
  linked: 'LINKED',
} as const;

/** callback_data is 64 BYTES, so state is keyed in the database and only a
 *  short key travels. */
export function callbackData(action: string, key: string): string {
  const data = `${action}:${key}`;
  return Buffer.byteLength(data, 'utf8') <= 64 ? data : `${action}:${key.slice(0, 40)}`;
}

export const REPLIES = {
  askForCode: 'LINKED no\nSend the code from Settings, Add a bet, the Telegram bot. It looks like SLIP-ABCD.',
  badCode: 'Not a code I recognise. Check it in the app under Add a bet.',
  codeElsewhere: 'That code is linked to another chat. Confirm the move in the app first.',
  unlinked: 'LINKED no\nThis chat is no longer linked. Your bets are untouched.',
  notASlip: 'That does not look like a betting slip, so nothing was read from it.',
  readerDown: 'UNREADABLE\nCannot read slips right now. Nothing is lost, send it again shortly.',
  paused: 'PAUSED\nThe account is read only, so nothing was read. The ledger and the export still work.',
  help: [
    'Commands',
    '/today   today’s figures',
    '/week    this week’s figures',
    '/open    what is running',
    '/last    the last bet logged',
    '/balance which balance a bet from this chat is filed in',
    '/undo    remove the last bet from this chat, within 24 hours',
    '/stop    unlink this chat',
  ].join('\n'),
  unknown: 'Not a command I know. /help lists them.',
  noBalance: 'This account has no balance yet. Open the app once and one is made, and this will say which.',
};

/** WHICH BALANCE A BET FROM THIS CHAT IS FILED IN.
 *
 *  An account keeps several balances now, each with its own currency, its own
 *  unit and its own figures, and every entry path in the app asks which one a
 *  bet lands in. A chat cannot be asked: a slip arrives as a photograph with
 *  no room for a question, and a keyboard of balance buttons in front of every
 *  forward would be four taps on the one route that exists to be nought.
 *
 *  So a chat files into the account's first balance, and this is where that
 *  is said out loud. Somebody keeping a matched betting float apart from a
 *  football bank has to be able to find out which one the bot uses without
 *  placing a bet and reading the balance sheet afterwards. The list beside it
 *  is the rest, so the answer is checkable rather than asserted.
 *
 *  It offers the app rather than an ordering control, because there is no
 *  ordering control: the review screen asks before it writes, and that is the
 *  way to put a slip somewhere else that this build actually keeps. */
export function balanceReply(balances: { name: string; currency: Currency }[]): string {
  const here = balances[0];
  if (!here) return REPLIES.noBalance;
  const lines = [
    `${here.name}, kept in ${CURRENCY_WORD[here.currency]}.`,
    'A bet from this chat is filed there. A chat cannot ask which balance you mean.',
  ];
  if (balances.length > 1) {
    lines.push('', `All ${balances.length}: ${balances.map((b) => `${b.name} (${CURRENCY_SYMBOL[b.currency]})`).join(', ')}.`);
    lines.push('', 'To put one in another balance, send it in the app instead. The review screen asks before it writes.');
  }
  return lines.join('\n');
}

export function trialExhausted(which: 'days' | 'slips', appUrl: string): string {
  return which === 'slips'
    ? `PAUSED\nThe trial slips have run out. The ledger and the export still work.\n${appUrl}/app/settings/plan`
    : `PAUSED\nThe 14 day trial has ended. The ledger and the export still work.\n${appUrl}/app/settings/plan`;
}

export function rateLimited(seconds: number): string {
  return `PAUSED\nToo many at once. Try again in ${seconds} seconds.`;
}
