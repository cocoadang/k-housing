import { FieldPath, type Firestore } from '@google-cloud/firestore';
import {
  projectFromAptWriter,
  type AptBudgetIdentity,
  type AptBudgetRequest,
  type AptCanonicalGroup,
  type AptWriterManifest,
} from './aptBudgetCanonicalProjection';

const revisionId = /^r\d{14}(?:_[a-f0-9]{8})?$/;
const complexId = /^[a-z][a-z0-9_]{1,95}$/;
const month = /^20\d{2}(?:0[1-9]|1[0-2])$/;
const pageLimit = 250;
const maxGroups = 50_000;
const fail = (): never => { throw Error('CANONICAL_MANIFEST_UNAVAILABLE'); };
type StoredGroup = { id: string; data: AptCanonicalGroup };
type PageRequest = { collection: string; complexId: string; month: string; after: string | null; limit: number };
export type CanonicalManifestStore = {
  manifest(id: string): Promise<AptWriterManifest | undefined>;
  page(request: PageRequest): Promise<readonly StoredGroup[]>;
};

// Caller must supply an already-authorized read-only client scoped to the exact K-Housing database.
// No settings, process credentials, writes, source regeneration or live initialization here.
export function createCanonicalManifestFirestoreStore(db: Pick<Firestore, 'collection'>): CanonicalManifestStore {
  return {
    async manifest(id) {
      if (id !== 'active' && !revisionId.test(id)) fail();
      const doc = await db.collection('priceRevisions').doc(id).get();
      return doc.exists ? doc.data() as AptWriterManifest : undefined;
    },
    async page({ collection, complexId: id, month: ymd, after, limit }) {
      if (!collection.startsWith('transactions_') || !revisionId.test(collection.slice('transactions_'.length)) ||
          !complexId.test(id) || !month.test(ymd) || limit !== pageLimit) fail();
      let query = db.collection(collection).where('complexId', '==', id).where('dealYmd', '==', ymd)
        .orderBy(FieldPath.documentId()).limit(limit);
      if (after !== null) query = query.startAfter(after);
      return (await query.get()).docs.map(doc => ({ id: doc.id, data: doc.data() as AptCanonicalGroup }));
    },
  };
}

function ready(manifest: AptWriterManifest | undefined): manifest is AptWriterManifest & { collections: { transactions: string } } {
  return !!manifest && manifest.status === 'READY' && revisionId.test(manifest.revision) &&
    manifest.collections?.transactions === 'transactions_' + manifest.revision;
}

export async function readCanonicalBudgetProjection(
  store: CanonicalManifestStore,
  request: AptBudgetRequest,
  registry: readonly AptBudgetIdentity[],
) {
  if (!request.months.length || request.months.length > 12 || !request.complexIds.length || request.complexIds.length > 18 ||
      new Set(request.months).size !== request.months.length || new Set(request.complexIds).size !== request.complexIds.length ||
      request.months.some(m => !month.test(m)) || request.complexIds.some(id => !complexId.test(id))) return fail();
  const active = await store.manifest('active');
  if (!ready(active)) return fail();
  const immutable = await store.manifest(active.revision);
  if (!ready(immutable) || immutable.revision !== active.revision) return fail();
  const groups: AptCanonicalGroup[] = [];
  const seen = new Set<string>();
  // No ACTIVE-only/family filter, no old base collection, no inferred empty result on page faults.
  for (const id of request.complexIds) for (const ymd of request.months) {
    let after: string | null = null;
    for (;;) {
      const rows = await store.page({ collection: active.collections.transactions, complexId: id, month: ymd, after, limit: pageLimit });
      if (!Array.isArray(rows) || rows.length > pageLimit || groups.length + rows.length > maxGroups) return fail();
      for (const row of rows) {
        if (!row?.id || typeof row.id !== 'string' || (after !== null && Buffer.compare(Buffer.from(row.id), Buffer.from(after)) <= 0) ||
            seen.has(row.id) || row.data?.id !== row.id || row.data.complexId !== id || row.data.dealYmd !== ymd) return fail();
        seen.add(row.id);
        groups.push(row.data);
        after = row.id;
      }
      if (rows.length < pageLimit) break; // Firestore get() returned fewer rows than the requested page size.
    }
  }
  const finalActive = await store.manifest('active');
  if (!ready(finalActive) || finalActive.revision !== active.revision) return fail();
  return projectFromAptWriter({
    request, registry, immutable, active: finalActive,
    query: { revision: active.revision, collection: active.collections.transactions, groups },
  });
}

type Freshness = { maxAgeMs:number; maxFutureMs:number };
export function oldestObservation(manifest:AptWriterManifest, months:readonly string[], districts:ReadonlySet<string>, now:Date, policy:Freshness) {
  if (!Array.isArray(manifest.snapshots) || manifest.snapshots.length > 5_000) return fail();
  const expected = new Set([...districts].flatMap(district=>months.map(month=>district+'/'+month)));
  const observations: number[] = [];
  for (const s of manifest.snapshots ?? []) {
    const key = s?.district+'/'+s?.month;
    if (!expected.delete(key)) continue;
    const observed = Date.parse(s.fetchedAt ?? '');
    const age = now.getTime()-observed;
    if (!Number.isFinite(age) || age < -policy.maxFutureMs || age >= policy.maxAgeMs) return fail();
    observations.push(observed);
  }
  if (expected.size || !observations.length) return fail();
  return Math.min(...observations);
}

