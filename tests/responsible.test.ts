import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { heldOutSentence } from '@/lib/data/ledger-shape';

/*  The ingestion handoff asks for one property to be kept when its figures
 *  go on screen, and it is not a style preference:
 *
 *    State the number and stop. No badge, no verdict, no "you're on a
 *    streak". Celebrate app actions, never betting outcomes.
 *
 *  There are tests on that branch that fail if the bot's /pl reply acquires a
 *  word that turns a figure into encouragement. This is the same property,
 *  asserted on this side, over every label and caption in the product.
 *
 *  The list is words that PRAISE or GOAD. It is deliberately not a list of
 *  betting words: "won", "lost", "profit" and "streak" are all facts this
 *  product has to be able to state plainly. */
const ENCOURAGING = [
  'well done', 'nice one', 'great work', 'congratulations', 'congrats',
  'you’re on fire', 'on fire', 'crushing', 'smashing it', 'keep it up',
  'keep going', 'you’re up', 'winner!', 'beast', 'sharp bettor',
  'beating the market', 'you beat', 'unstoppable', 'hot streak', 'on a heater',
  'don’t stop', 'why not', 'go again', 'one more', 'last chance',
  'don’t miss', 'you’ll lose your', 'falling behind', 'catch up',
];

/*  THE THREE MECHANICS BELOW, AND WHY THEY ARE A TEST RATHER THAN A LINE IN
 *  THE BRIEF.
 *
 *  The word list above was the whole of this file, and two mechanics that
 *  break the same locked rule shipped past it anyway, because neither of them
 *  uses a word that praises anybody.
 *
 *  The first was a badge, "Capture streak, 30 days of logging a slip on the
 *  day you placed it", drawn as earned on the account page and broadcast into
 *  other people's activity feed. It was filed under celebrating an app action
 *  and it is not one: it cannot be held without placing a bet on thirty
 *  consecutive days.
 *
 *  The second was latent. Every theme carried an `unlock` string and three of
 *  them were "Log 10 slips", "Settle 25 bets" and "A 30 day streak of
 *  capture". Nothing read the field, so nothing enforced it, and it sat in the
 *  codebase as asserted policy for the next session to implement.
 *
 *  A rule that lives only in a document is a rule the next session breaks. */

/** Rewarding a run of days is rewarding volume, whatever the badge is
 *  called. The stat "longest winning streak" is a fact about bets that have
 *  already been placed and is deliberately not caught here: what is caught is
 *  a mechanic that counts DAYS. */
const STREAK_MECHANIC: RegExp[] = [
  /\b(capture|logging|login|daily|weekly|betting|bet)[ _-]?streaks?\b/i,
  /\b(?:\d+|one|two|three|five|seven|ten|fourteen|twenty|thirty|sixty|ninety)[ -]days? streak\b/i,
  /\bstreak of\b/i,
  /\bstreak (?:alive|going|intact|continues|ends|resets)\b/i,
  /\bconsecutive days?\b/i,
  /\bdays? in a row\b/i,
  /\bevery day for\b/i,
];

/** A feature you are given for placing a countable number of bets is a reason
 *  to place the last one. Importing a history is not on this list on purpose:
 *  it is a count of bets and it is not a count of bets you have to place. */
const COUNTED_GATE: RegExp[] = [
  /\bunlock/i,
  /\b(?:log|logs|logged|logging|settle|settles|settled|settling|place|places|placed|placing|capture|captures|captured|capturing|record|records|recorded|recording)\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|twenty[- ]five|thirty|fifty)\s+(?:more\s+)?(?:bets?|slips?)\b/i,
  /\b(?:\d+|one|two|three|four|five|ten)\s+more\s+(?:bets?|slips?)\b/i,
];

/** Not betting is not a loss. Every one of these turns an empty week into
 *  something the reader is told they are about to forfeit. */
const ABSENCE_AS_LOSS: RegExp[] = [
  /\b(?:lose|losing|loses|lost)\s+(?:your|the)\s+(?:place|streak|spot|position|standing|run)\b/i,
  /\b(?:don[’']?t|do not|never)\s+lose\s+(?:your|the)\b/i,
  /\byour (?:streak|place|position|spot|run)\b[^.]{0,24}\b(?:ends|resets|expires|is at risk|slips)\b/i,
  /\b(?:have|has)\s+not\s+(?:bet|placed|logged)\b/i,
  /\b(?:haven|hasn)[’']?t\s+(?:bet|placed|logged)\b/i,
  /\bmissed (?:a|the|\d+) (?:day|days|week)\b/i,
  /\b(?:back|resets?) to zero\b/i,
  /\bsince you last (?:bet|placed|logged)\b/i,
  /\bdays since (?:you|your last)\b/i,
];

/*  Three surfaces state one of these rules by naming the sentence they
 *  forbid, which is the clearest way to write a prohibition and is
 *  indistinguishable from the offence to anything reading lines.
 *
 *  They are exempt by the WHOLE LINE rather than by a word, because a word
 *  ("never", say) can be sprinkled on a nudge to get it through and a line
 *  cannot. Wanting the exemption means adding the sentence here, in a test,
 *  where whoever reviews the change reads it beside the rule it is bending. */
const STATES_THE_RULE = [
  "'No notification is ever framed as losing your place in a league.'",
  "'Anything framed as losing your place'",
  'Never "you have not logged a slip this week". Never framed as losing your place.',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue;
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}
const FILES = [...walk('app'), ...walk('components'), ...walk('lib')];

test('nothing on screen turns a figure into encouragement', () => {
  const found: string[] = [];
  for (const f of FILES) {
    const src = readFileSync(f, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ');
    const low = src.toLowerCase();
    for (const w of ENCOURAGING) {
      let i = low.indexOf(w);
      while (i !== -1) {
        found.push(`${f}: "${w}"`);
        i = low.indexOf(w, i + 1);
      }
    }
  }
  assert.deepEqual(found, [], found.join('\n'));
});

/** Every line of every file a reader's words can reach, comments taken out:
 *  a comment explaining why a mechanic was deleted must not read as the
 *  mechanic coming back. */
function lines(): { file: string; n: number; text: string }[] {
  const out: { file: string; n: number; text: string }[] = [];
  for (const f of FILES) {
    readFileSync(f, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ')
      .split('\n')
      .forEach((text, i) => out.push({ file: f, n: i + 1, text }));
  }
  return out;
}

function offences(patterns: RegExp[]): string[] {
  return lines()
    .filter((l) => !STATES_THE_RULE.some((s) => l.text.includes(s)))
    .filter((l) => patterns.some((re) => re.test(l.text)))
    .map((l) => `${l.file}:${l.n} ${l.text.trim().slice(0, 100)}`);
}

test('nothing counts a run of days', () => {
  const found = offences(STREAK_MECHANIC);
  assert.deepEqual(found, [], `A streak is a reward for betting on consecutive days, however it is dressed:
${found.join('\n')}`);
});

test('nothing is gated on a count of bets or slips', () => {
  const found = offences(COUNTED_GATE);
  assert.deepEqual(found, [], `A feature earned by placing a countable number of bets is a reason to place the last one:
${found.join('\n')}`);
});

test('not betting is never framed as a loss', () => {
  const found = offences(ABSENCE_AS_LOSS);
  assert.deepEqual(found, [], `An empty week is not something to forfeit. A line that FORBIDS one of these
phrasings belongs in STATES_THE_RULE above, quoted in full:
${found.join('\n')}`);
});

/*  The handoff is blunt about this one: show heldOut, or the numbers look
 *  wrong for no reason. A person with 364 bets who sees 361 counted and
 *  nothing explaining the gap concludes the product loses bets. */
test('held out bets are explained rather than silently dropped', () => {
  assert.match(heldOutSentence(0), /every settled bet is counted/i);
  const one = heldOutSentence(1);
  assert.ok(one.includes('1 bet is'), `singular: ${one}`);
  const many = heldOutSentence(7);
  assert.ok(many.includes('7 bets are'), `plural: ${many}`);
  assert.match(many, /question is open/i, 'and it says WHY they are out');
});

/*  THE BREAK CONTROL IS GONE AND THE SAFEGUARDS ARE NOT.
 *
 *  This test used to assert that "take a break" was in the settings pane. The
 *  owner asked for it to be removed and said so explicitly, overriding the
 *  line in CLAUDE.md that named it, and the line in CLAUDE.md has been
 *  changed to match. What went was a switch that paused notifications and
 *  took an account out of the monthly leagues; it was never any form of self
 *  exclusion and could not have been, because Slippery accepts no bets, holds
 *  no money and pays no winnings, so there is nothing here to be excluded
 *  from.
 *
 *  What the test asserts now is the half that is load bearing. Every one of
 *  these is a real safeguard, none of them is a preference, and each has gone
 *  missing from a screen at least once in this build's history, which is why
 *  it is a test rather than a paragraph. */
test('the genuine safeguards stay on screen', () => {
  const panes = readFileSync('components/app/SettingsPanes.tsx', 'utf8');
  /*  Comments out first, the way every other check in this file does it: the
      comment where the control used to be explains what was deleted and
      names it, and a note about a deletion must not read as the deletion
      being undone. */
  const shown = panes.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  assert.doesNotMatch(shown, /take a break/i, 'the break control came back');
  assert.match(panes, /begambleaware/i, 'BeGambleAware is gone from settings');
  assert.match(panes, /0808 8020 133/, 'the National Gambling Helpline number is gone');
  assert.match(panes, /18 or over/i, 'the age statement is gone');
  assert.match(panes, /safer-gambling/, 'the safer gambling page is unreachable from settings');

  const sg = readFileSync('app/(marketing)/safer-gambling/page.tsx', 'utf8');
  assert.match(sg, /begambleaware/i, 'the safer gambling page lost BeGambleAware');
  assert.match(sg, /0808 8020 133/, 'the safer gambling page lost the helpline');
});
