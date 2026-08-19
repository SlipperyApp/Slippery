/* The icon sprite.
 *
 * Symbols, never emoji: emoji rasterise from the system font, so they cannot
 * take the semantic profit and loss colours and they differ per platform.
 */
export function IconSprite() {
  return (
    <svg style={{ display: 'none' }} aria-hidden="true">
      <symbol id="tgi" viewBox="0 0 24 24"><path d="M21.9 4.3 18.9 19c-.2 1-.8 1.2-1.7.8l-4.6-3.4-2.2 2.1c-.2.3-.5.5-1 .5l.3-4.7 8.5-7.7c.4-.3-.1-.5-.6-.2L6.9 13.1l-4.5-1.4c-1-.3-1-1 .2-1.4l17.6-6.8c.8-.3 1.5.2 1.2 1.4z"/></symbol>
      <symbol id="dsh" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></symbol>
      <symbol id="impi" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></symbol>
      <symbol id="soci" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16.5 6.2a3 3 0 0 1 0 5.6M18 20a6 6 0 0 0-2.2-4.6"/></symbol>
      <symbol id="seti" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M20 13v-2l-2.2-.5a6 6 0 0 0-.7-1.7l1.2-1.9-1.4-1.4-1.9 1.2a6 6 0 0 0-1.7-.7L12.9 4h-2l-.5 2.2a6 6 0 0 0-1.7.7L6.8 5.7 5.4 7.1l1.2 1.9a6 6 0 0 0-.7 1.7L4 11.2v2l2.2.5a6 6 0 0 0 .7 1.7l-1.2 1.9 1.4 1.4 1.9-1.2a6 6 0 0 0 1.7.7l.4 2.2h2l.5-2.2a6 6 0 0 0 1.7-.7l1.9 1.2 1.4-1.4-1.2-1.9a6 6 0 0 0 .7-1.7z"/></symbol>
    </svg>
  );
}
