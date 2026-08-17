/* ULTRAS puts its redeemers into a group.
 *
 * The rules being pinned here are the ones that would silently corrupt
 * membership rather than fail loudly: joining twice, joining a full group,
 * two people redeeming at the same instant, and the promise that none of
 * those can cost somebody the plan they actually redeemed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CODES, lookup } from '../api/_lib/promo.js';
import { ensurePromoGroup, MAX_MEMBERS, MAX_GROUPS_PER_USER, groupCode } from '../api/_lib/groups-core.js';
import { groupResult } from '../api/promo.js';

/* A stand-in for the neon tagged-template client. It dispatches on the text
   of the query, records every call, and lets a test script the answers. */
function stubSql(plan) {
  const calls = [];
  const state = Object.assign({
    group: null,          // {id,name,visibility} once it exists
    member: false,        // is the caller already in it
    groupSize: 0,
    userGroups: 0,
    failInsertGroup: null,  // an error to throw on the next group insert
    failInsertMember: null
  }, plan);

  const sql = (strings, ...values) => {
    const text = strings.join('?').replace(/\s+/g, ' ').trim();
    calls.push({ text, values });

    if (text.startsWith('SELECT id, name, visibility FROM groups')) {
      return Promise.resolve(state.group ? [state.group] : []);
    }
    if (text.startsWith('INSERT INTO groups')) {
      if (state.failInsertGroup) {
        const err = state.failInsertGroup;
        state.failInsertGroup = null;
        /* A name collision means somebody else won the race, so their row
           is now there to be found. A join-code collision means no row was
           written at all. Simulating both the same way would let a broken
           retry pass. */
        if (String(err.constraint || '').includes('name')) {
          state.group = { id: 'gWinner', name: values[0], visibility: values[3] };
        }
        return Promise.reject(err);
      }
      state.group = { id: 'g1', name: values[0], visibility: values[3] };
      return Promise.resolve([state.group]);
    }
    if (text.startsWith('SELECT 1 FROM group_members')) {
      return Promise.resolve(state.member ? [{ '?column?': 1 }] : []);
    }
    if (text.includes('count(*)::int AS n FROM group_members WHERE user_id')) {
      return Promise.resolve([{ n: state.userGroups }]);
    }
    if (text.includes('count(*)::int AS n FROM group_members WHERE group_id')) {
      return Promise.resolve([{ n: state.groupSize }]);
    }
    if (text.startsWith('INSERT INTO group_members')) {
      if (state.failInsertMember) {
        const err = state.failInsertMember;
        state.failInsertMember = null;
        return Promise.reject(err);
      }
      state.member = true;
      state.groupSize += 1;
      return Promise.resolve([]);
    }
    throw new Error('unexpected query: ' + text);
  };
  sql.calls = calls;
  sql.state = state;
  return sql;
}

/* Postgres reports a unique violation as 23505. This is what db.js reads. */
const dupe = index => Object.assign(new Error('duplicate key'), {
  code: '23505', constraint: index
});

const USER = { id: 'u1' };

test('ULTRAS carries a group and the other codes do not', () => {
  assert.equal(CODES.ULTRAS.group, 'Ultras');
  assert.equal(lookup('ultras').group, 'Ultras');
  for (const code of ['AK5WRD', 'GIFT1', 'GIFT2']) {
    assert.equal(CODES[code].group, undefined, code + ' must not join anyone to a group');
  }
});

test('a code with no group does nothing at all', async () => {
  const sql = stubSql();
  assert.equal(await ensurePromoGroup(sql, USER, lookup('GIFT1')), null);
  assert.equal(sql.calls.length, 0, 'must not touch the database');
});

test('the first redeemer creates the group and owns it', async () => {
  const sql = stubSql();
  const out = await ensurePromoGroup(sql, USER, lookup('ULTRAS'));

  assert.equal(out.created, true);
  assert.equal(out.joined, true);
  assert.equal(out.group.name, 'Ultras');

  const insert = sql.calls.find(c => c.text.startsWith('INSERT INTO groups'));
  assert.equal(insert.values[2], 'u1', 'the first redeemer must be the owner');
  assert.equal(insert.values[3], 'public', 'so it shows in the directory');
});

test('the second redeemer joins the group that already exists', async () => {
  const sql = stubSql({ group: { id: 'g1', name: 'Ultras', visibility: 'public' }, groupSize: 1 });
  const out = await ensurePromoGroup(sql, { id: 'u2' }, lookup('ULTRAS'));

  assert.equal(out.created, false);
  assert.equal(out.joined, true);
  assert.equal(sql.calls.some(c => c.text.startsWith('INSERT INTO groups')), false,
    'must not try to create a second group with the same name');
});

test('redeeming twice does not join twice', async () => {
  const sql = stubSql({ group: { id: 'g1', name: 'Ultras', visibility: 'public' }, member: true });
  const out = await ensurePromoGroup(sql, USER, lookup('ULTRAS'));

  assert.equal(out.joined, false);
  assert.equal(out.why, 'already');
  assert.equal(sql.calls.some(c => c.text.startsWith('INSERT INTO group_members')), false);
});

test('two people redeeming at once: the loser joins rather than failing', async () => {
  /* The race: both read "no such group", both insert, the unique index on
     name_lower picks a winner. The loser must go round, find it, and join. */
  const sql = stubSql({ failInsertGroup: dupe('groups_name_lower_key') });
  const out = await ensurePromoGroup(sql, { id: 'u2' }, lookup('ULTRAS'));

  assert.equal(out.created, false);
  assert.equal(out.joined, true, 'the loser of the race must still get in');
});

test('a join code collision is retried rather than surfaced', async () => {
  const sql = stubSql({ failInsertGroup: dupe('groups_join_code_key') });
  const out = await ensurePromoGroup(sql, USER, lookup('ULTRAS'));
  assert.equal(out.joined, true);
});

test('a full group does not cost anyone their plan', async () => {
  const sql = stubSql({
    group: { id: 'g1', name: 'Ultras', visibility: 'public' },
    groupSize: MAX_MEMBERS
  });
  const out = await ensurePromoGroup(sql, { id: 'u2' }, lookup('ULTRAS'));

  assert.equal(out.joined, false);
  assert.equal(out.why, 'group-full');
  assert.equal(sql.calls.some(c => c.text.startsWith('INSERT INTO group_members')), false);
});

test('somebody already in twenty groups is not forced into a twenty first', async () => {
  const sql = stubSql({
    group: { id: 'g1', name: 'Ultras', visibility: 'public' },
    userGroups: MAX_GROUPS_PER_USER
  });
  const out = await ensurePromoGroup(sql, { id: 'u2' }, lookup('ULTRAS'));
  assert.equal(out.why, 'user-full');
});

test('a membership insert that races is idempotent, not an error', async () => {
  const sql = stubSql({
    group: { id: 'g1', name: 'Ultras', visibility: 'public' },
    failInsertMember: dupe('group_members_pkey')
  });
  const out = await ensurePromoGroup(sql, { id: 'u2' }, lookup('ULTRAS'));
  assert.equal(out.why, 'already');
});

test('an error that is not a unique violation is not swallowed', async () => {
  const sql = stubSql({ failInsertGroup: Object.assign(new Error('connection lost'), { code: '08006' }) });
  await assert.rejects(() => ensurePromoGroup(sql, USER, lookup('ULTRAS')), /connection lost/);
});

/* ---------------- what the person is told ---------------- */

test('the sentence matches what actually happened', () => {
  const g = { id: 'g1', name: 'Ultras' };
  assert.match(groupResult({ group: g, created: true, joined: true, why: '' }).note, /You started Ultras/);
  assert.match(groupResult({ group: g, created: false, joined: true, why: '' }).note, /in Ultras now/);
  assert.match(groupResult({ group: g, created: false, joined: false, why: 'already' }).note, /already in Ultras/);
  assert.equal(groupResult(null).note, '');
});

test('a group we could not join is never reported as joined', () => {
  const g = { id: 'g1', name: 'Ultras' };
  for (const why of ['group-full', 'user-full']) {
    const out = groupResult({ group: g, created: false, joined: false, why });
    assert.equal(out.group, null, why + ' must not hand back a group the person is not in');
    assert.match(out.note, /could not add you/);
  }
});

test('no note contains an em dash', () => {
  /* The audit fails the build on one in rendered text, and these strings
     are appended to copy that reaches the screen. */
  const g = { id: 'g1', name: 'Ultras' };
  const notes = [
    groupResult({ group: g, created: true, joined: true, why: '' }).note,
    groupResult({ group: g, created: false, joined: true, why: '' }).note,
    groupResult({ group: g, created: false, joined: false, why: 'already' }).note,
    groupResult({ group: g, created: false, joined: false, why: 'group-full' }).note,
    groupResult({ group: g, created: false, joined: false, why: 'user-full' }).note,
    CODES.ULTRAS.note
  ];
  for (const n of notes) assert.equal(n.includes('—'), false, 'em dash in: ' + n);
});

test('group codes avoid the characters people mistype', () => {
  for (let i = 0; i < 200; i++) {
    const code = groupCode();
    assert.equal(code.length, 6);
    assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  }
});
