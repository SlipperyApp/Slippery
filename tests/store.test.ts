import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/* A localStorage that can be made to fail the way real ones do. */
class FakeStorage {
  private m = new Map<string, string>();
  mode: 'ok' | 'quota' | 'blocked' = 'ok';
  getItem(k: string) { if (this.mode === 'blocked') throw new Error('blocked'); return this.m.get(k) ?? null; }
  setItem(k: string, v: string) {
    if (this.mode === 'blocked') throw new Error('blocked');
    if (this.mode === 'quota') { const e: any = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
    this.m.set(k, v);
  }
  removeItem(k: string) { if (this.mode === 'blocked') throw new Error('blocked'); this.m.delete(k); }
  raw(k: string) { return this.m.get(k); }
  seed(k: string, v: string) { this.m.set(k, v); }
}

const storage = new FakeStorage();
(globalThis as any).localStorage = storage;

/* Imported after the global exists, and re-imported per test so the module's
   memoised availability flag does not leak between them. */
const fresh = async () => {
  const mod = await import('../lib/proto/store.js?v=' + Math.random());
  return mod as typeof import('../lib/proto/store.js');
};

beforeEach(() => { storage.mode = 'ok'; storage.removeItem('slippery.state.v1'); });

test('a saved preference comes back', async () => {
  const s = await fresh();
  assert.equal(s.save({ theme: 'liquid', oddsFmt: 'Fractional', view: 'ledger' }), true);
  const back = s.load();
  assert.equal(back.theme, 'liquid');
  assert.equal(back.oddsFmt, 'Fractional');
});

test('view state is not persisted, only preferences', async () => {
  const s = await fresh();
  s.save({ theme: 'ink', view: 'ledger', betIdx: 3, cashRem: 42 });
  const back = s.load();
  assert.equal(back.theme, 'ink');
  assert.equal('view' in back, false, 'which screen you were on is not a preference');
  assert.equal('betIdx' in back, false);
  assert.equal('cashRem' in back, false);
});

/* THE APP MUST WORK WITH STORAGE UNAVAILABLE. */
test('private browsing does not break anything', async () => {
  const s = await fresh();
  storage.mode = 'blocked';
  assert.equal(s.storageWorks(), false);
  assert.deepEqual(s.load(), {}, 'load returns empty rather than throwing');
  assert.equal(s.save({ theme: 'ink' }), false, 'save reports failure rather than throwing');
});

test('a full quota is reported, not thrown', async () => {
  const s = await fresh();
  storage.mode = 'quota';
  assert.equal(s.save({ theme: 'ink' }), false);
  /* And the app keeps going: the setting still applies this session. */
  assert.doesNotThrow(() => s.load());
});

test('a corrupt blob is dropped rather than half read', async () => {
  const s = await fresh();
  storage.seed('slippery.state.v1', '{not json');
  assert.deepEqual(s.load(), {});
  assert.equal(storage.raw('slippery.state.v1'), undefined, 'and cleared, so it cannot fail again');
});

test('a blob from an unknown version is ignored rather than guessed at', async () => {
  const s = await fresh();
  storage.seed('slippery.state.v1', JSON.stringify({ v: 99, state: { theme: 'ink' } }));
  assert.deepEqual(s.load(), {});
});

test('the theme is readable before the first paint', async () => {
  const s = await fresh();
  s.save({ theme: 'cinnabar' });
  assert.equal(s.themeBeforePaint(), 'cinnabar');
  storage.mode = 'blocked';
  assert.equal(s.themeBeforePaint(), null, 'and returns nothing rather than throwing');
});
