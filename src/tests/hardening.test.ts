import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { request } from 'node:http';
import { effectiveDealCount, registeredAreaMatches, weightedDealStats } from '../utils/transactionStatistics';
import { aggregateTradesByMonth } from '../utils/calculations';
import { parseHousingRoute, APT_PROJECT_LINKS } from '../utils/housingRoute';
import { requireOperator } from '../server/apiSecurity';
import { firestoreRepository } from '../server/firestoreRepository';

test('retired persistence methods refuse writes before opening a database connection', async () => {
  await assert.rejects(firestoreRepository.saveComplexMetadata({} as any), /READ_ONLY_REPOSITORY/);
  await assert.rejects(firestoreRepository.saveTransactions([], 'test'), /READ_ONLY_REPOSITORY/);
  await assert.rejects(firestoreRepository.saveMonthlyPrices('test', [], 'ALL'), /READ_ONLY_REPOSITORY/);
  await assert.rejects(firestoreRepository.recordCollectionStatus({} as any), /READ_ONLY_REPOSITORY/);
});

test('multiplicity affects both count and median; partial cancellations retain active deals', () => {
  const rows = [
    { price: 100, exclusiveArea: 59.96, activeCount: 2, cancelDate: '2023-11-01', isCancelled: false },
    { price: 400, exclusiveArea: 59.96, activeCount: 1 },
    { price: 1, exclusiveArea: 59.96, activeCount: 0, isCancelled: true },
  ];
  assert.deepEqual(weightedDealStats(rows), { count: 3, avgPrice: 200, medianPrice: 100, minPrice: 100, maxPrice: 400 });
  assert.equal(effectiveDealCount({ price: 100, exclusiveArea: 59.96, normalRowCount: 3, cancellationRowCount: 1 }), 2);
  assert.equal(effectiveDealCount({ price: 100, exclusiveArea: 59.96, cancelDate: '2023-01-01' }), 0);
  assert.throws(() => effectiveDealCount({ price: 100, exclusiveArea: 59.96, activeCount: -1 }));
});

test('weighted statistics agree with the app monthly engine', () => {
  const rows = [100, 400].map((price, i) => ({ id: String(i), price, exclusiveArea: 59.96, activeCount: i ? 1 : 2, isCancelled: false, dealYmd: '202310' }));
  const monthly = aggregateTradesByMonth(rows as any);
  const annual = weightedDealStats(rows)!;
  assert.equal(monthly[0].transactionCount, annual.count);
  assert.equal(monthly[0].medianPrice, annual.medianPrice);
});

test('unregistered nearby sizes are excluded; empty series have no fabricated statistics', () => {
  assert.equal(registeredAreaMatches(60.5, [59.96]), false);
  assert.equal(registeredAreaMatches(59.96, [59.96]), true);
  assert.equal(weightedDealStats([]), null);
});

test('direct links distinguish project lineage from existing apartment and reject unknown IDs', () => {
  assert.equal(parseHousingRoute('?view=REDEVELOPMENT&lineage=chokjin3_redevelopment').lineageId, 'chokjin3_redevelopment');
  assert.equal(parseHousingRoute('?view=ANALYSIS&complex=busan_samick_beach').complexId, 'busan_samick_beach');
  assert.equal(parseHousingRoute('?view=evil&complex=gwacheon-5').view, 'MAP');
  assert.equal(parseHousingRoute('?view=evil&complex=gwacheon-5').complexId, 'banpo_xi');
  assert.equal(APT_PROJECT_LINKS.some(x => x.aptProjectId.startsWith('gwacheon')), false);
});

test('operator endpoint rejects missing/wrong secrets and permits authenticated backend caller', async () => {
  let secret: string | undefined;
  const app = express();
  let calls = 0;
  app.post('/protected', requireOperator(() => secret), (_, res) => { calls++; res.json({ ok: true }); });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}/protected`;
  // OS-assigned local ports may be in Fetch's browser-unsafe port list.
  // Use Node's transport for this backend-only authentication test.
  const post = (authorization?: string) => new Promise<number>((resolve, reject) => {
    const req = request(url, { method: 'POST', headers: authorization ? { authorization } : {} }, res => {
      res.resume();
      res.once('end', () => resolve(res.statusCode!));
    });
    req.once('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('Local authentication test timed out')));
    req.end();
  });
  try {
    assert.equal(await post(), 503);
    secret = 'test-server-secret';
    assert.equal(await post(), 401);
    assert.equal(await post('Bearer incorrect'), 401);
    assert.equal(calls, 0);
    assert.equal(await post(`Bearer ${secret}`), 200);
    assert.equal(calls, 1);
  } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
});
