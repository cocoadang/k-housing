export type AreaCategory = '59' | '84';

export type StandardAreaCategory = '59' | '84' | 'OTHER';

export type MapAreaCategory = '59' | '84';

export type ComplexCategory = 'NEW' | 'OLD' | 'REDEVELOPMENT' | 'RECONSTRUCTION' | 'REMODELING' | 'LANDMARK';

export type DataReliability = 'HIGH' | 'MEDIUM' | 'LOW' | 'NO_DATA';

export type TransactionCancellationState = 'ACTIVE' | 'CANCELLED' | 'PARTIALLY_CANCELLED';

export interface AreaFamily {
  id: string;
  complexId: string;

  label: string;
  shortLabel: string;

  representativeExclusiveArea: number;
  representativeSupplyArea?: number | null; // 공식 공급면적(㎡). 부재 시 null (평당가 산출 제외)

  exactAreas?: number[];

  minExclusiveArea?: number;
  maxExclusiveArea?: number;

  standardCategory: StandardAreaCategory;

  exclusiveAreaPyeong?: number; // legacy deprecated field

  legacyPyeongLabel?: string; // 공식 또는 검증된 통상 평형 명칭이 있는 경우에만 사용 (구 24평형 등)

  source:
    | 'TRANSACTION_DISCOVERY'
    | 'OFFICIAL_BUILDING_DATA'
    | 'MANUAL_VERIFIED'
    | 'HISTORICAL_DISCOVERY_VERIFIED';

  confidence:
    | 'HIGH'
    | 'MEDIUM'
    | 'LOW';

  isPredecessorFamily?: boolean;
}

/**
 * Phase 6A: AreaFamily Metadata Model
 * Single Source of Truth for complex area options in Price Analysis.
 */
export interface AreaFamilyMetadata {
  areaFamilyId: string;
  complexId: string;
  label: string;
  shortLabel?: string;
  representativeExclusiveArea: number;
  representativeSupplyArea?: number | null;
  exactAreas?: number[];
  minExclusiveArea?: number;
  maxExclusiveArea?: number;
  standardAreaCategory: StandardAreaCategory;
  exclusiveAreaPyeong?: number;
  legacyPyeongLabel?: string;
  hasMonthlyData: boolean;
  firstDealYmd: string | null;
  lastDealYmd: string | null;
  monthlyPointCount: number;
  tradeCount: number;
  isPredecessorFamily?: boolean;
}

export interface AreaFamilyListResponse {
  success: boolean;
  complexId: string;
  totalFamilies: number;
  activeFamilies: number;
  families: AreaFamilyMetadata[];
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Phase 6A: AreaFamily Monthly Price Point Model
 * Sparse, canonical monthly aggregations from monthlyComplexPrices_v2.
 */
export interface AreaFamilyMonthlyPoint {
  dealYmd: string; // YYYYMM
  year: number;
  month: number;
  displayDate: string; // YYYY.MM
  tradeCount: number;
  activeCount: number;
  sourceCanonicalGroupCount?: number;
  medianPrice: number;
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  medianPricePerSqm: number;
  averagePricePerSqm: number;
  medianPricePerPyeong: number;
  firstDealDate?: string;
  lastDealDate?: string;
  reliability: DataReliability;
  confidenceLabel?: string;
}

export interface AreaFamilyMonthlyResponse {
  success: boolean;
  complexId: string;
  areaFamilyId: string;
  hasMonthlyData: boolean;
  metadata?: AreaFamilyMetadata;
  period: {
    startYmd?: string;
    endYmd?: string;
    firstDealYmd?: string | null;
    lastDealYmd?: string | null;
  };
  pointCount: number;
  points: AreaFamilyMonthlyPoint[];
  error?: {
    code: string;
    message: string;
  };
}

export interface AreaFamilyResolution {
  status: 'MATCHED' | 'UNMAPPED_AREA';
  family?: AreaFamily;
}

export interface ComparisonTarget {
  complexId: string;
  areaFamilyId: string;
}

export interface SourceReference {
  sourceType:
    | 'LOCAL_GOV'
    | 'ASSOCIATION'
    | 'MANAGEMENT_DISPOSITION'
    | 'APPRAISAL'
    | 'CONTRACTOR'
    | 'REA'
    | 'NEWS'
    | 'OTHER';
  title: string;
  publisher?: string;
  referenceDate?: string;
  url?: string;
  accessedAt?: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * 재건축/재개발 정비사업 Lineage 관계 모델
 * 
 * CRITICAL ARCHITECTURAL RULE:
 * predecessor(구 단지)와 successor(신축 단지)는 가격 시계열상 완전히 독립된 자산입니다.
 * Return, CAGR, ATH, MDD, Volatility, Normalized Index 등 시계열 계산에서
 * 두 단지의 가격은 절대 자동으로 연결되거나 합성되지 않습니다.
 */
export * from './redevelopment';

export type ApiErrorCode =
  | 'AUTH_ERROR'
  | 'RATE_LIMIT'
  | 'API_SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'
  | 'PARSE_ERROR'
  | 'NO_DATA'
  | 'APT_NOT_MATCHED'
  | 'AREA_NOT_MATCHED'
  | 'UNKNOWN_ERROR';

export interface ApiErrorDetail {
  code: ApiErrorCode;
  message: string;
  source: string;
  target?: string;
  period?: string;
  rawDetails?: string;
}

export interface ComplexAreaCapabilities {
  has59: boolean;
  has84: boolean;
  defaultArea: '59' | '84';
}

export interface ComplexInfo {
  id: string;
  name: string;
  shortName: string;
  apiAliases: string[]; // 국토교통부 실거래가 API의 아파트명 매칭용 별칭 목록
  region: 'SEOUL_METRO' | 'BUSAN'; // Top-level region
  province: string; // e.g. "서울특별시", "경기도", "부산광역시"
  city: string; // e.g. "서울시", "과천시", "성남시 수정구", "부산시"
  district: string; // e.g. "강남구 압구정동", "수정구 산성동"
  neighborhood: string; // e.g. "압구정동", "산성동", "신흥동", "금광동"
  subRegion: string; // e.g. "압구정", "반포", "마포", "성동", "용산", "과천", "길음", "강동", "목동", "구성남", "남천동", "센텀시티"
  lawdCd: string; // 5-digit code e.g. 11680 for Gangnam, 41131 for Seongnam Sujeong
  dong: string;
  latitude: number;
  longitude: number;
  location: {
    lat: number;
    lng: number;
  };
  builtYear: number;
  totalUnits: number;
  featuredAreas: number[]; // [59, 84, 114, 144]
  representativeArea: number; // Default 59 (or 84 if 59 not available)
  areaCapabilities: ComplexAreaCapabilities;
  category: ComplexCategory;
  description: string;
  badge?: string;
  historicalOnly?: boolean; // 재건축 이전 구 단지 등 과거 히스토리 전용 단지 플래그
  isActive?: boolean; // 현재 매매 거래 활성 단지 여부 (재건축 멸실 단지는 false)
  redevelopmentLineageId?: string; // 소속된 재건축 정비사업 Lineage ID
}

export interface TradeRecord {
  id: string;
  complexId: string;
  complexName: string;
  dealYear: number;
  dealMonth: number;
  dealDay: number;
  dealDate: string; // YYYY-MM-DD
  dealYmd: string; // YYYYMM
  price: number; // in 만원 (e.g. 250000 = 25억)
  exclusiveArea: number; // 전용면적 sqm (e.g. 59.98, 84.97)
  areaCategory: '59' | '84' | '114_PLUS' | 'OTHER';
  areaFamilyId?: string; // 단지별 주택형 AreaFamily ID (e.g. "banpo_xi_84", "samick_61")
  standardAreaCategory?: StandardAreaCategory; // '59' | '84' | 'OTHER' (지도/거시 비교용)
  canonicalStatus?: 'TARGET_CANONICAL' | 'ACTIVE' | 'CANCELLED' | string;
  pyeong: number; // 공급/환산 평형 (approx exclusiveArea / 3.305785 * 1.3)
  pricePerPyeong: number; // 만원 per pyeong
  pricePerSqm: number; // 만원 per ㎡ (거래금액 / 전용면적)
  floor: number;
  isCancelled: boolean;
  normalRowCount?: number;
  cancellationRowCount?: number;
  activeCount?: number;
  cancelDate?: string;
  cancelDates?: string[];
  registrationDate?: string;
  dealType?: string; // '중개거래' | '직거래'
  isOutlier?: boolean;
  dataSource: 'MOLIT_OPENAPI' | 'LOCAL_CACHE';
}

export interface MonthlyAggregate {
  dealYmd: string; // YYYYMM (e.g. "202508")
  year: number;
  month: number;
  displayDate: string; // "2025.08"
  transactionCount: number; // 월간 거래건수
  tradeCount: number; // alias for transactionCount
  volume: number; // alias for transactionCount
  medianPrice: number; // 만원 (월별 대표가격)
  averagePrice: number; // 만원
  avgPrice: number; // alias for averagePrice
  minPrice: number;
  maxPrice: number;
  medianPricePerPyeong: number;
  averagePricePerPyeong?: number;
  medianPricePerSqm: number; // 만원/㎡
  averagePricePerSqm: number; // 만원/㎡
  confidence: DataReliability; // HIGH (10+), MEDIUM (3-9), LOW (1-2), NO_DATA (0)
  reliability: DataReliability; // alias for confidence
  confidenceLabel: string; // '충분' | '보통' | '낮음' | '거래 없음'
  hasData: boolean;
}

export interface RegionMonthlyPrice {
  region: string;
  subRegion?: string;
  dealYmd: string;
  displayDate: string;
  complexCount: number;
  transactionCount: number;
  medianPrice: number;
  medianPricePerSqm: number;
  averagePrice: number;
  averagePricePerSqm: number;
  confidence: DataReliability;
}

export interface CAGRResult {
  startPeriod: string;
  endPeriod: string;
  startPrice: number;
  endPrice: number;
  totalReturnPct: number;
  years: number;
  cagr: number; // % annual rate
  effectiveStartMonth?: string;
  effectiveEndMonth?: string;
}

export interface MDDResult {
  peakDate: string;
  peakPrice: number;
  troughDate: string;
  troughPrice: number;
  mddPct: number; // e.g. -24.5%
  currentPrice: number;
  currentRecoveryPct: number; // e.g. 96.2%
  isNewHigh: boolean;
  peakTradeCount?: number;
  troughTradeCount?: number;
  isLowSample?: boolean;
}

export interface PeriodReturnItem {
  label: string; // '1년' | '3년' | '5년' | '10년' | '15년' | '20년' | '전체 기간'
  periodKey: '1Y' | '3Y' | '5Y' | '10Y' | '15Y' | '20Y' | 'ALL';
  returnPct: number | null; // % (null if insufficient data)
  cagrPct?: number | null; // 연평균 상승률 % (CAGR)
  status: 'VALID' | 'INSUFFICIENT_DATA' | 'NO_DATA';
  startPeriod?: string;
  endPeriod?: string;
  startPrice?: number;
  endPrice?: number;
  years?: number;
}

export interface AnalysisPeriod {
  startMonth: string; // "YYYY.MM", e.g. "2017.01"
  endMonth: string;   // "YYYY.MM", e.g. "2026.08"
  startYmd: string;   // "YYYYMM", e.g. "201701"
  endYmd: string;     // "YYYYMM", e.g. "202608"
  presetId?: '1Y' | '3Y' | '5Y' | '10Y' | 'ALL' | 'CUSTOM';
}

export interface DetailedPriceMetrics {
  latestMedianPrice: number;
  latestMedianDate: string;
  latestTransactionCount: number;
  latestConfidence: DataReliability;
  latestConfidenceLabel: string; // '거래 충분' | '거래 보통' | '거래 적음' | '거래 없음'
  pricePerPyeong: number;
  pricePerSqm: number;
  oneYearReturnPct: number | null;
  athPrice: number;
  athDate: string;
  drawdownFromAthPct: number; // e.g. -11.7
  isNewAth: boolean;
  mddPct: number;
  mddPeakDate: string;
  mddPeakPrice: number;
  mddTroughDate: string;
  mddTroughPrice: number;
  mddPeakTradeCount?: number;
  mddTroughTradeCount?: number;
  mddIsLowSample?: boolean;
  cagrPct: number | null;
  cagrStartPeriod?: string;
  cagrEndPeriod?: string;
  periodReturns: PeriodReturnItem[];
  minPrice: number;
  minPriceDate: string;
  maxPrice: number;
  maxPriceDate: string;
  earliestDate?: string;
  earliestPrice?: number;
  hasData: boolean;
  userPeriodStart?: string;
  userPeriodEnd?: string;
  isAllPeriod?: boolean;
  periodPeakPrice?: number;
  periodPeakDate?: string;
  periodDrawdownPct?: number;
  isNewPeriodPeak?: boolean;
  // All-time (전체 기간) MDD metrics
  allTimeMddPct?: number;
  allTimeMddPeakDate?: string;
  allTimeMddPeakPrice?: number;
  allTimeMddTroughDate?: string;
  allTimeMddTroughPrice?: number;
  allTimeMddPeakTradeCount?: number;
  allTimeMddTroughTradeCount?: number;
  allTimeMddIsLowSample?: boolean;
}

export interface ROneIndexPoint {
  date: string; // YYYYMM
  seoulAll: number;
  gangnamZone: number; // 동남권
  dosimZone: number; // 도심권
  seobukZone: number; // 서북권
  gwacheon: number;
  seongnam: number; // 성남/구성남 권역 지수
  busanAll: number;
  busanHaeundae: number;
}

export interface NormalizedSeriesPoint {
  date: string;
  displayDate: string;
  [complexId: string]: number | string; // Normalized value (base = 100) or date string
}

export interface ComplexComparisonStats {
  complex: ComplexInfo;
  latestMedian: number;
  pricePerPyeong: number;
  pricePerSqm: number;
  cagr: number;
  mdd: number;
  recoveryPct: number;
  baselineReturnPct: number;
  totalTrades: number;
  peakPrice: number;
  peakDate: string;
  hasData: boolean;
  noDataReason?: string;
}

export type BaselineOption = 'FIRST_AVAILABLE' | '2017_05' | '2020_01' | '2022_12' | '2024_01' | 'CUSTOM';

export type MapPriceMode = 'LATEST_PRICE' | 'ONE_YEAR_RETURN' | 'CAGR' | 'PRICE_PER_SQM';

export type MapDataStatus =
  | 'NORMAL'
  | 'NO_DATA'
  | 'API_ERROR'
  | 'AUTH_ERROR'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE';

export interface MapComplexSummary {
  complexId: string;
  complexName: string;
  shortName: string;
  district: string;
  subRegion: string;
  province: string;
  builtYear: number;
  totalUnits: number;
  latitude: number;
  longitude: number;
  location: {
    lat: number;
    lng: number;
  };
  representativeArea: number;

  // Single source of truth area query parameters
  requestedArea: AreaCategory;
  actualAreaCategory?: AreaCategory;
  hasRequestedAreaData: boolean;

  // Standard Monthly Median representative values
  latestMonth?: string; // YYYYMM (e.g. 202408)
  latestMedianPrice?: number; // 만원 (e.g. 291000 = 29.1억)
  latestMedianPricePerSqm?: number; // 만원/㎡
  latestPricePerPyeong?: number; // 만원/평

  // Return rates computed from monthly median series
  oneYearReturn?: number; // % (approx 12 months prior)
  cagr?: number; // % (standard monthly series CAGR)

  // Volume & Reliability
  transactionCount: number; // 해당 면적 총 거래건수
  totalRecentTrades: number; // 최근 1년 거래건수
  confidence?: DataReliability;

  // Operational status
  status: MapDataStatus;
  hasData: boolean;
  noDataReason?: string;

  // Compatibility aliases
  targetArea: number; // e.g. 59 or representativeArea
  hasTargetArea: boolean;
  latestMonthlyMedianPrice?: number;
  latestPricePerSqm?: number;
  latestTransactionDate?: string;
  latestPeriod?: string;
  oneYearReturnPct?: number;
  cagrPct?: number;
}

export * from './compare';
export * from './redevelopment';
export * from './redevelopmentEvidence';
export type {
  ProductionEligibility,
  MappingCoverageStatus,
  FinancialSemanticType,
  CalculationReadinessStatus,
  NormalizedProjectMilestone,
  NormalizedProjectSeed,
  PredecessorAreaFamilyCoverage,
  NormalizedMappingSeed,
  NormalizedFinancialMetric,
  NormalizedFinancialSeed,
  NormalizedCostEvent,
  NormalizedConstructionCostSeed,
  NormalizedLandShareTier,
  NormalizedLandShareSeed,
  NormalizedAnalysisSeed,
} from './redevelopmentNormalizedSeed';
export * from './redevelopmentAnalysis';
export * from './redevelopmentApi';

