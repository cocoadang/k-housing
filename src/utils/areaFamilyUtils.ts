import { AreaFamilyMetadata, AreaFamilyMonthlyPoint, MonthlyAggregate, TradeRecord, AreaCategory } from '../types';

/**
 * Deterministic default AreaFamily selection policy:
 * 1. If preferredCategory is provided and valid (e.g. '84'):
 *    - Priority 1: hasMonthlyData=true with standardAreaCategory === preferredCategory
 *    - Priority 2: hasMonthlyData=true with other standardAreaCategory ('59' or '84')
 * 2. Default (preferredCategory '59' or none):
 *    - Priority 1: hasMonthlyData=true with standardAreaCategory === '59'
 *      (If multiple, pick closest representativeExclusiveArea to 59㎡, tie-break: area ASC, id ASC)
 *    - Priority 2: hasMonthlyData=true with standardAreaCategory === '84'
 *      (If multiple, pick closest representativeExclusiveArea to 84㎡, tie-break: area ASC, id ASC)
 *    - Priority 3: hasMonthlyData=true with smallest representativeExclusiveArea
 *    - Priority 4: If no active family exists, first family in registry
 */
export function getDefaultAreaFamily(
  families: AreaFamilyMetadata[],
  preferredCategory?: AreaCategory | string
): AreaFamilyMetadata | null {
  if (!families || families.length === 0) return null;

  const activeFamilies = families.filter((f) => f.hasMonthlyData);

  // Helper to pick closest to target number
  const pickClosest = (candidates: AreaFamilyMetadata[], targetArea: number): AreaFamilyMetadata => {
    return [...candidates].sort((a, b) => {
      const diffA = Math.abs(a.representativeExclusiveArea - targetArea);
      const diffB = Math.abs(b.representativeExclusiveArea - targetArea);
      if (diffA !== diffB) return diffA - diffB;
      if (a.representativeExclusiveArea !== b.representativeExclusiveArea) {
        return a.representativeExclusiveArea - b.representativeExclusiveArea;
      }
      return a.areaFamilyId.localeCompare(b.areaFamilyId);
    })[0];
  };

  if (preferredCategory === '84') {
    const active84 = activeFamilies.filter((f) => f.standardAreaCategory === '84');
    if (active84.length > 0) return pickClosest(active84, 84);

    const active59 = activeFamilies.filter((f) => f.standardAreaCategory === '59');
    if (active59.length > 0) return pickClosest(active59, 59);
  } else {
    // Default: prioritize 59, then 84
    const active59 = activeFamilies.filter((f) => f.standardAreaCategory === '59');
    if (active59.length > 0) return pickClosest(active59, 59);

    const active84 = activeFamilies.filter((f) => f.standardAreaCategory === '84');
    if (active84.length > 0) return pickClosest(active84, 84);
  }

  // Priority 3: smallest active area
  if (activeFamilies.length > 0) {
    return [...activeFamilies].sort((a, b) => {
      if (a.representativeExclusiveArea !== b.representativeExclusiveArea) {
        return a.representativeExclusiveArea - b.representativeExclusiveArea;
      }
      return a.areaFamilyId.localeCompare(b.areaFamilyId);
    })[0];
  }

  // Priority 4: first registry family
  return families[0];
}

/**
 * Format AreaFamily display label for UI buttons, chips, and headers
 */
export function formatAreaFamilyButtonLabel(family: AreaFamilyMetadata): string {
  // Prioritize "XX㎡형" format (e.g. "61㎡형", "59㎡형", "84㎡형")
  const m = family.label.match(/(\d+)㎡?형?/);
  if (m) {
    return `${m[1]}㎡형`;
  }
  if (family.shortLabel) {
    const sm = family.shortLabel.match(/(\d+)/);
    if (sm) return `${sm[1]}㎡형`;
    return family.shortLabel;
  }
  return `${Math.round(family.representativeExclusiveArea)}㎡형`;
}

/**
 * Format AreaFamily secondary information (e.g. "전용 60.83~61.09㎡" or "전용 84.83㎡")
 */
export function formatAreaFamilySubtext(family: AreaFamilyMetadata): string {
  if (family.exactAreas && family.exactAreas.length > 1) {
    const min = Math.min(...family.exactAreas);
    const max = Math.max(...family.exactAreas);
    return `전용 ${min}~${max}㎡`;
  }
  return `전용 ${family.representativeExclusiveArea}㎡`;
}

/**
 * Convert Phase 6A AreaFamilyMonthlyPoint into MonthlyAggregate for seamless chart & metric consumption
 */
export function convertAreaFamilyPointToMonthlyAggregate(
  pt: AreaFamilyMonthlyPoint
): MonthlyAggregate {
  const transactionCount = pt.tradeCount || 0;
  return {
    dealYmd: pt.dealYmd,
    year: pt.year,
    month: pt.month,
    displayDate: pt.displayDate,
    transactionCount,
    tradeCount: transactionCount,
    volume: transactionCount,
    medianPrice: pt.medianPrice,
    averagePrice: pt.averagePrice,
    avgPrice: pt.averagePrice,
    minPrice: pt.minPrice,
    maxPrice: pt.maxPrice,
    medianPricePerPyeong: pt.medianPricePerPyeong,
    medianPricePerSqm: pt.medianPricePerSqm,
    averagePricePerSqm: pt.averagePricePerSqm,
    confidence: pt.reliability,
    reliability: pt.reliability,
    confidenceLabel: pt.confidenceLabel || (transactionCount >= 10 ? '거래 충분' : transactionCount >= 3 ? '거래 보통' : transactionCount >= 1 ? '거래 적음' : '거래 없음'),
    hasData: transactionCount > 0 && pt.medianPrice > 0,
  };
}

/**
 * Check if a raw transaction matches the selected AreaFamily
 */
export function isTransactionMatchingAreaFamily(
  trade: TradeRecord,
  selectedAreaFamilyId: string,
  family?: AreaFamilyMetadata | null
): boolean {
  if (!selectedAreaFamilyId) return true;

  // 1. Direct match on trade's areaFamilyId if populated
  if (trade.areaFamilyId) {
    return trade.areaFamilyId === selectedAreaFamilyId;
  }

  // 2. Fallback to exactAreas match from metadata
  if (family && family.exactAreas && family.exactAreas.length > 0) {
    return family.exactAreas.includes(trade.exclusiveArea);
  }

  // 3. Approximate fallback to representativeExclusiveArea within 0.5㎡ tolerance
  if (family) {
    return Math.abs(trade.exclusiveArea - family.representativeExclusiveArea) < 0.5;
  }

  return false;
}
