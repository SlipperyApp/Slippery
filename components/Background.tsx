/** The animated field behind every page, not just the landing hero.
 *
 *  Three layered blobs whose gaussian is baked into an SVG mask (a live
 *  filter: blur() re-evaluates every scroll frame: 49.9ms p95 with it,
 *  16.8ms without), a grain layer, and a veil that keeps text legible.
 *  Everything is inside overflow:hidden, because uncontained blobs once
 *  caused 47px of horizontal scroll on a phone. transform and opacity only. */

export function Background() {
  return (
    <div className="bgfield" aria-hidden="true">
      <div className="bgfield__parallax" style={{ position: 'absolute', inset: 0 }}>
        <div className="bgfield__blob bgfield__blob--a" />
        <div className="bgfield__blob bgfield__blob--b" />
        <div className="bgfield__blob bgfield__blob--c" />
      </div>
      <div className="bgfield__veil" />
      <div className="bgfield__grain" />
    </div>
  );
}
