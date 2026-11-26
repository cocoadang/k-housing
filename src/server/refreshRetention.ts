type TransactionGroup = {
  id: string;
  complexId: string;
  dealYmd: string;
  dealDate: string;
  price: number;
  floor: number;
  exclusiveArea: number;
  areaFamilyId?: string | null;
};

type Snapshot = {
  district: string;
  month: string;
  archiveUri?: string;
  aptBudget?: { identities: { id: string; groupedCount: number }[] };
};

type Manifest = {
  snapshots: Snapshot[];
};

function index<T, K>(values: T[], key: (value: T) => K, error: string) {
  const indexed = new Map<K, T>();
  for (const value of values) {
    const id = key(value);
    if (indexed.has(id)) throw Error(error);
    indexed.set(id, value);
  }
  return indexed;
}

const bucketKey = (snapshot: Snapshot) => `${snapshot.district}/${snapshot.month}`;
const cellKey = (row: TransactionGroup) => `${row.complexId}/${row.dealYmd}`;
const tradeIdentity = ['complexId', 'dealYmd', 'dealDate', 'price', 'floor', 'exclusiveArea'] as const;

export function mergeRetainedRefresh<T extends TransactionGroup>(
  baseline: { rows: T[]; manifest: Manifest },
  fresh: { rows: T[]; manifest: Manifest },
) {
  const stored = index(baseline.rows, row => row.id, 'DUPLICATE_STORED_TRANSACTION_ID');
  const incoming = index(fresh.rows, row => row.id, 'DUPLICATE_FRESH_TRANSACTION_ID');
  const previousSnapshots = index(baseline.manifest.snapshots, bucketKey, 'DUPLICATE_STORED_SNAPSHOT');
  const freshSnapshots = index(fresh.manifest.snapshots, bucketKey, 'DUPLICATE_FRESH_SNAPSHOT');
  const protectedCells = new Set<string>();
  const protectedBuckets = new Set<string>();
  for (const snapshot of previousSnapshots.values()) {
    if (!snapshot.aptBudget || freshSnapshots.get(bucketKey(snapshot))?.aptBudget) continue;
    protectedBuckets.add(bucketKey(snapshot));
    for (const identity of snapshot.aptBudget.identities) {
      protectedCells.add(`${identity.id}/${snapshot.month}`);
    }
  }
  const merged = new Map(stored);
  let protectedGroupsHeld = 0;
  for (const [id, row] of incoming) {
    const prior = stored.get(id);
    if (prior && tradeIdentity.some(field => prior[field] !== row[field])) {
      throw Error('REFRESH_TRANSACTION_IDENTITY_CHANGED');
    }
    if (protectedCells.has(cellKey(row))) {
      protectedGroupsHeld++;
      continue;
    }
    merged.set(id, prior ? { ...prior, ...row } : row);
  }
  const snapshots = new Map(previousSnapshots);
  for (const [key, snapshot] of freshSnapshots) {
    if (!protectedBuckets.has(key)) snapshots.set(key, snapshot);
  }
  const mergedCellCounts = new Map<string, number>();
  for (const row of merged.values()) {
    const key = cellKey(row);
    mergedCellCounts.set(key, (mergedCellCounts.get(key) ?? 0) + 1);
  }
  const incompleteAttestations = [...freshSnapshots.values()].flatMap(snapshot =>
    (snapshot.aptBudget?.identities ?? []).flatMap(identity => {
      const key = `${identity.id}/${snapshot.month}`;
      return (mergedCellCounts.get(key) ?? 0) === identity.groupedCount ? [] : [key];
    }),
  );
  return {
    incompleteAttestations,
    rows: [...merged.values()],
    snapshots: [...snapshots.values()],
    baselineGroups: stored.size,
    retainedMissingGroups: [...stored.keys()].filter(id => !incoming.has(id)).length,
    protectedGroupsHeld,
    requiresAptReceiptRefresh: [...protectedBuckets].some(key => freshSnapshots.has(key)) ||
      incompleteAttestations.length > 0,
  };
}
