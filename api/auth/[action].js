/* /api/auth/* — one function, nine actions.
 *
 * WHY THIS IS A ROUTER AND NOT EIGHT FILES.
 * Vercel's Hobby plan allows twelve Serverless Functions per deployment, and
 * every .js file under api/ is one. The tree reached exactly twelve, and the
 * next four routes took it to sixteen. A deployment over the limit does not
 * warn or degrade: it fails to build, the previous deployment keeps serving,
 * and the site simply stops changing while every push reports success. That
 * cost five commits before anyone noticed the live page was old.
 *
 * So the handlers live under api/_lib/routes/, which Vercel does not treat
 * as routes because the directory is underscore-prefixed, and this file is
 * the only function. The URLs are unchanged: /api/auth/login still posts to
 * login.
 *
 * STATIC IMPORTS, DELIBERATELY. Vercel's file tracer only follows literal
 * specifiers, so `await import('../_lib/routes/' + action + '.js')` would
 * compile, bundle nothing, and fail in production with "Cannot find module".
 * That has already happened once in this codebase. Import them by name and
 * hold them in a table.
 */
import { json } from '../_lib/http.js';
import forgot from '../_lib/routes/forgot.js';
import login from '../_lib/routes/login.js';
import logout from '../_lib/routes/logout.js';
import me from '../_lib/routes/me.js';
import profile from '../_lib/routes/profile.js';
import resend from '../_lib/routes/resend.js';
import reset from '../_lib/routes/reset.js';
import signup from '../_lib/routes/signup.js';
import verify from '../_lib/routes/verify.js';

const ROUTES = { forgot, login, logout, me, profile, resend, reset, signup, verify };

export default async function handler(req, res) {
  /* Vercel puts the [action] segment in req.query. Falling back to the path
     keeps this working under any runner that does not. */
  const raw = (req.query && req.query.action) ||
    String(req.url || '').split('?')[0].split('/').filter(Boolean).pop() || '';
  const action = String(Array.isArray(raw) ? raw[0] : raw).toLowerCase();

  /* Own properties only: without it "constructor" resolves to a function
     and gets called with (req, res). */
  if (!Object.prototype.hasOwnProperty.call(ROUTES, action)) {
    return json(res, 404, { error: 'No such auth endpoint.' });
  }
  return ROUTES[action](req, res);
}
