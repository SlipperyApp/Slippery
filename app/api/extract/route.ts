import { readSlip, readerReady, toRead } from '@/lib/server/vision';
import { slipGate } from '@/lib/server/gate';
import { recordRead } from '@/lib/server/reads';
import { storeSlipImage } from '@/lib/server/slips';
import { currentAccount, sha256 } from '@/lib/server/auth';
import { fail, limitOr429, ok } from '@/lib/server/respond';
import { hasDatabase, query } from '@/lib/server/db';
import {
  REFUSAL_COPY, checkUpload, duplicateCutoff, fingerprintSource, identityOf,
  normaliseType, type SlipRead, type SlipRefusal,
} from '@/lib/data/read';
import { DEFAULT_BOOKMAKER_ID } from '@/lib/data/reference';
import { currentBalance } from '@/lib/server/balances';
import { openBalanceId } from '@/lib/data/session';
import type { Currency } from '@/lib/domain/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Every refusal answers with the same shape and its own next step.
 *
 *  The copy comes from one table shared with the browser, so the message a
 *  person gets when the upload is stopped before it leaves the phone is the
 *  same message they get when the route stops it. Two tables meant two
 *  answers to "that file is too big", and one of them was a toast with no
 *  number in it. */
function refuse(status: number, reason: SlipRefusal, detail?: string, message?: string) {
  const copy = REFUSAL_COPY[reason];
  /*  `message` overrides the table for exactly one case: the trial's own
      sentence, which says WHICH half ran out and is owned by trialState().
      Assembling it here would be a second place the trial numbers live. */
  return fail(status, reason, message ?? copy.message, { title: copy.title, tag: copy.tag, fix: copy.fix, detail });
}

/** Which currency this ledger is kept in. A slip in another one is refused
 *  rather than converted, so this decides a refusal and has to be the
 *  account's own answer, not a default sitting in the reader.
 *
 *  IT IS THE OPEN BALANCE'S, NOT THE ACCOUNT ROW'S. accounts.currency is what
 *  a balance was seeded from and nothing reads it for a figure once a balance
 *  exists, so an account whose row says GBP with the euro balance open had
 *  every euro slip refused as a currency mismatch against a balance that is
 *  kept in euro. The bet lands in the open balance, so the open balance is
 *  what the slip has to agree with. */
async function ledgerCurrency(accountId: string | null): Promise<Currency> {
  if (!accountId || !hasDatabase()) return 'GBP';
  const bal = await currentBalance(accountId, await openBalanceId()).catch(() => null);
  if (bal) return bal.currency;
  const rows = await query<{ currency: string }>(
    'select currency from accounts where id = $1 limit 1', [accountId],
  ).catch(() => []);
  return rows[0]?.currency === 'EUR' ? 'EUR' : 'GBP';
}

/** The bet this read would become, if there is already one like it.
 *
 *  DUPLICATES USED TO BE FOUND ON THE IMAGE AND NOWHERE ELSE. Two screenshots
 *  of one slip are two files, so both saved, and net, turnover, return and
 *  units all counted the bet twice with nothing on any screen saying so. The
 *  fingerprint is over the bet itself, and the window is a day, because two
 *  shots of one slip arrive within hours and the same fingerprint a week
 *  later is a different occasion.
 *
 *  It answers a question and never makes a decision. The read goes back with
 *  the match attached to it and the review screen asks. */
async function betAlreadyThere(accountId: string, read: SlipRead): Promise<SlipRead['duplicateOf']> {
  const identity = identityOf({
    // The ID, and the same default /api/bets writes: a slip whose bookmaker
    // did not read would otherwise be fingerprinted here as nothing and
    // stored there as bet365, and the check could never match its own writes.
    bookmaker: read.bookmakerId !== 'unknown' ? read.bookmakerId : DEFAULT_BOOKMAKER_ID,
    stakePerLineMinor: read.stakeMinor,
    lines: read.lines,
    eventAt: read.placedAt,
    legs: read.legs.map((l) => ({ selection: l.selection, fixture: l.fixture, odds: Number(l.odds) || null })),
  });
  // A bet nobody could identify is not matched against anything. Without a
  // stake or a price the fingerprint is mostly empty string, and an empty
  // fingerprint matches every other unreadable slip in the account.
  if (identity.stakeMinor == null || identity.odds == null) return undefined;

  const rows = await query<{ id: string; created_at: string }>(
    `select id, created_at from bets
      where account_id = $1 and bet_fingerprint = $2 and created_at > $3
      order by created_at desc limit 1`,
    [accountId, sha256(fingerprintSource(identity)), duplicateCutoff()],
  ).catch(() => []);

  return rows.length ? { id: rows[0].id, when: rows[0].created_at, matchedOn: 'bet' } : undefined;
}

/** Slip image or PDF to structured fields. It refuses to guess. */
export async function POST(req: Request) {
  const limited = limitOr429(req, 'extract', 20, 900);
  if (limited) return limited;

  if (!readerReady()) return refuse(503, 'not_configured');

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return refuse(400, 'no_file');

  /*  The same guard the browser ran, run again here. A client check saves an
   *  upload and nothing else: this is the one that decides. */
  const bad = checkUpload({ type: file.type, size: file.size, name: file.name });
  if (bad) return refuse(bad === 'too_large' ? 413 : 400, bad);
  const mediaType = normaliseType(file.type, file.name);
  if (!mediaType) return refuse(400, 'unsupported_type');

  const buf = Buffer.from(await file.arrayBuffer());
  const hash = sha256(buf);
  const account = await currentAccount();

  /*  THE GATE, BEFORE THE MODEL AND AFTER THE FILE CHECKS.
   *
   *  This route checked no plan, no trial and no read-only state, so the one
   *  call in the product that costs money per use was open to anybody with a
   *  script. Its only guard was an in-memory rate limit keyed on a forwarded
   *  IP, which on Vercel is per lambda and is therefore not a limit under any
   *  concurrency at all.
   *
   *  It sits AFTER the size and type checks because those cost nothing and
   *  their refusals are more useful, and BEFORE the duplicate fast path,
   *  because a paused account should be told it is paused rather than told
   *  about a file it is not allowed to read anyway. */
  const gate = account ? await slipGate(account.id) : null;
  if (gate && !gate.allowed) {
    return refuse(402, gate.reason, undefined, gate.message);
  }

  /*  The fast path, and only a fast path. An identical file was almost
   *  certainly sent twice, and catching it here costs nobody a slip off their
   *  allowance. It is a QUESTION now rather than the end of the journey: the
   *  answer carries `force`, which reads the same file anyway, because a
   *  second identical screenshot of a second identical bet is a thing that
   *  happens and refusing it outright loses a real bet. */
  const forced = String(form?.get('force') ?? '') === '1';
  if (account && hasDatabase() && !forced) {
    const seen = await query<{ bet_id: string | null; uploaded_at: string }>(
      `select bet_id, uploaded_at from slip_images
        where account_id = $1 and sha256 = $2 and deleted_at is null
        order by uploaded_at desc limit 1`,
      [account.id, hash],
    ).catch(() => []);
    if (seen.length) {
      return ok({
        duplicate: true,
        matchedOn: 'image',
        betId: seen[0].bet_id,
        when: seen[0].uploaded_at,
        message: 'That exact image file is already in your ledger.',
      });
    }
  }

  const currency = await ledgerCurrency(account?.id ?? null);
  const outcome = await readSlip(buf.toString('base64'), mediaType, { accountCurrency: currency });
  const readId = hash.slice(0, 16);

  if (!outcome.ok) {
    /*  A FAILED READ COSTS US AND NOT THEM. The row is written either way,
        because the tokens were spent and somebody has to be able to add the
        cost up, and recordRead only moves the counter when ok is true. */
    if (account) {
      await recordRead(account.id, {
        readId, sha256: hash, bookmakerId: null, ok: false, cost: outcome.cost,
      });
    }
    // 502 for the far end failing, 422 for an image that will never read.
    const upstream = ['unreachable', 'refused', 'unparsable', 'not_configured'].includes(outcome.reason);
    return refuse(upstream ? 502 : 422, outcome.reason, outcome.detail);
  }

  const read = toRead(outcome.result, { id: readId, currency });

  /*  THE SLIP IS SPENT HERE, on a read that worked, and nowhere else. The
      counter every surface quotes was incremented in no place in the entire
      repository, so trialState() computed "35 more slips" for ever and the
      slips half of the trial could never run out. */
  if (account) {
    await recordRead(account.id, {
      readId,
      sha256: hash,
      bookmakerId: read.bookmakerId !== 'unknown' ? read.bookmakerId : null,
      ok: true,
      cost: outcome.cost,
    });

    /*  AND THE IMAGE ITSELF, which nothing kept. It is stored here rather
        than at confirm time because this is where the bytes are, and it is
        bound to the bet when the bet is written. An image nobody turns into
        a bet is deleted by the retention sweep within two days, so an
        abandoned review does not leave somebody's slip sitting in a table. */
    await storeSlipImage(account.id, { sha256: hash, mediaType, bytes: buf });
  }

  /*  The second check, on the bet rather than on the file, which is the one
   *  a re-cropped or re-compressed screenshot cannot walk past. It never
   *  stops the read: the fields go back either way and the review screen
   *  asks, because silently skipping loses a real bet and silently saving is
   *  the defect this replaces. */
  if (account && hasDatabase()) {
    read.duplicateOf = await betAlreadyThere(account.id, read);
  }

  /*  The allowance after this read, from the same function that blocks the
      next one, so the counter on the screen cannot disagree with what stops
      an upload. Null for a paid account, which has no ceiling. */
  const after = account ? await slipGate(account.id) : null;
  return ok({ read, sha256: hash, trial: after && after.allowed ? after.trial : null });
}
