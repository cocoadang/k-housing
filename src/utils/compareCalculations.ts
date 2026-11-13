import {
  CompareMode,
  ComparePeriod,
  CompareTargetResult,
  CompareSeriesPoint,
  CompareTargetMetrics,
  CompareCalculationResult,
  UnifiedCompareChartPoint,
  ResolvedCompareTarget,
  AreaFamilyMonthlyPoint,
} from '../types';
import { calculateCAGR } from './calculations';
import { LoadedCompareSeriesResult } from '../services/compareDataService';

export interface CompareCalculationOptions {
  mode?: CompareMode;
  period?: ComparePeriod;
  customStartYmd?: string;
  customEndYmd?: string;
}

/**
 * Determine effective date bounds [startYmd, endYmd] based on period and series dates
 */
export function resolveEffectivePeriod(
  period: ComparePeriod,
  allDates: string[],
  customStart?: string,
  customEnd?: string
): { startYmd: string; endYmd: string } {
  if (period === 'CUSTOM') {
    return {
      startYmd: customStart?.replace(/[^0-9]/g, '').slice(0, 6) || '000000',
      endYmd: customEnd?.replace(/[^0-9]/g, '').slice(0, 6) || '999999',
    };
  }

  if (period === 'ALL' || allDates.length === 0) {
    return { startYmd: '000000', endYmd: '999999' };
  }

  // Find latest observed date across all target series
  const sortedDates = [...allDates].sort();
  const maxDate = sortedDates[sortedDates.length - 1]; // e.g. "202602"
  const maxYear = parseInt(maxDate.slice(0, 4), 10);
  const maxMonth = maxDate.slice(4, 6);

  let startYear = maxYear;
  switch (period) {
    case '1Y':
      startYear = maxYear - 1;
      break;
    case '3Y':
      startYear = maxYear - 3;
      break;
    case '5Y':
      startYear = maxYear - 5;
      break;
    case '10Y':
      startYear = maxYear - 10;
      break;
    default:
      startYear = maxYear - 3;
  }

  const startYmd = `${startYear}${maxMonth}`;
  return { startYmd, endYmd: maxDate };
}

/**
 * Compute independent financial metrics for a single target's observed series
 */
export function calculateTargetMetrics(
  series: AreaFamilyMonthlyPoint[]
): CompareTargetMetrics | null {
  if (!series || series.length === 0) return null;

  const validSeries = series
    .filter((pt) => pt.medianPrice > 0 && pt.tradeCount > 0)
    .sort((a, b) => a.dealYmd.localeCompare(b.dealYmd));

  if (validSeries.length === 0) return null;

  const firstPt = validSeries[0];
  const lastPt = validSeries[validSeries.length - 1];

  const firstObservedPrice = firstPt.medianPrice;
  const firstObservedDate = firstPt.displayDate;
  const lastObservedPrice = lastPt.medianPrice;
  const lastObservedDate = lastPt.displayDate;

  // Return %: (last / first - 1) * 100
  const returnPct =
    firstObservedPrice > 0
      ? Math.round(
          ((lastObservedPrice - firstObservedPrice) / firstObservedPrice) * 1000
        ) / 10
      : 0;

  // CAGR %: using fractional year interval between first and last observation
  const startFraction = firstPt.year + (firstPt.month - 1) / 12;
  const endFraction = lastPt.year + (lastPt.month - 1) / 12;
  const years = endFraction - startFraction;
  const cagrPct =
    years >= 0.083 && firstObservedPrice > 0
      ? calculateCAGR(firstObservedPrice, lastObservedPrice, years)
      : null;

  // Maximum Drawdown (MDD) & All-Time-High (ATH)
  let peakPrice = 0;
  let peakDate = '';
  let peakTradeCount = 0;
  let maxDrawdown = 0;
  let mddPeakPrice = 0;
  let mddPeakDate = '';
  let mddPeakTradeCount = 0;
  let mddTroughPrice = 0;
  let mddTroughDate = '';
  let mddTroughTradeCount = 0;
  let athPrice = 0;
  let athDate = '';
  let totalTrades = 0;

  for (const pt of validSeries) {
    totalTrades += pt.tradeCount;

    if (pt.medianPrice > athPrice) {
      athPrice = pt.medianPrice;
      athDate = pt.displayDate;
    }

    if (pt.medianPrice > peakPrice) {
      peakPrice = pt.medianPrice;
      peakDate = pt.displayDate;
      peakTradeCount = pt.tradeCount;
    }

    if (peakPrice > 0) {
      const dd = (pt.medianPrice - peakPrice) / peakPrice;
      if (dd < maxDrawdown) {
        maxDrawdown = dd;
        mddPeakPrice = peakPrice;
        mddPeakDate = peakDate;
        mddPeakTradeCount = peakTradeCount;
        mddTroughPrice = pt.medianPrice;
        mddTroughDate = pt.displayDate;
        mddTroughTradeCount = pt.tradeCount;
      }
    }
  }

  const mddPct = Math.round(maxDrawdown * 1000) / 10;
  const mddIsLowSample =
    maxDrawdown < 0 && (mddPeakTradeCount === 1 || mddTroughTradeCount === 1);

  return {
    firstObservedPrice,
    firstObservedDate,
    lastObservedPrice,
    lastObservedDate,
    returnPct,
    cagrPct,
    mddPct,
    mddPeakPrice,
    mddPeakDate,
    mddTroughPrice,
    mddTroughDate,
    mddPeakTradeCount,
    mddTroughTradeCount,
    mddIsLowSample,
    athPrice,
    athDate,
    totalTrades,
    observedMonthsCount: validSeries.length,
  };
}

/**
 * Pure function: Calculate Multi-Complex AreaFamily Comparison
 */
export function calculateCompare(
  loadedTargets: LoadedCompareSeriesResult[],
  options: CompareCalculationOptions = {}
): CompareCalculationResult {
  const mode: CompareMode = options.mode || 'ABSOLUTE_PRICE';
  const period: ComparePeriod = options.period || 'ALL';

  // 1. Collect all dealYmd across all target series to resolve date bounds
  const allDates: string[] = [];
  for (const t of loadedTargets) {
    for (const pt of t.series) {
      allDates.push(pt.dealYmd);
    }
  }

  const { startYmd, endYmd } = resolveEffectivePeriod(
    period,
    allDates,
    options.customStartYmd,
    options.customEndYmd
  );

  // 2. Filter and validate each target series within the effective date range
  interface ProcessedTarget {
    target: ResolvedCompareTarget;
    rawFilteredSeries: AreaFamilyMonthlyPoint[];
    metrics: CompareTargetMetrics | null;
    status: LoadedCompareSeriesResult['status'];
    errorCode?: string;
    errorMessage?: string;
  }

  const processedTargets: ProcessedTarget[] = [];

  for (const loaded of loadedTargets) {
    const { target, series, status, errorCode, errorMessage } = loaded;

    if (status !== 'SUCCESS' || !series || series.length === 0) {
      processedTargets.push({
        target,
        rawFilteredSeries: [],
        metrics: null,
        status: status || 'NO_MONTHLY_DATA',
        errorCode: errorCode || 'NO_MONTHLY_DATA',
        errorMessage: errorMessage || 'No monthly price data available',
      });
      continue;
    }

    // Sort strictly chronological ASC
    const sorted = [...series].sort((a, b) => a.dealYmd.localeCompare(b.dealYmd));

    // Duplicate month check (Integrity Guard)
    const seenYmd = new Set<string>();
    let hasDuplicate = false;
    for (const pt of sorted) {
      if (seenYmd.has(pt.dealYmd)) {
        hasDuplicate = true;
        break;
      }
      seenYmd.add(pt.dealYmd);
    }

    if (hasDuplicate) {
      processedTargets.push({
        target,
        rawFilteredSeries: [],
        metrics: null,
        status: 'V2_READ_FAILED',
        errorCode: 'DUPLICATE_MONTH_INTEGRITY_ERROR',
        errorMessage: `Duplicate dealYmd detected in series for ${target.targetKey}`,
      });
      continue;
    }

    // Filter within effective period
    const filtered = sorted.filter(
      (pt) =>
        pt.dealYmd >= startYmd &&
        pt.dealYmd <= endYmd &&
        pt.medianPrice > 0 &&
        pt.tradeCount > 0
    );

    if (filtered.length === 0) {
      processedTargets.push({
        target,
        rawFilteredSeries: [],
        metrics: null,
        status: 'NO_MONTHLY_DATA',
        errorCode: 'NO_MONTHLY_DATA',
        errorMessage: 'No trades observed in selected period',
      });
      continue;
    }

    // Calculate independent metrics
    const metrics = calculateTargetMetrics(filtered);

    processedTargets.push({
      target,
      rawFilteredSeries: filtered,
      metrics,
      status: 'SUCCESS',
    });
  }

  // 3. Mode-specific series construction
  let commonBaseYmd: string | null = null;
  let commonObservedMonths: string[] = [];
  let base100Status: CompareCalculationResult['base100Status'] = 'NOT_APPLICABLE';

  const finalTargetResults: CompareTargetResult[] = [];

  if (mode === 'BASE_100') {
    // Collect candidate targets (targets that should have monthly data)
    const candidateTargets = processedTargets.filter(
      (p) => p.target.hasMonthlyData !== false
    );

    // If any candidate target has no data in this period, or if no candidates exist,
    // then there is no common observed base month across all targets
    const anyCandidateEmpty =
      candidateTargets.length === 0 ||
      candidateTargets.some(
        (p) => p.status !== 'SUCCESS' || p.rawFilteredSeries.length === 0
      );

    if (anyCandidateEmpty) {
      base100Status = 'NO_COMMON_BASE_MONTH';
    } else {
      // Find intersection of observed months across all candidate targets
      const sets = candidateTargets.map(
        (t) => new Set(t.rawFilteredSeries.map((pt) => pt.dealYmd))
      );

      // Start with first target's months and retain only those present in all other targets
      const commonSet: string[] = Array.from(sets[0]).filter((ymd) =>
        sets.every((s) => s.has(ymd))
      );

      commonObservedMonths = commonSet.sort();

      if (commonObservedMonths.length === 0) {
        base100Status = 'NO_COMMON_BASE_MONTH';
      } else {
        base100Status = 'SUCCESS';
        commonBaseYmd = commonObservedMonths[0]; // Earliest common observed month in range
      }
    }

    // Build BASE_100 series for each target
    for (const p of processedTargets) {
      if (p.status !== 'SUCCESS') {
        finalTargetResults.push({
          target: p.target,
          status: p.status,
          errorCode: p.errorCode,
          errorMessage: p.errorMessage,
          series: [],
          metrics: p.metrics,
        });
        continue;
      }

      if (base100Status === 'NO_COMMON_BASE_MONTH' || !commonBaseYmd) {
        finalTargetResults.push({
          target: p.target,
          status: 'BASE100_NO_COMMON_BASE_MONTH',
          errorCode: 'BASE100_NO_COMMON_BASE_MONTH',
          errorMessage: 'No common observed month found across all compare targets in this period',
          series: [],
          metrics: p.metrics,
        });
        continue;
      }

      // Base point for this target
      const basePoint = p.rawFilteredSeries.find(
        (pt) => pt.dealYmd === commonBaseYmd
      );

      if (!basePoint || basePoint.medianPrice <= 0) {
        finalTargetResults.push({
          target: p.target,
          status: 'BASE100_NO_COMMON_BASE_MONTH',
          errorCode: 'BASE100_NO_COMMON_BASE_MONTH',
          errorMessage: `Target missing valid base price at common month ${commonBaseYmd}`,
          series: [],
          metrics: p.metrics,
        });
        continue;
      }

      const basePrice = basePoint.medianPrice;
      const baseDate = basePoint.displayDate;

      // Filter series from commonBaseYmd onward (starts at common base month)
      const baseSeriesPoints: CompareSeriesPoint[] = p.rawFilteredSeries
        .filter((pt) => pt.dealYmd >= commonBaseYmd!)
        .map((pt) => {
          const indexValue =
            pt.dealYmd === commonBaseYmd
              ? 100.0
              : (pt.medianPrice / basePrice) * 100;

          return {
            dealYmd: pt.dealYmd,
            displayDate: pt.displayDate,
            value: indexValue,
            medianPrice: pt.medianPrice,
            medianPricePerSqm: pt.medianPricePerSqm,
            tradeCount: pt.tradeCount,
            baseValue: 100,
          };
        });

      finalTargetResults.push({
        target: p.target,
        status: 'SUCCESS',
        series: baseSeriesPoints,
        metrics: p.metrics,
        basePrice,
        baseDate,
      });
    }
  } else if (mode === 'PRICE_PER_PYEONG') {
    // Mode: 평당가 = 거래가격 ÷ (공급면적㎡ / 3.305785)
    // 공급면적 데이터가 없는 AreaFamily는 엄격히 DATA_NOT_AVAILABLE 처리
    for (const p of processedTargets) {
      if (p.status !== 'SUCCESS') {
        finalTargetResults.push({
          target: p.target,
          status: p.status,
          errorCode: p.errorCode,
          errorMessage: p.errorMessage,
          series: [],
          metrics: p.metrics,
        });
        continue;
      }

      const supplyArea = p.target.representativeSupplyArea;
      if (!supplyArea || supplyArea <= 0) {
        finalTargetResults.push({
          target: p.target,
          status: 'DATA_NOT_AVAILABLE',
          errorCode: 'DATA_NOT_AVAILABLE',
          errorMessage: '공급면적 데이터 부재로 평당가 산출 불가 (DATA_NOT_AVAILABLE)',
          series: [],
          metrics: p.metrics,
        });
        continue;
      }

      const supplyPyeong = supplyArea / 3.305785;
      const compareSeriesPoints: CompareSeriesPoint[] = p.rawFilteredSeries.map(
        (pt) => ({
          dealYmd: pt.dealYmd,
          displayDate: pt.displayDate,
          value: Math.round(pt.medianPrice / supplyPyeong),
          medianPrice: pt.medianPrice,
          medianPricePerSqm: pt.medianPricePerSqm,
          tradeCount: pt.tradeCount,
        })
      );

      finalTargetResults.push({
        target: p.target,
        status: 'SUCCESS',
        series: compareSeriesPoints,
        metrics: p.metrics,
      });
    }
  } else {
    // ABSOLUTE_PRICE or PRICE_PER_SQM
    for (const p of processedTargets) {
      if (p.status !== 'SUCCESS') {
        finalTargetResults.push({
          target: p.target,
          status: p.status,
          errorCode: p.errorCode,
          errorMessage: p.errorMessage,
          series: [],
          metrics: p.metrics,
        });
        continue;
      }

      const compareSeriesPoints: CompareSeriesPoint[] = p.rawFilteredSeries.map(
        (pt) => ({
          dealYmd: pt.dealYmd,
          displayDate: pt.displayDate,
          value:
            mode === 'PRICE_PER_SQM'
              ? pt.medianPricePerSqm
              : pt.medianPrice,
          medianPrice: pt.medianPrice,
          medianPricePerSqm: pt.medianPricePerSqm,
          tradeCount: pt.tradeCount,
        })
      );

      finalTargetResults.push({
        target: p.target,
        status: 'SUCCESS',
        series: compareSeriesPoints,
        metrics: p.metrics,
      });
    }
  }

  // 4. Construct Unified Chart Points (Union of all observed months)
  // Missing values for any target are strictly set to null (connectNulls={false})
  const unionDatesSet = new Set<string>();
  for (const tr of finalTargetResults) {
    for (const pt of tr.series) {
      unionDatesSet.add(pt.dealYmd);
    }
  }

  const sortedUnionDates = Array.from(unionDatesSet).sort();
  const unifiedChartPoints: UnifiedCompareChartPoint[] = sortedUnionDates.map(
    (dealYmd) => {
      const year = dealYmd.slice(0, 4);
      const month = dealYmd.slice(4, 6);
      const displayDate = `${year}.${month}`;

      const values: Record<string, number | null> = {};

      for (const tr of finalTargetResults) {
        const match = tr.series.find((pt) => pt.dealYmd === dealYmd);
        values[tr.target.targetKey] = match ? match.value : null;
      }

      return {
        date: dealYmd,
        displayDate,
        values,
      };
    }
  );

  return {
    mode,
    period,
    startYmd,
    endYmd,
    targets: finalTargetResults,
    commonBaseYmd,
    commonObservedMonths,
    base100Status,
    unifiedChartPoints,
  };
}
