import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  Scale,
  Percent,
  Calendar,
  AlertTriangle,
  Award,
} from 'lucide-react';
import { CAGRResult, MDDResult, MonthlyAggregate, ComplexInfo } from '../types';
import { formatPrice, formatSqmPrice } from '../utils/calculations';

interface MetricsCardsProps {
  complex: ComplexInfo;
  latestAgg: MonthlyAggregate | null;
  cagrResult: CAGRResult | null;
  mddResult: MDDResult;
  totalTrades: number;
  filteredOutCount: number;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({
  complex,
  latestAgg,
  cagrResult,
  mddResult,
  totalTrades,
  filteredOutCount,
}) => {
  const latestPrice = latestAgg?.medianPrice || 0;
  const sqmPrice = latestAgg?.medianPricePerSqm || 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
      {/* 1. Recent Median Price */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-sm hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-slate-400 mb-1.5">
          <span className="text-xs font-semibold tracking-wide">최근 중위 실거래가</span>
          <Scale className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="text-lg sm:text-2xl font-bold text-slate-100 tracking-tight">
          {formatPrice(latestPrice)}
        </div>
        <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
          <span>{latestAgg?.displayDate || '-'} 기준</span>
          {latestAgg && (
            <span className="text-slate-500">
              {formatPrice(latestAgg.minPrice)} ~ {formatPrice(latestAgg.maxPrice)}
            </span>
          )}
        </div>
      </div>

      {/* 2. Unit Price (전용 ㎡당 단가) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-sm hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-slate-400 mb-1.5">
          <span className="text-xs font-semibold tracking-wide">전용 ㎡당 단가</span>
          <Activity className="w-4 h-4 text-teal-400" />
        </div>
        <div className="text-lg sm:text-2xl font-bold text-teal-300 tracking-tight">
          {formatSqmPrice(sqmPrice)}
        </div>
        <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
          <span>전용면적 기준</span>
          <span className="text-slate-500 font-mono">1㎡ 기준 실거래 환산</span>
        </div>
      </div>

        {/* 3. CAGR (Compound Annual Growth Rate) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-semibold tracking-wide">연평균 복합 성장률 (CAGR)</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            {cagrResult && !isNaN(cagrResult.cagr) ? (
              <>
                <span
                  className={`text-lg sm:text-2xl font-bold tracking-tight ${
                    cagrResult.cagr >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {cagrResult.cagr >= 0 ? `+${cagrResult.cagr}%` : `${cagrResult.cagr}%`}
                </span>
                <span className="text-xs text-slate-400">/년</span>
              </>
            ) : (
              <span className="text-lg sm:text-2xl font-bold text-slate-500 tracking-tight">-</span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between truncate">
            {cagrResult && !isNaN(cagrResult.totalReturnPct) ? (
              <span>
                {cagrResult.startPeriod} 대비 (총{' '}
                <strong className="text-emerald-300 font-semibold">
                  {cagrResult.totalReturnPct >= 0 ? `+${cagrResult.totalReturnPct}%` : `${cagrResult.totalReturnPct}%`}
                </strong>
                )
              </span>
            ) : (
              <span className="text-slate-500">비교 데이터 부족</span>
            )}
          </div>
        </div>

        {/* 4. MDD (Maximum Drawdown) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-semibold tracking-wide">전고점 대비 최대낙폭 (MDD)</span>
            <div className="flex items-center gap-1.5">
              {mddResult.isLowSample && (
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 cursor-help"
                  title="월별 실거래 대표가격 기준입니다.&#10;고점월 또는 저점월의 거래 표본이 1건으로,&#10;시장가격 대표성이 낮을 수 있습니다."
                >
                  저표본 구간
                </span>
              )}
              <TrendingDown className="w-4 h-4 text-rose-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <div className="text-lg sm:text-2xl font-bold text-rose-400 tracking-tight">
              {mddResult.peakPrice > 0 && !isNaN(mddResult.mddPct) ? `${mddResult.mddPct}%` : '-'}
            </div>
            {mddResult.isLowSample && (
              <span
                className="text-[11px] font-semibold text-amber-300/90 cursor-help"
                title="월별 실거래 대표가격 기준입니다.&#10;고점월 또는 저점월의 거래 표본이 1건으로,&#10;시장가격 대표성이 낮을 수 있습니다."
              >
                [저표본 구간]
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 space-y-1">
            <div className="flex items-center justify-between truncate">
              {mddResult.peakPrice > 0 ? (
                <>
                  <span>저점: {mddResult.troughDate}</span>
                  <span className="text-slate-500">고점: {mddResult.peakDate}</span>
                </>
              ) : (
                <span className="text-slate-500">데이터 부족</span>
              )}
            </div>
            {mddResult.isLowSample && mddResult.peakTradeCount !== undefined && mddResult.troughTradeCount !== undefined && (
              <div
                className="text-[10px] text-amber-300/80 pt-1 border-t border-slate-800/60 flex items-center justify-between cursor-help"
                title="월별 실거래 대표가격 기준입니다.&#10;고점월 또는 저점월의 거래 표본이 1건으로,&#10;시장가격 대표성이 낮을 수 있습니다."
              >
                <span className="text-amber-400/90 font-medium">표본</span>
                <span className="font-mono">고점월 거래 {mddResult.peakTradeCount}건 · 저점월 거래 {mddResult.troughTradeCount}건</span>
              </div>
            )}
          </div>
        </div>

        {/* 5. Recovery Rate */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-semibold tracking-wide">전고점 회복률</span>
            {mddResult.isNewHigh ? (
              <Award className="w-4 h-4 text-amber-400" />
            ) : (
              <Percent className="w-4 h-4 text-sky-400" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg sm:text-2xl font-bold text-slate-100 tracking-tight">
              {mddResult.peakPrice > 0 && !isNaN(mddResult.currentRecoveryPct) ? `${mddResult.currentRecoveryPct}%` : '-'}
            </span>
            {mddResult.isNewHigh && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                신고가 돌파
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 truncate">
            {mddResult.peakPrice > 0 ? (
              <>역대 최고가: <span className="text-slate-300 font-medium">{formatPrice(mddResult.peakPrice)}</span></>
            ) : (
              <span className="text-slate-500">-</span>
            )}
          </div>
        </div>

      {/* 6. Total Valid Volume */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-sm hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-slate-400 mb-1.5">
          <span className="text-xs font-semibold tracking-wide">분석 유효 실거래 건수</span>
          <Layers className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="text-lg sm:text-2xl font-bold text-indigo-300 tracking-tight">
          {totalTrades.toLocaleString()}건
        </div>
        <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
          <span>이상치/취소 제외</span>
          {filteredOutCount > 0 && (
            <span className="text-amber-400 font-mono">({filteredOutCount}건 필터링)</span>
          )}
        </div>
      </div>
    </div>
  );
};
