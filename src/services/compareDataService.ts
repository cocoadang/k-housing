import {
  CompareTarget,
  ResolvedCompareTarget,
  CompareTargetStatus,
  AreaFamilyMonthlyPoint,
  AreaFamilyMetadata,
} from '../types';
import { TARGET_COMPLEXES } from '../data/complexesData';
import { HISTORICAL_COMPLEXES, isPredecessorComplex } from '../data/redevelopmentLineages';
import { AREA_FAMILIES_REGISTRY } from '../data/areaFamilies';
import { formatAreaFamilyButtonLabel } from '../utils/areaFamilyUtils';
import { dataService } from './dataService';

export interface LoadedCompareSeriesResult {
  target: ResolvedCompareTarget;
  series: AreaFamilyMonthlyPoint[];
  status: CompareTargetStatus;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Resolve CompareTarget into a rich ResolvedCompareTarget structure.
 */
export function resolveCompareTarget(target: CompareTarget): {
  resolved: ResolvedCompareTarget | null;
  errorStatus?: CompareTargetStatus;
  errorMessage?: string;
} {
  const { complexId, areaFamilyId } = target;

  if (!complexId) {
    return {
      resolved: null,
      errorStatus: 'UNKNOWN_COMPLEX',
      errorMessage: 'Missing complexId',
    };
  }

  // 1. Locate complex in TARGET_COMPLEXES or HISTORICAL_COMPLEXES
  const complex =
    TARGET_COMPLEXES.find((c) => c.id === complexId) ||
    HISTORICAL_COMPLEXES.find((c) => c.id === complexId);

  const complexName = complex?.name || complexId;
  const shortName = complex?.shortName || complex?.name || complexId;
  const isPredecessor = Boolean(
    complex?.historicalOnly || isPredecessorComplex(complexId)
  );

  // 2. Locate areaFamily in AREA_FAMILIES_REGISTRY
  const families = AREA_FAMILIES_REGISTRY[complexId];
  if (!families) {
    return {
      resolved: null,
      errorStatus: 'UNKNOWN_COMPLEX',
      errorMessage: `Complex "${complexId}" not found in AREA_FAMILIES_REGISTRY`,
    };
  }

  const family = families.find((f) => f.id === areaFamilyId);
  if (!family) {
    return {
      resolved: null,
      errorStatus: 'UNKNOWN_AREA_FAMILY',
      errorMessage: `AreaFamily "${areaFamilyId}" not found in complex "${complexId}"`,
    };
  }

  // Check if this family is known to have no monthly data (e.g. namcheon_xi_142)
  const hasMonthlyData = areaFamilyId !== 'namcheon_xi_142';

  // Format button label strictly preserving standard (e.g. samick_61 -> '61㎡형')
  const areaFamilyButtonLabel = formatAreaFamilyButtonLabel({
    areaFamilyId: family.id,
    complexId: family.complexId,
    label: family.label,
    shortLabel: family.shortLabel,
    representativeExclusiveArea: family.representativeExclusiveArea,
    exactAreas: family.exactAreas,
    standardAreaCategory: family.standardCategory,
    exclusiveAreaPyeong: family.exclusiveAreaPyeong,
    legacyPyeongLabel: family.legacyPyeongLabel,
    hasMonthlyData,
    firstDealYmd: null,
    lastDealYmd: null,
    monthlyPointCount: 0,
    tradeCount: 0,
    isPredecessorFamily: isPredecessor,
  });

  const resolved: ResolvedCompareTarget = {
    complexId,
    complexName,
    shortName,
    areaFamilyId,
    areaFamilyLabel: family.label,
    areaFamilyButtonLabel,
    representativeExclusiveArea: family.representativeExclusiveArea,
    representativeSupplyArea: family.representativeSupplyArea ?? null,
    standardAreaCategory: family.standardCategory,
    hasMonthlyData,
    targetKey: `${complexId}::${areaFamilyId}`,
    isPredecessor,
  };

  return { resolved };
}

/**
 * Load sparse monthly price series for a single CompareTarget.
 * Supports both client-side (via dataService) and server/node script execution (via firestoreRepo option).
 */
export async function loadCompareTargetSeries(
  target: CompareTarget,
  startYmd?: string,
  endYmd?: string,
  options?: { firestoreRepo?: any }
): Promise<LoadedCompareSeriesResult> {
  const { resolved, errorStatus, errorMessage } = resolveCompareTarget(target);

  if (!resolved || errorStatus) {
    return {
      target: resolved || {
        complexId: target.complexId,
        complexName: target.complexId,
        shortName: target.complexId,
        areaFamilyId: target.areaFamilyId,
        areaFamilyLabel: target.areaFamilyId,
        areaFamilyButtonLabel: target.areaFamilyId,
        representativeExclusiveArea: 0,
        standardAreaCategory: 'OTHER',
        hasMonthlyData: false,
        targetKey: `${target.complexId}::${target.areaFamilyId}`,
      },
      series: [],
      status: errorStatus || 'UNKNOWN_COMPLEX',
      errorCode: errorStatus,
      errorMessage,
    };
  }

  // If known no monthly data (e.g. namcheon_xi_142)
  if (!resolved.hasMonthlyData) {
    return {
      target: resolved,
      series: [],
      status: 'NO_MONTHLY_DATA',
      errorCode: 'NO_MONTHLY_DATA',
      errorMessage: `AreaFamily "${target.areaFamilyId}" has no recorded monthly data`,
    };
  }

  try {
    let monthlyPoints: AreaFamilyMonthlyPoint[] = [];

    if (options?.firestoreRepo) {
      // Direct Firestore repository for server/testing environments
      const repoRes = await options.firestoreRepo.getAreaFamilyMonthlyPrices(
        target.complexId,
        target.areaFamilyId,
        startYmd,
        endYmd
      );
      monthlyPoints = repoRes.points || [];
    } else {
      // Browser client-side fetch via Phase 6A HTTP endpoint
      const response = await dataService.getAreaFamilyMonthlyPrices(
        target.complexId,
        target.areaFamilyId,
        startYmd,
        endYmd
      );
      monthlyPoints = response.points || [];
    }

    if (monthlyPoints.length === 0) {
      return {
        target: resolved,
        series: [],
        status: 'NO_MONTHLY_DATA',
        errorCode: 'NO_MONTHLY_DATA',
        errorMessage: 'No transaction points found in selected period',
      };
    }

    return {
      target: resolved,
      series: monthlyPoints,
      status: 'SUCCESS',
    };
  } catch (err: any) {
    return {
      target: resolved,
      series: [],
      status: 'V2_READ_FAILED',
      errorCode: 'V2_READ_FAILED',
      errorMessage: err?.message || 'Failed to read monthlyComplexPrices_v2',
    };
  }
}

/**
 * Load multiple compare target series in parallel.
 * Deduplicates by targetKey (complexId + areaFamilyId).
 */
export async function loadCompareSeries(
  targets: CompareTarget[],
  startYmd?: string,
  endYmd?: string,
  options?: { firestoreRepo?: any }
): Promise<LoadedCompareSeriesResult[]> {
  // Deduplicate targets by unique key: complexId + areaFamilyId
  const seen = new Set<string>();
  const uniqueTargets: CompareTarget[] = [];

  for (const t of targets) {
    const key = `${t.complexId}::${t.areaFamilyId}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueTargets.push(t);
    }
  }

  return Promise.all(
    uniqueTargets.map((t) =>
      loadCompareTargetSeries(t, startYmd, endYmd, options)
    )
  );
}
