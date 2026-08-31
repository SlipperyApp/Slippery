import { NextResponse } from 'next/server';
import {
  verifySecret, botReady, sendMessage, sendChatAction, answerCallbackQuery,
  PREFIX, REPLIES,
} from '@/lib/server/telegram';
import { hasDatabase, query } from '@/lib/server/db';
import { isLinkCode, normaliseLinkCode } from '@/lib/server/codes';

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
  callback_query?: { id?: string; data?: string; from?: { id?: number }; message?: { chat?: { id?: number } } };
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

async function handle(update: Update): Promise<void> {
  if (!botReady()) return;

  // Rule three: answerCallbackQuery on EVERY callback, or the button spins
  // forever despite the write having succeeded.
  if (update.callback_query?.id) {
    const cq = update.callback_query;
    const callbackId: string = cq.id ?? '';
    const chatId = cq.message?.chat?.id;
    const [action, key] = String(cq.data ?? '').split(':', 2);
    try {
      if (action === 'confirm' && chatId) {
        const already = await confirmPending(key ?? '');
        await sendMessage(chatId, already
          ? 'Already saved. Nothing was written twice.'
          : `${PREFIX.tracking} saved. /open shows what is running.`);
      } else if (action === 'edit' && chatId) {
        await sendMessage(chatId, 'Open it in the app to change a field before it is saved.');
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

  const link = hasDatabase()
    ? (await query<{ account_id: string }>(
      'select account_id from telegram_links where telegram_user_id = $1 and dormant = false', [fromId],
    ).catch(() => []))[0]
    : undefined;

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

  if (isLinkCode(normaliseLinkCode(text))) {
    if (!hasDatabase()) { await sendMessage(chatId, REPLIES.badCode); return; }
    const code = normaliseLinkCode(text);
    const acc = await query<{ id: string }>('select id from accounts where link_code = $1', [code]).catch(() => []);
    if (!acc.length) { await sendMessage(chatId, REPLIES.badCode); return; }
    await query(
      `insert into telegram_links (telegram_user_id, chat_id, account_id, telegram_username)
       values ($1,$2,$3,$4)
       on conflict (telegram_user_id) do update set chat_id = excluded.chat_id,
         account_id = excluded.account_id, dormant = false`,
      [fromId, chatId, acc[0].id, msg.from?.username ?? null],
    ).catch(() => null);
    await sendMessage(chatId, `${PREFIX.linked} yes\nForward a slip the moment you place it.`);
    return;
  }

  const command = text.split(/\s+/)[0].toLowerCase();
  switch (command) {
    case '/start':
      await sendMessage(chatId, link
        ? `${PREFIX.linked} yes\nForward a slip when you place it. /help lists the commands.`
        : REPLIES.askForCode);
      return;
    case '/stop':
      if (hasDatabase()) await query('delete from telegram_links where telegram_user_id = $1', [fromId]).catch(() => null);
      await sendMessage(chatId, REPLIES.unlinked);
      return;
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
      await sendMessage(chatId, REPLIES.unknown);
  }
}

async function confirmPending(key: string): Promise<boolean> {
  if (!hasDatabase() || !key) return false;
  const rows = await query<{ confirmed_at: string | null }>(
    'update pending_reads set confirmed_at = now() where id = $1 and confirmed_at is null returning confirmed_at',
    [key],
  ).catch(() => []);
  return rows.length === 0;
}
