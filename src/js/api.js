/* Client for the serverless API.
 *
 * Images are downscaled before upload. An iPhone photo is 4-8MB; at 1600px
 * on the long edge a slip is 200-400KB and reads exactly as well, which is
 * the difference between a 4 second wait on 4G and an instant one. */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.86;

export async function downscale(file) {
  if (!/^image\//.test(file.type)) return file;
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 900_000) { bmp.close(); return file; }
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

async function toBase64(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export async function extractSlip(file) {
  const small = await downscale(file);
  const b64 = await toBase64(small);
  return read({ image: b64, mime: small.type || 'image/jpeg' });
}

/* The same reader, given text instead of a picture. A list someone typed
   into their notes is a betting record as much as a screenshot is, and
   refusing it because it is not an image would send them to a spreadsheet
   they do not have. */
export async function readText(text) {
  return read({ text });
}

async function read(payload) {
  const res = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || ('Reader returned ' + res.status));
  return body;
}

/* One shape for every call: {ok, status, body}. Nothing throws on a 4xx,
   because a 402 "out of free slips" and a 401 "log in" are both ordinary
   answers the UI has to render, not exceptions. A genuinely unreachable
   network is the only throw, and it is turned into ok:false here too so
   callers never need a try/catch to stay correct. */
async function send(method, path, payload) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: payload === undefined ? {} : { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: payload === undefined ? undefined : JSON.stringify(payload)
    });
  } catch {
    return { ok: false, status: 0, offline: true, body: { error: 'You appear to be offline.' } };
  }
  let body = {};
  try { body = await res.json(); } catch { /* empty body is fine */ }
  return { ok: res.ok, status: res.status, body };
}

export const get = path => send('GET', path);
export const post = (path, payload) => send('POST', path, payload || {});
export const patch = (path, payload) => send('PATCH', path, payload || {});
export const del = (path, payload) => send('DELETE', path, payload || {});
