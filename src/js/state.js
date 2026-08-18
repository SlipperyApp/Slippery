/* Application state.
 *
 * Held in memory only. iOS Safari in Lockdown Mode and in private windows
 * throws on localStorage access, and the brief rules it out outright, so
 * nothing here is persisted client-side. Real persistence is the server's
 * job, see api/_lib/db.js.
 */
import { TODAY } from './data.js';

export const S = {
  view: 'landing',
  /* The public demo: the real dashboard, loaded with the fabricated sample
     and unable to write. Set only by enterDemo() and only when nobody is
     signed in. api.js refuses every request while it is true. */
  demo: false,
  pane: 'overview',

  /* period selection.
     Four are on the picker — All time, Yearly, Monthly, Weekly — and 'd'
     is the fifth, reached by tapping a day on the calendar rather than by
     a button. Each one changes which bets are counted, which is the whole
     point: the old Tracker/Lifetime toggle beside them changed a single
     integer and left every other figure describing a different set. */
  period: 'm',          // d | w | m | y | a
  year: TODAY.year,
  month: TODAY.month,
  focus: 8,             // day of month in view, or null
  calMode: 'm',         // m | y

  /* preferences */
  unit: 10000,          // pence
  target: 250000,       // pence
  targetPeriod: 'month',
  weekStart: 1,         // 1 = Monday
  currency: 'GBP',
  oddsFormat: 'Decimal',
  profitFormat: 'Currency',
  /* Periwinkle. It is what :root carries and what build.mjs writes on
     <html>, so this, the stylesheet and the first paint all agree without
     the client writing an attribute. */
  theme: 'periwinkle',
  showTipster: true,
  /* Which provenance the ledger is showing: all, slips, or import. A bet
     off a slip and a row out of a spreadsheet are both real; they are not
     the same kind of evidence, and sometimes you want to read only one. */
  source: 'all',

  /* social */
  privacy: 'friends',
  group: 0,
  groupVis: 'private',   // what the create-a-group form is set to
  profile: null,

  /* ui */
  showMore: false,
  showAllBets: false,
  filter: 'all',
  query: '',
  peopleQuery: '',
  name: '',
  plan: 'free',           // free | monthly | yearly | lifetime
  planUntil: null,
  /* The verified tick. Granted by the owner, or by a code that carries it,
     and removable, so it is a fact about the account rather than something
     derived from how long you have been here or how much you have logged. */
  verified: false,
  planChoice: 'free',     // what the signup chooser is on
  payPlan: 'yearly',      // which plan the checkout page is showing
  ledgerView: 'ledgerBets',
  socialView: 'socialGroups',
  /* Which import job is open: '' is the chooser, then importUpload for a
     single bet or importHistory for bringing a record across. They are
     different jobs at different moments and the screen now says so. */
  importJob: '',
  /* A day. The markup marks "A day" as the selected segment, and this
     used to say month, so the sentence under the picker announced a month
     while the control said a day. */
  totalsPeriod: 'day' 
};

/** Day and week periods need a focused day. Without one the old build
    fell through to whole-month figures while labelling them as a single
    date, "Net on 31 Jul" showing the entire August total. */
export function periodNeedsFocus(p) { return p === 'd' || p === 'w'; }
export function canUsePeriod(p) {
  if (!periodNeedsFocus(p)) return true;
  return S.focus != null;
}
