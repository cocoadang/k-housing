import { ComplexInfo, TradeRecord, MapComplexSummary, AreaCategory, BaselineOption, MapDataStatus } from '../types';
import { SUBREGIONS_METADATA } from '../data/complexesData';
import { AREA_FAMILIES_REGISTRY } from '../data/areaFamilies';
import { getAreaCategory } from './areaUtils';
import {
  aggregateTradesByMonth,
  calculateCAGRAnalysis,
} from './calculations';

export interface ComputeMapSummaryOptions {
  excludeCancelled?: boolean;
  excludeOutliers?: boolean;
  baselineOption?: BaselineOption;
  startYmd?: string;
  endYmd?: string;
}

/**
 * 단지의 국토교통부 실거래가 목록으로부터 지도 마커/인포윈도우용 정량 요약 지표 산출
 * 
 * [단일 기준 원칙]:
 * 1. 면적 분류는 src/utils/areaUtils.ts (getAreaCategory)만을 단일 기준으로 사용
 * 2. 59㎡(또는 선택 면적) 데이터가 없다고 해서 다른 면적(84㎡ 등)으로 자동 fallback 금지
 * 3. 월별 대표가격은 가격분석 엔진과 100% 동일한 aggregateTradesByMonth의 medianPrice를 사용
 * 4. 1년 변동률 및 CAGR 역시 월별 대표가격 시계열을 기준으로 일관 계산
 */
export function computeMapComplexSummary(
  complex: ComplexInfo,
  rawTrades: TradeRecord[] | undefined,
  requestedArea: AreaCategory = '59',
  options?: ComputeMapSummaryOptions
): MapComplexSummary {
  const excludeCancelled = options?.excludeCancelled !== false;
  const excludeOutliers = options?.excludeOutliers !== false;
  const baselineOption = options?.baselineOption || 'FIRST_AVAILABLE';
  const startYmd = options?.startYmd;
  const endYmd = options?.endYmd;

  const baseSummary: MapComplexSummary = {
    complexId: complex.id,
    complexName: complex.name,
    shortName: complex.shortName,
    district: complex.district,
    subRegion: complex.subRegion,
    province: complex.province,
    builtYear: complex.builtYear,
    totalUnits: complex.totalUnits,
    latitude: complex.latitude,
    longitude: complex.longitude,
    location: complex.location,
    representativeArea: complex.representativeArea,

    // Query state
    requestedArea,
    actualAreaCategory: requestedArea,
    hasRequestedAreaData: false,
    hasData: false,
    status: 'NO_DATA',
    transactionCount: 0,
    totalRecentTrades: 0,

    // Compatibility fields
    targetArea: parseInt(requestedArea, 10) || 59,
    hasTargetArea: false,
  };

  // 1. Check complex capability for requested area
  if (
    (requestedArea === '59' && complex.areaCapabilities?.has59 === false) ||
    (requestedArea === '84' && complex.areaCapabilities?.has84 === false)
  ) {
    baseSummary.status = 'NO_DATA';
    baseSummary.hasRequestedAreaData = false;
    baseSummary.hasData = false;
    baseSummary.hasTargetArea = false;
    baseSummary.noDataReason = `전용 ${requestedArea}㎡ 미공급 단지 (대표: ${complex.areaCapabilities?.defaultArea || complex.representativeArea}㎡)`;
    return baseSummary;
  }

  // 2. Raw trades check
  if (!rawTrades || rawTrades.length === 0) {
    baseSummary.status = 'NO_DATA';
    baseSummary.noDataReason = '실거래 등록 내역 없음 (NO_DATA)';
    return baseSummary;
  }

  // 3. Cancellation and outlier filtering
  let validTrades = rawTrades;
  if (excludeCancelled) {
    validTrades = validTrades.filter((t) => !t.isCancelled);
  }
  if (excludeOutliers) {
    validTrades = validTrades.filter((t) => !t.isOutlier && t.dealType !== '직거래');
  }
  if (startYmd && endYmd) {
    validTrades = validTrades.filter((t) => t.dealYmd >= startYmd && t.dealYmd <= endYmd);
  }

  if (validTrades.length === 0) {
    baseSummary.status = 'NO_DATA';
    baseSummary.noDataReason = '유효 실거래 내역 없음 (취소/필터 제외)';
    return baseSummary;
  }

  // 4. Area filtering using areaUtils SSOT with complex.id
  // Strict matching without fallback
  const targetTrades = validTrades.filter((t) => {
    const cat = t.areaCategory || getAreaCategory(t.exclusiveArea, complex.id);
    return cat === requestedArea;
  });

  const transactionCount = targetTrades.length;
  baseSummary.transactionCount = transactionCount;

  // If no trades exist for requestedArea, return NO_DATA status strictly without fallback
  if (transactionCount === 0) {
    baseSummary.status = 'NO_DATA';
    baseSummary.hasRequestedAreaData = false;
    baseSummary.hasData = false;
    baseSummary.hasTargetArea = false;
    baseSummary.noDataReason = `전용 ${requestedArea}㎡ 실거래 데이터 없음 (단지 대표면적: ${complex.representativeArea}㎡)`;
    return baseSummary;
  }

  // 4. Compute monthly aggregate series using the exact same calculation as Analysis view
  const monthlySeries = aggregateTradesByMonth(targetTrades);
  const validAggs = monthlySeries.filter((m) => m.hasData && m.medianPrice > 0);

  if (validAggs.length === 0) {
    baseSummary.status = 'NO_DATA';
    baseSummary.hasRequestedAreaData = false;
    baseSummary.hasData = false;
    baseSummary.hasTargetArea = false;
    baseSummary.noDataReason = '월별 집계 가능한 실거래 데이터가 없습니다.';
    return baseSummary;
  }

  // Latest monthly median representative record
  const latestAgg = validAggs[validAggs.length - 1];
  const latestMedianPrice = latestAgg.medianPrice;
  const latestMedianPricePerSqm = latestAgg.medianPricePerSqm;
  // Calculate pyeong price strictly using actual verified supplyAreaSqm / 3.305785
  const family = AREA_FAMILIES_REGISTRY[complex.id]?.find((f) => f.standardCategory === requestedArea);
  const hasSupply = typeof family?.representativeSupplyArea === 'number' && family.representativeSupplyArea > 0;
  const latestPricePerPyeong =
    hasSupply && latestMedianPrice > 0
      ? Math.round(latestMedianPrice / (family!.representativeSupplyArea! / 3.305785))
      : undefined;

  // 5. 1-Year Return calculation from monthly median series
  // Find record approx 12 months prior (10~14 months range)
  let oneYearReturn: number | undefined;
  if (validAggs.length >= 2) {
    const latestYear = latestAgg.year;
    const latestMonth = latestAgg.month;
    const targetPriorYmd = `${latestYear - 1}${latestMonth < 10 ? '0' + latestMonth : latestMonth}`;

    // Find closest month in range [-2 months, +2 months] around targetPriorYmd
    let bestMatch = validAggs.find((a) => a.dealYmd === targetPriorYmd);
    if (!bestMatch) {
      // Find nearest prior within 10 ~ 14 months
      const candidates = validAggs.filter((a) => {
        const monthDiff = (latestYear - a.year) * 12 + (latestMonth - a.month);
        return monthDiff >= 10 && monthDiff <= 14;
      });
      if (candidates.length > 0) {
        bestMatch = candidates[candidates.length - 1];
      }
    }

    if (bestMatch && bestMatch.medianPrice > 0 && bestMatch.dealYmd !== latestAgg.dealYmd) {
      const returnPct = ((latestMedianPrice - bestMatch.medianPrice) / bestMatch.medianPrice) * 100;
      if (isFinite(returnPct)) {
        oneYearReturn = Math.round(returnPct * 10) / 10;
      }
    }
  }

  // 6. CAGR calculation (standard monthly series CAGR)
  const cagrRes = calculateCAGRAnalysis(monthlySeries, baselineOption);
  const cagr =
    cagrRes && typeof cagrRes.cagr === 'number' && isFinite(cagrRes.cagr)
      ? Math.round(cagrRes.cagr * 10) / 10
      : undefined;

  // 7. Recent 12 months trade count
  const latestDateObj = new Date(latestAgg.year, latestAgg.month - 1, 1);
  latestDateObj.setFullYear(latestDateObj.getFullYear() - 1);
  const cutoffYmd = `${latestDateObj.getFullYear()}${latestDateObj.getMonth() + 1 < 10 ? '0' + (latestDateObj.getMonth() + 1) : latestDateObj.getMonth() + 1}`;
  const totalRecentTrades = targetTrades.filter((t) => t.dealYmd >= cutoffYmd).length;

  const lastTradeRecord = targetTrades[targetTrades.length - 1];

  return {
    ...baseSummary,
    hasRequestedAreaData: true,
    hasData: true,
    status: 'NORMAL',
    latestMonth: latestAgg.dealYmd,
    latestMedianPrice,
    latestMedianPricePerSqm,
    latestPricePerPyeong: isFinite(latestPricePerPyeong) ? latestPricePerPyeong : undefined,
    oneYearReturn,
    cagr,
    transactionCount,
    totalRecentTrades,
    confidence: latestAgg.confidence,

    // Compatibility fields
    hasTargetArea: true,
    targetArea: parseInt(requestedArea, 10) || 59,
    latestMonthlyMedianPrice: latestMedianPrice,
    latestPricePerSqm: latestMedianPricePerSqm,
    latestTransactionDate: lastTradeRecord?.dealDate || `${latestAgg.displayDate}`,
    latestPeriod: latestAgg.dealYmd,
    oneYearReturnPct: oneYearReturn,
    cagrPct: cagr,
  };
}

/**
 * 단지의 월별 집계 데이터(monthlyComplexPrices)로부터 직접 경량 지도 마커/요약 지표 산출
 * 10년 raw 거래내역 전체를 fetch하지 않고도 최신 대표가격, 1년 변동률, CAGR, 거래건수를 고속 산출
 */
export function computeMapSummaryFromMonthlyAggregates(
  complex: ComplexInfo,
  monthlyAggs: import('../types').MonthlyAggregate[] | undefined,
  requestedArea: AreaCategory = '59',
  options?: ComputeMapSummaryOptions
): MapComplexSummary {
  const baselineOption = options?.baselineOption || 'FIRST_AVAILABLE';
  const startYmd = options?.startYmd;
  const endYmd = options?.endYmd;

  const baseSummary: MapComplexSummary = {
    complexId: complex.id,
    complexName: complex.name,
    shortName: complex.shortName,
    district: complex.district,
    subRegion: complex.subRegion,
    province: complex.province,
    builtYear: complex.builtYear,
    totalUnits: complex.totalUnits,
    latitude: complex.latitude,
    longitude: complex.longitude,
    location: complex.location,
    representativeArea: complex.representativeArea,

    // Query state
    requestedArea,
    actualAreaCategory: requestedArea,
    hasRequestedAreaData: false,
    hasData: false,
    status: 'NO_DATA',
    transactionCount: 0,
    totalRecentTrades: 0,

    // Compatibility fields
    targetArea: parseInt(requestedArea, 10) || 59,
    hasTargetArea: false,
  };

  if (!monthlyAggs || monthlyAggs.length === 0) {
    baseSummary.status = 'NO_DATA';
    baseSummary.noDataReason = `전용 ${requestedArea}㎡ 실거래 데이터 없음 (단지 대표면적: ${complex.representativeArea}㎡)`;
    return baseSummary;
  }

  let validAggs = monthlyAggs.filter((m) => m.hasData && m.medianPrice > 0 && m.transactionCount > 0);
  if (startYmd && endYmd) {
    validAggs = validAggs.filter((m) => m.dealYmd >= startYmd && m.dealYmd <= endYmd);
  }

  if (validAggs.length === 0) {
    baseSummary.status = 'NO_DATA';
    baseSummary.noDataReason = `전용 ${requestedArea}㎡ 실거래 데이터 없음 (단지 대표면적: ${complex.representativeArea}㎡)`;
    return baseSummary;
  }

  const transactionCount = validAggs.reduce((acc, curr) => acc + (curr.transactionCount || curr.tradeCount || 1), 0);
  baseSummary.transactionCount = transactionCount;

  // Latest monthly median representative record
  const latestAgg = validAggs[validAggs.length - 1];
  const latestMedianPrice = latestAgg.medianPrice;
  const latestMedianPricePerSqm = latestAgg.medianPricePerSqm;
  // Calculate pyeong price strictly using actual verified supplyAreaSqm / 3.305785
  const familyFromRegistry = AREA_FAMILIES_REGISTRY[complex.id]?.find((f) => f.standardCategory === requestedArea);
  const hasSupplyInRegistry = typeof familyFromRegistry?.representativeSupplyArea === 'number' && familyFromRegistry.representativeSupplyArea > 0;
  const latestPricePerPyeong =
    hasSupplyInRegistry && latestMedianPrice > 0
      ? Math.round(latestMedianPrice / (familyFromRegistry!.representativeSupplyArea! / 3.305785))
      : undefined;

  // 1-Year Return calculation from monthly median series
  let oneYearReturn: number | undefined;
  if (validAggs.length >= 2) {
    const latestYear = latestAgg.year;
    const latestMonth = latestAgg.month;
    const targetPriorYmd = `${latestYear - 1}${latestMonth < 10 ? '0' + latestMonth : latestMonth}`;

    let bestMatch = validAggs.find((a) => a.dealYmd === targetPriorYmd);
    if (!bestMatch) {
      const candidates = validAggs.filter((a) => {
        const monthDiff = (latestYear - a.year) * 12 + (latestMonth - a.month);
        return monthDiff >= 10 && monthDiff <= 14;
      });
      if (candidates.length > 0) {
        bestMatch = candidates[candidates.length - 1];
      }
    }

    if (bestMatch && bestMatch.medianPrice > 0 && bestMatch.dealYmd !== latestAgg.dealYmd) {
      const returnPct = ((latestMedianPrice - bestMatch.medianPrice) / bestMatch.medianPrice) * 100;
      if (isFinite(returnPct)) {
        oneYearReturn = Math.round(returnPct * 10) / 10;
      }
    }
  }

  // CAGR calculation
  const cagrRes = calculateCAGRAnalysis(monthlyAggs, baselineOption);
  const cagr =
    cagrRes && typeof cagrRes.cagr === 'number' && isFinite(cagrRes.cagr)
      ? Math.round(cagrRes.cagr * 10) / 10
      : undefined;

  // Recent 12 months trade count
  const latestDateObj = new Date(latestAgg.year, latestAgg.month - 1, 1);
  latestDateObj.setFullYear(latestDateObj.getFullYear() - 1);
  const cutoffYmd = `${latestDateObj.getFullYear()}${latestDateObj.getMonth() + 1 < 10 ? '0' + (latestDateObj.getMonth() + 1) : latestDateObj.getMonth() + 1}`;
  const totalRecentTrades = validAggs
    .filter((a) => a.dealYmd >= cutoffYmd)
    .reduce((acc, curr) => acc + (curr.transactionCount || 1), 0);

  return {
    ...baseSummary,
    hasRequestedAreaData: true,
    hasData: true,
    status: 'NORMAL',
    latestMonth: latestAgg.dealYmd,
    latestMedianPrice,
    latestMedianPricePerSqm,
    latestPricePerPyeong: isFinite(latestPricePerPyeong) ? latestPricePerPyeong : undefined,
    oneYearReturn,
    cagr,
    transactionCount,
    totalRecentTrades,
    confidence: latestAgg.confidence,

    // Compatibility fields
    hasTargetArea: true,
    targetArea: parseInt(requestedArea, 10) || 59,
    latestMonthlyMedianPrice: latestMedianPrice,
    latestPricePerSqm: latestMedianPricePerSqm,
    latestTransactionDate: `${latestAgg.displayDate}`,
    latestPeriod: latestAgg.dealYmd,
    oneYearReturnPct: oneYearReturn,
    cagrPct: cagr,
  };
}

/**
 * 가격 문자열 포맷팅 (예: 291000 -> "29.1억")
 */
export function formatMarkerPrice(priceInTenThousand: number | null | undefined): string {
  if (priceInTenThousand === null || priceInTenThousand === undefined || isNaN(priceInTenThousand) || priceInTenThousand <= 0) {
    return '-';
  }
  if (priceInTenThousand >= 10000) {
    const eok = (priceInTenThousand / 10000).toFixed(1);
    return `${eok}억`;
  }
  return `${Math.round(priceInTenThousand).toLocaleString()}만`;
}

/**
 * 평당 가격 포맷팅 (예: 9500 -> "9,500만/평" 또는 "0.95억/평")
 */
export function formatMarkerPyeongPrice(priceInTenThousand: number | null | undefined): string {
  if (priceInTenThousand === null || priceInTenThousand === undefined || isNaN(priceInTenThousand) || priceInTenThousand <= 0 || !isFinite(priceInTenThousand)) {
    return '-';
  }
  if (priceInTenThousand >= 10000) {
    const eok = (priceInTenThousand / 10000).toFixed(1);
    return `평당 ${eok}억`;
  }
  return `평당 ${Math.round(priceInTenThousand).toLocaleString()}만`;
}

/**
 * 지역/생활권 선택 시 중심 좌표 및 줌 레벨 반환
 */
export function getRegionViewport(regionId: string): { center: { lat: number; lng: number }; zoom: number } {
  if (regionId === 'ALL' || regionId === 'SEOUL_METRO') {
    return { center: { lat: 37.5250, lng: 127.0200 }, zoom: 11 };
  }
  if (regionId === 'BUSAN') {
    return { center: { lat: 35.1580, lng: 129.1280 }, zoom: 13 };
  }

  const sub = SUBREGIONS_METADATA.find((s) => s.id === regionId || s.name === regionId);
  if (sub) {
    return { center: sub.center, zoom: sub.zoom };
  }

  return { center: { lat: 37.5250, lng: 127.0200 }, zoom: 11 };
}
