import 'server-only';
import { env } from './env';

/* Talking to Telegram.
 *
 * NEVER LOG SLIP CONTENTS. Chat id and a short outcome line only, which is
 * what the privacy policy commits to. Nothing in this file writes a message
 * body, a caption or a file to a log.
 */
const api = (method: string) => `https://api.telegram.org/bot${env.telegramBotToken()}/${method}`;

async function call(method: string, body: unknown) {
  const token = env.telegramBotToken();
  if (!token) return null;
  try {
    const r = await fetch(api(method), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await r.json();
  } catch {
    return null;
  }
}

export const sendMessage = (chatId: number | bigint, text: string, replyMarkup?: unknown) =>
  call('sendMessage', { chat_id: Number(chatId), text, reply_markup: replyMarkup, disable_web_page_preview: true });

export const sendChatAction = (chatId: number | bigint, action = 'typing') =>
  call('sendChatAction', { chat_id: Number(chatId), action });

/* CALLED ON EVERY CALLBACK, WITHOUT EXCEPTION. Telegram spins the button
   until this arrives, so a write that succeeded still looks broken. */
export const answerCallbackQuery = (id: string, text?: string) =>
  call('answerCallbackQuery', { callback_query_id: id, text });

export async function getFileBytes(fileId: string): Promise<{ bytes: Buffer; mediaType: string } | null> {
  const token = env.telegramBotToken();
  if (!token) return null;
  const info = (await call('getFile', { file_id: fileId })) as { ok?: boolean; result?: { file_path?: string } } | null;
  const path = info?.result?.file_path;
  if (!path) return null;
  /* Downloaded immediately: the link expires in about an hour, so deferring
     it to a queue is how a slip becomes unreadable an hour later. */
  const r = await fetch(`https://api.telegram.org/file/bot${token}/${path}`);
  if (!r.ok) return null;
  const bytes = Buffer.from(await r.arrayBuffer());
  const mediaType = /\.png$/i.test(path) ? 'image/png'
    : /\.webp$/i.test(path) ? 'image/webp'
      : /\.pdf$/i.test(path) ? 'application/pdf' : 'image/jpeg';
  return { bytes, mediaType };
}

import { COMMANDS, callbackData } from './telegram-pure';
export { COMMANDS, callbackData } from './telegram-pure';

export const setMyCommands = () => call('setMyCommands', { commands: COMMANDS });

/* Registered deliberately, from an admin call, never from inside a cron.
   The old app re-registered the webhook every time its results sweep ran,
   which meant the first deployment to run a cron silently repointed the bot
   at itself with no coordination and no way to stage a cutover. */
export const setWebhook = (url: string) =>
  call('setWebhook', {
    url,
    secret_token: env.telegramWebhookSecret(),
    allowed_updates: ['message', 'callback_query', 'my_chat_member'],
    drop_pending_updates: false,
  });

