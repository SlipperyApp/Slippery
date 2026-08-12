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
  pane: 'overview',

  /* period selection */
  period: 'm',          // d | w | m | a
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
  theme: 'periwinkle',
  showTipster: true,

  /* social */
  privacy: 'friends',
  group: 0,
  profile: null,

  /* ui */
  showMore: false,
  showAllBets: false,
  filter: 'all',
  query: '',
  peopleQuery: '',
  migrateChoice: '',
  name: '',
  plan: 'free',           // free | monthly | yearly | lifetime
  planUntil: null,
  planChoice: 'free',     // what the signup chooser is on
  payPlan: 'yearly',      // which plan the checkout page is showing
  ledgerView: 'ledgerBets',
  socialView: 'socialGroups',
  importView: 'importUpload',
  totalsPeriod: 'month'
};

/** Day and week periods need a focused day. Without one the old build
    fell through to whole-month figures while labelling them as a single
    date, "Net on 31 Jul" showing the entire August total. */
export function periodNeedsFocus(p) { return p === 'd' || p === 'w'; }
export function canUsePeriod(p) {
  if (!periodNeedsFocus(p)) return true;
  return S.focus != null;
}
