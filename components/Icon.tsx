/** The icon set.
 *
 *  No emoji is ever used as an interface element: they rasterise from the
 *  system font, so they cannot take #86EFAC or #FCA5A5, and they differ per
 *  platform. Everything here is a stroked path that inherits currentColor.
 *
 *  Decorative by default (aria-hidden). Pass a `title` only when the icon is
 *  the whole meaning; an icon-only control gets its name from the button's
 *  aria-label instead. */

import * as React from 'react';

const P: Record<string, React.ReactNode> = {
  home: <><path d="M3 10.4 12 3l9 7.4" /><path d="M5.5 9.6V20h13V9.6" /><path d="M9.8 20v-5.4h4.4V20" /></>,
  bets: <><path d="M4 5.5h16" /><path d="M4 12h16" /><path d="M4 18.5h10" /></>,
  slip: <><path d="M6 3h12v16.5l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4Z" /><path d="M9 8h6" /><path d="M9 12h4" /></>,
  social: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.4 19.5c.7-3 2.9-4.7 5.6-4.7s4.9 1.7 5.6 4.7" /><path d="M16.2 6.2a3 3 0 0 1 0 5.8" /><path d="M17.4 14.9c2 .5 3.4 2.1 3.9 4.6" /></>,
  upload: <><path d="M12 15.5V4.2" /><path d="m7.8 8.4 4.2-4.2 4.2 4.2" /><path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15" /></>,
  you: <><circle cx="12" cy="8" r="3.6" /><path d="M4.6 20c.6-3.7 3.5-5.9 7.4-5.9s6.8 2.2 7.4 5.9" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  minus: <><path d="M5 12h14" /></>,
  check: <><path d="m4.5 12.5 5 5 10-11" /></>,
  close: <><path d="m5.5 5.5 13 13" /><path d="m18.5 5.5-13 13" /></>,
  chevronRight: <><path d="m9 5 7 7-7 7" /></>,
  chevronLeft: <><path d="m15 5-7 7 7 7" /></>,
  chevronDown: <><path d="m5 9 7 7 7-7" /></>,
  chevronUp: <><path d="m5 15 7-7 7 7" /></>,
  arrowRight: <><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></>,
  arrowUpRight: <><path d="M7 17 17 7" /><path d="M8.5 7H17v8.5" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m15.5 15.5 4 4" /></>,
  filter: <><path d="M3.5 6h17" /><path d="M6.5 12h11" /><path d="M10 18h4" /></>,
  sort: <><path d="M7 4v16" /><path d="m3.5 16.5 3.5 3.5 3.5-3.5" /><path d="M17 20V4" /><path d="m13.5 7.5 3.5-3.5 3.5 3.5" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.4" /><path d="M3.5 9.6h17" /><path d="M8 3v4" /><path d="M16 3v4" /></>,
  chart: <><path d="M4 19.5h16.5" /><path d="M4 15.5 9 10l3.6 3.2L20 5.5" /></>,
  settings: <><circle cx="12" cy="12" r="3.1" /><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M18.5 5.5l-1.9 1.9M7.4 16.6l-1.9 1.9" /></>,
  clock: <><circle cx="12" cy="12" r="8.6" /><path d="M12 7.2V12l3.2 2" /></>,
  alert: <><path d="M12 4.2 21 19.6H3Z" /><path d="M12 10v4.2" /><path d="M12 17.1h.01" /></>,
  info: <><circle cx="12" cy="12" r="8.6" /><path d="M12 11v5.4" /><path d="M12 7.7h.01" /></>,
  camera: <><path d="M3.5 8.6h3.1l1.6-2.4h7.6l1.6 2.4h3.1v10.2H3.5Z" /><circle cx="12" cy="13.4" r="3.3" /></>,
  telegram: <><path d="m21 4.6-3 15.2-5.4-4-2.6 2.5-.5-4.2L19 6.7 7.4 12.9 3 11.5Z" /></>,
  trash: <><path d="M4.5 6.6h15" /><path d="M9.2 6.6V4.4h5.6v2.2" /><path d="M6.6 6.6 7.6 20h8.8l1-13.4" /></>,
  edit: <><path d="M4.5 19.5h4l10-10-4-4-10 10Z" /><path d="m14.5 5.5 4 4" /></>,
  download: <><path d="M12 4v11.4" /><path d="m7.8 11.2 4.2 4.2 4.2-4.2" /><path d="M4.5 19.5h15" /></>,
  lock: <><rect x="4.8" y="10.2" width="14.4" height="10" rx="2.2" /><path d="M8.2 10.2V7.6a3.8 3.8 0 0 1 7.6 0v2.6" /></>,
  card: <><rect x="2.8" y="5.4" width="18.4" height="13.2" rx="2.4" /><path d="M2.8 10h18.4" /><path d="M6.4 14.6h3.2" /></>,
  flag: <><path d="M6 21V3.8" /><path d="M6 4.6h11.5l-2.2 3.9 2.2 3.9H6" /></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20.4 4v4.4H16" /></>,
  eye: <><path d="M2.6 12s3.6-6 9.4-6 9.4 6 9.4 6-3.6 6-9.4 6-9.4-6-9.4-6Z" /><circle cx="12" cy="12" r="2.8" /></>,
  sliders: <><path d="M4 7h9" /><path d="M17 7h3" /><path d="M4 17h4" /><path d="M12 17h8" /><circle cx="15" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
  trophy: <><path d="M7.5 4h9v5.4a4.5 4.5 0 0 1-9 0Z" /><path d="M7.5 5.4H4.6v1.4a3 3 0 0 0 3 3" /><path d="M16.5 5.4h2.9v1.4a3 3 0 0 1-3 3" /><path d="M10 13.8V17h4v-3.2" /><path d="M7.6 20h8.8" /></>,
  share: <><path d="M12 15V4.4" /><path d="m8.4 7.6 3.6-3.2 3.6 3.2" /><path d="M5 13v6.5h14V13" /></>,
  link: <><path d="M10.4 13.6a3.6 3.6 0 0 0 5.1 0l2.6-2.6a3.6 3.6 0 0 0-5.1-5.1l-1.1 1.1" /><path d="M13.6 10.4a3.6 3.6 0 0 0-5.1 0l-2.6 2.6a3.6 3.6 0 0 0 5.1 5.1l1.1-1.1" /></>,
  bell: <><path d="M6.4 10a5.6 5.6 0 0 1 11.2 0c0 4.2 1.4 5.6 1.4 5.6H5s1.4-1.4 1.4-5.6Z" /><path d="M10.2 19a2 2 0 0 0 3.6 0" /></>,
  pause: <><path d="M9.2 5v14" /><path d="M14.8 5v14" /></>,
  help: <><circle cx="12" cy="12" r="8.6" /><path d="M9.6 9.4a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.8-.9 1.4v.5" /><path d="M12 16.9h.01" /></>,
  football: <><circle cx="12" cy="12" r="8.6" /><path d="m12 7.4 3.6 2.6-1.4 4.2H9.8L8.4 10Z" /><path d="M12 3.4v4M4 9.6l4.4.4M20 9.6l-4.4.4M7.4 19.6l2.4-5.4M16.6 19.6l-2.4-5.4" /></>,
  tennis: <><circle cx="12" cy="12" r="8.6" /><path d="M4.6 8.4a8.6 8.6 0 0 1 7 7.2" /><path d="M19.4 15.6a8.6 8.6 0 0 1-7-7.2" /></>,
  horse: <><path d="M5 20c0-4.2 2.2-6.4 5.4-7.6L9 9.6l2.6-1.8-.8-2.6 3 1.6L17 4l1.4 3.4L21 8.4l-2.6 2c.4 5.2-2.2 8-6.4 9.6" /><path d="M8.6 20H19" /></>,
  bank: <><path d="M3.6 9.4 12 4.4l8.4 5" /><path d="M5.6 10.4v7.2M10 10.4v7.2M14 10.4v7.2M18.4 10.4v7.2" /><path d="M3.4 19.6h17.2" /></>,
  book: <><path d="M4.4 4.6h6a2.6 2.6 0 0 1 2.6 2.6v12a2 2 0 0 0-2-2H4.4Z" /><path d="M19.6 4.6h-6A2.6 2.6 0 0 0 11 7.2v12a2 2 0 0 1 2-2h6.6Z" /></>,
  spark: <><path d="M12 3.4 13.9 9l5.6 1.9-5.6 1.9L12 18.4l-1.9-5.6L4.5 11l5.6-1.9Z" /></>,
  target: <><circle cx="12" cy="12" r="8.4" /><circle cx="12" cy="12" r="4.6" /><circle cx="12" cy="12" r="1" /></>,
  scissors: <><circle cx="6.4" cy="6.4" r="2.4" /><circle cx="6.4" cy="17.6" r="2.4" /><path d="m8.4 8 11 8.4M19.4 7.6 8.4 16" /></>,
  google: <><path d="M20.5 12.2c0-.6 0-1.2-.2-1.8H12v3.5h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.6-3.9 2.6-6.6Z" /><path d="M12 21c2.4 0 4.4-.8 5.9-2.2l-2.9-2.2c-.8.5-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H4v2.3A9 9 0 0 0 12 21Z" /><path d="M7 13.8a5.4 5.4 0 0 1 0-3.5V8H4a9 9 0 0 0 0 8.1Z" /><path d="M12 6.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 4 8l3 2.3c.7-2.1 2.7-3.7 5-3.7Z" /></>,
  menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
  offline: <><path d="M3 3.5 21 20.5" /><path d="M5.4 10.4a10 10 0 0 1 3.4-2.2" /><path d="M2.4 7.2a14 14 0 0 1 4-2.6" /><path d="M17.6 7.6a14 14 0 0 1 4 .1" /><path d="M9.2 14.2a5.5 5.5 0 0 1 5.6-.4" /><path d="M12 18.6h.01" /></>,
  cash: <><rect x="2.6" y="6.4" width="18.8" height="11.2" rx="2.2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 12h.01M18 12h.01" /></>,
  split: <><path d="M4 5.5h4l8 13h4" /><path d="M17 3.5 20.5 5.5 17 7.5" /><path d="M4 18.5h4l2.5-4" /><path d="M17 16.5l3.5 2-3.5 2" /></>,
  shield: <><path d="M12 3.4 19.4 6v5.6c0 4.2-3 7.4-7.4 9-4.4-1.6-7.4-4.8-7.4-9V6Z" /><path d="m8.8 12 2.2 2.2 4.2-4.4" /></>,
  clipboard: <><rect x="5" y="5" width="14" height="15.4" rx="2.2" /><path d="M9 5V3.6h6V5" /><path d="M9 11h6M9 15h4" /></>,
  play: <><path d="M8 5.2 18.4 12 8 18.8Z" /></>,
};

export type IconName = keyof typeof P;

export function Icon({
  name, size = 20, className, title, strokeWidth = 1.6, style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  title?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {P[name]}
    </svg>
  );
}

export const ICON_NAMES = Object.keys(P) as IconName[];
