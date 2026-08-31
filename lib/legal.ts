/** Terms and Privacy.
 *
 *  These are the working texts. **The final wording is an owner task**, and
 *  it is flagged at the top of both pages rather than quietly presented as
 *  settled: the ICO registration position and the exact retention wording are
 *  not decisions this build gets to make. */

export const TERMS_UPDATED = '31 August 2026';

export const TERMS: { h: string; p: string[] }[] = [
  { h: 'What Slippery is', p: [
    'Slippery is a record keeping tool for bets you place elsewhere. You place a bet with a bookmaker, you send Slippery the slip, and Slippery keeps the record and reports on it.',
    'Slippery does not accept bets, hold money, pay winnings, offer odds, act as an intermediary between you and any bookmaker, or give tips or advice about what to bet on. No feature will ever do any of these things.',
  ] },
  { h: 'Who can use it', p: [
    'You must be 18 or over. You confirm this when you create an account and the confirmation is stored with the date and time you gave it.',
    'You must be permitted to hold a betting account in the country you are in. Slippery does not check this on your behalf and does not verify your identity.',
  ] },
  { h: 'Your account', p: [
    'You are responsible for your sign-in details and for anything done through your account. Tell us promptly if you think someone else has access.',
    'One person, one account. Sharing an account makes the record meaningless, which defeats the point of keeping one.',
  ] },
  { h: 'What you send us', p: [
    'You keep every right you have in the slips and data you send. You give Slippery permission to store and process them so it can do what you asked it to do, and for no other purpose.',
    'Do not send material you do not have the right to send, or anything containing another person’s financial details.',
  ] },
  { h: 'Accuracy', p: [
    'Slippery reads slips and settles bets automatically and it will sometimes be wrong. Where it is uncertain it asks rather than guessing, but a reading or a settlement can still be incorrect.',
    'You are responsible for checking your own record. Every read is confirmable before it is written and every settled bet can be corrected afterwards; a correction is recorded rather than overwriting what came before.',
    'Slippery is not a source of truth about your bookmaker account. Your bookmaker is.',
  ] },
  { h: 'Paying', p: [
    'The trial is 14 days or 35 slips, whichever runs out first. A card is required to start it. The yearly plan begins automatically when the trial ends unless you cancel first, and there is deliberately no reminder email.',
    'Prices are £3.49 a month or £29.99 a year and include VAT where it applies. Payments are handled by Stripe; Slippery never sees or stores your card number.',
    'If a payment fails it is retried once after three days. After two failed attempts the account becomes read only.',
  ] },
  { h: 'Read only', p: [
    'Read only pauses new slips, imports and the Telegram bot. Your ledger, your history and your export stay fully available.',
    'Nothing is deleted because of a failed payment, ever. Adding a working card restores everything immediately.',
  ] },
  { h: 'Cancelling', p: [
    'You can cancel at any time from Settings. You keep access until the end of the period you have paid for.',
    'Your export keeps working after you cancel, because a betting record belongs to the person who kept it.',
  ] },
  { h: 'Slip images', p: [
    'Slip images are deleted 90 days after upload, or immediately if you ask. The bet stays; only the image goes, and the gallery says so rather than showing a broken thumbnail.',
  ] },
  { h: 'Groups', p: [
    'Inside a group, members can see each other’s unit size and this cannot be turned off while you are a member. Outside a group only units are visible, never stakes.',
    'Groups cannot be renamed once created. Group administrators can remove members and set whether the group requires slip backed bets.',
  ] },
  { h: 'Acceptable use', p: [
    'Do not use Slippery to run a tipping service, to advertise, to harass anyone, or to attempt to access another account. Do not attempt to overload or break the service.',
    'An account used to promote gambling to people under 18, in any group or in any profile field, is closed without notice.',
  ] },
  { h: 'Availability', p: [
    'Slippery is provided as it is. It depends on services outside our control, including results feeds, and it will occasionally be unavailable or behind.',
    'Where a results feed cannot prove a result, bets are left for you to settle rather than being guessed at. A delay is not an error.',
  ] },
  { h: 'Liability', p: [
    'Slippery is a record. It is not advice, and it does not tell you what to bet on or how much. Decisions you make about gambling are yours.',
    'To the extent the law allows, Slippery is not liable for gambling losses, for decisions taken on the basis of its figures, or for a bookmaker’s own settlement of your bets. Nothing here limits liability that cannot be limited by law.',
  ] },
  { h: 'Ending an account', p: [
    'You can delete your account from Settings. You are offered an export first. Deletion removes your bets and your personal data and cannot be undone.',
    'We may close an account that breaks these terms, and will say why unless the law prevents it.',
  ] },
  { h: 'Changes and law', p: [
    'These terms may change. A material change is notified in the app before it takes effect.',
    'These terms are governed by the law of England and Wales.',
    'Questions go to the address on the Privacy page.',
  ] },
];

export const PRIVACY_UPDATED = '31 August 2026';

export const PRIVACY: { h: string; p: string[] }[] = [
  { h: 'The short version', p: [
    'Slippery holds the bets you send it, the account details you gave it, and nothing else. It does not sell data, does not run advertising, and does not share your record with any bookmaker.',
  ] },
  { h: 'What is collected', p: [
    'Account: your email address, display name, handle, and the date and time you confirmed you are 18 or over.',
    'Bets: everything on the slips you send, including stake, price, selection, bookmaker and the time you placed it.',
    'Slip images: the image itself, its hash, and when it was uploaded.',
    'Technical: the pages you request and errors that occur, kept in short lived logs for operating the service.',
  ] },
  { h: 'What is never collected', p: [
    'Card numbers. Payments go to Stripe and Slippery receives only whether a payment succeeded and which plan you are on.',
    'The contents of your Telegram messages beyond the slips you send the bot. The bot logs a chat identifier and a short outcome line, never slip contents.',
    'Your bookmaker credentials. Slippery has no way to sign in to a bookmaker and never asks.',
  ] },
  { h: 'Why it is held', p: [
    'To do the thing you asked: read slips, keep a ledger, settle bets and report on them. That is performance of the contract between us.',
    'To keep the service secure and working, which is our legitimate interest, balanced against the fact that a betting record is sensitive and is therefore kept to the minimum needed.',
  ] },
  { h: 'How long', p: [
    'Slip images: 90 days from upload, or immediately on request.',
    'Bets and account data: until you delete your account, or until it has been closed and inactive for two years.',
    'Logs: 30 days.',
  ] },
  { h: 'Who it is shared with', p: [
    'Stripe, for payments. Vercel, for hosting. Neon, for the database. A transactional email provider, for verification codes. Telegram, if you use the bot. A vision model provider, for reading slip images.',
    'Nobody else. Your record is not shared with any bookmaker, any tipster, or any advertiser.',
    'Inside a group you have joined, other members see your units and your slip backed percentage. They never see your stakes.',
  ] },
  { h: 'Slip images and the reader', p: [
    'A slip image is sent to a vision model to be read. The image is not used to train anybody’s model. It is deleted on the 90 day schedule above whether or not the read succeeded.',
  ] },
  { h: 'Your rights', p: [
    'You can get a copy of everything held about you, at any time, from Settings. The export works in read only and after cancelling.',
    'You can correct anything, delete your bets while keeping the account, or delete the account entirely.',
    'You can object to processing and ask for it to be restricted. You can complain to the Information Commissioner’s Office at ico.org.uk.',
  ] },
  { h: 'Cookies', p: [
    'Slippery sets a cookie to keep you signed in and a cookie to remember your theme. There are no advertising or analytics cookies.',
    'It deliberately does not use localStorage or sessionStorage.',
  ] },
  { h: 'Children', p: [
    'Slippery is for adults over 18. If we learn that an account belongs to someone under 18 it is closed and the data deleted.',
  ] },
  { h: 'Security', p: [
    'Passwords are hashed. Traffic is encrypted in transit. Access to production data is limited to what is needed to operate the service.',
    'If a breach affects you, you will be told without undue delay.',
  ] },
  { h: 'Where data is held', p: [
    'In the United Kingdom and the European Economic Area, with the exception of the vision model provider and Stripe, who may process data elsewhere under appropriate safeguards.',
  ] },
  { h: 'Changes', p: [
    'A material change to this policy is notified in the app before it takes effect.',
  ] },
  { h: 'Contact', p: [
    'privacy@slippery.app for anything on this page, including a request for a copy of your data or for it to be deleted.',
  ] },
];
