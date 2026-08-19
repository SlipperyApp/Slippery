import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { env } from './env';

/* Reading a slip. SERVER ONLY, ALWAYS.
 *
 * The key never reaches a browser and the image never goes anywhere except
 * to the model. Slip contents are never logged: the privacy policy commits
 * to that and the bot's own voice depends on it.
 *
 * THE READER REFUSES TO GUESS. Every field it could not read comes back
 * named in `unreadable_fields` rather than filled with something plausible,
 * because a stake that is nearly right is worse than a stake that is
 * visibly missing.
 */

import type { ReadResult } from './slip-schema';
import { sanitise } from './slip-schema';
export type { ReadLeg, ReadBet, ReadResult } from './slip-schema';
export { sanitise } from './slip-schema';

const SYSTEM = `You read betting slips for a UK and Irish bet tracker and return structured data.

THE RULE THAT MATTERS: never guess. If a value is not legible, leave it null and
name the field in unreadable_fields. A stake that is nearly right corrupts a
ledger silently; a stake that is missing is visibly missing.

TELLING BETS APART. The test is the stake.
- Several selections sharing ONE stake in ONE fixture is a bet builder or
  same game multi: shape "multi_same_fixture", one entry, one leg per selection.
- Several selections sharing ONE stake across DIFFERENT fixtures is an
  accumulator: shape "multi_cross_fixture", one entry, one leg per selection.
- Several SEPARATE stakes is a list of singles: one entry in bets[] each, with
  its own stake. Never merge them.
- Each way is one bet with two parts, not two bets: shape "each_way".

Money is integer pence. £25.00 is 2500. Never a float, never a string.
Odds are decimal. Convert fractional prices: 10/11 is 1.91, evens is 2.0.
event_at is ISO 8601. If the slip shows only a time, use the date on the slip.
If the image is not a betting slip, return {"bets":[],"not_a_slip":true}.`;

const TOOL = {
  name: 'record_slip',
  description: 'Record what is legible on the slip, and name what is not.',
  input_schema: {
    type: 'object' as const,
    properties: {
      not_a_slip: { type: 'boolean' },
      bets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            shape: { type: 'string', enum: ['single', 'multi_same_fixture', 'multi_cross_fixture', 'each_way', 'system'] },
            side: { type: 'string', enum: ['back', 'lay'] },
            stake_pence: { type: 'integer' },
            liability_pence: { type: 'integer' },
            odds: { type: 'number' },
            currency: { type: 'string', enum: ['GBP', 'EUR'] },
            bookmaker: { type: 'string' },
            event_name: { type: 'string' },
            selection: { type: 'string' },
            market: { type: 'string' },
            event_at: { type: 'string' },
            is_free_bet: { type: 'boolean' },
            is_each_way: { type: 'boolean' },
            legs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  selection: { type: 'string' },
                  event_name: { type: 'string' },
                  market: { type: 'string' },
                  odds: { type: 'number' },
                },
              },
            },
            unreadable_fields: { type: 'array', items: { type: 'string' } },
          },
          required: ['unreadable_fields'],
        },
      },
    },
    required: ['bets'],
  },
};

export class ReaderUnavailable extends Error {}

export async function readSlip(image: { base64: string; mediaType: string }): Promise<ReadResult> {
  const key = env.visionApiKey();
  if (!key) throw new ReaderUnavailable('no reader configured');

  const client = new Anthropic({ apiKey: key });
  let message;
  try {
    message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: 'record_slip' },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: image.mediaType as never, data: image.base64 } },
          { type: 'text', text: 'Read this slip.' },
        ],
      }],
    });
  } catch {
    /* Never the provider's message: it can carry the request, and the
       request is the slip. */
    throw new ReaderUnavailable('the reader is not answering');
  }

  const block = message.content.find((c) => c.type === 'tool_use');
  if (!block || block.type !== 'tool_use') throw new ReaderUnavailable('the reader returned nothing usable');

  return sanitise(block.input as Record<string, unknown>);
}

