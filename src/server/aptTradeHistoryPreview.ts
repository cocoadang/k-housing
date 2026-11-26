import type { Firestore } from '@google-cloud/firestore';

const revisionPattern = /^r\d{14}(?:_[a-f0-9]{8})?$/;
const monthPattern = /^20\d{2}(?:0[1-9]|1[0-2])$/;
const complexPattern = /^[a-z][a-z0-9_]{1,95}$/;

export async function readPinnedTradeHistory(
  db: Pick<Firestore, 'collection'>,
  revision: string,
  complexId: string,
  start: string,
  end: string,
) {
  if (!revisionPattern.test(revision) || !complexPattern.test(complexId) ||
      !monthPattern.test(start) || !monthPattern.test(end) || end < start) {
    throw Error('INVALID_PINNED_HISTORY_SCOPE');
  }
  const monthNumber = (month: string) => Number(month.slice(0, 4)) * 12 + Number(month.slice(4)) - 1;
  if (monthNumber(end) - monthNumber(start) >= 60) throw Error('INVALID_PINNED_HISTORY_SCOPE');
  const collection = `transactions_${revision}`;
  const manifest = (await db.collection('priceRevisions').doc(revision).get()).data();
  if (manifest?.status !== 'READY' || manifest.revision !== revision ||
      manifest.collections?.transactions !== collection || !Array.isArray(manifest.covered)) {
    throw Error('PINNED_HISTORY_MANIFEST_UNAVAILABLE');
  }

  const scope = new Set(manifest.covered);
  const rows = [];
  for (let month = monthNumber(start); month <= monthNumber(end); month++) {
    const ymd = `${Math.floor(month / 12)}${String(month % 12 + 1).padStart(2, '0')}`;
    if (!scope.has(`${complexId}/${ymd}`)) throw Error('PINNED_HISTORY_SCOPE_UNAVAILABLE');
    const snapshot = await db.collection(collection).where('complexId', '==', complexId)
      .where('dealYmd', '==', ymd).limit(2001).get();
    if (rows.length + snapshot.size > 2000) throw Error('PINNED_HISTORY_TOO_LARGE');
    for (const doc of snapshot.docs) {
      const row = doc.data();
      if (row.id !== doc.id || row.complexId !== complexId || row.dealYmd !== ymd) {
        throw Error('INVALID_PINNED_HISTORY_ROW');
      }
      rows.push(row);
    }
  }
  return rows;
}
