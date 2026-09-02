import { hasDatabase, pooled, transaction } from '@/lib/server/db';
import { currentAccount } from '@/lib/server/auth';
import { fail, limitOr429, ok, readJson, str } from '@/lib/server/respond';
import { botReady } from '@/lib/server/telegram';
import {
  BOT_HANDLE, LINK_CODE_TTL_MINUTES,
  issueLinkCode, linkStatus, revokeLinkCodes, unlinkChat,
} from '@/lib/server/telegram-link';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The web half of linking a Telegram chat.
 *
 *  GET says where the account stands. POST issues a code, revokes it, or
 *  unlinks. The code is in the issue response and NOWHERE else: only its HMAC
 *  is stored, so GET cannot hand it back and a log line cannot leak it. A
 *  person who loses the code issues another, which revokes the first. */
export async function GET() {
  if (!hasDatabase()) {
    return fail(503, 'no_store', 'This deployment has no database, so there is nothing to link a chat to.', {
      botReady: botReady(), botHandle: BOT_HANDLE,
    });
  }
  const account = await currentAccount();
  if (!account) {
    return fail(401, 'no_session', 'You are looking at the example account, so there is no chat to link.', {
      botReady: botReady(), botHandle: BOT_HANDLE,
    });
  }

  const status = await linkStatus(pooled, account.id);
  return ok({ ...status, botReady: botReady(), botHandle: BOT_HANDLE, ttlMinutes: LINK_CODE_TTL_MINUTES });
}

export async function POST(req: Request) {
  // Issuing writes a row and every issue revokes the last one, so the limit is
  // on the route rather than on the action: twenty in five minutes is far more
  // than linking a chat takes and far less than a way to fill the table.
  const limited = limitOr429(req, 'telegram-link', 20, 300);
  if (limited) return limited;

  const body = await readJson(req);
  const action = str(body.action);

  if (!hasDatabase()) {
    return fail(503, 'no_store', 'This deployment has no database, so no code can be issued.');
  }
  const account = await currentAccount();
  if (!account) {
    return fail(401, 'no_session', 'You are looking at the example account, so there is no chat to link.');
  }

  if (action === 'issue') {
    if (!botReady()) {
      /*  Honest refusal rather than a code nobody can spend: without a token
          the bot cannot answer, so the code would expire unused and the
          person would blame the code. */
      return fail(503, 'bot_not_configured', 'The bot is not configured on this deployment, so a code would go nowhere.');
    }
    const issued = await transaction((client) => issueLinkCode(client, account.id));
    // The code travels in this response and is never written down anywhere
    // else, this log included: there is no log.
    return ok({
      code: issued.code,
      sendText: issued.sendText,
      expiresAt: issued.expiresAt,
      ttlSeconds: issued.ttlSeconds,
      botHandle: BOT_HANDLE,
    });
  }

  if (action === 'revoke') {
    const revoked = await transaction((client) => revokeLinkCodes(client, account.id));
    return ok({ revoked });
  }

  if (action === 'unlink') {
    /*  Unlinking revokes the live code as well. Leaving one alive means the
        chat somebody just detached can re-attach itself from the code still
        sitting in its history. Bets are untouched, which is what the bot's
        reply promises. */
    const removed = await transaction(async (client) => {
      const n = await unlinkChat(client, { accountId: account.id });
      await revokeLinkCodes(client, account.id);
      return n;
    });
    return ok({ unlinked: removed });
  }

  return fail(400, 'bad_action', 'That is not an action this route knows, so nothing changed.');
}
