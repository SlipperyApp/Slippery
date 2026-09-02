import { NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import {
  verifySecret, botReady, sendMessage, sendChatAction, answerCallbackQuery,
  callbackData, PREFIX, REPLIES,
} from '@/lib/server/telegram';
import { hasDatabase, pooled, query, transaction } from '@/lib/server/db';
import { isLinkCode, normaliseLinkCode } from '@/lib/server/codes';
import {
  LINK_CODE_TTL_MINUTES,
  accountForChat, confirmLinkMove, redeemLinkCode, unlinkChat, wakeChat,
  type RedeemResult,
} from '@/lib/server/telegram-link';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Update = {
  update_id?: number;
  message?: {
    message_id?: number;
    chat?: { id?: number };
    from?: { id?: number; username?: string };
    text?: string;
    photo?: { file_id: string }[];
    document?: { file_id: string; mime_type?: string; file_name?: string };
    media_group_id?: string;
  };
  callback_query?: { id?: string; data?: string; from?: { id?: number; username?: string }; message?: { chat?: { id?: number } } };
  my_chat_member?: { chat?: { id?: number }; new_chat_member?: { status?: string } };
};

/** Return 200 immediately and process after. Telegram retries any non-200,
 *  and a slow read otherwise creates duplicate bets. */
export async function POST(req: Request) {
  // Rule one: verify the secret on EVERY request, before anything is read.
  if (!verifySecret(req.headers.get('x-telegram-bot-api-secret-token'))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: Update;
  try { update = (await req.json()) as Update; } catch { return NextResponse.json({ ok: true }); }

  // Rule two: dedupe on update_id, so a retry cannot double-write.
  if (hasDatabase() && typeof update.update_id === 'number') {
    try {
      const rows = await query<{ update_id: string }>(
        'insert into telegram_updates (update_id) values ($1) on conflict do nothing returning update_id',
        [update.update_id],
      );
      if (!rows.length) return NextResponse.json({ ok: true, duplicate: true });
    } catch {
      // A guard that cannot be written is not a reason to drop the update.
    }
  }

  // Answered now; the work happens after the response is on its way.
  const work = handle(update).catch(() => { /* never logged with slip contents */ });
  if (process.env.VERCEL) { /* the platform waits for the handler to settle */ await work; }
  else await work;

  return NextResponse.json({ ok: true });
}

/*  What the bot says about a redeem, in one table.
 *
 *  Every branch says what happened to the CODE, because a person who cannot
 *  tell "wrong code" from "code already used" reads both as the app being
 *  broken and sends the same code again. None of them names the account a
 *  code belongs to: the chat that sent a guess is not entitled to know whose
 *  guess it nearly was. */
const LINK_REPLY: Record<Exclude<RedeemResult['status'], 'needs_confirmation' | 'too_many'>, string> = {
  linked: `${PREFIX.linked} yes\nForward a slip the moment you place it. /help lists the commands.`,
  already_linked: `${PREFIX.linked} yes\nThis chat is already on that account. Nothing changed and the code is unspent.`,
  unknown: REPLIES.badCode,
  expired: `That code has expired. They last ${LINK_CODE_TTL_MINUTES} minutes. Issue another in the app under Add a bet.`,
  used: 'That code has already been used. A code works once. Issue another in the app under Add a bet.',
  revoked: 'That code was replaced by a newer one. Send the newest code the app is showing you.',
};

/** A chat that is already linked is never moved by a message. It is moved by
 *  pressing this, and by nothing else. */
const MOVE_ASK = [
  'This chat is already linked to another account.',
  'Moving it means every slip forwarded from here lands in the new ledger instead.',
  'Nothing moves unless you confirm it.',
].join('\n');

const CANNOT_LINK = 'Cannot link right now. Nothing changed, so send the code again shortly.';

async function say(chatId: number, result: RedeemResult): Promise<void> {
  if (result.status === 'too_many') {
    await sendMessage(chatId, `Too many wrong codes. Try again in ${Math.ceil(result.retryAfterSeconds / 60)} minutes.`);
    return;
  }
  if (result.status === 'needs_confirmation') {
    await sendMessage(chatId, MOVE_ASK, {
      reply_markup: {
        inline_keyboard: [[{ text: 'Move this chat', callback_data: callbackData('tglink', result.moveKey) }]],
      },
    });
    return;
  }
  await sendMessage(chatId, LINK_REPLY[result.status]);
}

async function handle(update: Update): Promise<void> {
  if (!botReady()) return;

  // Rule three: answerCallbackQuery on EVERY callback, or the button spins
  // forever despite the write having succeeded.
  if (update.callback_query?.id) {
    const cq = update.callback_query;
    const callbackId: string = cq.id ?? '';
    const chatId = cq.message?.chat?.id;
    const pressedBy = cq.from?.id;
    const pressedByName = cq.from?.username ?? null;
    const [action, key] = String(cq.data ?? '').split(':', 2);
    try {
      if (action === 'confirm' && chatId) {
        const already = await confirmPending(key ?? '');
        await sendMessage(chatId, already
          ? 'Already saved. Nothing was written twice.'
          : `${PREFIX.tracking} saved. /open shows what is running.`);
      } else if (action === 'edit' && chatId) {
        await sendMessage(chatId, 'Open it in the app to change a field before it is saved.');
      } else if (action === 'tglink' && chatId && typeof pressedBy === 'number') {
        /*  The move, confirmed. The code is spent HERE and not when the
            button was drawn, so a code that expired while the button sat
            unpressed still cannot bind anything. */
        const result = await write((client) => confirmLinkMove(client, {
          moveKey: key ?? '',
          chatId,
          telegramUserId: pressedBy,
          telegramUsername: pressedByName,
        }));
        await (result ? say(chatId, result) : sendMessage(chatId, CANNOT_LINK));
      }
    } finally {
      await answerCallbackQuery(callbackId, 'Done');
    }
    return;
  }

  // A blocked or removed bot marks the link dormant. It never deletes it.
  if (update.my_chat_member) {
    const status = update.my_chat_member.new_chat_member?.status;
    const chatId = update.my_chat_member.chat?.id;
    if (chatId && (status === 'kicked' || status === 'left') && hasDatabase()) {
      await query('update telegram_links set dormant = true where chat_id = $1', [chatId]).catch(() => null);
    }
    return;
  }

  const msg = update.message;
  const chatId = msg?.chat?.id;
  const fromId = msg?.from?.id;
  if (!chatId || !fromId) return;

  /*  THE BINDING IS THE CHAT, not the sender. It was read by
      telegram_user_id, which in a group chat is whoever typed last: two
      members of one chat could point it at two ledgers and a forwarded slip
      landed in whichever of them forwarded it. */
  const link = hasDatabase()
    ? await accountForChat(pooled, chatId).catch(() => null)
    : null;

  // Blocking the bot marks a link dormant and deletes nothing. A chat that is
  // talking again is not dormant, so it does not have to link a second time.
  if (link?.dormant) await write((client) => wakeChat(client, chatId));

  const text = (msg.text ?? '').trim();

  // A photo from an unlinked chat is NOT read. The code is asked for first.
  if (msg.photo?.length || msg.document) {
    if (!link) { await sendMessage(chatId, REPLIES.askForCode); return; }
    const mime = msg.document?.mime_type ?? 'image/jpeg';
    if (msg.document && !/^image\/|^application\/pdf$/.test(mime)) {
      await sendMessage(chatId, 'That file type is not accepted. Send a photo, a screenshot or a PDF.');
      return;
    }
    await sendChatAction(chatId, 'typing');
    await sendMessage(chatId, REPLIES.readerDown);
    return;
  }

  if (!text) return;

  const words = text.split(/\s+/);
  const command = words[0].toLowerCase();

  /*  Both ways in: the code on its own, and /start with the code after it,
      which is what a t.me deep link sends and what the app tells people to
      paste. They redeem the same way, through the same guards. */
  const typed = command === '/start' && words[1] ? words[1] : text;
  if (isLinkCode(normaliseLinkCode(typed))) {
    await redeem(chatId, fromId, msg.from?.username ?? null, normaliseLinkCode(typed));
    return;
  }

  switch (command) {
    case '/start':
      await sendMessage(chatId, link
        ? `${PREFIX.linked} yes\nForward a slip when you place it. /help lists the commands.`
        : REPLIES.askForCode);
      return;
    case '/stop': {
      if (!link) { await sendMessage(chatId, REPLIES.askForCode); return; }
      const removed = await write((client) => unlinkChat(client, { chatId }));
      await sendMessage(chatId, removed === null ? CANNOT_LINK : REPLIES.unlinked);
      return;
    }
    case '/help':
      await sendMessage(chatId, REPLIES.help);
      return;
    case '/today':
    case '/week':
    case '/open':
    case '/last':
    case '/undo':
      if (!link) { await sendMessage(chatId, REPLIES.askForCode); return; }
      await sendMessage(chatId, `${PREFIX.tracking} open it in the app for the figures: /app/ledger`);
      return;
    default:
      /*  AN UNLINKED CHAT IS TOLD HOW TO LINK, whatever it sent. It used to
          get "Not a command I know" for anything that was not a code, which
          is a dead end: the one thing that chat needs to be told is the one
          thing it was never told. */
      await sendMessage(chatId, link ? REPLIES.unknown : REPLIES.askForCode);
  }
}

async function redeem(chatId: number, fromId: number, username: string | null, code: string): Promise<void> {
  if (!hasDatabase()) { await sendMessage(chatId, CANNOT_LINK); return; }
  const result = await write((client) => redeemLinkCode(client, {
    code, chatId, telegramUserId: fromId, telegramUsername: username,
  }));
  // The code is never echoed back into the chat and never logged, here or
  // anywhere: it is a key to a ledger for as long as it is live.
  await (result ? say(chatId, result) : sendMessage(chatId, CANNOT_LINK));
}

/** One transaction, and null when the database refused.
 *
 *  The consume and the binding are two statements, and a failure between them
 *  would spend a code without linking anything: the person then has a code
 *  that says it is used and a chat that is not linked. */
async function write<T>(fn: (client: PoolClient) => Promise<T>): Promise<T | null> {
  if (!hasDatabase()) return null;
  return transaction(fn).catch(() => null);
}

async function confirmPending(key: string): Promise<boolean> {
  if (!hasDatabase() || !key) return false;
  const rows = await query<{ confirmed_at: string | null }>(
    'update pending_reads set confirmed_at = now() where id = $1 and confirmed_at is null returning confirmed_at',
    [key],
  ).catch(() => []);
  return rows.length === 0;
}
