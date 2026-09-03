'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { useSlipFlow } from '@/components/app/SlipFlow';

/** The crop step, against the actual uploaded image.
 *
 *  IT USED TO CROP A DRAWING. The stage held a striped div with a border on
 *  it, sized by one of three fixed insets, and the uploaded file never
 *  reached this screen at all. Nothing could be aligned to anything, because
 *  there was nothing under the rectangle: the person dragged nothing, and the
 *  reader was handed the original file whatever they chose here.
 *
 *  This draws the image on a canvas and puts a real rectangle over it. The
 *  same rectangle is applied to the source pixels on the way out, so what is
 *  inside the frame is what the reader is given.
 *
 *  No cropping library. A canvas, pointer events and four buttons is the
 *  whole of it, and it is the same code path for a mouse, a thumb and the
 *  arrow keys, which is the only way the keyboard version stays correct. */

type Rect = { x: number; y: number; w: number; h: number };

const FULL: Rect = { x: 0, y: 0, w: 1, h: 1 };
/*  The frame starts inset rather than on the edges. Two reasons, both found
 *  by using it: a 44px corner handle centred on the very corner of a clipped
 *  stage is three quarters outside it and a quarter pressable, and a frame
 *  covering everything leaves nowhere to start a drag from. */
const START: Rect = { x: 0.05, y: 0.05, w: 0.9, h: 0.9 };
const MIN = 0.06;                 // a crop smaller than this is a mis-tap
/*  A frame this big is not a frame anybody is repositioning, so a drag inside
 *  it starts a new one. Without this the first drag on a fresh image tried to
 *  move a rectangle that was already against all four edges, and nothing
 *  happened at all: the control looked dead on the one gesture everybody
 *  tries first. */
const ROOMY = 0.9;
const HANDLE = 44;                // the tap target, per the floors
const MAX_EDGE = 2200;            // the longest side the reader is ever sent

type Corner = 'nw' | 'ne' | 'se' | 'sw';

const CORNERS: { id: Corner; label: string; ax: number; ay: number }[] = [
  { id: 'nw', label: 'Top left corner', ax: 0, ay: 0 },
  { id: 'ne', label: 'Top right corner', ax: 1, ay: 0 },
  { id: 'se', label: 'Bottom right corner', ax: 1, ay: 1 },
  { id: 'sw', label: 'Bottom left corner', ax: 0, ay: 1 },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A rectangle from two opposite points, always with positive width. */
function fromPoints(ax: number, ay: number, bx: number, by: number): Rect {
  const x = clamp(Math.min(ax, bx), 0, 1);
  const y = clamp(Math.min(ay, by), 0, 1);
  return {
    x, y,
    w: clamp(Math.max(ax, bx), 0, 1) - x,
    h: clamp(Math.max(ay, by), 0, 1) - y,
  };
}

export function Cropper() {
  const router = useRouter();
  const flow = useSlipFlow();
  const pending = flow.pending;

  const stage = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const image = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ mode: 'move' | Corner | 'new'; ox: number; oy: number; start: Rect } | null>(null);

  const [box, setBox] = useState({ w: 0, h: 0 });
  const [loaded, setLoaded] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);
  /*  Rotation is two numbers, not one. The quarter turns are what fixes a
   *  photograph taken sideways; the tilt is what straightens a slip on a
   *  table. Sharing one value made the slider fight the buttons: every press
   *  of Rotate left silently threw the straightening away. */
  const [quarter, setQuarter] = useState(0);
  const [tilt, setTilt] = useState(0);
  const angle = quarter + tilt;
  const [crop, setCrop] = useState<Rect>(START);
  const [working, setWorking] = useState(false);

  const isPdf = pending?.type === 'application/pdf';

  /*  How the image sits in the stage: the rotated bounding box, scaled to
   *  fit, centred. Everything else on this screen is expressed against it. */
  const fit = useCallback(() => {
    const img = loaded;
    if (!img || !box.w || !box.h) return null;
    const rad = (angle * Math.PI) / 180;
    const c = Math.abs(Math.cos(rad));
    const s = Math.abs(Math.sin(rad));
    const bw = img.w * c + img.h * s;
    const bh = img.w * s + img.h * c;
    return { scale: Math.min(box.w / bw, box.h / bh), rad };
  }, [loaded, box, angle]);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pending, isPdf]);

  useEffect(() => {
    if (!pending || isPdf) return;
    const img = new Image();
    img.onload = () => { image.current = img; setLoaded({ w: img.naturalWidth, h: img.naturalHeight }); };
    /*  HEIC on a browser that cannot decode it lands here. It is said out
     *  loud rather than uploaded, because the reader takes no HEIC and the
     *  refusal would arrive a screen later looking like an outage. */
    img.onerror = () => setFailed(true);
    img.src = pending.url;
    return () => { img.onload = null; img.onerror = null; };
  }, [pending, isPdf]);

  useEffect(() => {
    const cv = canvas.current;
    const img = image.current;
    const f = fit();
    if (!cv || !img || !f || !box.w) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(box.w * dpr);
    cv.height = Math.round(box.h * dpr);
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, box.w, box.h);
    ctx.save();
    ctx.translate(box.w / 2, box.h / 2);
    ctx.rotate(f.rad);
    const w = loaded!.w * f.scale;
    const h = loaded!.h * f.scale;
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }, [fit, box, loaded]);

  const pointOf = (e: React.PointerEvent) => {
    const r = stage.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1) };
  };

  function onDown(e: React.PointerEvent) {
    if (!loaded) return;
    const p = pointOf(e);
    const corner = (e.target as HTMLElement).closest?.('[data-corner]')?.getAttribute('data-corner') as Corner | null;
    const inside = p.x >= crop.x && p.x <= crop.x + crop.w && p.y >= crop.y && p.y <= crop.y + crop.h;
    const roomy = crop.w >= ROOMY && crop.h >= ROOMY;
    const mode: 'move' | Corner | 'new' = corner ?? (inside && !roomy ? 'move' : 'new');
    drag.current = { mode, ox: p.x, oy: p.y, start: crop };
    if (mode === 'new') setCrop({ x: p.x, y: p.y, w: 0, h: 0 });
    stage.current?.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const p = pointOf(e);
    if (d.mode === 'new') { setCrop(fromPoints(d.ox, d.oy, p.x, p.y)); return; }
    if (d.mode === 'move') {
      const w = d.start.w;
      const h = d.start.h;
      setCrop({
        x: clamp(d.start.x + (p.x - d.ox), 0, 1 - w),
        y: clamp(d.start.y + (p.y - d.oy), 0, 1 - h),
        w, h,
      });
      return;
    }
    const s = d.start;
    const anchorX = d.mode === 'nw' || d.mode === 'sw' ? s.x + s.w : s.x;
    const anchorY = d.mode === 'nw' || d.mode === 'ne' ? s.y + s.h : s.y;
    setCrop(fromPoints(anchorX, anchorY, p.x, p.y));
  }

  function onUp(e: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    stage.current?.releasePointerCapture?.(e.pointerId);
    // A tap rather than a drag must not leave a crop nobody can see or grab.
    if (d && (crop.w < MIN || crop.h < MIN)) setCrop(d.mode === 'new' ? START : d.start);
  }

  /*  The keyboard version is the same rectangle, not a second control. Each
   *  corner button moves its own corner; the middle one moves the whole
   *  frame. One per cent a press, ten with shift, which is how far a thumb
   *  drags in one movement anyway. */
  function onCornerKey(e: React.KeyboardEvent, id: Corner) {
    const step = (e.shiftKey ? 0.1 : 0.01) * (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1);
    const horizontal = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
    const vertical = e.key === 'ArrowUp' || e.key === 'ArrowDown';
    if (!horizontal && !vertical) return;
    e.preventDefault();
    const west = id === 'nw' || id === 'sw';
    const north = id === 'nw' || id === 'ne';
    const anchorX = west ? crop.x + crop.w : crop.x;
    const anchorY = north ? crop.y + crop.h : crop.y;
    const cornerX = west ? crop.x : crop.x + crop.w;
    const cornerY = north ? crop.y : crop.y + crop.h;
    setCrop(fromPoints(
      anchorX, anchorY,
      horizontal ? cornerX + step : cornerX,
      vertical ? cornerY + step : cornerY,
    ));
  }

  function onMoveKey(e: React.KeyboardEvent) {
    const step = (e.shiftKey ? 0.1 : 0.01) * (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      setCrop((c) => ({ ...c, x: clamp(c.x + step, 0, 1 - c.w) }));
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      setCrop((c) => ({ ...c, y: clamp(c.y + step, 0, 1 - c.h) }));
    }
  }

  /*  What the export will actually be, in pixels. The readout uses it too, so
   *  the size on screen is the size the reader is given rather than a
   *  calculation from the stage that counts the letterboxing either side of a
   *  tall screenshot as part of the slip. */
  function plan(r: Rect) {
    const f = fit();
    if (!f || !box.w) return null;
    const px = { x: r.x * box.w, y: r.y * box.h, w: Math.max(r.w * box.w, 1), h: Math.max(r.h * box.h, 1) };
    let m = 1 / f.scale;
    const longest = Math.max(px.w, px.h) * m;
    if (longest > MAX_EDGE) m *= MAX_EDGE / longest;
    return { f, px, m, w: Math.max(1, Math.round(px.w * m)), h: Math.max(1, Math.round(px.h * m)) };
  }

  /** The frame, applied to the source pixels. The transform is the one the
   *  canvas drew with, so what was inside the rectangle is what comes out. */
  async function send(whole: boolean) {
    if (!pending) return;
    setWorking(true);
    if (isPdf || failed) {
      flow.setCropped(pending.file);
      router.push('/app/import/analysing');
      return;
    }
    const img = image.current;
    // Source pixels per stage pixel, capped inside plan() so a 48 megapixel
    // photograph does not become a 60MB upload.
    const p = plan(whole ? FULL : crop);
    if (!img || !p || !loaded) { setWorking(false); return; }
    const { f, px, m } = p;

    const out = document.createElement('canvas');
    out.width = p.w;
    out.height = p.h;
    const ctx = out.getContext('2d');
    if (!ctx) { setWorking(false); return; }
    // White behind it: a rotated crop has empty corners, and JPEG has no
    // alpha, so unpainted pixels would come out black and read as a shadow.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.translate((box.w / 2 - px.x) * m, (box.h / 2 - px.y) * m);
    ctx.rotate(f.rad);
    const w = loaded.w * f.scale * m;
    const h = loaded.h * f.scale * m;
    ctx.drawImage(img, -w / 2, -h / 2, w, h);

    const blob: Blob | null = await new Promise((res) => out.toBlob(res, 'image/jpeg', 0.92));
    if (!blob) { setWorking(false); return; }
    flow.setCropped(new File([blob], 'slip.jpg', { type: 'image/jpeg' }));
    router.push('/app/import/analysing');
  }

  if (!pending) {
    return (
      <div className="card">
        <p className="card__title">There is no image on this screen</p>
        <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
          A slip is held in this tab and nowhere else, so a refresh or a link straight to this
          address arrives with nothing to crop. Nothing was lost and no allowance was spent.
        </p>
        <Link href="/app/import" className="btn btn--primary" style={{ marginTop: 'var(--s4)' }}>
          Choose a slip <Icon name="arrowRight" size={16} />
        </Link>
      </div>
    );
  }

  const sourceCrop = loaded ? plan(crop) : null;

  return (
    <>
      <div className="card" style={{ padding: 'var(--s4)' }}>
        {isPdf ? (
          <div className="banner" style={{ marginBottom: 'var(--s4)' }}>
            <Icon name="info" size={18} className="banner__icon" />
            <span>
              A PDF goes to the reader whole. There is nothing to crop here, because the pages are
              read as pages rather than as an image.
            </span>
          </div>
        ) : null}

        {failed ? (
          <div className="banner banner--warn" style={{ marginBottom: 'var(--s4)' }}>
            <Icon name="alert" size={18} className="banner__icon" />
            <span>
              This browser could not open <span className="mono">{pending.name}</span>, so it cannot
              be shown or cropped. An iPhone HEIC does this on a desktop browser. Screenshot the
              slip instead, or send it from the phone.
            </span>
          </div>
        ) : null}

        {!isPdf && !failed ? (
          <>
            <div
              ref={stage}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              style={{
                position: 'relative', aspectRatio: '3 / 4', borderRadius: 'var(--r-ctl)',
                overflow: 'hidden', background: 'var(--surface-2)', touchAction: 'none',
                cursor: 'crosshair',
              }}
            >
              <canvas
                ref={canvas}
                role="img"
                aria-label={`The slip you uploaded, ${pending.name}`}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
              />

              <div
                role="group"
                aria-label="Crop frame"
                style={{
                  position: 'absolute',
                  left: `${crop.x * 100}%`, top: `${crop.y * 100}%`,
                  width: `${crop.w * 100}%`, height: `${crop.h * 100}%`,
                  border: '2px solid var(--accent)',
                  boxShadow: '0 0 0 9999px color-mix(in oklab, var(--bg) 82%, transparent)',
                  cursor: 'move',
                }}
              >
                <button
                  type="button"
                  className="crop__grab"
                  aria-label="Move the crop frame. Arrow keys move it, shift for ten times as far"
                  onKeyDown={onMoveKey}
                  style={{
                    position: 'absolute', left: '50%', top: '50%',
                    width: HANDLE, height: HANDLE, transform: 'translate(-50%, -50%)',
                    background: 'none', border: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', cursor: 'move',
                  }}
                >
                  <span aria-hidden="true" style={{ display: 'block', width: 18, height: 18, border: '2px solid var(--accent)', borderRadius: 3 }} />
                </button>

                {CORNERS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    data-corner={c.id}
                    aria-label={`${c.label} of the crop. Arrow keys move it, shift for ten times as far`}
                    onKeyDown={(e) => onCornerKey(e, c.id)}
                    style={{
                      position: 'absolute',
                      left: `calc(${c.ax * 100}% - ${HANDLE / 2}px)`,
                      top: `calc(${c.ay * 100}% - ${HANDLE / 2}px)`,
                      width: HANDLE, height: HANDLE,
                      background: 'none', border: 0, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', cursor: 'move',
                      touchAction: 'none',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        display: 'block', width: 16, height: 16, borderRadius: 3,
                        background: 'var(--accent)', border: '2px solid var(--bg)',
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <p className="small dim" style={{ marginTop: 'var(--s3)' }}>
              Drag a rectangle over the slip, or tab to a corner and use the arrow keys. Dragging
              outside the frame starts a new one.
            </p>

            <div className="row row--wrap" style={{ marginTop: 'var(--s4)', gap: 'var(--s3)' }}>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setQuarter((q) => q - 90)}>
                <Icon name="refresh" size={15} /> Rotate left
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setQuarter((q) => q + 90)}>
                <Icon name="refresh" size={15} /> Rotate right
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setQuarter(0); setTilt(0); setCrop(START); }}>
                Reset
              </button>
            </div>

            <div className="row" style={{ marginTop: 'var(--s4)', gap: 'var(--s3)' }}>
              <label htmlFor="crop-tilt" className="small" style={{ minWidth: 0 }}>Straighten</label>
              <input
                id="crop-tilt"
                type="range"
                min={-15}
                max={15}
                step={0.5}
                value={tilt}
                onChange={(e) => setTilt(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              {/*  The slider's own value, not the total. Showing 90 beside a
                   slider sitting at its midpoint reads as a broken control. */}
              <span className="small mono tnum">{tilt.toFixed(1)}&deg;</span>
            </div>

            <p className="small muted" aria-live="polite" style={{ marginTop: 'var(--s3)' }}>
              {sourceCrop
                ? `The reader is sent ${sourceCrop.w} by ${sourceCrop.h} pixels, turned ${Math.round(((angle % 360) + 360) % 360)} degrees.`
                : 'Opening the image.'}
            </p>
          </>
        ) : null}
      </div>

      <div className="row row--wrap" style={{ marginTop: 'var(--s5)', gap: 'var(--s3)' }}>
        <button
          type="button"
          className="btn btn--primary grow"
          onClick={() => send(false)}
          disabled={working || (!isPdf && !failed && !loaded)}
        >
          {working ? 'Preparing' : 'Read this slip'} <Icon name="arrowRight" size={16} />
        </button>
        {!isPdf && !failed ? (
          <button type="button" className="btn btn--ghost" onClick={() => send(true)} disabled={working || !loaded}>
            Use the whole image
          </button>
        ) : null}
      </div>
    </>
  );
}
