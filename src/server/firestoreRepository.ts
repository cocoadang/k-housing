import {
  getActivePriceRevision,
  collection,
  getDocs,
  query,
  where,
} from './firestoreReader';
import { getReaderDb as getFirestoreDb } from './firestoreReader';
import { AREA_FAMILIES_REGISTRY } from '../data/areaFamilies';
import { isPredecessorComplex } from '../data/redevelopmentLineages';
import type {
  ComplexInfo,
  TradeRecord,
  MonthlyAggregate,
  AreaCategory,
  AreaFamilyMetadata,
  AreaFamilyMonthlyPoint,
} from '../types';

// In-Memory Fallback Cache to survive Firestore Quota Exhaustion (RESOURCE_EXHAUSTED)
const memTransactionCache = new Map<string, TradeRecord[]>();
const memMonthlyCache = new Map<string, MonthlyAggregate[]>();
const memComplexCache = new Map<string, ComplexInfo>();
// Phase 5C: Dedicated isolated cache for V2 standard area monthly aggregates
const memStandardAreaV2Cache = new Map<string, MonthlyAggregate[]>();
// Phase 6A: Dedicated isolated cache for V2 AreaFamily metadata and monthly time-series
const memAreaFamilyMetaCache = new Map<string, AreaFamilyMetadata[]>();
const memAreaFamilyMonthlyCache = new Map<string, AreaFamilyMonthlyPoint[]>();

let cachedSourceRevision: string | undefined;
export async function refreshPriceReadCaches() {
  const revision=await getActivePriceRevision();
  if(!revision?.revision || cachedSourceRevision===revision.revision)return;
  for(const cache of [memTransactionCache,memMonthlyCache,memStandardAreaV2Cache,memAreaFamilyMetaCache,memAreaFamilyMonthlyCache])cache.clear();
  cachedSourceRevision=revision.revision;
}

let isFirestoreQuotaExhausted = false;
let quotaExhaustedLoggedAt = 0;

function checkAndHandleQuotaError(err: any): boolean {
  const errMsg = String(err?.message || err || '').toLowerCase();
  const errCode = String(err?.code || '').toLowerCase();
  if (
    errMsg.includes('quota') ||
    errMsg.includes('resource_exhausted') ||
    errMsg.includes('resource-exhausted') ||
    errCode.includes('resource-exhausted')
  ) {
    isFirestoreQuotaExhausted = true;
    const now = Date.now();
    if (now - quotaExhaustedLoggedAt > 60000) {
      console.warn(
        '[Firestore] Daily free quota exceeded. Falling back to in-memory cache and direct MOLIT calculations seamlessly.'
      );
      quotaExhaustedLoggedAt = now;
    }
    return true;
  }
  return false;
}

/**
 * Deterministic Transaction ID generator to guarantee idempotency and prevent duplicate records.
 */
export function generateDeterministicTransactionId(
  complexId: string,
  r: {
    dealYmd: string;
    dealDay: number;
    floor: number;
    price: number;
    exclusiveArea: number;
  }
): string {
  const areaInt = Math.round(r.exclusiveArea * 100);
  const cleanComplexId = complexId.replace(/[^a-zA-Z0-9_]/g, '');
  return `${cleanComplexId}_${r.dealYmd}_d${r.dealDay}_f${r.floor}_p${r.price}_a${areaInt}`;
}

/**
 * Consolidate and deduplicate raw TradeRecords by deterministic transaction ID.
 * Preserves multiplicity for identical valid transactions and accurately computes activeCount,
 * normalRowCount, cancellationRowCount, and cancellation metadata.
 */
export function consolidateTradeRecords(records: TradeRecord[], complexId: string): TradeRecord[] {
  const map = new Map<
    string,
    {
      baseRecord: TradeRecord;
      normalRowCount: number;
      cancellationRowCount: number;
      cancelDates: string[];
      registrationDates: string[];
      dealTypes: string[];
    }
  >();

  for (const r of records) {
    const id = generateDeterministicTransactionId(complexId, {
      dealYmd: r.dealYmd,
      dealDay: r.dealDay,
      floor: r.floor,
      price: r.price,
      exclusiveArea: r.exclusiveArea,
    });

    const isCancel = Boolean(r.isCancelled);
    const existing = map.get(id);

    if (!existing) {
      const cancelDates: string[] = [];
      if (isCancel && r.cancelDate && r.cancelDate.trim().length > 0) {
        cancelDates.push(r.cancelDate.trim());
      }
      const registrationDates: string[] = [];
      if (r.registrationDate && r.registrationDate.trim().length > 0) {
        registrationDates.push(r.registrationDate.trim());
      }
      const dealTypes: string[] = [];
      if (r.dealType && r.dealType.trim().length > 0) {
        dealTypes.push(r.dealType.trim());
      }

      map.set(id, {
        baseRecord: { ...r, id },
        normalRowCount: isCancel ? 0 : 1,
        cancellationRowCount: isCancel ? 1 : 0,
        cancelDates,
        registrationDates,
        dealTypes,
      });
    } else {
      if (isCancel) {
        existing.cancellationRowCount += 1;
        if (r.cancelDate && r.cancelDate.trim().length > 0) {
          if (!existing.cancelDates.includes(r.cancelDate.trim())) {
            existing.cancelDates.push(r.cancelDate.trim());
          }
        }
      } else {
        existing.normalRowCount += 1;
      }

      if (r.registrationDate && r.registrationDate.trim().length > 0) {
        if (!existing.registrationDates.includes(r.registrationDate.trim())) {
          existing.registrationDates.push(r.registrationDate.trim());
        }
      }
      if (r.dealType && r.dealType.trim().length > 0) {
        if (!existing.dealTypes.includes(r.dealType.trim())) {
          existing.dealTypes.push(r.dealType.trim());
        }
      }
    }
  }

  const result: TradeRecord[] = [];
  for (const [id, entry] of map.entries()) {
    const normalCount = entry.normalRowCount;
    const cancelCount = entry.cancellationRowCount;
    const activeCount = Math.max(0, normalCount - cancelCount);
    const isCancelled = activeCount === 0;

    const latestCancelDate =
      entry.cancelDates.length > 0 ? entry.cancelDates[entry.cancelDates.length - 1] : undefined;
    const latestRegDate =
      entry.registrationDates.length > 0
        ? entry.registrationDates[entry.registrationDates.length - 1]
        : undefined;
    const latestDealType = entry.dealTypes.length > 0 ? entry.dealTypes[0] : undefined;

    result.push({
      ...entry.baseRecord,
      id,
      normalRowCount: normalCount,
      cancellationRowCount: cancelCount,
      activeCount,
      isCancelled,
      cancelDate: latestCancelDate,
      cancelDates: entry.cancelDates,
      registrationDate: latestRegDate || entry.baseRecord.registrationDate,
      dealType: latestDealType || entry.baseRecord.dealType,
    });
  }

  result.sort((a, b) => a.dealDate.localeCompare(b.dealDate));
  return result;
}

export const firestoreRepository = {
  /**
   * Save complex metadata to 'complexes/{complexId}' and in-memory cache
   */
  async saveComplexMetadata(complex: ComplexInfo): Promise<boolean> {
    // Query service is read-only. Ingestion uses a separate IAM identity.
    throw new Error('READ_ONLY_REPOSITORY');
  },

  /**
   * Save batch of TradeRecords into 'transactions/{transactionId}' and memory
   */
  async saveTransactions(records: TradeRecord[], complexId: string): Promise<number> {
    // Query service is read-only. Ingestion uses a separate IAM identity.
    throw new Error('READ_ONLY_REPOSITORY');
  },

  /**
   * Get transactions for a complex and date range from memory or Firestore
   */
  async getTransactions(
    complexId: string,
    startYmd?: string,
    endYmd?: string,
    areaCategory?: AreaCategory | '114_PLUS' | 'ALL' | 'OTHER'
  ): Promise<TradeRecord[]> {
    // 1. If in memory, filter and return
    const memList = memTransactionCache.get(complexId);
    if (memList && memList.length > 0) {
      return memList.filter((d) => {
        if (areaCategory && areaCategory !== 'ALL' && d.areaCategory !== areaCategory) return false;
        if (startYmd && d.dealYmd < startYmd) return false;
        if (endYmd && d.dealYmd > endYmd) return false;
        return true;
      });
    }

    if (isFirestoreQuotaExhausted) return [];
    const db = getFirestoreDb();
    if (!db) return [];

    try {
      const collRef = collection(db, 'transactions');
      const q = query(collRef, where('complexId', '==', complexId));

      const snapshot = await getDocs(q);
      if (snapshot.empty) return [];

      const results: TradeRecord[] = [];
      const allForMem: TradeRecord[] = [];

      snapshot.forEach((docSnap) => {
        const d = docSnap.data();

        const normalRowCount =
          d.normalRowCount !== undefined ? Number(d.normalRowCount) : d.isCancelled ? 0 : 1;
        const cancellationRowCount =
          d.cancellationRowCount !== undefined ? Number(d.cancellationRowCount) : d.isCancelled ? 1 : 0;
        const activeCount =
          d.activeCount !== undefined
            ? Number(d.activeCount)
            : Math.max(0, normalRowCount - cancellationRowCount);
        const isCancelled = Boolean(d.isCancelled) || activeCount === 0;

        const record: TradeRecord = {
          id: d.transactionId || docSnap.id,
          complexId: d.complexId,
          complexName: d.complexName,
          dealYear: Number(d.dealYear),
          dealMonth: Number(d.dealMonth),
          dealDay: Number(d.dealDay),
          dealDate: d.dealDate,
          dealYmd: d.dealYmd,
          price: Number(d.price),
          exclusiveArea: Number(d.exclusiveArea),
          areaCategory: d.areaCategory,
          areaFamilyId: d.areaFamilyId,
          standardAreaCategory: d.standardAreaCategory,
          canonicalStatus: d.canonicalStatus,
          pyeong: Number(d.pyeong),
          pricePerPyeong: Number(d.pricePerPyeong),
          pricePerSqm: Number(d.pricePerSqm),
          floor: Number(d.floor),
          normalRowCount,
          cancellationRowCount,
          activeCount,
          isCancelled,
          cancelDate: d.cancelDate || ' ',
          cancelDates: Array.isArray(d.cancelDates) ? d.cancelDates : [],
          registrationDate: d.registrationDate || '',
          dealType: d.dealType && String(d.dealType).trim().length > 0 ? String(d.dealType).trim() : '확인불가',
          isOutlier: Boolean(d.isOutlier),
          dataSource: 'MOLIT_OPENAPI',
        };

        allForMem.push(record);

        if (areaCategory && areaCategory !== 'ALL' && d.areaCategory !== areaCategory) {
          return;
        }
        if (startYmd && d.dealYmd < startYmd) {
          return;
        }
        if (endYmd && d.dealYmd > endYmd) {
          return;
        }

        results.push(record);
      });

      // Cache full set in memory
      if (allForMem.length > 0) {
        allForMem.sort((a, b) => a.dealDate.localeCompare(b.dealDate));
        memTransactionCache.set(complexId, allForMem);
      }

      results.sort((a, b) => a.dealDate.localeCompare(b.dealDate));
      return results;
    } catch (err: any) {
      if (!checkAndHandleQuotaError(err)) {
        console.warn(`[Firestore] Failed to read transactions for ${complexId}:`, err?.message || err);
      }
      return [];
    }
  },

  /**
   * Get all-time high canonical individual trade for an AreaFamily
   * (취소/해제 제외, canonical price > 0 최고가)
   */
  async getAthTrade(complexId: string, areaFamilyId: string): Promise<TradeRecord | null> {
    const allTrades = await this.getTransactions(complexId);
    const familyTrades = allTrades.filter(
      (t) => t.areaFamilyId === areaFamilyId && t.price > 0 && !t.isCancelled
    );
    if (familyTrades.length === 0) return null;

    return familyTrades.reduce((highest, current) => {
      if (current.price > highest.price) {
        return current;
      }
      if (current.price === highest.price) {
        const dateCmp = (current.dealDate || '').localeCompare(highest.dealDate || '');
        if (dateCmp !== 0) {
          return dateCmp > 0 ? current : highest;
        }
        return (current.id || '').localeCompare(highest.id || '') > 0 ? current : highest;
      }
      return highest;
    }, familyTrades[0]);
  },

  /**
   * Save monthly price aggregates
   */
  async saveMonthlyPrices(
    complexId: string,
    monthlyAggs: MonthlyAggregate[],
    areaCategory: AreaCategory | '114_PLUS' | 'ALL' | 'OTHER'
  ): Promise<number> {
    // Query service is read-only. Ingestion uses a separate IAM identity.
    throw new Error('READ_ONLY_REPOSITORY');
  },

  /**
   * Get monthly price aggregates from memory or 'monthlyComplexPrices'
   */
  async getMonthlyPrices(
    complexId: string,
    areaCategory: AreaCategory | '114_PLUS' | 'ALL' | 'OTHER',
    startYmd?: string,
    endYmd?: string
  ): Promise<MonthlyAggregate[]> {
    const key = `${complexId}_${areaCategory}`;
    const memList = memMonthlyCache.get(key);
    if (memList && memList.length > 0) {
      return memList.filter((d) => {
        if (startYmd && d.dealYmd < startYmd) return false;
        if (endYmd && d.dealYmd > endYmd) return false;
        return true;
      });
    }

    if (isFirestoreQuotaExhausted) return [];
    const db = getFirestoreDb();
    if (!db) return [];

    try {
      const collRef = collection(db, 'monthlyComplexPrices');
      const q = query(
        collRef,
        where('complexId', '==', complexId),
        where('areaCategory', '==', areaCategory)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) return [];

      const results: MonthlyAggregate[] = [];
      const allForMem: MonthlyAggregate[] = [];

      snapshot.forEach((docSnap) => {
        const d = docSnap.data();

        const conf =
          d.confidence ||
          (d.transactionCount >= 10
            ? 'HIGH'
            : d.transactionCount >= 3
            ? 'MEDIUM'
            : d.transactionCount >= 1
            ? 'LOW'
            : 'NO_DATA');
        const confLabel =
          conf === 'HIGH' ? '충분' : conf === 'MEDIUM' ? '보통' : conf === 'LOW' ? '낮음' : '거래 없음';

        const item: MonthlyAggregate = {
          dealYmd: d.dealYmd,
          year: Number(d.year),
          month: Number(d.month),
          displayDate: d.displayDate || `${d.year}.${String(d.month).padStart(2, '0')}`,
          transactionCount: Number(d.transactionCount),
          tradeCount: Number(d.transactionCount),
          volume: Number(d.transactionCount),
          medianPrice: Number(d.medianPrice),
          averagePrice: Number(d.averagePrice),
          avgPrice: Number(d.averagePrice),
          minPrice: Number(d.minPrice),
          maxPrice: Number(d.maxPrice),
          medianPricePerPyeong: Number(
            d.medianPricePerPyeong || Math.round(d.medianPrice / ((59 / 3.305785) * 1.3))
          ),
          medianPricePerSqm: Number(d.medianPricePerSqm),
          averagePricePerSqm: Number(d.averagePricePerSqm),
          confidence: conf,
          reliability: conf,
          confidenceLabel: confLabel,
          hasData: Number(d.transactionCount) > 0,
        };

        allForMem.push(item);

        if (startYmd && d.dealYmd < startYmd) return;
        if (endYmd && d.dealYmd > endYmd) return;

        results.push(item);
      });

      if (allForMem.length > 0) {
        allForMem.sort((a, b) => a.dealYmd.localeCompare(b.dealYmd));
        memMonthlyCache.set(key, allForMem);
      }

      results.sort((a, b) => a.dealYmd.localeCompare(b.dealYmd));
      return results;
    } catch (err: any) {
      if (!checkAndHandleQuotaError(err)) {
        console.warn(`[Firestore] Failed to read monthly prices for ${complexId}:`, err?.message || err);
      }
      return [];
    }
  },

  /**
   * Phase 5C: Read standard area monthly price aggregates from 'monthlyStandardAreaPrices_v2'
   * Strictly reads monthlyStandardAreaPrices_v2 with NO fallback to legacy monthly, transactions, or MOLIT.
   * Only supports standardAreaCategory '59' and '84'.
   */
  async getStandardAreaMonthlyPrices(
    complexId: string,
    standardAreaCategory: '59' | '84',
    startYmd?: string,
    endYmd?: string
  ): Promise<MonthlyAggregate[]> {
    if (standardAreaCategory !== '59' && standardAreaCategory !== '84') {
      throw new Error(`[V2 Reader] Invalid standardAreaCategory: "${standardAreaCategory}". Only '59' and '84' are supported.`);
    }

    const cacheKey = `v2_std_${complexId}_${standardAreaCategory}`;
    const cached = memStandardAreaV2Cache.get(cacheKey);
    if (cached && cached.length > 0) {
      return cached.filter((d) => {
        if (startYmd && d.dealYmd < startYmd) return false;
        if (endYmd && d.dealYmd > endYmd) return false;
        return true;
      });
    }

    const db = getFirestoreDb();
    if (!db) {
      throw new Error('[V2 Reader] Firestore DB client unavailable');
    }

    const collRef = collection(db, 'monthlyStandardAreaPrices_v2');
    const q = query(
      collRef,
      where('complexId', '==', complexId),
      where('standardAreaCategory', '==', standardAreaCategory)
    );

    const snapshot = await getDocs(q);
    const allForMem: MonthlyAggregate[] = [];
    const results: MonthlyAggregate[] = [];

    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      const item: MonthlyAggregate = {
        dealYmd: d.dealYmd,
        year: Number(d.year),
        month: Number(d.month),
        displayDate: d.displayDate || `${d.year}.${String(d.month).padStart(2, '0')}`,
        transactionCount: Number(d.tradeCount ?? d.activeCount ?? 0),
        tradeCount: Number(d.tradeCount ?? d.activeCount ?? 0),
        volume: Number(d.tradeCount ?? d.activeCount ?? 0),
        medianPrice: Number(d.medianPrice),
        averagePrice: Number(d.averagePrice),
        avgPrice: Number(d.averagePrice),
        minPrice: Number(d.minPrice),
        maxPrice: Number(d.maxPrice),
        medianPricePerPyeong: Number(d.medianPricePerPyeong || 0),
        medianPricePerSqm: Number(d.medianPricePerSqm || 0),
        averagePricePerSqm: Number(d.averagePricePerSqm || 0),
        confidence: d.reliability || 'LOW',
        reliability: d.reliability || 'LOW',
        confidenceLabel: d.confidenceLabel || '낮음',
        hasData: Number(d.tradeCount ?? d.activeCount ?? 0) > 0,
      };

      allForMem.push(item);
      if (startYmd && d.dealYmd < startYmd) return;
      if (endYmd && d.dealYmd > endYmd) return;
      results.push(item);
    });

    if (allForMem.length > 0) {
      allForMem.sort((a, b) => a.dealYmd.localeCompare(b.dealYmd));
      memStandardAreaV2Cache.set(cacheKey, allForMem);
    }

    results.sort((a, b) => a.dealYmd.localeCompare(b.dealYmd));
    return results;
  },

  /**
   * Phase 5C: Bulk read standard area monthly aggregates for all complexes in a single query
   * Drastically reduces query count from 31 to 1 for Map Explorer.
   * Strictly reads monthlyStandardAreaPrices_v2 with NO fallback.
   */
  async getAllStandardAreaMonthlyPrices(
    standardAreaCategory: '59' | '84',
    startYmd?: string,
    endYmd?: string
  ): Promise<Record<string, MonthlyAggregate[]>> {
    if (standardAreaCategory !== '59' && standardAreaCategory !== '84') {
      throw new Error(`[V2 Reader] Invalid standardAreaCategory: "${standardAreaCategory}". Only '59' and '84' are supported.`);
    }

    const db = getFirestoreDb();
    if (!db) {
      throw new Error('[V2 Reader] Firestore DB client unavailable');
    }

    const collRef = collection(db, 'monthlyStandardAreaPrices_v2');
    const q = query(
      collRef,
      where('standardAreaCategory', '==', standardAreaCategory)
    );

    const snapshot = await getDocs(q);
    const byComplexAll: Record<string, MonthlyAggregate[]> = {};

    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      const cId = d.complexId;
      if (!cId) return;

      const item: MonthlyAggregate = {
        dealYmd: d.dealYmd,
        year: Number(d.year),
        month: Number(d.month),
        displayDate: d.displayDate || `${d.year}.${String(d.month).padStart(2, '0')}`,
        transactionCount: Number(d.tradeCount ?? d.activeCount ?? 0),
        tradeCount: Number(d.tradeCount ?? d.activeCount ?? 0),
        volume: Number(d.tradeCount ?? d.activeCount ?? 0),
        medianPrice: Number(d.medianPrice),
        averagePrice: Number(d.averagePrice),
        avgPrice: Number(d.averagePrice),
        minPrice: Number(d.minPrice),
        maxPrice: Number(d.maxPrice),
        medianPricePerPyeong: Number(d.medianPricePerPyeong || 0),
        medianPricePerSqm: Number(d.medianPricePerSqm || 0),
        averagePricePerSqm: Number(d.averagePricePerSqm || 0),
        confidence: d.reliability || 'LOW',
        reliability: d.reliability || 'LOW',
        confidenceLabel: d.confidenceLabel || '낮음',
        hasData: Number(d.tradeCount ?? d.activeCount ?? 0) > 0,
      };

      if (!byComplexAll[cId]) {
        byComplexAll[cId] = [];
      }
      byComplexAll[cId].push(item);
    });

    // Populate individual cache and filter results by date range
    const results: Record<string, MonthlyAggregate[]> = {};
    for (const [cId, list] of Object.entries(byComplexAll)) {
      list.sort((a, b) => a.dealYmd.localeCompare(b.dealYmd));
      memStandardAreaV2Cache.set(`v2_std_${cId}_${standardAreaCategory}`, list);

      results[cId] = list.filter((d) => {
        if (startYmd && d.dealYmd < startYmd) return false;
        if (endYmd && d.dealYmd > endYmd) return false;
        return true;
      });
    }

    return results;
  },

  /**
   * Phase 6A: Get verified AreaFamily metadata list for a specific complex.
   * SSOT: AREA_FAMILIES_REGISTRY combined with availability stats from monthlyComplexPrices_v2.
   * Deterministic Sort: representativeExclusiveArea ASC, then areaFamilyId ASC.
   * Performance: Queries only documents for the target complexId (1 query, ~100-600 docs max, never full scan).
   */
  async getAreaFamilyMetadata(complexId: string): Promise<AreaFamilyMetadata[]> {
    const registryFamilies = AREA_FAMILIES_REGISTRY[complexId];
    if (!registryFamilies || registryFamilies.length === 0) {
      const err: any = new Error(`[V2 Area Metadata] Invalid complexId: "${complexId}". Complex not found in registry.`);
      err.code = 'INVALID_COMPLEX_ID';
      throw err;
    }

    const cacheKey = `v2_area_family_meta_${complexId}`;
    const cached = memAreaFamilyMetaCache.get(cacheKey);
    if (cached && cached.length > 0) {
      return [...cached];
    }

    const db = getFirestoreDb();
    if (!db) {
      const err: any = new Error('[V2 Area Metadata] Firestore DB client unavailable');
      err.code = 'V2_AREA_MONTHLY_READ_FAILED';
      throw err;
    }

    // Query monthlyComplexPrices_v2 for only this complexId
    const collRef = collection(db, 'monthlyComplexPrices_v2');
    const q = query(collRef, where('complexId', '==', complexId));
    let snapshot;
    try {
      snapshot = await getDocs(q);
    } catch (err: any) {
      const wrapped: any = new Error(`[V2 Area Metadata] Failed to read monthlyComplexPrices_v2: ${err?.message || err}`);
      wrapped.code = 'V2_AREA_MONTHLY_READ_FAILED';
      throw wrapped;
    }

    // Aggregate stats per areaFamilyId
    const statsMap = new Map<
      string,
      {
        monthlyPointCount: number;
        tradeCount: number;
        firstDealYmd: string;
        lastDealYmd: string;
      }
    >();

    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      const fId = d.areaFamilyId;
      if (!fId) return;

      const tc = Number(d.tradeCount ?? d.activeCount ?? 0);
      const dealYmd = String(d.dealYmd || '');

      const existing = statsMap.get(fId);
      if (!existing) {
        statsMap.set(fId, {
          monthlyPointCount: 1,
          tradeCount: tc,
          firstDealYmd: dealYmd,
          lastDealYmd: dealYmd,
        });
      } else {
        existing.monthlyPointCount += 1;
        existing.tradeCount += tc;
        if (dealYmd && (!existing.firstDealYmd || dealYmd < existing.firstDealYmd)) {
          existing.firstDealYmd = dealYmd;
        }
        if (dealYmd && (!existing.lastDealYmd || dealYmd > existing.lastDealYmd)) {
          existing.lastDealYmd = dealYmd;
        }
      }
    });

    const results: AreaFamilyMetadata[] = registryFamilies.map((f) => {
      const stats = statsMap.get(f.id);
      const hasMonthlyData = Boolean(stats && stats.monthlyPointCount > 0);

      return {
        areaFamilyId: f.id,
        complexId: f.complexId || complexId,
        label: f.label,
        shortLabel: f.shortLabel,
        representativeExclusiveArea: f.representativeExclusiveArea,
        representativeSupplyArea: f.representativeSupplyArea ?? null,
        exactAreas: f.exactAreas,
        minExclusiveArea: f.minExclusiveArea,
        maxExclusiveArea: f.maxExclusiveArea,
        standardAreaCategory: f.standardCategory,
        exclusiveAreaPyeong: f.exclusiveAreaPyeong,
        legacyPyeongLabel: f.legacyPyeongLabel,
        hasMonthlyData,
        firstDealYmd: hasMonthlyData && stats ? stats.firstDealYmd : null,
        lastDealYmd: hasMonthlyData && stats ? stats.lastDealYmd : null,
        monthlyPointCount: hasMonthlyData && stats ? stats.monthlyPointCount : 0,
        tradeCount: hasMonthlyData && stats ? stats.tradeCount : 0,
        isPredecessorFamily: Boolean(f.isPredecessorFamily || isPredecessorComplex(complexId)),
      };
    });

    // Deterministic Sort: representativeExclusiveArea ASC, then areaFamilyId ASC
    results.sort((a, b) => {
      if (a.representativeExclusiveArea !== b.representativeExclusiveArea) {
        return a.representativeExclusiveArea - b.representativeExclusiveArea;
      }
      return a.areaFamilyId.localeCompare(b.areaFamilyId);
    });

    memAreaFamilyMetaCache.set(cacheKey, results);
    return [...results];
  },

  /**
   * Phase 6A: Get sparse monthly price time series for a specific AreaFamily.
   * SSOT: monthlyComplexPrices_v2 ONLY.
   * Strict Constraints:
   * - No fallback to legacy monthlyComplexPrices or monthlyStandardAreaPrices_v2
   * - No fallback to raw transaction aggregations or MOLIT API
   * - Sparse series only: No zero-filling, no interpolation, no carry-forward
   * - Valid family with 0 active monthly records (e.g. namcheon_xi_142) returns points: [] cleanly.
   */
  async getAreaFamilyMonthlyPrices(
    complexId: string,
    areaFamilyId: string,
    startYmd?: string,
    endYmd?: string
  ): Promise<{ metadata: AreaFamilyMetadata; points: AreaFamilyMonthlyPoint[] }> {
    // 1. Date format & range validations
    const ymdRegex = /^\d{4}(0[1-9]|1[0-2])$/;
    if (startYmd && !ymdRegex.test(startYmd)) {
      const err: any = new Error(`[V2 Reader] Invalid startYmd: "${startYmd}". Must be YYYYMM format with valid month (01-12).`);
      err.code = 'INVALID_YMD';
      throw err;
    }
    if (endYmd && !ymdRegex.test(endYmd)) {
      const err: any = new Error(`[V2 Reader] Invalid endYmd: "${endYmd}". Must be YYYYMM format with valid month (01-12).`);
      err.code = 'INVALID_YMD';
      throw err;
    }
    if (startYmd && endYmd && startYmd > endYmd) {
      const err: any = new Error(`[V2 Reader] Invalid date range: startYmd "${startYmd}" > endYmd "${endYmd}".`);
      err.code = 'INVALID_DATE_RANGE';
      throw err;
    }

    // 2. Validate complex in registry
    const registryFamilies = AREA_FAMILIES_REGISTRY[complexId];
    if (!registryFamilies || registryFamilies.length === 0) {
      const err: any = new Error(`[V2 Reader] Invalid complexId: "${complexId}". Complex not found in registry.`);
      err.code = 'INVALID_COMPLEX_ID';
      throw err;
    }

    // 3. Validate areaFamilyId in complex registry
    const targetRegFamily = registryFamilies.find((f) => f.id === areaFamilyId);
    if (!targetRegFamily) {
      const err: any = new Error(`[V2 Reader] AreaFamily "${areaFamilyId}" not found in complex "${complexId}".`);
      err.code = 'AREA_FAMILY_NOT_FOUND';
      throw err;
    }

    // 4. Retrieve metadata for this family
    const allMeta = await this.getAreaFamilyMetadata(complexId);
    const metadata = allMeta.find((m) => m.areaFamilyId === areaFamilyId) || {
      areaFamilyId: targetRegFamily.id,
      complexId,
      label: targetRegFamily.label,
      shortLabel: targetRegFamily.shortLabel,
      representativeExclusiveArea: targetRegFamily.representativeExclusiveArea,
      representativeSupplyArea: targetRegFamily.representativeSupplyArea ?? null,
      exactAreas: targetRegFamily.exactAreas,
      minExclusiveArea: targetRegFamily.minExclusiveArea,
      maxExclusiveArea: targetRegFamily.maxExclusiveArea,
      standardAreaCategory: targetRegFamily.standardCategory,
      exclusiveAreaPyeong: targetRegFamily.exclusiveAreaPyeong,
      legacyPyeongLabel: targetRegFamily.legacyPyeongLabel,
      hasMonthlyData: false,
      firstDealYmd: null,
      lastDealYmd: null,
      monthlyPointCount: 0,
      tradeCount: 0,
      isPredecessorFamily: Boolean(targetRegFamily.isPredecessorFamily || isPredecessorComplex(complexId)),
    };

    // 5. If known family has no active monthly data (e.g. namcheon_xi_142), return empty points cleanly
    if (!metadata.hasMonthlyData) {
      return { metadata, points: [] };
    }

    // 6. Check in-memory monthly cache
    const cacheKey = `v2_area_family_monthly_${complexId}_${areaFamilyId}`;
    const cached = memAreaFamilyMonthlyCache.get(cacheKey);
    let allPoints: AreaFamilyMonthlyPoint[] = [];

    if (cached && cached.length > 0) {
      allPoints = cached;
    } else {
      const db = getFirestoreDb();
      if (!db) {
        const err: any = new Error('[V2 Reader] Firestore DB client unavailable');
        err.code = 'V2_AREA_MONTHLY_READ_FAILED';
        throw err;
      }

      const collRef = collection(db, 'monthlyComplexPrices_v2');
      const q = query(
        collRef,
        where('complexId', '==', complexId),
        where('areaFamilyId', '==', areaFamilyId)
      );

      let snapshot;
      try {
        snapshot = await getDocs(q);
      } catch (err: any) {
        const wrapped: any = new Error(`[V2 Reader] Failed to read monthlyComplexPrices_v2: ${err?.message || err}`);
        wrapped.code = 'V2_AREA_MONTHLY_READ_FAILED';
        throw wrapped;
      }

      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const item: AreaFamilyMonthlyPoint = {
          dealYmd: d.dealYmd,
          year: Number(d.year),
          month: Number(d.month),
          displayDate: d.displayDate || `${d.year}.${String(d.month).padStart(2, '0')}`,
          tradeCount: Number(d.tradeCount ?? d.activeCount ?? 0),
          activeCount: Number(d.activeCount ?? d.tradeCount ?? 0),
          sourceCanonicalGroupCount: Number(d.sourceCanonicalGroupCount ?? 1),
          medianPrice: Number(d.medianPrice),
          averagePrice: Number(d.averagePrice),
          minPrice: Number(d.minPrice),
          maxPrice: Number(d.maxPrice),
          medianPricePerSqm: Number(d.medianPricePerSqm || 0),
          averagePricePerSqm: Number(d.averagePricePerSqm || 0),
          medianPricePerPyeong: Number(d.medianPricePerPyeong || 0),
          firstDealDate: d.firstDealDate,
          lastDealDate: d.lastDealDate,
          reliability: d.reliability || 'LOW',
          confidenceLabel: d.confidenceLabel || '낮음',
        };
        allPoints.push(item);
      });

      // Sort chronologically dealYmd ASC
      allPoints.sort((a, b) => a.dealYmd.localeCompare(b.dealYmd));
      memAreaFamilyMonthlyCache.set(cacheKey, allPoints);
    }

    // Filter points by requested date range (Sparse: NEVER zero fill or interpolate)
    const filtered = allPoints.filter((p) => {
      if (startYmd && p.dealYmd < startYmd) return false;
      if (endYmd && p.dealYmd > endYmd) return false;
      return true;
    });

    return { metadata, points: filtered };
  },

  /**
   * Update internal settings metadata in 'settings/dataCollection'
   */
  async recordCollectionStatus(status: {
    complexId: string;
    lawdCd: string;
    startYmd: string;
    endYmd: string;
    itemCount: number;
    success: boolean;
  }): Promise<void> {
    // Query service is read-only. Ingestion uses a separate IAM identity.
    throw new Error('READ_ONLY_REPOSITORY');
  },
};

