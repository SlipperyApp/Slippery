import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callbackData, COMMANDS } from '../lib/server/telegram-pure.ts';

test('callback data fits the 64 byte limit and refuses rather than truncating', () => {
  assert.equal(callbackData('ok', 'abc123'), 'ok:abc123');
  assert.throws(() => callbackData('confirm', 'x'.repeat(70)), /64 bytes/);
});

test('the commands registered with BotFather are the ones specified', () => {
  assert.deepEqual(
    COMMANDS.map((c) => c.command),
    ['start', 'today', 'week', 'open', 'last', 'undo', 'help', 'stop'],
  );
});
