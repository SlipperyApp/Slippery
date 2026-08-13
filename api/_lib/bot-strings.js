/* EVERY WORD THE BOT SAYS, IN ONE FILE.
 *
 * Nothing user-facing is written inline in api/telegram.js. The handlers
 * decide what happened; this decides how it is said. That split exists so
 * the copy can be read end to end and edited without reading code, and so
 * that changing a sentence cannot change behaviour.
 *
 * HOW TO EDIT
 *   · A plain string is used as it is.
 *   · A function takes named values and returns the message. The names are
 *     the only thing it can use; adding a new one means touching the
 *     handler too, so prefer rewording over new placeholders.
 *   · Markdown is Telegram's legacy Markdown: *bold*, _italic_, `code`.
 *     Anything interpolated from a user or a slip is escaped by the caller
 *     before it arrives here.
 *   · Blank lines are real. Telegram collapses nothing, so \n\n is a
 *     paragraph break and a single \n is a line break.
 *
 * HOUSE STYLE, so a new message sounds like the old ones
 *   · Say what happened, then what to do next. Never only the second.
 *   · Never claim something was saved unless it was.
 *   · No emoji. They rasterise from the system font, cannot take the
 *     product's profit and loss colours, and differ per platform.
 *   · No exclamation marks.
 *   · Say "I" for the bot. It is answering, not narrating.
 *   · A refusal explains itself in one sentence. "I will not guess at
 *     numbers I cannot see" is the tone; "invalid input" is not.
 *   · About 280 characters. A chat message longer than that is scrolled
 *     past, and the reply to a refusal is the one somebody most needs to
 *     read. Enforced by tests/bot-strings.test.mjs.
 *
 * THE TWO EXEMPTIONS, and why. `help` has to list seven commands and
 * `welcome` has to explain what the product is to somebody who has just
 * opened the chat. Both are reference text somebody reads deliberately
 * rather than a reply they are trying to get past, so they are allowed
 * 600. Nothing else is, and the test names them so a third one cannot be
 * added quietly.
 */
export const LONG_ALLOWED = ['welcome', 'help'];
export const MAX_LEN = 280;
export const MAX_LEN_LONG = 600;

/* The one place the trial numbers are worded for chat. The figures
   themselves come from promo.js so the bot and the app cannot disagree. */
export const BOT = {

  /* ---------------- first contact ---------------- */

  welcome:
    'Welcome to Slippery.\n\n' +
    'Forward me a bet slip the moment you *place* it. I read the stake, odds ' +
    'and selection off the image, watch the game, and settle it into your ' +
    'profit and loss.\n\n' +
    'Capturing at placement is the point: it is what stops a tracker quietly ' +
    'becoming a highlight reel of your winners.\n\n' +
    'To link this chat to your account, open Settings on the site and send me ' +
    'the six character code shown there, like this: /link ABC123\n\n' +
    'Send a slip whenever you are ready.',

  help:
    '*What I do*\n' +
    'Send a slip photo and I read it, then ask you to confirm.\n\n' +
    '*Commands*\n' +
    '/start, what this bot is\n' +
    '/link CODE, connect this chat to your account\n' +
    '/whoami, which account this chat is linked to\n' +
    '/unlink, disconnect this chat\n' +
    '/today, today\'s profit and loss\n' +
    '/pending, bets still running\n' +
    '/stop, pause every message from me\n\n' +
    'I never guess at a number I cannot read. If a slip is blurred I will ' +
    'ask for a clearer photo rather than invent a stake.',

  unknownCommand: 'I do not know that one. /help lists what I can do.',

  /* THINGS THAT ARE NOT A SLIP AND NOT A COMMAND.
     Each gets its own line, because "send me a bet slip" in reply to a
     voice note reads as a bot that did not notice what you sent. */
  gotVoice:
    'I cannot listen to audio. Send a screenshot of the slip and I will read it.',
  gotSticker:
    'Nice. I read bet slips though, so send me a screenshot of one.',
  gotLocation:
    'I do not do anything with locations. Send a screenshot of a bet slip instead.',
  gotFile: kind =>
    'I cannot read a ' + kind + '. Send a screenshot, a photo, or a PDF of the slip.',
  gotTextBet:
    'That looks like a bet, but I only log what I can see on a slip. ' +
    'Send the screenshot and I will read the stake and price off it.',

  /* Anything that is not a command and not an image. */
  nudge:
    'Send me a *photo or screenshot of a bet slip* and I will read it.\n\n' +
    'Forward it the moment you place the bet, not after it settles, that is the ' +
    'whole point of Slippery.\n\n/help for what else I can do.',

  stop:
    'Messages paused. Send /start when you want them back.\n\n' +
    'If you want a real break from betting itself, Settings has a break ' +
    'control that locks the app for as long as you choose, and GamCare is ' +
    'on 0808 8020 133.',

  /* ---------------- linking ---------------- */

  /* THE ONE LINE AN UNLINKED CHAT GETS, AND ONLY ONCE.
     The bot used to read a slip for an unlinked chat, print every field,
     and then quietly log nothing. That is the worst possible outcome: it
     looks like it worked. It refuses up front now, and the instructions
     are attached to the first refusal only, because repeating them on
     every message is how a helpful line becomes noise. */
  notLinked:
    'This chat is not linked to an account, so nothing I read would be saved.',
  notLinkedHow:
    '\n\nOpen Settings on the site, and send me the six character code it ' +
    'shows: /link ABC123\n\nThe code lasts ten minutes and you can generate ' +
    'a new one whenever you like.',

  linkNoCode: 'Send /link followed by the code from Settings, like /link ABC123',
  linkBadShape: c =>
    'That does not look like one of my codes. They are six characters, ' +
    'letters and numbers, with no O, I, or zero in them. You sent: ' + c,
  linkNoMatch:
    'That code did not match an account. Codes last ten minutes, so it may ' +
    'have expired. Open Settings and generate a new one.',
  linkExpired:
    'That code has expired. They last ten minutes. Open Settings and ' +
    'generate a new one.',
  /* ONE CHAT, ONE ACCOUNT, AND IT REFUSES RATHER THAN MOVING.
     Silently reassigning a linked chat means somebody's slips start landing
     in a different ledger with no message anywhere saying so. */
  linkTakenByOther: name =>
    'This chat is already linked to *' + name + '*.\n\n' +
    'I will not move it without being told to. Send /unlink first if you ' +
    'really want to connect it to a different account.',
  linkAlready: name => 'This chat is already linked to *' + name + '*. Nothing to do.',
  /* A code that has been claimed once. Told apart from a code that never
     existed, because somebody sending the same code twice is otherwise
     told it does not match an account and goes hunting a mistake they did
     not make. */
  linkUsed:
    'That code has already been used. Open Settings and generate a new one.',
  /* THE ACCOUNT IS ON ANOTHER CHAT. Refuse, do not replace.
     Replacing would mean somebody who gets hold of a code can silently
     take over where an account's slips arrive, and the real owner would
     see nothing at all. Unlinking from the old chat is deliberate and
     takes one message. */
  linkAccountElsewhere:
    'That account is already linked to a different Telegram chat.\n\n' +
    'Send /unlink from that chat first, or unlink it in Settings.',
  linked: name =>
    'Linked to *' + name + '*. Send me a slip whenever you are ready.',
  linkNoDb: 'Account linking is not available on this deployment yet.',

  /* /start from a chat that is already linked. Names the account and stops:
     repeating the how-to at somebody who has already done it is noise. */
  welcomeBack: name =>
    'This chat is linked to *' + name + '*.\n\n' +
    'Forward me a slip when you place a bet, and I will read it and log it.',

  whoami: (name, since) =>
    'This chat is linked to *' + name + '*, since ' + since + '.\n\n' +
    'Send /unlink to disconnect it.',
  whoamiNone: 'This chat is not linked to any account.',

  unlinked: name =>
    'Unlinked from *' + name + '*. I will not save anything sent here until ' +
    'it is linked again.\n\nNothing has been deleted: everything already ' +
    'logged is still on your account.',
  unlinkNone: 'This chat was not linked to anything.',

  /* ---------------- reading a slip ---------------- */

  reading: 'Reading your slip…',

  /* ---- refusals that come BEFORE an extraction call ----
     Each one costs nothing and saves an Anthropic call on a slip that
     could not have been logged anyway. */
  trialOverSlips: n =>
    'That is all ' + n + ' free slips used, so I have stopped reading. ' +
    'Subscribe in the app and send it again. Everything logged stays where it is.',
  trialOverDays:
    'Your two week trial is over, so I have stopped reading slips. ' +
    'Subscribe in the app and send it again. Everything logged stays where it is.',
  onBreak: until =>
    'You are on a break until ' + until + ', so I am not logging anything. ' +
    'A break can be extended but never shortened, including by me.',
  noReader:
    'The slip reader is not switched on for this deployment ' +
    '(ANTHROPIC_API_KEY is not set), so I cannot read that. Nothing was logged.',
  noDatabase:
    'This deployment has no database connected (DATABASE_URL is not set), ' +
    'so there is nowhere to save a bet. Nothing was logged.',
  tooFast:
    'That is a lot of slips at once. Give me a minute and send the next one.',
  downloadFailed: 'I could not download that image. Try sending it again.',
  tooLarge: 'That image is too large for me to read. Try a screenshot instead.',
  readerFailed: why => 'I could not read that one: ' + why + '. Nothing was logged.',

  unreadable:
    '*I could not read that slip.*\n\n' +
    'I will not guess at numbers I cannot see. Crop to the slip, avoid glare, ' +
    'and keep the stake, odds and result in frame.',

  slipHeadOk: '*Slip read.*\n\n',
  slipHeadPartial: '*Read it, but some fields are missing.*\n\n',

  stageSettled: '\nAlready settled on the slip.',
  stageInplay: '\nIn play. I will settle it at full time.',
  stagePrematch: '\nNot started. I will settle it at full time.',

  slipMissing: fields =>
    '\n\nI left ' + fields + ' blank rather than guess. ' +
    'Tap Edit to fill them in, or send a clearer photo.',
  slipConfirmPrompt: '\n\nConfirm to log it. Nothing is saved until you do.',
  slipNotLinked: '\n\nThis chat is not linked, so I cannot log it. Send /link with the code from Settings.',
  notLegible: '_not legible_',

  /* Button labels. Telegram allows 64 bytes of callback data, not of
     label, but short labels still read better on a phone. */
  btnConfirm: 'Confirm',
  btnDiscard: 'Discard',
  btnEdit: 'Edit',
  btnRetake: 'Retake',

  editHow: 'Send the corrected value as a message, for example `stake 25` or `odds 2.10`.',
  retakeHow: 'Send a clearer photo whenever you are ready.',
  callbackDone: 'Done.',

  /* ---------------- logging ---------------- */

  discarded: 'Discarded. Nothing was logged.',
  draftExpired:
    'That reading is more than a day old, so I have let it go. ' +
    'Send the slip again and I will read it fresh.',
  alreadyLogged: 'That one is already logged. I have not added it twice.',
  draftGone: 'That slip has already been dealt with.',
  logNoDb: 'This deployment has no database yet, so I cannot log that.',
  logFailed: 'Something went wrong saving that. Nothing was logged, try again.',

  trialUsedUp: n =>
    'That is all ' + n + ' free slips used. Upgrade in the app and send it again.',

  loggedSettled: (outcome, profit, todayNet, todayCount) =>
    'Logged as *' + outcome + '*, ' + profit + '.\n\n' +
    'Today: *' + todayNet + '* across ' + todayCount + ' settled bets.',
  loggedPending:
    'Logged. It is on your calendar now, and I will settle it when the game finishes.',

  /* ---------------- reports ---------------- */

  todayNone: 'Nothing settled today yet.',
  today: (net, n) => 'Today: *' + net + '* across ' + n + ' settled bets.',

  pendingNone: 'Nothing running right now.',
  pendingHead: (n, risk) => '*' + n + ' running*, ' + risk + ' at risk\n\n',
  pendingRow: (selection, stake, odds) =>
    '· ' + selection + ', ' + stake + ' at ' + odds,

  noDbForAccount: 'That needs an account, and this deployment has no database yet.'
};

/* THE LINK CODE ALPHABET.
 *
 * No O against 0, no I or l against 1. Somebody is reading this off one
 * screen and typing it into another, usually on a phone, often in a hurry,
 * and a code that cannot be transcribed is a code that gets regenerated
 * three times and then abandoned.
 *
 * Thirty characters, six long: 729 million codes, which is far more than
 * enough for something that lives ten minutes.
 *
 * U is out as well. It is not a legibility problem, it is that excluding it
 * removes most of the ways a random six characters spells something the
 * owner would rather not send to a customer.
 */
export const LINK_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
export const LINK_LENGTH = 6;
export const LINK_TTL_MS = 10 * 60 * 1000;

/** Is this the shape of one of our codes? Used before touching the database. */
export function looksLikeCode(input) {
  const s = String(input || '').trim().toUpperCase();
  if (s.length !== LINK_LENGTH) return false;
  for (const ch of s) if (!LINK_ALPHABET.includes(ch)) return false;
  return true;
}

/**
 * Fold what somebody types into the code we stored.
 *
 * Case and punctuation only. The confusable characters are deliberately
 * NOT mapped: none of O, 0, I, l, 1 or U is in the alphabet, so there is
 * nothing to map them to, and stripping them would shorten a six character
 * code into a five character one that fails for a reason nobody could
 * work out. A code containing one of them is a misreading, and
 * looksLikeCode says so in a sentence that names the problem.
 */
export function normaliseCode(input) {
  return String(input || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}
