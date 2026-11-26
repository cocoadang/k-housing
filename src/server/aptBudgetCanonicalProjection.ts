/**
 * Pure projection for Apt's existing amount/actual-area recommendation rows.
 * The future internal adapter must supply writer-built exact receipts and revision-bound
 * query results, not accept these inputs from a browser or synthesize them from covered[].
 */
export interface AptIdentity {
  id: string;
  district: string;
  legalDong: string;
  parcel: string;
}
export interface AptBudgetIdentity extends AptIdentity { name: string }
export interface AptBudgetRequest { complexIds: readonly string[]; months: readonly string[] }
export interface AptCanonicalIdentityReceipt extends AptIdentity {
  groupedCount: number;
  activeCount: number;
  canceledCount: number;
}
export interface AptCanonicalBucketReceipt {
  district: string;
  month: string;
  /** Number the official detailed ordinary-sale API declared, including non-target rows. */
  sourceTotalCount: number;
  /** One row count per validated official page, in API order, including zero for a successful empty first page. */
  pageRowCounts: readonly number[];
  identities: readonly AptCanonicalIdentityReceipt[];
}
export interface AptCanonicalReceipt {
  revision: string;
  /** Only a validated named revision selected by the active READY pointer is meant here. */
  collection: string;
  state: 'READY';
  buckets: readonly AptCanonicalBucketReceipt[];
}
export interface AptCanonicalGroup {
  id: string;
  complexId: string;
  sourceDistrict: string;
  sourceLegalDong: string;
  sourceParcel: string;
  sourceAptSeqs: readonly string[];
  dataSource: 'MOLIT_OPENAPI';
  source: 'MOLIT_APT_TRADE';
  schemaVersion: 'SOURCE_STATUS_V2';
  dealYmd: string;
  dealDate: string;
  price: number;
  floor: number;
  exclusiveArea: number;
  normalRowCount: number;
  activeCount: number;
  cancellationRowCount: number;
  isCancelled: boolean;
  cancelDates: readonly string[];
}
export interface AptCanonicalGroupQuery {
  revision: string;
  collection: string;
  /** All groups for requested scopes, including canceled-only and unresolved-area-family groups. */
  groups: readonly AptCanonicalGroup[];
}
export interface AptBudgetProjectionRow {
  complexId: string;
  name: string;
  region: string;
  neighborhood: string;
  price: number;
  area: number;
  date: string;
  floor: number;
  areaCategory: string;
  tradeSummary: { count: number; min: number; max: number };
}
export type AptCoverageState = 'complete' | 'missing_registry_identity' | 'missing_bucket_receipt' |
  'invalid_bucket_receipt' | 'missing_identity_receipt' | 'identity_mismatch' |
  'row_identity_or_status_invalid' | 'row_count_mismatch';
export interface AptCoverageCell {
  complexId: string;
  district: string | null;
  month: string;
  state: AptCoverageState;
  activeCount?: number;
  canceledCount?: number;
}

const monthPattern = /^20\d{2}(?:0[1-9]|1[0-2])$/;
const idPattern = /^[a-z][a-z0-9_]{0,99}$/;
const districtPattern = /^\d{5}$/;
const parcelPattern = /^[1-9]\d{0,3}-(?:0|[1-9]\d{0,3})$/;
const revisionPattern = /^r\d{14}(?:_[a-f0-9]{8})?$/;
const seqPattern = /^\d{5}-\d+$/;
const count = (x: number) => Number.isSafeInteger(x) && x >= 0;
const positive = (x: number) => count(x) && x > 0;
const dealDay = (value: string) => {
  if (typeof value !== 'string') return '';
  const day = value.replace(/-/g, '');
  if (!/^20\d{2}\d{4}$/.test(day) || (value !== day && value !== `${day.slice(0,4)}-${day.slice(4,6)}-${day.slice(6,8)}`)) return '';
  const asIso = `${day.slice(0,4)}-${day.slice(4,6)}-${day.slice(6,8)}`;
  const date = new Date(`${asIso}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === asIso ? asIso : '';
};
// Writer intentionally preserves raw cancellation values, including documented fixture YY.MM.DD.
const cancelDay = (value: string) => typeof value === 'string' && /^\d{2}\.\d{2}\.\d{2}$/.test(value)
  ? dealDay(`20${value.replace(/\./g, '')}`) : dealDay(value);
const identKey = (district: string, month: string) => `${district}/${month}`;
const cellKey = (complexId: string, month: string) => `${complexId}/${month}`;
const sameIdentity = (a: AptIdentity, b: AptIdentity) => a.id === b.id && a.district === b.district &&
  a.legalDong === b.legalDong && a.parcel === b.parcel;
function validIdentity(i: AptIdentity) {
  return !!i && typeof i.id === 'string' && idPattern.test(i.id) &&
    typeof i.district === 'string' && districtPattern.test(i.district) &&
    typeof i.legalDong === 'string' && /^[가-힣0-9·]{1,30}$/.test(i.legalDong) &&
    typeof i.parcel === 'string' && parcelPattern.test(i.parcel);
}
function validPageProof(b: AptCanonicalBucketReceipt) {
  if (!count(b.sourceTotalCount) || !Array.isArray(b.pageRowCounts) || b.pageRowCounts.length < 1 ||
    b.pageRowCounts.length > 100 || !Array.isArray(b.identities) || b.identities.length > 500 ||
    [...b.pageRowCounts].some(x => !count(x) || x > 1000) ||
    ![...b.identities].every(i => i && validIdentity(i) && i.district === b.district &&
      count(i.groupedCount) && count(i.activeCount) && count(i.canceledCount) &&
      Number.isSafeInteger(i.activeCount + i.canceledCount) && i.groupedCount <= i.activeCount + i.canceledCount &&
      (i.groupedCount > 0 || i.activeCount + i.canceledCount === 0)) ||
    new Set(b.identities.map(x => x.id)).size !== b.identities.length) return false;
  if (b.sourceTotalCount === 0) return b.pageRowCounts.length === 1 && b.pageRowCounts[0] === 0 &&
    b.identities.every(x => x.groupedCount === 0);
  // MOLIT requests numOfRows=1000. Missing/midstream short or repeated extra pages cannot attest completion.
  return b.pageRowCounts.every((n, i) => i === b.pageRowCounts.length-1 ? n > 0 : n === 1000) &&
    b.pageRowCounts.reduce((a,x) => a+x,0) === b.sourceTotalCount &&
    b.identities.reduce((a,x) => a+x.activeCount+x.canceledCount,0) <= b.sourceTotalCount;
}
function validGroup(g: AptCanonicalGroup, i: AptIdentity): boolean {
  const day = dealDay(g.dealDate);
  const validDay = day === g.dealDate && !!day && day.slice(0,7).replace('-','') === g.dealYmd;
  if (g.sourceDistrict !== i.district || g.sourceLegalDong !== i.legalDong || g.sourceParcel !== i.parcel ||
      !Array.isArray(g.sourceAptSeqs) || g.sourceAptSeqs.length < 1 ||
      [...g.sourceAptSeqs].some(x => typeof x !== 'string' || !seqPattern.test(x) || !x.startsWith(`${i.district}-`)) ||
      new Set(g.sourceAptSeqs).size !== g.sourceAptSeqs.length ||
      g.dataSource !== 'MOLIT_OPENAPI' || g.source !== 'MOLIT_APT_TRADE' || g.schemaVersion !== 'SOURCE_STATUS_V2' ||
      typeof g.id !== 'string' || !/^[a-zA-Z0-9_.:-]{1,300}$/.test(g.id) ||
      !validDay || !positive(g.price) || !Number.isFinite(g.exclusiveArea) || g.exclusiveArea <= 0 || g.exclusiveArea > 10000 ||
      !Number.isSafeInteger(g.floor) ||
      !count(g.normalRowCount) || !count(g.activeCount) || g.normalRowCount !== g.activeCount ||
      !count(g.cancellationRowCount) || !positive(g.activeCount + g.cancellationRowCount) ||
      g.isCancelled !== (g.activeCount === 0) || !Array.isArray(g.cancelDates) ||
      g.cancelDates.length !== g.cancellationRowCount ||
      [...g.cancelDates].some(x => !cancelDay(x) || cancelDay(x) < day)) return false;
  return true;
}

export function projectAptBudget(input: {
  request: AptBudgetRequest;
  /** Trusted server-internal exact physical crosswalk, never built from caller input. */
  registry: readonly AptBudgetIdentity[];
  receipt: AptCanonicalReceipt;
  query: AptCanonicalGroupQuery;
}): { revision: string; incomplete: boolean; coverage: AptCoverageCell[]; results: AptBudgetProjectionRow[] } {
  const {request, registry, receipt, query} = input;
  const {months, complexIds} = request;
  if (!Array.isArray(months) || months.length < 1 || months.length > 12 ||
      months.some(m => typeof m !== 'string' || !monthPattern.test(m)) || new Set(months).size !== months.length ||
      !Array.isArray(complexIds) || complexIds.length < 1 || complexIds.length > 18 ||
      complexIds.some(id => typeof id !== 'string' || !idPattern.test(id)) || new Set(complexIds).size !== complexIds.length) {
    throw new Error('INVALID_APT_CANONICAL_SCOPE');
  }
  if (receipt.state !== 'READY' || !revisionPattern.test(receipt.revision) ||
      receipt.collection !== `transactions_${receipt.revision}` ||
      query.revision !== receipt.revision || query.collection !== receipt.collection) {
    throw new Error('INVALID_APT_CANONICAL_REVISION');
  }
  if (!Array.isArray(query.groups) || query.groups.length > 50_000 || !Array.isArray(receipt.buckets) ||
      receipt.buckets.length > 5_000 || !Array.isArray(registry) || registry.length > 500) throw new Error('INVALID_APT_CANONICAL_BOUNDS');
  const identities = new Map<string,AptBudgetIdentity>();
  const boundParcels = new Set<string>();
  for (const i of registry) {
    if (!validIdentity(i) || typeof i.name !== 'string' || !i.name.trim() || identities.has(i.id)) {
      throw new Error('INVALID_APT_CANONICAL_REGISTRY');
    }
    const physical = `${i.district}/${i.legalDong}/${i.parcel}`;
    if (boundParcels.has(physical)) throw new Error('INVALID_APT_CANONICAL_REGISTRY');
    identities.set(i.id, i);
    boundParcels.add(physical);
  }
  const scopeIds = new Set(complexIds);
  const scopeMonths = new Set(months);
  const districts = new Set(complexIds.flatMap(id => identities.get(id)?.district ?? []));
  const byBucket = new Map<string,AptCanonicalBucketReceipt>();
  const badBucket = new Set<string>();
  for (const r of receipt.buckets) {
    if (!r || !districts.has(r.district) || !scopeMonths.has(r.month)) continue;
    const key = identKey(r.district,r.month);
    if (byBucket.has(key) || !validPageProof(r)) badBucket.add(key);
    byBucket.set(key,r);
  }
  const inputRows = new Map<string,AptCanonicalGroup[]>();
  const groupIds = new Set<string>();
  const duplicateIds = new Set<string>();
  for (const g of query.groups) {
    if (!g || !scopeIds.has(g.complexId) || !scopeMonths.has(g.dealYmd)) throw new Error('OUT_OF_SCOPE_APT_CANONICAL_GROUP');
    if (groupIds.has(g.id)) duplicateIds.add(g.id);
    groupIds.add(g.id);
    const key = cellKey(g.complexId,g.dealYmd);
    let list = inputRows.get(key);
    if (!list) { list = []; inputRows.set(key,list); }
    list.push(g);
  }
  const coverage: AptCoverageCell[] = [];
  const results: AptBudgetProjectionRow[] = [];
  for (const id of complexIds) {
    const identity = identities.get(id);
    const verified: AptCanonicalGroup[] = [];
    const cells: AptCoverageCell[] = [];
    for (const month of months) {
      let state: AptCoverageState = 'complete';
      let totals: { activeCount: number; canceledCount: number } | undefined;
      const rows = inputRows.get(cellKey(id,month)) ?? [];
      const key = identity ? identKey(identity.district, month) : '';
      const bucket = byBucket.get(key);
      const scoped = !badBucket.has(key) ? bucket?.identities.find(x => x.id === id) : undefined;
      if (!identity) state = 'missing_registry_identity';
      else if (!bucket) state = 'missing_bucket_receipt';
      else if (badBucket.has(key)) state = 'invalid_bucket_receipt';
      else if (!scoped) state = 'missing_identity_receipt';
      else if (!sameIdentity(identity, scoped)) state = 'identity_mismatch';
      else if (rows.some(g => duplicateIds.has(g.id) || !validGroup(g, identity))) state = 'row_identity_or_status_invalid';
      else {
        const activeCount = rows.reduce((n,g) => n+g.activeCount,0);
        const canceledCount = rows.reduce((n,g) => n+g.cancellationRowCount,0);
        if (rows.length !== scoped.groupedCount || activeCount !== scoped.activeCount || canceledCount !== scoped.canceledCount) {
          state = 'row_count_mismatch';
        } else {
          totals = {activeCount, canceledCount};
          verified.push(...rows);
        }
      }
      cells.push({complexId:id, district:identity?.district ?? null, month, state, ...totals});
    }
    coverage.push(...cells);
    if (!identity || cells.some(c => c.state !== 'complete')) continue;
    const areas = new Map<string,AptCanonicalGroup[]>();
    for (const g of verified) if (g.activeCount > 0) {
      const cat = String(Math.floor(g.exclusiveArea));
      const rows = areas.get(cat) ?? [];
      rows.push(g);
      areas.set(cat,rows);
    }
    const local: AptBudgetProjectionRow[] = [];
    for (const [areaCategory, sales] of areas) {
      // Same-day, same-price reports can differ by floor or exact area.
      // Select a real row consistently and keep every report in the price summary.
      sales.sort((a,b) => b.dealDate.localeCompare(a.dealDate) || b.price-a.price ||
        a.exclusiveArea-b.exclusiveArea || a.floor-b.floor || a.id.localeCompare(b.id));
      const latest = sales[0];
      local.push({
        complexId:id, name:identity.name, region:identity.district, neighborhood:identity.legalDong,
        price:latest.price, date:latest.dealDate, floor:latest.floor, area:latest.exclusiveArea, areaCategory,
        tradeSummary:sales.reduce((s,g) => ({
          count:s.count+g.activeCount, min:Math.min(s.min,g.price), max:Math.max(s.max,g.price),
        }),{count:0,min:latest.price,max:latest.price}),
      });
    }
    if (cells.every(c => c.state === 'complete')) results.push(...local.sort((a,b) => Number(a.areaCategory)-Number(b.areaCategory)));
  }
  return {revision:receipt.revision, incomplete:coverage.some(x => x.state !== 'complete'), coverage, results};
}

const saleEndpoint = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev';
export interface AptWriterSnapshot {
  district: string;
  month: string;
  sourceEndpoint?: string;
  rawCount?: number;
  pageCount?: number;
  canonicalCount?: number;
  sha256?: string;
  fetchedAt?: string;
  archiveUri?: string;
  aptBudget?: Omit<AptCanonicalBucketReceipt, 'district' | 'month'>;
}
export interface AptWriterManifest {
  revision: string;
  status: string;
  collections: { transactions?: string };
  snapshots?: readonly AptWriterSnapshot[];
}
const writerArchive = /^gs:\/\/run-sources-gen-lang-client-0064554427-asia-northeast3\/khousing-source\/r\d{14}(?:_[a-f0-9]{8})?\/source\.json\.gz$/;
function normalizeSnapshot(s: AptWriterSnapshot): AptCanonicalBucketReceipt {
  const a = s.aptBudget;
  const result = {district:s.district, month:s.month, sourceTotalCount:a?.sourceTotalCount ?? -1,
    pageRowCounts:a?.pageRowCounts ?? [], identities:a?.identities ?? []};
  if (!a || !validPageProof(result) || s.sourceEndpoint !== saleEndpoint ||
      s.rawCount !== result.sourceTotalCount || s.pageCount !== result.pageRowCounts.length ||
      !count(s.canonicalCount ?? -1) || (s.canonicalCount ?? -1) > result.sourceTotalCount ||
      result.identities.reduce((n,i) => n+i.groupedCount,0) > (s.canonicalCount ?? -1) ||
      !/^[a-f0-9]{64}$/.test(s.sha256 ?? '') ||
      !/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(s.fetchedAt ?? '') ||
      !Number.isFinite(Date.parse(s.fetchedAt ?? '')) || !writerArchive.test(s.archiveUri ?? '')) {
    return {...result,pageRowCounts:[]};
  }
  return result;
}
function snapshotEvidenceKey(s: AptWriterSnapshot, normalized: AptCanonicalBucketReceipt) {
  return JSON.stringify([
    s.rawCount,s.pageCount,s.canonicalCount,s.sourceEndpoint,s.sha256,s.fetchedAt,s.archiveUri,
    normalized.sourceTotalCount,normalized.pageRowCounts,normalized.identities.map(i =>
      [i.id,i.district,i.legalDong,i.parcel,i.groupedCount,i.activeCount,i.canceledCount]).sort((a,b) => String(a[0]).localeCompare(String(b[0]))),
  ]);
}

/**
 * Adapt the exact writer's manifest shape without networking. Call with the READY pointer
 * and immutable document already resolved by the internal adapter, never a guessed collection.
 * Old snapshots without aptBudget deliberately yield missing_bucket_receipt.
 */
export function projectFromAptWriter(input: {
  request: AptBudgetRequest;
  registry: readonly AptBudgetIdentity[];
  active: AptWriterManifest;
  immutable: AptWriterManifest;
  query: AptCanonicalGroupQuery;
}) {
  const {active,immutable,request,registry,query}=input;
  const c=active.collections?.transactions;
  if (active.status !== 'READY' || immutable.status !== 'READY' || !c ||
      immutable.revision !== active.revision || immutable.collections?.transactions !== c ||
      !revisionPattern.test(active.revision) || c !== `transactions_${active.revision}`) {
    throw new Error('INVALID_APT_CANONICAL_REVISION');
  }
  const manifests=[active.snapshots ?? [],immutable.snapshots ?? []];
  if (manifests.some(m=>!Array.isArray(m) || m.length>5_000)) throw new Error('INVALID_APT_CANONICAL_BOUNDS');
  const right = new Map<string,AptWriterSnapshot>();
  const duplicates = new Set<string>();
  for (const s of manifests[1]) {
    if (!s) continue;
    const key=identKey(s.district,s.month);
    if (right.has(key)) duplicates.add(key);
    right.set(key,s);
  }
  const seen = new Set<string>();
  const buckets: AptCanonicalBucketReceipt[] = [];
  for (const s of manifests[0]) {
    if (!s) continue;
    const key=identKey(s.district,s.month);
    // Track even old snapshots, to detect conflicting duplicate receipts.
    const wasSeen=seen.has(key);
    seen.add(key);
    if (!s.aptBudget && !wasSeen) continue;
    const joined=right.get(key);
    const normalized=normalizeSnapshot(s);
    if (wasSeen || duplicates.has(key) || !joined?.aptBudget || normalized.pageRowCounts.length === 0) {
      buckets.push({...normalized,pageRowCounts:[]});
      continue;
    }
    const other=normalizeSnapshot(joined);
    if (other.pageRowCounts.length === 0 || snapshotEvidenceKey(s,normalized) !== snapshotEvidenceKey(joined,other)) {
      buckets.push({...normalized,pageRowCounts:[]});
    } else {
      buckets.push(normalized);
    }
  }
  return projectAptBudget({request,registry,query,receipt:{revision:active.revision,collection:c,state:'READY',buckets}});
}
