import React, { useState, useMemo, useRef } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  Bar,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { MonthlyAggregate, TradeRecord, ComplexInfo, AreaCategory, AreaFamilyMetadata, AnalysisPeriod } from '../../types';
import { formatPrice, formatPyeongPrice } from '../../utils/calculations';
import { LineChart, Pin, X } from 'lucide-react';

interface MainPriceChartProps {
  complex: ComplexInfo;
  monthlyAggs: MonthlyAggregate[];
  trades: TradeRecord[];
  selectedArea: AreaCategory;
  selectedFamily?: AreaFamilyMetadata | null;
  analysisPeriod?: AnalysisPeriod;
}

export const MainPriceChart: React.FC<MainPriceChartProps> = ({
  complex,
  monthlyAggs,
  trades,
  selectedArea,
  selectedFamily,
  analysisPeriod,
}) => {
  const [showMovingAverage, setShowMovingAverage] = useState(false);
  const [showRangeBand, setShowRangeBand] = useState(true);
  const [showScatter, setShowScatter] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [pinnedMonth, setPinnedMonth] = useState<any | null>(null);

  // Ref flag to ensure action clicks (Scatter dots / month points) are never cancelled by background click bubbling
  const isActionClickRef = useRef(false);

  // Calculate supply pyeong strictly from verified supplyAreaSqm / 3.305785
  const supplyArea = selectedFamily?.representativeSupplyArea;
  const hasSupplyArea = typeof supplyArea === 'number' && supplyArea > 0;
  const supplyPyeong = hasSupplyArea ? supplyArea / 3.305785 : null;

  // Precompute valid individual trade records grouped by monthly YMD
  // Ensuring 100% mathematical consistency between monthly range band min/max, median, and individual trades
  const tradesByMonth = useMemo(() => {
    const map = new Map<string, TradeRecord[]>();
    for (const t of trades) {
      if (t.price > 0 && !t.isCancelled) {
        const ymd = (t.dealYmd || '').replace(/[^0-9]/g, '').slice(0, 6);
        if (ymd.length === 6) {
          if (!map.has(ymd)) map.set(ymd, []);
          map.get(ymd)!.push(t);
        }
      }
    }
    // Sort records within each month chronologically by dealDay or price
    for (const [, list] of map.entries()) {
      list.sort((a, b) => {
        const dayA = a.dealDay || 1;
        const dayB = b.dealDay || 1;
        if (dayA !== dayB) return dayA - dayB;
        return a.price - b.price;
      });
    }
    return map;
  }, [trades]);

  // Compute continuous chronological monthly time-series & 6-month Moving Average
  const { chartData, allMonths, minTime, maxTime, chartTicks, maxVolume } = useMemo(() => {
    if ((!monthlyAggs || monthlyAggs.length === 0) && (!trades || trades.length === 0)) {
      return { chartData: [], allMonths: [], minTime: 0, maxTime: 0, chartTicks: [], maxVolume: 10 };
    }

    // Filter valid aggregates that have dealYmd
    const sortedAggs = (monthlyAggs || [])
      .filter((m) => m && m.dealYmd)
      .sort((a, b) => a.dealYmd.localeCompare(b.dealYmd));

    // Determine bounds strictly anchored to requested analysisPeriod and current benchmark (2026.09)
    let minYmd = sortedAggs.length > 0 ? sortedAggs[0].dealYmd : '';
    let maxYmd = sortedAggs.length > 0 ? sortedAggs[sortedAggs.length - 1].dealYmd : '';

    for (const t of trades) {
      if (t.price > 0 && !t.isCancelled && t.dealYmd) {
        const ymd = t.dealYmd.replace(/[^0-9]/g, '').slice(0, 6);
        if (ymd.length === 6) {
          if (!minYmd || ymd < minYmd) minYmd = ymd;
          if (!maxYmd || ymd > maxYmd) maxYmd = ymd;
        }
      }
    }

    if (analysisPeriod) {
      if (analysisPeriod.presetId !== 'ALL' && analysisPeriod.startYmd) {
        minYmd = analysisPeriod.startYmd;
      } else if (analysisPeriod.presetId === 'ALL') {
        const familyEarliest = selectedFamily?.firstDealYmd;
        if (familyEarliest && familyEarliest.length === 6) {
          minYmd = familyEarliest;
        } else if (sortedAggs.length > 0) {
          minYmd = sortedAggs[0].dealYmd;
        } else if (analysisPeriod.startYmd) {
          minYmd = analysisPeriod.startYmd;
        } else {
          minYmd = '200601';
        }
      }
      if (analysisPeriod.endYmd) {
        maxYmd = analysisPeriod.endYmd;
      }
    } else {
      if (!maxYmd || maxYmd < '202609') {
        maxYmd = '202609';
      }
    }

    if (!minYmd) {
      minYmd = '202109';
    }

    if (!minYmd || !maxYmd) {
      return { chartData: [], allMonths: [], minTime: 0, maxTime: 0, chartTicks: [], maxVolume: 10 };
    }

    // Generate continuous chronological monthly YMD list from minYmd to maxYmd (Oldest -> Recent)
    const monthList: string[] = [];
    let curY = parseInt(minYmd.slice(0, 4), 10);
    let curM = parseInt(minYmd.slice(4, 6), 10);
    const endY = parseInt(maxYmd.slice(0, 4), 10);
    const endM = parseInt(maxYmd.slice(4, 6), 10);

    while (curY < endY || (curY === endY && curM <= endM)) {
      const ymd = `${curY}${curM < 10 ? '0' + curM : curM}`;
      monthList.push(ymd);
      curM++;
      if (curM > 12) {
        curM = 1;
        curY++;
      }
    }

    // Map existing monthly aggregates by dealYmd (SSOT from monthlyComplexPrices_v2)
    const aggMap = new Map<string, MonthlyAggregate>();
    for (const agg of sortedAggs) {
      if (agg.hasData && agg.medianPrice > 0 && agg.transactionCount > 0) {
        aggMap.set(agg.dealYmd, agg);
      }
    }

    let calculatedMaxVolume = 1;

    const dataPoints = monthList.map((ymd, idx) => {
      const year = parseInt(ymd.slice(0, 4), 10);
      const month = parseInt(ymd.slice(4, 6), 10);
      const displayDate = `${year}.${month < 10 ? '0' + month : month}`;
      // Canonical monthly mid-point timestamp
      const time = new Date(year, month - 1, 15).getTime();

      const agg = aggMap.get(ymd);
      const monthTrades = tradesByMonth.get(ymd) || [];
      const hasMonthTrades = monthTrades.length > 0;
      const monthPrices = monthTrades.map((t) => t.price);
      const hasAggData = !!agg && agg.medianPrice > 0;
      const hasTrades = hasMonthTrades || hasAggData;

      // Real observed median price only; null if no transactions occurred
      const medianVal = hasAggData
        ? agg.medianPrice
        : hasMonthTrades
        ? monthPrices[Math.floor(monthPrices.length / 2)]
        : null;

      // 6-month trailing rolling window over actual valid monthly medians in chronological order
      // Uses ONLY real monthlyComplexPrices_v2 observation points; does NOT use visual connection or synthetic values
      const startIdx = Math.max(0, idx - 5);
      const windowYmds = monthList.slice(startIdx, idx + 1);
      const windowValidPrices = windowYmds
        .map((wYmd) => aggMap.get(wYmd)?.medianPrice)
        .filter((p): p is number => typeof p === 'number' && p > 0);

      const ma6 =
        hasTrades && windowValidPrices.length > 0
          ? Math.round(windowValidPrices.reduce((acc, curr) => acc + curr, 0) / windowValidPrices.length)
          : null;

      // Transaction count for volume
      const tradeCount = hasMonthTrades
        ? monthPrices.length
        : agg?.transactionCount || 0;

      if (tradeCount > calculatedMaxVolume) {
        calculatedMaxVolume = tradeCount;
      }

      let confidenceText = '거래 없음';
      if (tradeCount >= 10) confidenceText = '거래 충분';
      else if (tradeCount >= 3) confidenceText = '거래 보통';
      else if (tradeCount >= 1) confidenceText = '거래 적음';

      // Min and Max prices: Range band strictly only exists when real trades occurred (0 trades = null)
      let minPrice: number | null = null;
      let maxPrice: number | null = null;

      if (hasMonthTrades) {
        minPrice = Math.min(...monthPrices);
        maxPrice = Math.max(...monthPrices);
      } else if (agg && agg.minPrice && agg.maxPrice && agg.maxPrice > 0) {
        minPrice = agg.minPrice;
        maxPrice = agg.maxPrice;
      }

      const priceRange =
        minPrice != null && maxPrice != null && maxPrice > 0
          ? [minPrice, maxPrice]
          : null;

      return {
        time,
        date: ymd,
        displayDate,
        medianPrice: medianVal,
        avgPrice: hasAggData ? agg.avgPrice : null,
        minPrice,
        maxPrice,
        priceRange,
        ma6,
        volume: tradeCount,
        confidenceText,
        hasTrades,
        monthTrades,
      };
    });

    // Unified Chronological Time Domain bounds (Past -> Recent)
    const startY = parseInt(monthList[0].slice(0, 4), 10);
    const startM = parseInt(monthList[0].slice(4, 6), 10);
    const lastY = parseInt(monthList[monthList.length - 1].slice(0, 4), 10);
    const lastM = parseInt(monthList[monthList.length - 1].slice(4, 6), 10);

    // Padding proportional to period length so points never clip at edges
    const total = monthList.length;
    const paddingDays = total <= 14 ? 10 : 15;
    const domainMinTime = new Date(startY, startM - 1, 1).getTime() - paddingDays * 86400000;
    const domainMaxTime = new Date(lastY, lastM - 1, 28).getTime() + paddingDays * 86400000;

    // Generate clean periodic ticks for the chronological time axis
    let step = 1;
    if (total > 84) step = 24; // > 7 years: every 2 years
    else if (total > 48) step = 12; // 4-7 years: every 1 year
    else if (total > 24) step = 6; // 2-4 years: every 6 months
    else if (total > 14) step = 3; // 1-2 years: every 3 months
    else if (total > 8) step = 2; // ~1 year: every 2 months to prevent crowding
    else step = 1; // <= 8 months: every month

    const ticks: number[] = [];
    for (let i = 0; i < total; i += step) {
      const ymd = monthList[i];
      const y = parseInt(ymd.slice(0, 4), 10);
      const m = parseInt(ymd.slice(4, 6), 10);
      ticks.push(new Date(y, m - 1, 15).getTime());
    }

    const lastMonthTime = new Date(lastY, lastM - 1, 15).getTime();
    if (ticks.length > 0 && !ticks.includes(lastMonthTime) && lastMonthTime - ticks[ticks.length - 1] > (step * 25 * 86400000)) {
      ticks.push(lastMonthTime);
    }

    return {
      chartData: dataPoints,
      allMonths: monthList,
      minTime: domainMinTime,
      maxTime: domainMaxTime,
      chartTicks: ticks,
      maxVolume: calculatedMaxVolume,
    };
  }, [monthlyAggs, trades, tradesByMonth, analysisPeriod]);

  // Scatter points data mapped strictly onto exact chronological transaction dates
  // Perfectly aligns individual trades with their real transaction dates and price levels
  const scatterData = useMemo(() => {
    if (!trades || trades.length === 0 || allMonths.length === 0) return [];
    const validMonthSet = new Set(allMonths);
    return trades
      .filter((t) => {
        if (!t.price || t.price <= 0 || t.isCancelled) return false;
        const ym = (t.dealYmd || '').replace(/[^0-9]/g, '').slice(0, 6);
        return validMonthSet.has(ym);
      })
      .map((t) => {
        const cleanYmd = (t.dealYmd || '').replace(/[^0-9]/g, '');
        const year = parseInt(cleanYmd.slice(0, 4), 10);
        const month = parseInt(cleanYmd.slice(4, 6), 10);
        const displayDate = `${year}.${month < 10 ? '0' + month : month}`;
        let day = t.dealDay;
        if (!day && t.dealDate) {
          const parts = t.dealDate.split('-');
          if (parts.length === 3) day = parseInt(parts[2], 10);
        }
        if (!day || isNaN(day) || day < 1 || day > 31) {
          day = 15;
        }
        // Exact transaction day timestamp
        const time = new Date(year, month - 1, day, 12, 0, 0).getTime();

        return {
          time,
          displayDate,
          price: t.price,
          exclusiveArea: t.exclusiveArea,
          floor: t.floor,
          dealDate: t.dealDate || `${displayDate}.${day < 10 ? '0' + day : day}`,
          dealDay: day,
          dealType: t.dealType,
          monthYmd: cleanYmd.slice(0, 6),
        };
      })
      .sort((a, b) => a.time - b.time || a.price - b.price);
  }, [trades, allMonths]);

  // Fixed price domain computed across monthly points and valid trades within the current period
  const priceDomain = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const d of chartData) {
      if (typeof d.minPrice === 'number' && d.minPrice > 0 && d.minPrice < min) min = d.minPrice;
      if (typeof d.maxPrice === 'number' && d.maxPrice > 0 && d.maxPrice > max) max = d.maxPrice;
      if (typeof d.medianPrice === 'number' && d.medianPrice > 0 && d.medianPrice < min) min = d.medianPrice;
      if (typeof d.medianPrice === 'number' && d.medianPrice > 0 && d.medianPrice > max) max = d.medianPrice;
    }
    for (const t of scatterData) {
      if (typeof t.price === 'number' && t.price > 0) {
        if (t.price < min) min = t.price;
        if (t.price > max) max = t.price;
      }
    }
    if (!isFinite(min) || !isFinite(max)) return ['auto', 'auto'];
    const diff = max - min;
    const padding = diff > 0 ? diff * 0.08 : min * 0.05;
    return [Math.max(0, Math.floor((min - padding) / 1000) * 1000), Math.ceil((max + padding) / 1000) * 1000];
  }, [chartData, scatterData]);

  const formatYAxisPrice = (value: number) => {
    if (!value || isNaN(value)) return '';
    const eok = value / 10000;
    const formatted = Number.isInteger(eok) ? eok.toString() : eok.toFixed(1);
    return `${formatted}억`;
  };

  const renderScatterDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null || isNaN(cx) || isNaN(cy)) return null;
    const isPinned = pinnedMonth && (pinnedMonth.displayDate === payload?.displayDate || pinnedMonth.date === payload?.monthYmd);
    return (
      <g
        className="cursor-pointer"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          if (e.nativeEvent && e.nativeEvent.stopImmediatePropagation) {
            e.nativeEvent.stopImmediatePropagation();
          }
          isActionClickRef.current = true;
          const ym = payload?.monthYmd || payload?.displayDate?.replace(/[^0-9]/g, '').slice(0, 6);
          const matchedMonth = chartData.find((d) => d.date === ym || d.displayDate === payload?.displayDate);
          if (matchedMonth && matchedMonth.hasTrades) {
            setPinnedMonth(matchedMonth);
          }
        }}
      >
        {/* Invisible wider hit-target (12px radius) to prevent click misses */}
        <circle cx={cx} cy={cy} r={12} fill="transparent" />
        <circle
          cx={cx}
          cy={cy}
          r={isPinned ? 5.5 : 4}
          fill="#38bdf8"
          stroke={isPinned ? '#ffffff' : '#0369a1'}
          strokeWidth={isPinned ? 2 : 1.2}
          opacity={isPinned ? 1 : 0.85}
          className="transition-transform hover:scale-125"
        />
      </g>
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    // Resolve monthData strictly from Line, Bar, or Area payload first to prevent scatter index mismatch
    let data = payload.find(
      (p: any) => p.dataKey === 'medianPrice' || p.dataKey === 'volume' || p.dataKey === 'priceRange'
    )?.payload;

    if (!data) {
      const rawData = payload.find((p: any) => p.payload?.displayDate)?.payload;
      if (rawData) {
        data = chartData.find((d) => d.displayDate === rawData.displayDate) || rawData;
      }
    }

    if (!data) return null;

    const monthPyeongPrice =
      hasSupplyArea && supplyPyeong && data.medianPrice > 0
        ? Math.round(data.medianPrice / supplyPyeong)
        : null;
    const monthTrades: TradeRecord[] = data.monthTrades || [];

    return (
      <div className="bg-slate-900/95 border border-slate-700 p-3.5 rounded-xl shadow-2xl text-xs space-y-2.5 z-50 min-w-[250px] max-w-[320px] backdrop-blur-md pointer-events-none">
        {/* Header: Year.Month & Count */}
        <div className="font-bold text-slate-200 border-b border-slate-800 pb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-slate-100 font-semibold">{data.displayDate}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-indigo-300 font-mono font-medium">거래 {data.volume}건</span>
            {data.confidenceText && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  data.confidenceText === '거래 충분'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : data.confidenceText === '거래 보통'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    : data.confidenceText === '거래 적음'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {data.confidenceText}
              </span>
            )}
          </div>
        </div>

        {data.hasTrades ? (
          <div className="space-y-1.5 pt-0.5">
            {/* Monthly Median */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400">월별 대표가격:</span>
              <span className="font-bold text-emerald-400 text-sm font-mono">{formatPrice(data.medianPrice)}</span>
            </div>

            {/* 6M Moving Average */}
            {data.ma6 && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">6개월 이동평균:</span>
                <span className="font-medium text-amber-300 font-mono">{formatPrice(data.ma6)}</span>
              </div>
            )}

            {/* Monthly Range */}
            {data.minPrice != null && data.maxPrice != null && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">월별 거래범위:</span>
                <span className="text-indigo-300 font-mono font-medium">
                  {formatPrice(data.minPrice)} ~ {formatPrice(data.maxPrice)}
                </span>
              </div>
            )}

            {/* Price per Pyeong */}
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/80">
              <span className="text-slate-400">평단가 (공급기준):</span>
              {monthPyeongPrice !== null ? (
                <span className="font-medium text-teal-300 font-mono">
                  {formatPyeongPrice(monthPyeongPrice)}
                </span>
              ) : (
                <span className="font-mono text-slate-500 text-[10px]">공급면적 확인 불가</span>
              )}
            </div>

            {/* Individual Trades in this Month */}
            {showScatter && monthTrades.length > 0 && (
              <div className="pt-2 border-t border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-sky-300">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                    해당월 개별 실거래 ({monthTrades.length}건)
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">일자·층수 / 가격</span>
                </div>
                <div className="max-h-32 overflow-hidden space-y-1">
                  {monthTrades.slice(0, 3).map((t, idx) => {
                    const formattedDay = t.dealDate
                      ? t.dealDate.replace(/^\d{4}[.-]/, '')
                      : `${t.dealDay || 1}일`;
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-[10px] font-mono text-slate-300 bg-slate-950/60 border border-slate-800/80 px-2 py-0.5 rounded"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-sky-300/90">{formattedDay}</span>
                          <span className="text-slate-500">·</span>
                          <span className="text-slate-300">{t.floor}층</span>
                        </div>
                        <span className="font-bold text-emerald-400 font-mono">{formatPrice(t.price)}</span>
                      </div>
                    );
                  })}
                  {monthTrades.length > 3 && (
                    <div className="text-[10px] text-slate-500 text-center">
                      외 {monthTrades.length - 3}건 더보기 (클릭하여 고정)
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-slate-500 text-center py-1">해당 월 거래 내역 없음</div>
        )}

        <div className="pt-1.5 border-t border-slate-800/60 text-[10px] text-slate-400 flex items-center justify-between">
          <span>클릭하여 실거래 목록 고정</span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
      {/* Chart Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
            <LineChart className="w-4 h-4 text-emerald-400" />
            월별 대표 실거래가 및 거래량 추이
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            월별 중위 실거래가선, 거래범위 밴드, 개별 실거래 점 및 거래량
          </p>
        </div>

        {/* Display Toggles */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <button
            type="button"
            onClick={() => setShowMovingAverage(!showMovingAverage)}
            className={`px-2.5 py-1 rounded-lg font-semibold border transition-all ${
              showMovingAverage
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            6개월 이동평균
          </button>
          <button
            type="button"
            onClick={() => setShowRangeBand(!showRangeBand)}
            className={`px-2.5 py-1 rounded-lg font-semibold border transition-all ${
              showRangeBand
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            월별 거래범위
          </button>
          <button
            type="button"
            onClick={() => setShowScatter(!showScatter)}
            className={`px-2.5 py-1 rounded-lg font-semibold border transition-all inline-flex items-center gap-1 ${
              showScatter
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <span>개별 실거래</span>
          </button>
          <button
            type="button"
            onClick={() => setShowVolume(!showVolume)}
            className={`px-2.5 py-1 rounded-lg font-semibold border transition-all ${
              showVolume
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            거래량
          </button>
        </div>
      </div>

      {/* Main Canvas */}
      <div
        className="h-[320px] sm:h-[400px] w-full relative"
        onClick={(e) => {
          if (isActionClickRef.current) {
            isActionClickRef.current = false;
            return;
          }
          // Only close when clicking directly on the canvas container background outside the chart SVG
          if (e.target === e.currentTarget) {
            setPinnedMonth(null);
          }
        }}
      >
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 12, left: 0, bottom: 20 }}
              onClick={(e: any) => {
                if (isActionClickRef.current) {
                  isActionClickRef.current = false;
                  return;
                }
                if (e && e.activePayload && e.activePayload.length > 0) {
                  const data =
                    e.activePayload.find(
                      (p: any) => p.dataKey === 'medianPrice' || p.dataKey === 'volume' || p.dataKey === 'priceRange'
                    )?.payload ||
                    e.activePayload.find((p: any) => p.payload?.date)?.payload ||
                    e.activePayload.find((p: any) => p.payload?.monthYmd)?.payload ||
                    chartData.find((d) => d.displayDate === e.activePayload[0]?.payload?.displayDate);

                  let targetMonth = data;
                  if (data && (!data.monthTrades || data.monthTrades.length === 0)) {
                    const ym = data.date || data.monthYmd || data.displayDate?.replace(/[^0-9]/g, '').slice(0, 6);
                    const fullMatch = chartData.find((d) => d.date === ym || d.displayDate === data.displayDate);
                    if (fullMatch) targetMonth = fullMatch;
                  }

                  if (targetMonth && targetMonth.hasTrades) {
                    isActionClickRef.current = true;
                    setPinnedMonth(targetMonth);
                    return;
                  }
                }
                // Explicit click on clear empty chart area closes the panel
                setPinnedMonth(null);
              }}
            >
              <defs>
                {/* Area band gradient: Distinct indigo/purple hue separating clearly from emerald median line */}
                <linearGradient id="priceRangeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.12} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} vertical={false} />

              {/* Unified Continuous Chronological Time Domain (Left = Past, Right = Recent) */}
              <XAxis
                xAxisId="time"
                type="number"
                dataKey="time"
                domain={[minTime, maxTime]}
                ticks={chartTicks}
                tickFormatter={(timestamp: number) => {
                  const d = new Date(timestamp);
                  const y = d.getFullYear();
                  const m = d.getMonth() + 1;
                  return `${y}.${m < 10 ? '0' + m : m}`;
                }}
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
              />

              {/* Left Y Axis: Real Estate Price */}
              <YAxis
                yAxisId="price"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={formatYAxisPrice}
                domain={priceDomain}
                tickLine={false}
                axisLine={false}
                width={50}
              />

              {/* Sub Y Axis: Volume (Confined to bottom ~24% of chart area) */}
              {showVolume && (
                <YAxis
                  yAxisId="volume"
                  orientation="right"
                  domain={[0, Math.max(8, Math.ceil(maxVolume * 4.2))]}
                  hide={true}
                />
              )}

              <Tooltip content={<CustomTooltip />} />

              {/* Custom Legend ensuring strict requested order:
                  1. 월별 중위가 (Line)
                  2. 6개월 이동평균 (Line)
                  3. 월별 거래범위 (Area)
                  4. 개별 실거래 (Dot)
                  5. 거래량 (Bar)
              */}
              <Legend
                verticalAlign="top"
                height={36}
                content={() => (
                  <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 pb-2 text-xs text-slate-300 select-none">
                    {/* 1. 월별 중위가 (Line) */}
                    <div className="inline-flex items-center gap-1.5">
                      <span className="w-4 h-0.5 bg-emerald-400 inline-block rounded-full"></span>
                      <span className="text-slate-200 font-medium">월별 중위가</span>
                    </div>

                    {/* 2. 6개월 이동평균 (Line - dashed) */}
                    {showMovingAverage && (
                      <div className="inline-flex items-center gap-1.5">
                        <span className="w-4 h-0.5 border-t-2 border-dashed border-amber-400 inline-block"></span>
                        <span className="text-slate-300">6개월 이동평균</span>
                      </div>
                    )}

                    {/* 3. 월별 거래범위 (Area) */}
                    {showRangeBand && (
                      <div className="inline-flex items-center gap-1.5">
                        <span className="w-3.5 h-3 bg-indigo-500/35 border border-indigo-400/80 rounded-xs inline-block"></span>
                        <span className="text-slate-300">월별 거래범위</span>
                      </div>
                    )}

                    {/* 4. 개별 실거래 (Dot) */}
                    {showScatter && (
                      <div className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-sky-400/60 border border-sky-500 inline-block shadow-xs"></span>
                        <span className="text-slate-300">개별 실거래</span>
                      </div>
                    )}

                    {/* 5. 거래량 (Bar) */}
                    {showVolume && (
                      <div className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-3.5 bg-indigo-500/90 border border-indigo-400/80 rounded-xs inline-block"></span>
                        <span className="text-slate-300">거래량</span>
                      </div>
                    )}
                  </div>
                )}
              />

              {/* Volume Bar: Prominent Indigo Bar at the base (Confined to bottom 20-25%) */}
              {showVolume && (
                <Bar
                  xAxisId="time"
                  yAxisId="volume"
                  dataKey="volume"
                  name="거래량"
                  fill="#6366f1"
                  opacity={0.8}
                  barSize={Math.max(4, Math.min(14, 550 / (allMonths.length || 1)))}
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
              )}

              {/* Price Range Band: Blue/Purple Area Band, NO connectNulls (empty gaps remain completely blank) */}
              {showRangeBand && (
                <Area
                  xAxisId="time"
                  yAxisId="price"
                  type="monotone"
                  dataKey="priceRange"
                  name="월별 거래범위"
                  stroke="#818cf8"
                  strokeWidth={1.5}
                  strokeOpacity={0.75}
                  fill="url(#priceRangeGradient)"
                  fillOpacity={0.35}
                  connectNulls={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              )}

              {/* Median Price Line: Emerald Green thick line, connects across empty months visually without interpolation */}
              <Line
                xAxisId="time"
                yAxisId="price"
                type="monotone"
                dataKey="medianPrice"
                name="월별 중위가"
                stroke="#10b981"
                strokeWidth={2.8}
                dot={{ r: 3, fill: '#10b981', stroke: '#064e3b', strokeWidth: 1 }}
                activeDot={{ r: 6, fill: '#34d399', stroke: '#064e3b', strokeWidth: 2 }}
                connectNulls={true}
                isAnimationActive={false}
              />

              {/* 6-Month Moving Average: Yellow/Amber line, computed solely from real monthly observations */}
              {showMovingAverage && (
                <Line
                  xAxisId="time"
                  yAxisId="price"
                  type="monotone"
                  dataKey="ma6"
                  name="6개월 이동평균"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}

              {/* Individual Trade Scatter Points: Light Sky Blue dots at exact chronological coordinates */}
              {showScatter && scatterData.length > 0 && (
                <Scatter
                  xAxisId="time"
                  yAxisId="price"
                  dataKey="price"
                  name="개별 실거래"
                  data={scatterData}
                  fill="#38bdf8"
                  shape={renderScatterDot}
                  isAnimationActive={false}
                  onClick={(entry: any, _index: number, e?: any) => {
                    if (e && e.stopPropagation) e.stopPropagation();
                    if (e && e.nativeEvent && e.nativeEvent.stopImmediatePropagation) {
                      e.nativeEvent.stopImmediatePropagation();
                    }
                    isActionClickRef.current = true;
                    const payload = entry?.payload || entry;
                    const ym = payload?.monthYmd || payload?.displayDate?.replace(/[^0-9]/g, '').slice(0, 6);
                    const matchedMonth = chartData.find((d) => d.date === ym || d.displayDate === payload?.displayDate);
                    if (matchedMonth && matchedMonth.hasTrades) {
                      setPinnedMonth(matchedMonth);
                    }
                  }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500 text-xs sm:text-sm">
            선택한 조건의 실거래 정보가 없습니다.
          </div>
        )}

        {/* Independent React State Pinned Month Panel */}
        {pinnedMonth && (
          <div
            className="absolute top-3 right-3 z-40 w-72 sm:w-80 bg-slate-900/95 border border-sky-500/70 ring-1 ring-sky-500/30 p-3.5 rounded-xl shadow-2xl text-xs space-y-2.5 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 select-text pointer-events-auto"
            onClick={(e) => {
              e.stopPropagation();
              isActionClickRef.current = true;
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Header: Year.Month, Count, Status */}
            <div className="font-bold text-slate-200 border-b border-slate-800 pb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
                <span className="text-slate-100 font-semibold">{pinnedMonth.displayDate}</span>
                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-medium">
                  <Pin className="w-2.5 h-2.5" />
                  고정됨
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-indigo-300 font-mono font-medium">거래 {pinnedMonth.volume}건</span>
                {pinnedMonth.confidenceText && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      pinnedMonth.confidenceText === '거래 충분'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : pinnedMonth.confidenceText === '거래 보통'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        : pinnedMonth.confidenceText === '거래 적음'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {pinnedMonth.confidenceText}
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    isActionClickRef.current = true;
                    setPinnedMonth(null);
                  }}
                  className="text-slate-400 hover:text-slate-200 p-0.5 hover:bg-slate-800 rounded transition-colors"
                  title="고정 해제"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {pinnedMonth.hasTrades ? (
              <div className="space-y-1.5 pt-0.5">
                {/* Monthly Median */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">월별 대표가격:</span>
                  <span className="font-bold text-emerald-400 text-sm font-mono">{formatPrice(pinnedMonth.medianPrice)}</span>
                </div>

                {/* 6M Moving Average */}
                {pinnedMonth.ma6 && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">6개월 이동평균:</span>
                    <span className="font-medium text-amber-300 font-mono">{formatPrice(pinnedMonth.ma6)}</span>
                  </div>
                )}

                {/* Monthly Range */}
                {pinnedMonth.minPrice != null && pinnedMonth.maxPrice != null && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">월별 거래범위:</span>
                    <span className="text-indigo-300 font-mono font-medium">
                      {formatPrice(pinnedMonth.minPrice)} ~ {formatPrice(pinnedMonth.maxPrice)}
                    </span>
                  </div>
                )}

                {/* Price per Pyeong */}
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/80">
                  <span className="text-slate-400">평단가 (공급기준):</span>
                  {hasSupplyArea && supplyPyeong && pinnedMonth.medianPrice > 0 ? (
                    <span className="font-medium text-teal-300 font-mono">
                      {formatPyeongPrice(Math.round(pinnedMonth.medianPrice / supplyPyeong))}
                    </span>
                  ) : (
                    <span className="font-mono text-slate-500 text-[10px]">공급면적 확인 불가</span>
                  )}
                </div>

                {/* Individual Trades in this Month - Scrollable */}
                {pinnedMonth.monthTrades && pinnedMonth.monthTrades.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-sky-300">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                        해당월 개별 실거래 ({pinnedMonth.monthTrades.length}건)
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">일자·층수 / 가격</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
                      {pinnedMonth.monthTrades.map((t: TradeRecord, idx: number) => {
                        const formattedDay = t.dealDate
                          ? t.dealDate.replace(/^\d{4}[.-]/, '')
                          : `${t.dealDay || 1}일`;
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-[10px] font-mono text-slate-300 bg-slate-950/60 border border-slate-800/80 px-2 py-1 rounded"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-sky-300/90">{formattedDay}</span>
                              <span className="text-slate-500">·</span>
                              <span className="text-slate-300">{t.floor}층</span>
                              {t.dealType && t.dealType !== '중개거래' && (
                                <span className="text-[9px] px-1 py-0.2 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                                  {t.dealType}
                                </span>
                              )}
                            </div>
                            <span className="font-bold text-emerald-400 font-mono">
                              {formatPrice(t.price)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-500 text-center py-1">
                해당 월 거래 내역 없음
              </div>
            )}

            {/* Click notice */}
            <div className="pt-1.5 border-t border-slate-800/60 text-[10px] text-slate-400 flex items-center justify-between">
              <span>다른 곳을 클릭하면 닫힙니다</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  isActionClickRef.current = true;
                  setPinnedMonth(null);
                }}
                className="text-sky-400 hover:text-sky-300 underline font-medium"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Chart Footer Guide */}
      <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
        <span>※ 월별 중위가, 거래범위 밴드(최저~최고) 및 개별 실거래 점은 동일한 월별 기준축(매월 15일)으로 정렬되어 차트 일관성이 유지됩니다.</span>
        <span>거래가 없는 월은 데이터 보간 없이 거래범위 밴드가 공백으로 유지됩니다.</span>
      </div>
    </div>
  );
};
