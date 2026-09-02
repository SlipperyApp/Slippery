/** The eight themes. All dark: there is no light mode, because profit green
 *  measures 1.07:1 on beige and disappears. The names carry forward from the
 *  previous build; nothing about their appearance does.
 *
 *  SEVEN OF THE EIGHT WERE TOO CLOSE TO EACH OTHER TO BE EIGHT THEMES.
 *  Measured in oklab, the closest pair of grounds was bronze against cinnabar
 *  at 0.011 and the closest pair of accents was carbon against ink at 0.045,
 *  where 0.08 is this codebase's own line for two colours reading as one. The
 *  cause was visible in the numbers: four themes carried surfaces from
 *  another hue family than the one they are named for, so bronze, the only
 *  warm one, had a pure grey --raise and a blue --elev. Every surface now
 *  sits at its own theme's hue and leans as far as that theme's own accent
 *  does, while keeping the lightness it had, so no contrast measurement went
 *  backwards. Grounds now floor at 0.026 where they floored at 0.011, accents
 *  at 0.086 where they floored at 0.045, and the mean over all eight tokens
 *  floors at 0.042 where it was 0.027. Every pair of accents in the set now
 *  clears the 0.08 line; two of them did not before.
 *
 *  NOTHING IN HERE IS TYPED BY HAND. tools/palette.mjs holds what each theme
 *  IS and tools/sync-themes.mjs writes both the swatches below and the theme
 *  blocks in tokens.css from it, so the two cannot drift. Editing a hex here
 *  is undone by the next person who runs the tool.
 *
 *  liquid IS NOW sage. It was a deep marine ground under a cold teal accent.
 *  A pastel sage accent is a desaturated green, so it cannot pass the rule
 *  that keeps an accent away from #86EFAC on the hue arm: it sits 31 degrees
 *  from profit green on the wheel. It passes on the other arm, at 14.8%
 *  saturation and 0.157 from profit in oklab against a floor of 0.120, which
 *  is the difference between a green and a grey with a green cast.
 *
 *  ALL EIGHT ARE AVAILABLE TO EVERYBODY, AND THERE IS NO UNLOCK.
 *
 *  Each theme used to carry an `unlock` string, and three of them were "Log 10
 *  slips", "Settle 25 bets" and "A 30 day streak of capture". Nothing read the
 *  field, which is the only reason it never shipped as behaviour, but a
 *  colour scheme you earn by settling a twenty fifth bet is a reason to place
 *  a twenty fifth bet, and the field sat here asserting that policy for the
 *  next session to implement. A theme is a preference. */

export type ThemeName =
  | 'carbon' | 'periwinkle' | 'ink' | 'graphite'
  | 'slate' | 'bronze' | 'cinnabar' | 'sage';

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
};

export const THEMES: Theme[] = [
  { name: 'carbon', label: 'Carbon', blurb: 'Steel on near black. The default, and the quietest.', swatch: ['#0C0E13', '#14171F', '#7085B0', '#181C26'] },
  { name: 'periwinkle', label: 'Periwinkle', blurb: 'Indigo on deep navy. The loudest accent.', swatch: ['#080E20', '#10162E', '#667CE2', '#141B36'] },
  { name: 'ink', label: 'Ink', blurb: 'Near black, violet cast. The darkest.', swatch: ['#05050A', '#100D17', '#A07ACA', '#15111F'] },
  { name: 'graphite', label: 'Graphite', blurb: 'Cold green grey. Almost black.', swatch: ['#040C09', '#0C1714', '#528681', '#101D1A'] },
  { name: 'slate', label: 'Slate', blurb: 'Steel blue grey. The lightest dark.', swatch: ['#151A21', '#1D232C', '#8BA2C1', '#212832'] },
  { name: 'bronze', label: 'Bronze', blurb: 'Warm paper on dark. The only warm one.', swatch: ['#1A1308', '#251D0F', '#AF8F62', '#2C2213'] },
  { name: 'cinnabar', label: 'Cinnabar', blurb: 'Burnt red, and it is in the ground.', swatch: ['#130705', '#21100B', '#C4643F', '#29150F'] },
  { name: 'sage', label: 'Sage', blurb: 'Pastel sage on a quiet green grey. The softest.', swatch: ['#0E1611', '#17211A', '#9EB49A', '#1C271F'] },
];

export const THEME_NAMES = THEMES.map((t) => t.name);
export const DEFAULT_THEME: ThemeName = 'carbon';

/** Names that used to be themes, and the theme each one became.
 *
 *  A RENAME IS A MIGRATION, and it took two forms here. The theme lives in a
 *  cookie AND in accounts.theme, so an account that was on liquid when this
 *  shipped had the string "liquid" in two places that outlive the release. The
 *  cookie readers all validated against the list and fell back to carbon, so
 *  that half degraded quietly and wrongly: somebody who chose a theme was
 *  silently moved to the default and the getting started list told them to
 *  pick a theme they had already picked. The database half was worse, because
 *  nothing validated it at all: the value went out as data-theme='liquid',
 *  matched no block in the stylesheet, and the page rendered on the :root
 *  fallback, which is carbon's surfaces under whatever the last theme's
 *  aliases were. That is the "no theme at all" case.
 *
 *  sage IS the theme liquid became rather than a coincidence of ordering, so
 *  an account on liquid lands on sage and keeps having chosen something. */
const RENAMED: Record<string, ThemeName> = { liquid: 'sage' };

export function isTheme(v: unknown): v is ThemeName {
  return typeof v === 'string' && (THEME_NAMES as string[]).includes(v);
}

/** The theme this stored value means today, or the default.
 *
 *  Every reader of a stored theme goes through here, so a renamed theme is
 *  carried forward in one place rather than in each of them. Total by design:
 *  a value nobody recognises is the default, never an attribute that matches
 *  no stylesheet block. */
export function readTheme(v: unknown): ThemeName {
  if (typeof v !== 'string') return DEFAULT_THEME;
  const name = v.trim();
  if (isTheme(name)) return name;
  return RENAMED[name] ?? DEFAULT_THEME;
}

/** True when this value names a theme the person actually chose, including
 *  one chosen under a name that has since been renamed. The onboarding list
 *  asks "has a theme been picked", and an account on liquid had picked one. */
export function themeWasChosen(v: unknown): boolean {
  return typeof v === 'string' && (isTheme(v.trim()) || v.trim() in RENAMED);
}

/** The renames, for the boot script and for the migration to read. */
export const THEME_RENAMES: ReadonlyArray<readonly [string, ThemeName]> =
  Object.entries(RENAMED) as ReadonlyArray<readonly [string, ThemeName]>;

export const THEME_COOKIE = 'slip_theme';
