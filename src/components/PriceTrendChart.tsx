import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { MonthlyAggregate, TradeRecord, ComplexInfo } from '../types';
import { formatPrice, formatPyeongPrice, formatSqmPrice } from '../utils/calculations';
import { LineChart, Info } from 'lucide-react';

interface PriceTrendChartProps {
  complex: ComplexInfo;
  monthlyAggs: MonthlyAggregate[];
  trades: TradeRecord[];
}

export const PriceTrendChart: React.FC<PriceTrendChartProps> = ({
  complex,
  monthlyAggs,
}) => {
  const [showMovingAverage, setShowMovingAverage] = useState(false);
  const [showRangeBand, setShowRangeBand] = useState(true);
  const [showROneNotice, setShowROneNotice] = useState(false);
  const [showVolume, setShowVolume] = useState(true);

  // Compute continuous chronological monthly time-series & 6-month Moving Average
  const chartData = useMemo(() => {
    if (!monthlyAggs || monthlyAggs.length === 0) return [];

    const sortedAggs = [...monthlyAggs]
      .filter((m) => m && m.dealYmd)
      .sort((a, b) => a.dealYmd.localeCompare(b.dealYmd));

    if (sortedAggs.length === 0) return [];

    const minYmd = sortedAggs[0].dealYmd;
    const maxYmd = sortedAggs[sortedAggs.length - 1].dealYmd;

    const allMonths: string[] = [];
    let curY = parseInt(minYmd.slice(0, 4), 10);
    let curM = parseInt(minYmd.slice(4, 6), 10);
    const endY = parseInt(maxYmd.slice(0, 4), 10);
    const endM = parseInt(maxYmd.slice(4, 6), 10);

    while (curY < endY || (curY === endY && curM <= endM)) {
      allMonths.push(`${curY}${curM < 10 ? '0' + curM : curM}`);
      curM++;
      if (curM > 12) {
        curM = 1;
        curY++;
      }
    }

    const aggMap = new Map<string, MonthlyAggregate>();
    for (const agg of sortedAggs) {
      if (agg.hasData && agg.medianPrice > 0 && agg.transactionCount > 0) {
        aggMap.set(agg.dealYmd, agg);
      }
    }

    return allMonths.map((ymd, idx) => {
      const year = parseInt(ymd.slice(0, 4), 10);
      const month = parseInt(ymd.slice(4, 6), 10);
      const displayDate = `${year}.${month < 10 ? '0' + month : month}`;

      const agg = aggMap.get(ymd);
      const hasTrades = !!agg && agg.medianPrice > 0;
      const medianVal = hasTrades ? agg.medianPrice : null;

      const startIdx = Math.max(0, idx - 5);
      const windowYmds = allMonths.slice(startIdx, idx + 1);
      const windowValidPrices = windowYmds
        .map((wYmd) => aggMap.get(wYmd)?.medianPrice)
        .filter((p): p is number => typeof p === 'number' && p > 0);

      const ma6 =
        hasTrades && windowValidPrices.length > 0
          ? Math.round(windowValidPrices.reduce((acc, curr) => acc + curr, 0) / windowValidPrices.length)
          : null;

      return {
        date: ymd,
        displayDate,
        medianPrice: medianVal,
        avgPrice: hasTrades && agg ? agg.avgPrice : null,
        minPrice: hasTrades && agg ? agg.minPrice : null,
        maxPrice: hasTrades && agg ? agg.maxPrice : null,
        priceRange: hasTrades && agg ? [agg.minPrice, agg.maxPrice] : null,
        ma6,
        volume: agg ? agg.volume || agg.transactionCount || 0 : 0,
        pyeongPrice: hasTrades && agg ? agg.medianPricePerPyeong : null,
        sqmPrice: hasTrades && agg ? agg.medianPricePerSqm : null,
        reliability: agg ? agg.reliability : 'NO_DATA',
        hasTrades,
      };
    });
  }, [monthlyAggs]);

  // Format tick labels
  const formatYAxisPrice = (val: number) => {
    if (val >= 10000) {
      return `${(val / 10000).toFixed(0)}억`;
    }
    return `${val}만`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0]?.payload;
    if (!data) return null;

    const reliabilityLabel = {
      HIGH: { text: '신뢰도 높음 (10건+)', color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30' },
      MEDIUM: { text: '신뢰도 보통 (3~9건)', color: 'text-sky-400 bg-sky-500/20 border-sky-500/30' },
      LOW: { text: '신뢰도 주의 (1~2건)', color: 'text-amber-400 bg-amber-500/20 border-amber-500/30' },
      NO_DATA: { text: '거래 없음', color: 'text-slate-400 bg-slate-800 border-slate-700' },
    }[data.reliability as 'HIGH' | 'MEDIUM' | 'LOW' | 'NO_DATA'] || { text: '', color: '' };

    return (
      <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-xs space-y-1.5 z-50 min-w-[220px]">
        <div className="font-bold text-slate-200 border-b border-slate-800 pb-1.5 flex items-center justify-between">
          <span>{data.displayDate}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400 font-mono">거래량: {data.volume}건</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${reliabilityLabel.color}`}>
              {data.reliability}
            </span>
          </div>
        </div>
        <div className="space-y-1 pt-0.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">중위 실거래가:</span>
            <span className="font-bold text-emerald-300">{formatPrice(data.medianPrice)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">6개월 이동평균:</span>
            <span className="font-medium text-amber-300">{formatPrice(data.ma6)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">월간 실거래 범위:</span>
            <span className="text-slate-300 font-mono text-[11px]">
              {formatPrice(data.minPrice)} ~ {formatPrice(data.maxPrice)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">전용 ㎡당 단가:</span>
            <span className="font-medium text-teal-300 font-mono">{formatSqmPrice(data.sqmPrice)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
      {/* Chart Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <LineChart className="w-4 h-4 text-emerald-400" />
            {complex.name} 실거래가 시세 추이 및 거래량
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            국토교통부 실거래가 기반 월별 중위가격, 6개월 이동평균선(MA6), 거래 레인지 및 월간 거래량
          </p>
        </div>

        {/* Display Toggles */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <button
            onClick={() => setShowMovingAverage(!showMovingAverage)}
            className={`px-2.5 py-1 rounded-md font-medium border transition-colors ${
              showMovingAverage
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            이동평균(6M)
          </button>
          <button
            onClick={() => setShowRangeBand(!showRangeBand)}
            className={`px-2.5 py-1 rounded-md font-medium border transition-colors ${
              showRangeBand
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            최고·최저 밴드
          </button>
          <button
            onClick={() => setShowROneNotice(!showROneNotice)}
            className="px-2.5 py-1 rounded-md font-medium border border-slate-700 bg-slate-800/80 text-slate-400 hover:text-slate-200 transition-colors"
            title="한국부동산원 R-ONE 지수 연동 정보"
          >
            R-ONE 지수 (연동 준비 중)
          </button>
          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`px-2.5 py-1 rounded-md font-medium border transition-colors ${
              showVolume
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            거래량 바
          </button>
        </div>
      </div>

      {showROneNotice && (
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
          <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-sky-300 font-semibold">데이터 산출 안내:</strong>
            <p className="text-slate-400 mt-0.5">
              국토교통부 아파트 매매 실거래가 원천 데이터를 기반으로 월별 중위가격 및 거래량 추이를 정밀 분석하여 제공합니다.
            </p>
          </div>
        </div>
      )}

      {/* Main Chart Canvas */}
      <div className="h-[380px] sm:h-[440px] w-full">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <defs>
                <linearGradient id="priceRangeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} vertical={false} />
              
              <XAxis
                dataKey="displayDate"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                minTickGap={28}
              />
              
              {/* Left Y Axis: Real Estate Price */}
              <YAxis
                yAxisId="price"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={formatYAxisPrice}
                domain={['auto', 'auto']}
              />

              {/* Sub Y Axis: Volume */}
              {showVolume && (
                <YAxis
                  yAxisId="volume"
                  orientation="right"
                  domain={[0, 40]}
                  hide={true}
                />
              )}

              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                height={36}
                wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }}
              />

              {/* Volume Bar */}
              {showVolume && (
                <Bar
                  yAxisId="volume"
                  dataKey="volume"
                  name="월간 거래량 (건)"
                  fill="#6366f1"
                  opacity={0.3}
                  barSize={8}
                />
              )}

              {/* Price Range Band */}
              {showRangeBand && (
                <Area
                  yAxisId="price"
                  type="monotone"
                  dataKey="maxPrice"
                  name="월간 최고가"
                  stroke="none"
                  fill="url(#priceRangeGradient)"
                  connectNulls={false}
                />
              )}

              {/* Median Price Line */}
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="medianPrice"
                name="중위 실거래가"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: '#10b981' }}
                activeDot={{ r: 5, fill: '#34d399' }}
                connectNulls={false}
              />

              {/* 6-Month Moving Average */}
              {showMovingAverage && (
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="ma6"
                  name="6개월 이동평균 (MA6)"
                  stroke="#f59e0b"
                  strokeWidth={1.8}
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            해당 조건의 실거래가 데이터가 존재하지 않습니다.
          </div>
        )}
      </div>
    </div>
  );
};
