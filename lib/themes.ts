/** The eight themes. All dark: there is no light mode, because profit green
 *  measures 1.07:1 on beige and disappears. The names carry forward from the
 *  previous build; nothing about their appearance does. */

export type ThemeName =
  | 'carbon' | 'periwinkle' | 'ink' | 'graphite'
  | 'slate' | 'bronze' | 'cinnabar' | 'liquid';

export type Theme = {
  name: ThemeName;
  label: string;
  /** One line on what it is for, shown on /themes and in Settings. */
  blurb: string;
  /** ground, surface, accent, line. The picker chip is built from these, so
   *  the row reads as eight palettes rather than eight labels. They mirror
   *  --bg/--card/--p/--line in tokens.css; tests/themes.test.ts
   *  fails if they drift. */
  swatch: [string, string, string, string];
  /** Every theme past the first is an unlock, not a settings free for all. */
  unlock: string;
};

export const THEMES: Theme[] = [
  { name: 'carbon', label: 'Carbon', blurb: 'Near black with a steel blue accent. The quietest of the eight.', swatch: ['#0C0E13', '#14171F', '#6E86B8', '#212732'], unlock: 'Default' },
  { name: 'periwinkle', label: 'Periwinkle', blurb: 'Indigo ground, a soft violet accent that never competes with a figure.', swatch: ['#0A0C16', '#141827', '#7C86D6', '#212840'], unlock: 'Log 10 slips' },
  { name: 'ink', label: 'Ink', blurb: 'Deepest ground of the eight. Best on an OLED phone at night.', swatch: ['#080A11', '#101420', '#6A86C0', '#1B2130'], unlock: 'Settle 25 bets' },
  { name: 'graphite', label: 'Graphite', blurb: 'Neutral dark, near monochrome. The most legible in daylight.', swatch: ['#0D0E10', '#17191C', '#818C99', '#23262B'], unlock: 'Add a bookmaker' },
  { name: 'slate', label: 'Slate', blurb: 'Blue grey throughout. A colder carbon.', swatch: ['#0B0F14', '#141A22', '#5E8FB8', '#1F2833'], unlock: 'Join a group' },
  { name: 'bronze', label: 'Bronze', blurb: 'Warm umber and a copper accent. Reads well on a big screen.', swatch: ['#100C09', '#1B1613', '#B08663', '#28201B'], unlock: 'A 30 day streak of capture' },
  { name: 'cinnabar', label: 'Cinnabar', blurb: 'Oxide red ground, terracotta accent. The warmest of the eight.', swatch: ['#110B0A', '#1D1513', '#C0755C', '#2B201C'], unlock: 'Import a full history' },
  { name: 'liquid', label: 'Liquid', blurb: 'Near black green with a teal accent. The loudest of the eight.', swatch: ['#070D0F', '#0F181B', '#4E9BA6', '#19262A'], unlock: 'Twelve months on Slippery' },
];

export const THEME_NAMES = THEMES.map((t) => t.name);
export const DEFAULT_THEME: ThemeName = 'carbon';

export function isTheme(v: unknown): v is ThemeName {
  return typeof v === 'string' && (THEME_NAMES as string[]).includes(v);
}

export const THEME_COOKIE = 'slip_theme';
