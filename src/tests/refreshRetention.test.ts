import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeRetainedRefresh } from '../server/refreshRetention.ts';

const row = (id: string, complexId: string, activeCount: number) => ({
  id, complexId, dealYmd: '202611', dealDate: '2026-11-25', price: 100,
  floor: 12, exclusiveArea: 59.95, activeCount,
});
const plainSnapshot = { district: '11680', month: '202611', archiveUri: 'fresh' };
const protectedSnapshot = {
  ...plainSnapshot, archiveUri: 'verified', aptBudget: { identities: [{ id: 'apt' }] },
};

test('refresh keeps live-only transactions and applies normal status updates', () => {
  const missing = row('missing', 'old', 1);
  const changed = row('changed', 'legacy', 0);
  const result = mergeRetainedRefresh({
    rows: [missing, row('changed', 'legacy', 1)], manifest: { snapshots: [] },
  }, {
    rows: [changed], manifest: { snapshots: [plainSnapshot] },
  });
  assert.deepEqual(result.rows, [missing, changed]);
  assert.equal(result.retainedMissingGroups, 1);
  assert.equal(result.requiresAptReceiptRefresh, false);
});

test('legacy collection preserves exact Apt receipts and cannot replace their trade groups', () => {
  const verified = row('same', 'apt', 1);
  const result = mergeRetainedRefresh({
    rows: [verified], manifest: { snapshots: [protectedSnapshot] },
  }, {
    rows: [row('same', 'apt', 0), row('new', 'apt', 1)], manifest: { snapshots: [plainSnapshot] },
  });
  assert.deepEqual(result.rows, [verified]);
  assert.deepEqual(result.snapshots, [protectedSnapshot]);
  assert.equal(result.protectedGroupsHeld, 2);
  assert.equal(result.requiresAptReceiptRefresh, true);
});

test('refresh rejects a reused ID with a different trade identity', () => {
  const stored = row('same', 'legacy', 1);
  assert.throws(() => mergeRetainedRefresh({
    rows: [stored], manifest: { snapshots: [] },
  }, {
    rows: [{ ...stored, floor: 13 }], manifest: { snapshots: [plainSnapshot] },
  }), /REFRESH_TRANSACTION_IDENTITY_CHANGED/);
});
