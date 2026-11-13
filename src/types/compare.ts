import { StandardAreaCategory } from './index';

/**
 * Compare target input specification
 * Target identity is strictly (complexId + areaFamilyId).
 */
export interface CompareTarget {
  complexId: string;
  areaFamilyId: string;
}

/**
 * Fully resolved compare target with rich metadata
 */
export interface ResolvedCompareTarget {
  complexId: string;
  complexName: string;
  shortName: string;
  areaFamilyId: string;
  areaFamilyLabel: string;
  areaFamilyButtonLabel: string;
  representativeExclusiveArea: number;
  representativeSupplyArea?: number | null;
  standardAreaCategory: StandardAreaCategory;
  hasMonthlyData: boolean;
  targetKey: string; // Unique dedupe key: "${complexId}::${areaFamilyId}"
  isPredecessor?: boolean;
}

/**
 * Supported comparison modes in Multi-Complex Compare
 * PRICE_PER_PYEONG: 공급면적 기준 평당가 (거래가격 ÷ (공급면적㎡ / 3.305785))
 */
export type CompareMode = 'ABSOLUTE_PRICE' | 'PRICE_PER_PYEONG' | 'PRICE_PER_SQM' | 'BASE_100';

/**
 * Compare period options
 */
export type ComparePeriod = '1Y' | '3Y' | '5Y' | '10Y' | 'ALL' | 'CUSTOM';

/**
 * Execution status for individual target
 */
export type CompareTargetStatus =
  | 'SUCCESS'
  | 'NO_MONTHLY_DATA'
  | 'UNKNOWN_COMPLEX'
  | 'UNKNOWN_AREA_FAMILY'
  | 'V2_READ_FAILED'
  | 'BASE100_NO_COMMON_BASE_MONTH'
  | 'INVALID_PERIOD'
  | 'DATA_NOT_AVAILABLE';

/**
 * Clean, sparse series point for comparison charts
 */
export interface CompareSeriesPoint {
  dealYmd: string; // YYYYMM
  displayDate: string; // YYYY.MM
  value: number; // Value corresponding to current CompareMode (만원, 만원/㎡, or Base 100 Index)
  medianPrice: number; // 만원
  medianPricePerSqm: number; // 만원/㎡
  tradeCount: number;
  baseValue?: number; // Only for BASE_100 (100 at commonBaseYmd)
}

/**
 * Independent financial and statistical metrics for each target
 */
export interface CompareTargetMetrics {
  firstObservedPrice: number;
  firstObservedDate: string;
  lastObservedPrice: number;
  lastObservedDate: string;
  returnPct: number;
  cagrPct: number | null;
  mddPct: number;
  mddPeakPrice: number;
  mddPeakDate: string;
  mddTroughPrice: number;
  mddTroughDate: string;
  athPrice: number;
  athDate: string;
  totalTrades: number;
  observedMonthsCount: number;
  mddPeakTradeCount?: number;
  mddTroughTradeCount?: number;
  mddIsLowSample?: boolean;
}

/**
 * Evaluation result for a single compare target
 */
export interface CompareTargetResult {
  target: ResolvedCompareTarget;
  status: CompareTargetStatus;
  errorCode?: string;
  errorMessage?: string;
  series: CompareSeriesPoint[]; // Strictly sparse, sorted by dealYmd ASC
  metrics: CompareTargetMetrics | null;
  basePrice?: number; // For BASE_100
  baseDate?: string; // For BASE_100
}

/**
 * Multi-complex unified chart point for Recharts line chart
 * Strictly uses null for missing months (connectNulls={false})
 */
export interface UnifiedCompareChartPoint {
  date: string; // dealYmd
  displayDate: string; // YYYY.MM
  values: Record<string, number | null>; // Keyed by targetKey (${complexId}::${areaFamilyId})
}

/**
 * High-level result of multi-target comparison calculation
 */
export interface CompareCalculationResult {
  mode: CompareMode;
  period: ComparePeriod;
  startYmd: string;
  endYmd: string;
  targets: CompareTargetResult[];
  commonBaseYmd: string | null;
  commonObservedMonths: string[];
  base100Status: 'SUCCESS' | 'NO_COMMON_BASE_MONTH' | 'NOT_APPLICABLE';
  unifiedChartPoints: UnifiedCompareChartPoint[];
}
