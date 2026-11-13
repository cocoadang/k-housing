/**
 * Phase 8C-2: Redevelopment Price Service
 * 
 * CORE PRINCIPLE:
 * Real Price Input Integration from canonical V2 SSOT: monthlyComplexPrices_v2.
 * 
 * Strict Constraints:
 * 1. Price SSOT: monthlyComplexPrices_v2 ONLY.
 * 2. NO raw transaction reaggregation, NO legacy monthlyComplexPrices fallback.
 * 3. Default selection policy: EXACT_MONTH.
 * 4. In EXACT_MONTH, if no trade: observation = null, availability = DATA_NOT_AVAILABLE.
 *    NO carry-forward, NO next-value, NO interpolation, NO zero-fill.
 * 5. Non-exact policies (LATEST_OBSERVED_ON_OR_BEFORE, EARLIEST_OBSERVED_ON_OR_AFTER)
 *    strictly record requestedMonth, actualObservationMonth, selectionPolicy, monthDistance.
 * 6. Price metrics: MEDIAN_PRICE (default) or AVERAGE_PRICE. Total asset values in 만원 (KRW_MANWON).
 * 7. Price provenance preserves document ID, collection, complexId, areaFamilyId, dealYmd, priceMetric, tradeCount.
 */

import { AREA_FAMILIES_REGISTRY } from '../data/areaFamilies';
import { firestoreRepository } from '../server/firestoreRepository';
import type { AreaFamilyMetadata, AreaFamilyMonthlyPoint } from '../types';
import type {
  PriceSelectionPolicy,
  PriceMetricType,
  PriceObservation,
  PriceResolutionResult,
  PriceProvenance,
  CalculationAvailability,
} from '../types/redevelopmentAnalysis';

export interface PriceResolutionOptions {
  complexId: string;
  areaFamilyId: string;
  requestedMonth: string; // YYYYMM or YYYY-MM
  selectionPolicy?: PriceSelectionPolicy; // default: EXACT_MONTH
  priceMetric?: PriceMetricType; // default: MEDIAN_PRICE
}

export interface FamilyPriceAvailabilityStats {
  complexId: string;
  areaFamilyId: string;
  label: string;
  shortLabel: string;
  hasPriceData: boolean;
  monthlyPointCount: number;
  tradeCount: number;
  firstDealYmd: string | null;
  lastDealYmd: string | null;
}

export interface PriceAvailabilityAuditResult {
  complexesAudited: string[];
  totalFamilies: number;
  familiesWithPriceData: number;
  familiesWithoutPriceData: number;
  families: FamilyPriceAvailabilityStats[];
}

/**
 * Calculates month distance between two YYYYMM strings.
 */
export function calculateMonthDifference(fromYmd: string, toYmd: string): number {
  const y1 = parseInt(fromYmd.substring(0, 4), 10);
  const m1 = parseInt(fromYmd.substring(4, 6), 10);
  const y2 = parseInt(toYmd.substring(0, 4), 10);
  const m2 = parseInt(toYmd.substring(4, 6), 10);
  return Math.abs((y2 - y1) * 12 + (m2 - m1));
}

/**
 * Normalizes YYYY-MM or YYYYMM to canonical YYYYMM.
 */
export function normalizeYmdMonth(input: string): string {
  if (!input) return '';
  const clean = input.replace(/[^0-9]/g, '');
  return clean.substring(0, 6);
}

export class RedevelopmentPriceService {
  /**
   * Resolves a price observation from monthlyComplexPrices_v2 for a specific AreaFamily and month.
   */
  public async resolvePrice(options: PriceResolutionOptions): Promise<PriceResolutionResult> {
    const { complexId, areaFamilyId, requestedMonth } = options;
    const policy: PriceSelectionPolicy = options.selectionPolicy || 'EXACT_MONTH';
    const metric: PriceMetricType = options.priceMetric || 'MEDIAN_PRICE';

    const normalizedMonth = normalizeYmdMonth(requestedMonth);
    const ymdRegex = /^\d{4}(0[1-9]|1[0-2])$/;

    // 1. Validate requested month format
    if (!ymdRegex.test(normalizedMonth)) {
      return {
        availability: 'INVALID_INPUT',
        observation: null,
        warnings: [`Invalid requestedMonth: "${requestedMonth}". Must be YYYYMM format.`],
        missingRequirements: [`유효하지 않은 요청 월 형식: "${requestedMonth}"`],
      };
    }

    // 2. Validate complex in AREA_FAMILIES_REGISTRY
    const registryFamilies = AREA_FAMILIES_REGISTRY[complexId];
    if (!registryFamilies || registryFamilies.length === 0) {
      return {
        availability: 'INVALID_INPUT',
        observation: null,
        warnings: [`Invalid complexId: "${complexId}". Complex not found in AREA_FAMILIES_REGISTRY.`],
        missingRequirements: [`등록되지 않은 단지 ID: "${complexId}"`],
      };
    }

    // 3. Validate areaFamilyId for this complex
    const regFamily = registryFamilies.find((f) => f.id === areaFamilyId);
    if (!regFamily) {
      return {
        availability: 'INVALID_INPUT',
        observation: null,
        warnings: [`AreaFamily "${areaFamilyId}" not found in complex "${complexId}".`],
        missingRequirements: [`단지 내 존재하지 않는 평형군 ID: "${areaFamilyId}"`],
      };
    }

    // 4. Retrieve points from monthlyComplexPrices_v2 via repository
    let points: AreaFamilyMonthlyPoint[] = [];
    let metadata: AreaFamilyMetadata | undefined;

    try {
      const resp = await firestoreRepository.getAreaFamilyMonthlyPrices(complexId, areaFamilyId);
      points = resp.points || [];
      metadata = resp.metadata;
    } catch (err: any) {
      const wrapped: any = new Error(`[V2 Price Resolver] Failed to read monthlyComplexPrices_v2: ${err?.message || err}`);
      wrapped.code = 'V2_READ_FAILED';
      throw wrapped;
    }

    // 5. If no active monthly observations exist for this family
    if (points.length === 0) {
      return {
        availability: 'DATA_NOT_AVAILABLE',
        observation: null,
        warnings: [`해당 평형군(${areaFamilyId})에 대한 월별 관측 데이터가 monthlyComplexPrices_v2에 존재하지 않습니다.`],
        missingRequirements: ['월별 실거래 가격 데이터 부재'],
        metadata,
      };
    }

    // 6. Policy-based point selection
    let matchedPoint: AreaFamilyMonthlyPoint | null = null;
    let actualObsMonth: string | null = null;
    let distance = 0;
    const warnings: string[] = [];

    if (policy === 'EXACT_MONTH') {
      const exact = points.find((p) => p.dealYmd === normalizedMonth);
      if (exact) {
        matchedPoint = exact;
        actualObsMonth = exact.dealYmd;
        distance = 0;
      } else {
        // EXACT_MONTH: STRICTLY NO zero-fill, NO carry-forward, NO interpolation!
        return {
          availability: 'DATA_NOT_AVAILABLE',
          observation: null,
          warnings: [`요청 월(${normalizedMonth})에 거래가 없어 가격 관측값이 존재하지 않습니다. (EXACT_MONTH 정책)`],
          missingRequirements: [`거래 없음 (요청 월 ${normalizedMonth} 거래 미발생)`],
          metadata,
        };
      }
    } else if (policy === 'LATEST_OBSERVED_ON_OR_BEFORE') {
      // 1) exact match check
      const exact = points.find((p) => p.dealYmd === normalizedMonth);
      if (exact) {
        matchedPoint = exact;
        actualObsMonth = exact.dealYmd;
        distance = 0;
      } else {
        // 2) filter on or before
        const candidates = points.filter((p) => p.dealYmd <= normalizedMonth);
        if (candidates.length > 0) {
          // latest is the last element
          matchedPoint = candidates[candidates.length - 1];
          actualObsMonth = matchedPoint.dealYmd;
          distance = calculateMonthDifference(matchedPoint.dealYmd, normalizedMonth);
          warnings.push(
            `요청 월(${normalizedMonth})에 거래가 없어 직전 관측월(${matchedPoint.dealYmd}, 거리: ${distance}개월)의 관측값을 적용했습니다.`
          );
        } else {
          return {
            availability: 'DATA_NOT_AVAILABLE',
            observation: null,
            warnings: [`요청 월(${normalizedMonth}) 또는 그 이전 거래 관측 데이터가 존재하지 않습니다.`],
            missingRequirements: [`요청 월(${normalizedMonth}) 또는 그 이전 거래 관측 데이터 부재`],
            metadata,
          };
        }
      }
    } else if (policy === 'EARLIEST_OBSERVED_ON_OR_AFTER') {
      // 1) exact match check
      const exact = points.find((p) => p.dealYmd === normalizedMonth);
      if (exact) {
        matchedPoint = exact;
        actualObsMonth = exact.dealYmd;
        distance = 0;
      } else {
        // 2) filter on or after
        const candidates = points.filter((p) => p.dealYmd >= normalizedMonth);
        if (candidates.length > 0) {
          // earliest is the first element
          matchedPoint = candidates[0];
          actualObsMonth = matchedPoint.dealYmd;
          distance = calculateMonthDifference(normalizedMonth, matchedPoint.dealYmd);
          warnings.push(
            `요청 월(${normalizedMonth})에 거래가 없어 직후 관측월(${matchedPoint.dealYmd}, 거리: ${distance}개월)의 관측값을 적용했습니다.`
          );
        } else {
          return {
            availability: 'DATA_NOT_AVAILABLE',
            observation: null,
            warnings: [`요청 월(${normalizedMonth}) 또는 그 이후 거래 관측 데이터가 존재하지 않습니다.`],
            missingRequirements: [`요청 월(${normalizedMonth}) 또는 그 이후 거래 관측 데이터 부재`],
            metadata,
          };
        }
      }
    }

    if (!matchedPoint || !actualObsMonth) {
      return {
        availability: 'DATA_NOT_AVAILABLE',
        observation: null,
        warnings: [`요청 조건에 부합하는 가격 관측값을 찾을 수 없습니다.`],
        missingRequirements: ['조건에 부합하는 관측값 부재'],
        metadata,
      };
    }

    // Determine value based on priceMetric (in 만원)
    const priceValue =
      metric === 'AVERAGE_PRICE' ? matchedPoint.averagePrice : matchedPoint.medianPrice;

    const docId = `${complexId}_${areaFamilyId}_${actualObsMonth}`;

    const observation: PriceObservation = {
      complexId,
      areaFamilyId,
      requestedMonth: normalizedMonth,
      actualObservationMonth: actualObsMonth,
      selectionPolicy: policy,
      priceMetric: metric,
      value: priceValue,
      unit: 'KRW_MANWON',
      tradeCount: matchedPoint.tradeCount || matchedPoint.activeCount || 0,
      monthDistance: distance,
      sourceCollection: 'monthlyComplexPrices_v2',
      documentId: docId,
    };

    return {
      availability: 'AVAILABLE',
      observation,
      warnings,
      missingRequirements: [],
      metadata,
    };
  }

  /**
   * Helper to build PriceProvenance from a resolved observation.
   */
  public buildPriceProvenance(obs: PriceObservation): PriceProvenance {
    return {
      sourceCollection: 'monthlyComplexPrices_v2',
      documentId: obs.documentId || `${obs.complexId}_${obs.areaFamilyId}_${obs.actualObservationMonth}`,
      complexId: obs.complexId,
      areaFamilyId: obs.areaFamilyId,
      dealYmd: obs.actualObservationMonth || obs.requestedMonth,
      priceMetric: obs.priceMetric,
      tradeCount: obs.tradeCount,
      observedAt: new Date().toISOString(),
    };
  }

  /**
   * Audits price availability in monthlyComplexPrices_v2 for specified complexes.
   */
  public async auditPriceAvailability(complexIds: string[]): Promise<PriceAvailabilityAuditResult> {
    const familiesStats: FamilyPriceAvailabilityStats[] = [];

    for (const complexId of complexIds) {
      const metaList = await firestoreRepository.getAreaFamilyMetadata(complexId);
      for (const m of metaList) {
        familiesStats.push({
          complexId,
          areaFamilyId: m.areaFamilyId,
          label: m.label,
          shortLabel: m.shortLabel,
          hasPriceData: Boolean(m.hasMonthlyData && m.monthlyPointCount > 0),
          monthlyPointCount: m.monthlyPointCount,
          tradeCount: m.tradeCount,
          firstDealYmd: m.firstDealYmd,
          lastDealYmd: m.lastDealYmd,
        });
      }
    }

    const familiesWithPriceData = familiesStats.filter((f) => f.hasPriceData).length;
    const familiesWithoutPriceData = familiesStats.filter((f) => !f.hasPriceData).length;

    return {
      complexesAudited: complexIds,
      totalFamilies: familiesStats.length,
      familiesWithPriceData,
      familiesWithoutPriceData,
      families: familiesStats,
    };
  }
}

export const redevelopmentPriceService = new RedevelopmentPriceService();
