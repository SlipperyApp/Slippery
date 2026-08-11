/* POST /api/extract
 *
 * Bet slip image -> strict JSON. The whole design goal is that it REFUSES.
 * A tracker that guesses a stake is worse than one that asks for a retake,
 * because a wrong number is silently wrong forever.
 *
 * Three things enforce that:
 *   1. output_config.format pins the response to a JSON schema, so the model
 *      cannot return prose, a code fence, or an apology. No parsing guesswork.
 *   2. Every field is nullable and the prompt says null means "not legible".
 *   3. A post-check rejects values that are structurally impossible (odds
 *      below 1, negative stakes), because a schema cannot express those and a
 *      confidently-wrong number is exactly the failure being designed out.
 */
import Anthropic from '@anthropic-ai/sdk';
import { json, methodGuard, readJson, clientIp, fail } from './_lib/http.js';
import { guard } from './_lib/rate.js';

const MODEL = process.env.EXTRACT_MODEL || 'claude-haiku-4-5';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/* Structured outputs reject minLength/maximum and require
   additionalProperties:false, so ranges are checked after the call instead. */
const nullable = type => ({ anyOf: [{ type }, { type: 'null' }] });

const SLIP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['readable', 'bet_type', 'selection', 'event', 'bookmaker', 'odds',
             'stake', 'returns', 'result', 'legs', 'placed_at', 'unreadable_fields', 'notes'],
  properties: {
    readable: { type: 'boolean' },
    bet_type: { anyOf: [{ type: 'string', enum: ['single', 'multiple', 'bet_builder', 'system'] }, { type: 'null' }] },
    selection: nullable('string'),
    event: nullable('string'),
    bookmaker: nullable('string'),
    odds: nullable('number'),
    stake: nullable('number'),
    returns: nullable('number'),
    result: { anyOf: [{ type: 'string', enum: ['won', 'lost', 'void', 'cashed_out', 'open'] }, { type: 'null' }] },
    legs: nullable('integer'),
    placed_at: nullable('string'),
    unreadable_fields: { type: 'array', items: { type: 'string' } },
    notes: nullable('string')
  }
};

const SYSTEM = `You read betting slips from images and return structured data.

THE ONE RULE: never guess. If a value is blurred, cropped, obscured by glare,
or simply absent from the image, return null for it and name the field in
unreadable_fields. A wrong number is far worse than a missing one, because the
person will not notice it and their profit and loss will be wrong forever.

Field notes:
- odds: decimal. Convert fractional (5/2 -> 3.5) and American (+150 -> 2.5).
  If the format is ambiguous, return null rather than picking one.
- stake and returns: the money amounts, as numbers with no currency symbol.
  Return the total stake. On an each-way slip that is the combined stake.
- result: only if the slip states it. An unsettled slip is "open". Never infer
  a result from the presence of a returns figure.
- selection: what was actually backed, as printed. Do not normalise or expand
  abbreviations, and do not translate.
- event: the fixture or market the selection belongs to.
- legs: number of selections. 1 for a single.
- placed_at: ISO 8601 if a date is legible, otherwise null.
- readable: false if the image is not a bet slip at all, or is too degraded to
  read anything useful from.
- notes: at most one short sentence, and only if something would confuse the
  person reading the result later. Otherwise null.`;

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return json(res, 503, { error: 'The slip reader is not configured on this deployment.' });
    }
    if (!(await guard(res, 'extract:' + clientIp(req), 30, 300))) return;

    const body = await readJson(req);
    const { image, mime } = body || {};
    if (typeof image !== 'string' || !image) {
      return json(res, 400, { error: 'Send an image as base64 in the "image" field.' });
    }
    const mediaType = ALLOWED_MIME.includes(mime) ? mime : 'image/jpeg';
    /* base64 is 4 chars per 3 bytes; check before allocating. */
    const approxBytes = Math.floor(image.length * 3 / 4);
    if (approxBytes > MAX_IMAGE_BYTES) {
      return json(res, 413, { error: 'That image is too large. Under 8MB, please.' });
    }
    if (!/^[A-Za-z0-9+/=]+$/.test(image.slice(0, 256))) {
      return json(res, 400, { error: 'The image field was not valid base64.' });
    }

    const client = new Anthropic();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SLIP_SCHEMA } },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: 'Read this bet slip. Return null for anything you cannot read with certainty.' }
        ]
      }]
    });

    if (message.stop_reason === 'refusal') {
      return json(res, 422, { error: 'The reader declined that image.' });
    }
    const text = message.content.find(b => b.type === 'text');
    if (!text) return json(res, 502, { error: 'The reader returned nothing usable.' });

    let fields;
    try {
      fields = JSON.parse(text.text);
    } catch {
      return json(res, 502, { error: 'The reader returned malformed data. Nothing was imported.' });
    }

    return json(res, 200, {
      fields: sanitise(fields),
      model: message.model,
      usage: { input: message.usage.input_tokens, output: message.usage.output_tokens }
    });
  } catch (err) {
    return fail(res, err, 'The slip reader is unavailable right now.');
  }
}

/* A schema can say "number or null"; it cannot say "odds are above 1". Values
   that are structurally impossible are dropped to null and reported, so the
   UI asks the user rather than storing a figure that cannot be true. */
function sanitise(f) {
  const out = { ...f };
  const bad = new Set(Array.isArray(f.unreadable_fields) ? f.unreadable_fields : []);
  const reject = (key, ok) => {
    if (out[key] != null && !ok(out[key])) { out[key] = null; bad.add(key); }
  };
  reject('odds', v => typeof v === 'number' && isFinite(v) && v > 1 && v < 5000);
  reject('stake', v => typeof v === 'number' && isFinite(v) && v > 0 && v < 1e7);
  reject('returns', v => typeof v === 'number' && isFinite(v) && v >= 0 && v < 1e9);
  reject('legs', v => Number.isInteger(v) && v >= 1 && v <= 40);
  reject('placed_at', v => typeof v === 'string' && !Number.isNaN(Date.parse(v)));
  for (const key of ['selection', 'event', 'bookmaker', 'notes']) {
    if (typeof out[key] === 'string') {
      out[key] = out[key].trim().slice(0, 200);
      if (!out[key]) { out[key] = null; bad.add(key); }
    }
  }
  out.unreadable_fields = [...bad];
  return out;
}
