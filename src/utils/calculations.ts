import {
  TradeRecord,
  MonthlyAggregate,
  CAGRResult,
  MDDResult,
  BaselineOption,
  AreaCategory,
  NormalizedSeriesPoint,
  ComplexComparisonStats,
  DataReliability,
  ComplexInfo,
  RegionMonthlyPrice,
  PeriodReturnItem,
  DetailedPriceMetrics,
} from '../types';
import { getAreaCategory } from './areaUtils';

/**
 * Robust mathematical median calculator
 */
export function calculateMedian(numbers: number[]): number {
  if (!numbers || numbers.length === 0) return 0;
  const validNumbers = numbers.filter((n) => typeof n === 'number' && !isNaN(n) && n > 0);
  if (validNumbers.length === 0) return 0;

  const sorted = [...validNumbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Format Korean Won amounts into 억/만원 format
 */
export function formatPrice(manwon: number | null | undefined): string {
  if (manwon === null || manwon === undefined || isNaN(manwon) || manwon <= 0) return '-';
  const eok = Math.floor(manwon / 10000);
  const remainder = Math.round(manwon % 10000);

  if (eok === 0) {
    return `${remainder.toLocaleString()}만원`;
  }
  if (remainder === 0) {
    return `${eok}억원`;
  }
  return `${eok}억 ${remainder.toLocaleString()}만원`;
}

/**
 * Format Pyeong (3.3㎡) price
 */
export function formatPyeongPrice(manwon: number | null | undefined): string {
  if (manwon === null || manwon === undefined || isNaN(manwon) || manwon <= 0) return '-';
  const eok = Math.floor(manwon / 10000);
  const remainder = Math.round(manwon % 10000);

  if (eok === 0) {
    return `${remainder.toLocaleString()}만/평`;
  }
  if (remainder === 0) {
    return `${eok}억/평`;
  }
  return `${eok}억 ${remainder.toLocaleString()}만/평`;
}

/**
 * Format Sqm (㎡) unit price
 */
export function formatSqmPrice(manwon: number | null | undefined): string {
  if (manwon === null || manwon === undefined || isNaN(manwon) || manwon <= 0) return '-';
  return `${Math.round(manwon).toLocaleString()}만/㎡`;
}

/**
 * Aggregate raw TradeRecords into MonthlyAggregate time-series
 * Uses Median price as the primary monthly representative price.
 */
export function aggregateTradesByMonth(trades: TradeRecord[]): MonthlyAggregate[] {
  if (!trades || trades.length === 0) return [];

  const grouped: Record<string, TradeRecord[]> = {};

  trades.forEach((trade) => {
    if (!trade.dealYmd || trade.price <= 0 || trade.isCancelled) return;
    const count = trade.activeCount !== undefined ? trade.activeCount : 1;
    if (count <= 0) return;

    if (!grouped[trade.dealYmd]) {
      grouped[trade.dealYmd] = [];
    }
    for (let i = 0; i < count; i++) {
      grouped[trade.dealYmd].push(trade);
    }
  });

  const sortedYmds = Object.keys(grouped).sort();

  return sortedYmds.map((dealYmd) => {
    const monthTrades = grouped[dealYmd];
    const prices = monthTrades.map((t) => t.price).filter((p) => p > 0);
    const pyeongPrices = monthTrades.map((t) => t.pricePerPyeong).filter((p) => p > 0);
    const sqmPrices = monthTrades
      .map((t) => (t.pricePerSqm > 0 ? t.pricePerSqm : t.exclusiveArea > 0 ? t.price / t.exclusiveArea : 0))
      .filter((p) => p > 0);

    const year = parseInt(dealYmd.slice(0, 4), 10);
    const month = parseInt(dealYmd.slice(4, 6), 10);
    const displayDate = `${year}.${month < 10 ? '0' + month : month}`;

    const transactionCount = monthTrades.length;
    const medianPrice = Math.round(calculateMedian(prices));
    const averagePrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

    const medianPricePerPyeong = Math.round(calculateMedian(pyeongPrices));
    const medianPricePerSqm = Math.round(calculateMedian(sqmPrices) * 10) / 10;
    const averagePricePerSqm =
      sqmPrices.length > 0 ? Math.round((sqmPrices.reduce((a, b) => a + b, 0) / sqmPrices.length) * 10) / 10 : 0;

    let confidence: DataReliability = 'LOW';
    let confidenceLabel = '낮음';

    if (transactionCount >= 10) {
      confidence = 'HIGH';
      confidenceLabel = '충분';
    } else if (transactionCount >= 3) {
      confidence = 'MEDIUM';
      confidenceLabel = '보통';
    } else if (transactionCount >= 1) {
      confidence = 'LOW';
      confidenceLabel = '낮음';
    } else {
      confidence = 'NO_DATA';
      confidenceLabel = '거래 없음';
    }

    return {
      dealYmd,
      year,
      month,
      displayDate,
      transactionCount,
      tradeCount: transactionCount,
      volume: transactionCount,
      medianPrice,
      averagePrice,
      avgPrice: averagePrice,
      minPrice,
      maxPrice,
      medianPricePerPyeong,
      medianPricePerSqm,
      averagePricePerSqm,
      confidence,
      reliability: confidence,
      confidenceLabel,
      hasData: transactionCount > 0,
    };
  });
}

/**
 * Calculate CAGR (Compound Annual Growth Rate)
 */
export function calculateCAGR(startPrice: number, endPrice: number, years: number): number {
  if (startPrice <= 0 || endPrice <= 0 || years <= 0 || isNaN(startPrice) || isNaN(endPrice) || isNaN(years)) {
    return 0;
  }
  const growthRate = Math.pow(endPrice / startPrice, 1 / years) - 1;
  if (isNaN(growthRate) || !isFinite(growthRate)) return 0;
  return Math.round(growthRate * 1000) / 10; // in %
}

/**
 * Calculate CAGR Analysis based on monthly representative prices and chosen baseline
 */
export function calculateCAGRAnalysis(
  monthlyAggs: MonthlyAggregate[],
  baselineOption: BaselineOption,
  customBaselineDate?: string
): CAGRResult | null {
  const validAggs = (monthlyAggs || []).filter((m) => m.hasData && m.medianPrice > 0);
  if (validAggs.length < 2) return null;

  let targetStartMonth = validAggs[0].dealYmd;

  switch (baselineOption) {
    case '2017_05':
      targetStartMonth = '201705';
      break;
    case '2020_01':
      targetStartMonth = '202001';
      break;
    case '2022_12':
      targetStartMonth = '202212';
      break;
    case '2024_01':
      targetStartMonth = '202401';
      break;
    case 'CUSTOM':
      if (customBaselineDate) {
        targetStartMonth = customBaselineDate.replace(/[^0-9]/g, '').slice(0, 6);
      }
      break;
    case 'FIRST_AVAILABLE':
    default:
      targetStartMonth = validAggs[0].dealYmd;
      break;
  }

  // Find nearest starting monthly record >= targetStartMonth
  let startAgg = validAggs.find((m) => m.dealYmd >= targetStartMonth);
  if (!startAgg) {
    startAgg = validAggs[0];
  }

  const endAgg = validAggs[validAggs.length - 1];

  const startYearFraction = startAgg.year + (startAgg.month - 1) / 12;
  const endYearFraction = endAgg.year + (endAgg.month - 1) / 12;
  const years = Math.max(0.083, endYearFraction - startYearFraction); // at least 1 month

  const startPrice = startAgg.medianPrice;
  const endPrice = endAgg.medianPrice;
  const totalReturnPct =
    startPrice > 0 ? Math.round(((endPrice - startPrice) / startPrice) * 1000) / 10 : 0;
  const cagr = calculateCAGR(startPrice, endPrice, years);

  return {
    startPeriod: startAgg.displayDate,
    endPeriod: endAgg.displayDate,
    startPrice,
    endPrice,
    totalReturnPct,
    years: Math.round(years * 10) / 10,
    cagr,
    effectiveStartMonth: startAgg.dealYmd,
    effectiveEndMonth: endAgg.dealYmd,
  };
}

/**
 * Calculate Maximum Drawdown (MDD) and ATH recovery based on monthly representative prices
 */
export function calculateMDD(monthlyAggs: MonthlyAggregate[]): MDDResult {
  const validAggs = (monthlyAggs || []).filter((m) => m.hasData && m.medianPrice > 0);

  if (validAggs.length === 0) {
    return {
      peakDate: '-',
      peakPrice: 0,
      troughDate: '-',
      troughPrice: 0,
      mddPct: 0,
      currentPrice: 0,
      currentRecoveryPct: 0,
      isNewHigh: false,
      peakTradeCount: 0,
      troughTradeCount: 0,
      isLowSample: false,
    };
  }

  let peakPrice = 0;
  let peakDate = '';
  let peakTradeCount = 0;
  let maxDrawdown = 0;
  let maxDrawdownPeakPrice = 0;
  let maxDrawdownPeakDate = '';
  let maxDrawdownPeakTradeCount = 0;
  let troughPrice = 0;
  let troughDate = '';
  let troughTradeCount = 0;

  validAggs.forEach((agg) => {
    const tradeCount = agg.tradeCount || agg.transactionCount || 0;
    if (agg.medianPrice > peakPrice) {
      peakPrice = agg.medianPrice;
      peakDate = agg.displayDate;
      peakTradeCount = tradeCount;
    }

    if (peakPrice > 0) {
      const drawdown = (agg.medianPrice - peakPrice) / peakPrice;
      if (drawdown < maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPeakPrice = peakPrice;
        maxDrawdownPeakDate = peakDate;
        maxDrawdownPeakTradeCount = peakTradeCount;
        troughPrice = agg.medianPrice;
        troughDate = agg.displayDate;
        troughTradeCount = tradeCount;
      }
    }
  });

  const latest = validAggs[validAggs.length - 1];
  const overallPeakPrice = Math.max(...validAggs.map((m) => m.medianPrice));
  const currentRecoveryPct =
    overallPeakPrice > 0 ? Math.round((latest.medianPrice / overallPeakPrice) * 1000) / 10 : 100;
  const isNewHigh = latest.medianPrice >= overallPeakPrice * 0.995;

  const finalPeakDate = maxDrawdownPeakDate || peakDate;
  const finalPeakPrice = maxDrawdownPeakPrice || peakPrice;
  const finalTroughDate = troughDate || peakDate;
  const finalTroughPrice = troughPrice || peakPrice;
  const finalPeakTradeCount = maxDrawdownPeakTradeCount || peakTradeCount;
  const finalTroughTradeCount = troughTradeCount || peakTradeCount;

  // 저표본 구간 판단: 낙폭이 존재하고, 고점월 또는 저점월 둘 중 하나라도 tradeCount == 1 이면 저표본 구간
  const isLowSample =
    maxDrawdown < 0 && (finalPeakTradeCount === 1 || finalTroughTradeCount === 1);

  return {
    peakDate: finalPeakDate,
    peakPrice: finalPeakPrice,
    troughDate: finalTroughDate,
    troughPrice: finalTroughPrice,
    mddPct: Math.round(maxDrawdown * 1000) / 10,
    currentPrice: latest.medianPrice,
    currentRecoveryPct,
    isNewHigh,
    peakTradeCount: finalPeakTradeCount,
    troughTradeCount: finalTroughTradeCount,
    isLowSample,
  };
}

/**
 * Multi-complex comparison calculation (Normalized 100 series & metrics matrix)
 */
export function calculateMultiComplexComparison(
  selectedComplexes: ComplexInfo[],
  tradesMap: Record<string, TradeRecord[]>,
  areaFilter: AreaCategory,
  startDate: string,
  endDate: string,
  excludeCancelled: boolean,
  excludeOutliers: boolean
): {
  normalizedSeries: NormalizedSeriesPoint[];
  stats: ComplexComparisonStats[];
} {
  const startYmd = startDate.replace(/[^0-9]/g, '').slice(0, 6);
  const endYmd = endDate.replace(/[^0-9]/g, '').slice(0, 6);

  // 1. Strict Area Capability Filtering:
  // Only compare complexes that actually support the requested area.
  // Unsupported complexes are strictly excluded and never ranked with 0 KRW or NO_DATA.
  const capableComplexes = selectedComplexes.filter((complex) => {
    if (areaFilter === '59') return complex.areaCapabilities ? complex.areaCapabilities.has59 : true;
    if (areaFilter === '84') return complex.areaCapabilities ? complex.areaCapabilities.has84 : true;
    return true;
  });

  const complexAggregates: Record<string, MonthlyAggregate[]> = {};
  const complexTradeTotals: Record<string, number> = {};

  capableComplexes.forEach((complex) => {
    const id = complex.id;
    let trades = tradesMap[id] || [];

    // Filter by area (59 or 84 strictly with complex exception check)
    trades = trades.filter((t) => (t.areaCategory || getAreaCategory(t.exclusiveArea, id)) === areaFilter);
    // Filter cancelled trades
    if (excludeCancelled) {
      trades = trades.filter((t) => !t.isCancelled);
    }
    // Filter direct deal / outliers
    if (excludeOutliers) {
      trades = trades.filter((t) => !t.isOutlier && t.dealType !== '직거래');
    }

    trades = trades.filter((t) => t.dealYmd >= startYmd && t.dealYmd <= endYmd);
    complexTradeTotals[id] = trades.length;

    const aggs = aggregateTradesByMonth(trades);
    complexAggregates[id] = aggs;
  });

  // Find all unique months across all capable complexes
  const allDatesSet = new Set<string>();
  Object.values(complexAggregates).forEach((aggs) => {
    aggs.forEach((a) => allDatesSet.add(a.dealYmd));
  });

  const sortedDates = Array.from(allDatesSet).sort();

  // Find baseline price for each complex (first available month in range)
  const basePrices: Record<string, number> = {};
  capableComplexes.forEach((complex) => {
    const id = complex.id;
    const aggs = complexAggregates[id];
    if (aggs && aggs.length > 0) {
      basePrices[id] = aggs[0].medianPrice;
    }
  });

  // Build normalized 100 time-series
  const normalizedSeries: NormalizedSeriesPoint[] = sortedDates.map((dealYmd) => {
    const year = parseInt(dealYmd.slice(0, 4), 10);
    const month = parseInt(dealYmd.slice(4, 6), 10);
    const displayDate = `${year}.${month < 10 ? '0' + month : month}`;

    const point: NormalizedSeriesPoint = {
      date: dealYmd,
      displayDate,
    };

    capableComplexes.forEach((complex) => {
      const id = complex.id;
      const aggs = complexAggregates[id];
      const match = aggs?.find((a) => a.dealYmd === dealYmd);
      const base = basePrices[id];

      if (match && base && base > 0) {
        point[id] = Math.round((match.medianPrice / base) * 1000) / 10;
      }
    });

    return point;
  });

  // Build comparison statistics matrix
  const stats: ComplexComparisonStats[] = capableComplexes.map((complex) => {
    const id = complex.id;
    const aggs = complexAggregates[id] || [];
    const totalTrades = complexTradeTotals[id] || 0;

    if (aggs.length === 0 || totalTrades === 0) {
      return {
        complex,
        latestMedian: 0,
        pricePerPyeong: 0,
        pricePerSqm: 0,
        cagr: 0,
        mdd: 0,
        recoveryPct: 0,
        baselineReturnPct: 0,
        totalTrades: 0,
        peakPrice: 0,
        peakDate: '-',
        hasData: false,
        noDataReason: `선택 평형(전용 ${areaFilter}㎡) 거래 없음`,
      };
    }

    const latest = aggs[aggs.length - 1];
    const first = aggs[0];
    const mddRes = calculateMDD(aggs);
    const startYearFraction = first.year + (first.month - 1) / 12;
    const endYearFraction = latest.year + (latest.month - 1) / 12;
    const years = Math.max(0.083, endYearFraction - startYearFraction);
    const cagr = calculateCAGR(first.medianPrice, latest.medianPrice, years);
    const baselineReturnPct =
      first.medianPrice > 0
        ? Math.round(((latest.medianPrice - first.medianPrice) / first.medianPrice) * 1000) / 10
        : 0;

    return {
      complex,
      latestMedian: latest.medianPrice,
      pricePerPyeong: latest.medianPricePerPyeong,
      pricePerSqm: latest.medianPricePerSqm,
      cagr,
      mdd: mddRes.mddPct,
      recoveryPct: mddRes.currentRecoveryPct,
      baselineReturnPct,
      totalTrades,
      peakPrice: mddRes.peakPrice,
      peakDate: mddRes.peakDate,
      hasData: true,
    };
  });

  return { normalizedSeries, stats };
}

/**
 * Aggregate trades across complexes in a region to form a regional monthly price series
 */
export function aggregateRegionMonthlyPrices(
  regionName: string,
  complexes: ComplexInfo[],
  tradesMap: Record<string, TradeRecord[]>,
  areaFilter: AreaCategory
): RegionMonthlyPrice[] {
  const allRegionTrades: TradeRecord[] = [];
  const activeComplexIds = new Set<string>();

  complexes.forEach((c) => {
    // Check area capability
    if (areaFilter === '59' && c.areaCapabilities && !c.areaCapabilities.has59) return;
    if (areaFilter === '84' && c.areaCapabilities && !c.areaCapabilities.has84) return;

    let trades = tradesMap[c.id] || [];
    trades = trades.filter((t) => (t.areaCategory || getAreaCategory(t.exclusiveArea, c.id)) === areaFilter);
    if (trades.length > 0) {
      activeComplexIds.add(c.id);
      allRegionTrades.push(...trades);
    }
  });

  if (allRegionTrades.length === 0) return [];

  const grouped: Record<string, TradeRecord[]> = {};
  allRegionTrades.forEach((t) => {
    if (!grouped[t.dealYmd]) grouped[t.dealYmd] = [];
    grouped[t.dealYmd].push(t);
  });

  const sortedYmds = Object.keys(grouped).sort();

  return sortedYmds.map((dealYmd) => {
    const monthTrades = grouped[dealYmd];
    const prices = monthTrades.map((t) => t.price).filter((p) => p > 0);
    const sqmPrices = monthTrades.map((t) => t.pricePerSqm).filter((p) => p > 0);
    const year = parseInt(dealYmd.slice(0, 4), 10);
    const month = parseInt(dealYmd.slice(4, 6), 10);
    const displayDate = `${year}.${month < 10 ? '0' + month : month}`;

    const medianPrice = Math.round(calculateMedian(prices));
    const averagePrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
    const medianPricePerSqm = Math.round(calculateMedian(sqmPrices) * 10) / 10;
    const averagePricePerSqm =
      sqmPrices.length > 0 ? Math.round((sqmPrices.reduce((a, b) => a + b, 0) / sqmPrices.length) * 10) / 10 : 0;

    let confidence: DataReliability = 'LOW';
    if (monthTrades.length >= 20) confidence = 'HIGH';
    else if (monthTrades.length >= 5) confidence = 'MEDIUM';
    else if (monthTrades.length >= 1) confidence = 'LOW';
    else confidence = 'NO_DATA';

    return {
      region: regionName,
      dealYmd,
      displayDate,
      complexCount: activeComplexIds.size,
      transactionCount: monthTrades.length,
      medianPrice,
      medianPricePerSqm,
      averagePrice,
      averagePricePerSqm,
      confidence,
    };
  });
}

/**
 * Calculate comprehensive deep price metrics for single complex analysis
 */
export function calculateDetailedPriceMetrics(
  monthlyAggs: MonthlyAggregate[],
  areaCategory: AreaCategory,
  userPeriod?: {
    startMonth?: string;
    endMonth?: string;
    startYmd?: string;
    endYmd?: string;
    presetId?: '1Y' | '3Y' | '5Y' | '10Y' | 'ALL' | 'CUSTOM';
  }
): DetailedPriceMetrics {
  const allValidAggs = (monthlyAggs || []).filter((m) => m.hasData && m.medianPrice > 0);
  let validAggs = [...allValidAggs];

  // If user period is provided, strictly constrain to user's selected period
  if (userPeriod?.startYmd) {
    validAggs = validAggs.filter((m) => m.dealYmd >= userPeriod.startYmd!);
  }
  if (userPeriod?.endYmd) {
    validAggs = validAggs.filter((m) => m.dealYmd <= userPeriod.endYmd!);
  }

  const isAllPeriod = userPeriod?.presetId === 'ALL' || (userPeriod?.startYmd ? userPeriod.startYmd <= '200601' : false);

  if (allValidAggs.length === 0) {
    return {
      latestMedianPrice: 0,
      latestMedianDate: '-',
      latestTransactionCount: 0,
      latestConfidence: 'NO_DATA',
      latestConfidenceLabel: '거래 없음',
      pricePerPyeong: 0,
      pricePerSqm: 0,
      oneYearReturnPct: null,
      athPrice: 0,
      athDate: '-',
      drawdownFromAthPct: 0,
      isNewAth: false,
      periodPeakPrice: 0,
      periodPeakDate: '-',
      periodDrawdownPct: 0,
      isNewPeriodPeak: false,
      isAllPeriod,
      userPeriodStart: userPeriod?.startMonth,
      userPeriodEnd: userPeriod?.endMonth,
      mddPct: 0,
      mddPeakDate: '-',
      mddPeakPrice: 0,
      mddTroughDate: '-',
      mddTroughPrice: 0,
      mddPeakTradeCount: 0,
      mddTroughTradeCount: 0,
      mddIsLowSample: false,
      allTimeMddPct: 0,
      allTimeMddPeakDate: '-',
      allTimeMddPeakPrice: 0,
      allTimeMddTroughDate: '-',
      allTimeMddTroughPrice: 0,
      allTimeMddPeakTradeCount: 0,
      allTimeMddTroughTradeCount: 0,
      allTimeMddIsLowSample: false,
      cagrPct: null,
      periodReturns: [
        { label: '1년', periodKey: '1Y', returnPct: null, cagrPct: null, status: 'NO_DATA' },
        { label: '3년', periodKey: '3Y', returnPct: null, cagrPct: null, status: 'NO_DATA' },
        { label: '5년', periodKey: '5Y', returnPct: null, cagrPct: null, status: 'NO_DATA' },
        { label: '10년', periodKey: '10Y', returnPct: null, cagrPct: null, status: 'NO_DATA' },
        { label: '15년', periodKey: '15Y', returnPct: null, cagrPct: null, status: 'NO_DATA' },
        { label: '20년', periodKey: '20Y', returnPct: null, cagrPct: null, status: 'NO_DATA' },
        { label: '전체 기간', periodKey: 'ALL', returnPct: null, cagrPct: null, status: 'NO_DATA' },
      ],
      minPrice: 0,
      minPriceDate: '-',
      maxPrice: 0,
      maxPriceDate: '-',
      hasData: false,
    };
  }

  // If validAggs is empty due to strict filter, fallback to allValidAggs
  if (validAggs.length === 0) {
    validAggs = [...allValidAggs];
  }

  const latestAgg = validAggs[validAggs.length - 1];
  const firstAgg = validAggs[0];

  let latestConfidenceLabel = '거래 보통';
  if (latestAgg.transactionCount >= 10) latestConfidenceLabel = '거래 충분';
  else if (latestAgg.transactionCount >= 3) latestConfidenceLabel = '거래 보통';
  else if (latestAgg.transactionCount >= 1) latestConfidenceLabel = '거래 적음';
  else latestConfidenceLabel = '거래 없음';

  // 1. Period Peak Price (Period High)
  let periodPeakPrice = 0;
  let periodPeakDate = '-';
  validAggs.forEach((agg) => {
    if (agg.medianPrice > periodPeakPrice) {
      periodPeakPrice = agg.medianPrice;
      periodPeakDate = agg.displayDate;
    }
  });

  const periodDrawdownPct =
    periodPeakPrice > 0 && latestAgg.medianPrice < periodPeakPrice
      ? Math.round(((latestAgg.medianPrice - periodPeakPrice) / periodPeakPrice) * 1000) / 10
      : 0;
  const isNewPeriodPeak = latestAgg.medianPrice >= periodPeakPrice * 0.995;

  // 2. MDD strictly across the observed monthly representative prices in selected period
  const mddRes = calculateMDD(validAggs);
  // All-time MDD across all valid historical monthly representative prices
  const allTimeMddRes = calculateMDD(allValidAggs);

  // 3. Min / Max prices in time-series
  let minPrice = Infinity;
  let minPriceDate = '-';
  let maxPrice = 0;
  let maxPriceDate = '-';
  validAggs.forEach((agg) => {
    if (agg.medianPrice < minPrice) {
      minPrice = agg.medianPrice;
      minPriceDate = agg.displayDate;
    }
    if (agg.medianPrice > maxPrice) {
      maxPrice = agg.medianPrice;
      maxPriceDate = agg.displayDate;
    }
  });
  if (minPrice === Infinity) minPrice = 0;

  // 4. CAGR calculated strictly using first observed month and latest observed month in selected period
  // No price synthesis, no interpolation, no carry-forward
  let cagrPct: number | null = null;
  let cagrStartPeriod: string | undefined;
  let cagrEndPeriod: string | undefined;

  if (validAggs.length >= 2 && firstAgg !== latestAgg) {
    const startYearFrac = firstAgg.year + (firstAgg.month - 1) / 12;
    const endYearFrac = latestAgg.year + (latestAgg.month - 1) / 12;
    const totalYears = Math.max(0.083, endYearFrac - startYearFrac);
    cagrPct = calculateCAGR(firstAgg.medianPrice, latestAgg.medianPrice, totalYears);
    cagrStartPeriod = firstAgg.displayDate;
    cagrEndPeriod = latestAgg.displayDate;
  }

  // 5. Multi-Period Returns (1Y, 3Y, 5Y, 10Y, 15Y, 20Y, ALL)
  // Calculated from the latest available month in the dataset ("현재월" 기준)
  // and ALL period calculated from the earliest available month in the dataset ("데이터가 있는 최초월" 기준)
  const refAgg = allValidAggs[allValidAggs.length - 1]; // 현재월 기준 (가장 최근 유효월)
  const earliestHistoricalAgg = allValidAggs[0]; // 데이터가 있는 최초월
  const refMonthIndex = refAgg.year * 12 + refAgg.month;
  const earliestMonthIndex = earliestHistoricalAgg.year * 12 + earliestHistoricalAgg.month;
  const datasetTotalMonths = refMonthIndex - earliestMonthIndex;

  const checkPeriodReturn = (
    periodYears: number,
    label: string,
    key: '1Y' | '3Y' | '5Y' | '10Y' | '15Y' | '20Y'
  ): PeriodReturnItem => {
    const requiredMonths = periodYears * 12;
    // Check if total history from earliest data point is substantially shorter than requested period (tolerance 2 months)
    if (datasetTotalMonths < requiredMonths - 2) {
      return {
        label,
        periodKey: key,
        returnPct: null,
        cagrPct: null,
        status: 'INSUFFICIENT_DATA',
      };
    }

    // Target month is current month minus periodYears * 12
    const targetMonthIndex = refMonthIndex - requiredMonths;
    let closestAgg: MonthlyAggregate | null = null;
    let minDiff = Infinity;

    allValidAggs.forEach((agg) => {
      const aggMonthIndex = agg.year * 12 + agg.month;
      const diffFromTarget = Math.abs(aggMonthIndex - targetMonthIndex);
      // Allow match within ±3 months of target
      if (diffFromTarget <= 3 && diffFromTarget < minDiff) {
        minDiff = diffFromTarget;
        closestAgg = agg;
      }
    });

    if (closestAgg && (closestAgg as MonthlyAggregate).medianPrice > 0 && closestAgg !== refAgg) {
      const startPrice = (closestAgg as MonthlyAggregate).medianPrice;
      const endPrice = refAgg.medianPrice;
      const ret = ((endPrice - startPrice) / startPrice) * 100;

      const actualMonths = refMonthIndex - ((closestAgg as MonthlyAggregate).year * 12 + (closestAgg as MonthlyAggregate).month);
      const actualYears = Math.max(0.083, actualMonths / 12);
      const cagr = calculateCAGR(startPrice, endPrice, actualYears);

      return {
        label,
        periodKey: key,
        returnPct: Math.round(ret * 10) / 10,
        cagrPct: cagr,
        status: 'VALID',
        startPeriod: (closestAgg as MonthlyAggregate).displayDate,
        endPeriod: refAgg.displayDate,
        startPrice,
        endPrice,
        years: Math.round(actualYears * 10) / 10,
      };
    }

    return {
      label,
      periodKey: key,
      returnPct: null,
      cagrPct: null,
      status: 'INSUFFICIENT_DATA',
    };
  };

  const p1Y = checkPeriodReturn(1, '1년', '1Y');
  const p3Y = checkPeriodReturn(3, '3년', '3Y');
  const p5Y = checkPeriodReturn(5, '5년', '5Y');
  const p10Y = checkPeriodReturn(10, '10년', '10Y');
  const p15Y = checkPeriodReturn(15, '15년', '15Y');
  const p20Y = checkPeriodReturn(20, '20년', '20Y');

  // 'ALL' (전체 기간 - 데이터가 있는 최초월 기준)
  const allMonths = Math.max(1, refMonthIndex - earliestMonthIndex);
  const allYears = Math.max(0.083, allMonths / 12);
  const sinceInceptionReturnPct =
    earliestHistoricalAgg.medianPrice > 0
      ? Math.round(((refAgg.medianPrice - earliestHistoricalAgg.medianPrice) / earliestHistoricalAgg.medianPrice) * 1000) / 10
      : 0;
  const allCagrPct = calculateCAGR(earliestHistoricalAgg.medianPrice, refAgg.medianPrice, allYears);

  const pAll: PeriodReturnItem = {
    label: '전체 기간',
    periodKey: 'ALL',
    returnPct: sinceInceptionReturnPct,
    cagrPct: allCagrPct,
    status: 'VALID',
    startPeriod: earliestHistoricalAgg.displayDate,
    endPeriod: refAgg.displayDate,
    startPrice: earliestHistoricalAgg.medianPrice,
    endPrice: refAgg.medianPrice,
    years: Math.round(allYears * 10) / 10,
  };

  return {
    latestMedianPrice: latestAgg.medianPrice,
    latestMedianDate: latestAgg.displayDate,
    latestTransactionCount: latestAgg.transactionCount,
    latestConfidence: latestAgg.confidence,
    latestConfidenceLabel,
    pricePerPyeong: latestAgg.medianPricePerPyeong,
    pricePerSqm: latestAgg.medianPricePerSqm,
    oneYearReturnPct: p1Y.status === 'VALID' ? p1Y.returnPct : null,
    athPrice: periodPeakPrice,
    athDate: periodPeakDate,
    drawdownFromAthPct: periodDrawdownPct,
    isNewAth: isNewPeriodPeak,
    periodPeakPrice,
    periodPeakDate,
    periodDrawdownPct,
    isNewPeriodPeak,
    isAllPeriod,
    userPeriodStart: userPeriod?.startMonth,
    userPeriodEnd: userPeriod?.endMonth,
    mddPct: mddRes.mddPct,
    mddPeakDate: mddRes.peakDate,
    mddPeakPrice: mddRes.peakPrice,
    mddTroughDate: mddRes.troughDate,
    mddTroughPrice: mddRes.troughPrice,
    mddPeakTradeCount: mddRes.peakTradeCount,
    mddTroughTradeCount: mddRes.troughTradeCount,
    mddIsLowSample: mddRes.isLowSample,
    allTimeMddPct: allTimeMddRes.mddPct,
    allTimeMddPeakDate: allTimeMddRes.peakDate,
    allTimeMddPeakPrice: allTimeMddRes.peakPrice,
    allTimeMddTroughDate: allTimeMddRes.troughDate,
    allTimeMddTroughPrice: allTimeMddRes.troughPrice,
    allTimeMddPeakTradeCount: allTimeMddRes.peakTradeCount,
    allTimeMddTroughTradeCount: allTimeMddRes.troughTradeCount,
    allTimeMddIsLowSample: allTimeMddRes.isLowSample,
    cagrPct,
    cagrStartPeriod,
    cagrEndPeriod,
    periodReturns: [p1Y, p3Y, p5Y, p10Y, p15Y, p20Y, pAll],
    minPrice,
    minPriceDate,
    maxPrice,
    maxPriceDate,
    earliestDate: earliestHistoricalAgg.displayDate,
    earliestPrice: earliestHistoricalAgg.medianPrice,
    hasData: true,
  };
}

