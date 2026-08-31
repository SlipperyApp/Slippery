/** Slip reading through the vision model.
 *
 *  VISION_API_KEY and ANTHROPIC_API_KEY are the same kind of key and the
 *  fallback between them is deliberate, so a rename cannot take reading down.
 *
 *  The model is asked to report what it can SEE and to say "not legible"
 *  rather than infer. A missing price is visible to the person confirming it;
 *  a wrong one is not, and a wrong one sits in an ROI for months. */

import { visionKey } from './env';

export function readerReady(): boolean {
  return Boolean(visionKey());
}

const MODEL = 'claude-sonnet-5';

const SYSTEM = [
  'You read betting slips from UK and Irish bookmakers and return structured fields.',
  '',
  'Rules you must not break:',
  '1. Report only what is legible on the image. If a field is not legible, return null for it and add its name to notLegible. Never infer a price, a stake or a date from context.',
  '2. Identify the bookmaker from the slip layout and branding, and say how sure you are.',
  '3. Identify the bet type exactly: single, double, treble, accumulator, each way, Trixie, Patent, Yankee, Lucky 15, Canadian, Lucky 31, Heinz, Lucky 63, Goliath, bet builder, or unknown.',
  '4. A permed bet has one stake per line and several selections. Report the stake per line and every selection separately.',
  '5. Score confidence per field, never for the slip as a whole.',
  '6. If the image is not a betting slip, set isSlip to false and return nothing else.',
  '',
  'Return JSON only, with no prose around it.',
].join('\n');

export type VisionResult = {
  isSlip: boolean;
  bookmaker: string | null;
  bookmakerConfidence: 'high' | 'medium' | 'low';
  shape: string | null;
  stakePence: number | null;
  currency: 'GBP' | 'EUR' | null;
  placedAt: string | null;
  isFreeBet: boolean;
  isBoosted: boolean;
  legs: { selection: string | null; eventName: string | null; marketRaw: string | null; odds: number | null; confidence: 'high' | 'medium' | 'low' }[];
  notLegible: string[];
};

export type ReadOutcome =
  | { ok: true; result: VisionResult }
  | { ok: false; reason: 'not_configured' | 'refused' | 'unreachable' | 'unparsable' };

export async function readSlip(imageBase64: string, mediaType: string): Promise<ReadOutcome> {
  const key = visionKey();
  if (!key) return { ok: false, reason: 'not_configured' };

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: SYSTEM,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: 'Read this slip. JSON only.' },
          ],
        }],
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) return { ok: false, reason: 'refused' };
    const body = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = body.content?.find((c) => c.type === 'text')?.text ?? '';
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    if (!json) return { ok: false, reason: 'unparsable' };
    return { ok: true, result: JSON.parse(json) as VisionResult };
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
}

/** A field the model marked as not legible is never filled in from a guess.
 *  This turns the model's answer into the shape the review screen uses. */
export function toFields(v: VisionResult): { key: string; label: string; value: string; confidence: 'high' | 'medium' | 'low' | 'missing' }[] {
  const missing = new Set(v.notLegible ?? []);
  const field = (key: string, label: string, value: unknown, confidence: 'high' | 'medium' | 'low' = 'high') => ({
    key,
    label,
    value: value == null || value === '' ? 'Not legible' : String(value),
    confidence: (missing.has(key) || value == null ? 'missing' : confidence) as 'high' | 'medium' | 'low' | 'missing',
  });
  return [
    field('bookmaker', 'Bookmaker', v.bookmaker, v.bookmakerConfidence),
    field('shape', 'Bet type', v.shape),
    field('stake', 'Stake', v.stakePence == null ? null : (v.stakePence / 100).toFixed(2)),
    field('placed', 'Placed', v.placedAt),
  ];
}
