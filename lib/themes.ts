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
   *  --bg/--surface/--accent/--line in tokens.css; tests/themes.test.ts
   *  fails if they drift. */
  swatch: [string, string, string, string];
  /** Every theme past the first is an unlock, not a settings free for all. */
  unlock: string;
};

export const THEMES: Theme[] = [
  { name: 'carbon', label: 'Carbon', blurb: 'Near black, bone accent. The quietest of the eight.', swatch: ['#0A0A0B', '#141416', '#D9D4C7', '#26262A'], unlock: 'Default' },
  { name: 'periwinkle', label: 'Periwinkle', blurb: 'Indigo ground, a soft blue accent that never competes with the figures.', swatch: ['#0C0E1C', '#171A31', '#A9B6FF', '#272B4A'], unlock: 'Log 10 slips' },
  { name: 'ink', label: 'Ink', blurb: 'Deep navy and a cold sky accent. Best on an OLED phone at night.', swatch: ['#061019', '#0D1C2B', '#7DD3FC', '#1B3047'], unlock: 'Settle 25 bets' },
  { name: 'graphite', label: 'Graphite', blurb: 'Neutral dark with a lilac accent. The most legible in daylight.', swatch: ['#0F0F11', '#1A1A1E', '#C4B5FD', '#2C2C33'], unlock: 'Add a bookmaker' },
  { name: 'slate', label: 'Slate', blurb: 'Blue grey throughout, accent included. Almost monochrome.', swatch: ['#0A1015', '#131C24', '#BACADD', '#212D38'], unlock: 'Join a group' },
  { name: 'bronze', label: 'Bronze', blurb: 'Warm umber and a metallic gold. Reads well on a big screen.', swatch: ['#100E09', '#1C1811', '#E3B341', '#2C2619'], unlock: 'A 30 day streak of capture' },
  { name: 'cinnabar', label: 'Cinnabar', blurb: 'Oxide red ground, porcelain accent. The only warm ground with a pale accent.', swatch: ['#140A09', '#22120F', '#F3D7A3', '#341D19'], unlock: 'Import a full history' },
  { name: 'liquid', label: 'Liquid', blurb: 'Near black green with an aqua accent. The loudest of the eight.', swatch: ['#04100F', '#0A211E', '#22D3EE', '#143732'], unlock: 'Twelve months on Slippery' },
];

export const THEME_NAMES = THEMES.map((t) => t.name);
export const DEFAULT_THEME: ThemeName = 'carbon';

export function isTheme(v: unknown): v is ThemeName {
  return typeof v === 'string' && (THEME_NAMES as string[]).includes(v);
}

export const THEME_COOKIE = 'slip_theme';
