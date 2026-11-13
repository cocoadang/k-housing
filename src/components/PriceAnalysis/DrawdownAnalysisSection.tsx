import React from 'react';
import {
  Award,
  TrendingDown,
  TrendingUp,
  Percent,
  Compass,
} from 'lucide-react';
import { DetailedPriceMetrics } from '../../types';
import { formatPrice } from '../../utils/calculations';

interface DrawdownAnalysisSectionProps {
  metrics: DetailedPriceMetrics;
}

export const DrawdownAnalysisSection: React.FC<DrawdownAnalysisSectionProps> = ({
  metrics,
}) => {
  const {
    athPrice,
    athDate,
    drawdownFromAthPct,
    isNewAth,
    periodPeakPrice,
    periodPeakDate,
    periodDrawdownPct,
    isNewPeriodPeak,
    isAllPeriod,
    userPeriodStart,
    userPeriodEnd,
    mddPct,
    mddPeakDate,
    mddPeakPrice,
    mddTroughDate,
    mddTroughPrice,
    mddPeakTradeCount,
    mddTroughTradeCount,
    mddIsLowSample,
    allTimeMddPct,
    allTimeMddPeakDate,
    allTimeMddPeakPrice,
    allTimeMddTroughDate,
    allTimeMddTroughPrice,
    allTimeMddPeakTradeCount,
    allTimeMddTroughTradeCount,
    allTimeMddIsLowSample,
    cagrPct,
    cagrStartPeriod,
    cagrEndPeriod,
    latestMedianPrice,
    latestMedianDate,
    hasData,
  } = metrics;

  const peakPrice = periodPeakPrice || athPrice;
  const peakDate = periodPeakDate || athDate;
  const drawdownPct = periodDrawdownPct ?? drawdownFromAthPct;
  const isPeak = isNewPeriodPeak ?? isNewAth;

  const peakLabel = isAllPeriod ? '역대 최고' : '기간 내 최고';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
            <Compass className="w-4 h-4 text-emerald-400" />
            가격 위치 및 상승·하락 분석
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {isAllPeriod ? '역대' : '선택기간'} 최고 대표가격, 현재 고점 대비 낙폭, 최대 낙폭(MDD) 및 연평균 상승률(CAGR)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* 1. Unified Peak Price & Drawdown Card */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-xs font-bold text-slate-300">
                {peakLabel} 대표가격 및 고점 대비 낙폭
              </span>
              {isPeak ? (
                <Award className="w-4 h-4 text-amber-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-400" />
              )}
            </div>

            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xs text-slate-400">고점 대비:</span>
              <span className="text-xl sm:text-2xl font-black tracking-tight">
                {hasData && peakPrice > 0 ? (
                  isPeak ? (
                    <span className="text-amber-300">0.0% (신고가)</span>
                  ) : (
                    <span className="text-rose-400">{drawdownPct}%</span>
                  )
                ) : (
                  <span className="text-slate-500">-</span>
                )}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-slate-800/80 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{peakLabel} 대표가:</span>
              <span className="font-bold text-amber-300 font-mono">
                {hasData && peakPrice > 0 ? `${formatPrice(peakPrice)} (${peakDate})` : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">현재 대표가격:</span>
              <span className="font-bold text-emerald-400 font-mono">
                {hasData && latestMedianPrice > 0 ? `${formatPrice(latestMedianPrice)} (${latestMedianDate})` : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. MDD (Maximum Drawdown) */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-xs font-bold text-slate-300">
                {isAllPeriod ? '역대 최대 낙폭 (MDD)' : '기간 내 최대 낙폭 (MDD)'}
              </span>
              <div className="flex items-center gap-1.5">
                {mddIsLowSample && (
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 cursor-help"
                    title="월별 실거래 대표가격 기준입니다.&#10;고점월 또는 저점월의 거래 표본이 1건으로,&#10;시장가격 대표성이 낮을 수 있습니다."
                  >
                    저표본 구간
                  </span>
                )}
                <Percent className="w-4 h-4 text-rose-400" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 flex-wrap mt-1">
              <div className="text-xl sm:text-2xl font-black text-rose-400 tracking-tight">
                {hasData && mddPeakPrice > 0 ? `${mddPct}%` : '-'}
              </div>
              {mddIsLowSample && (
                <span
                  className="text-[11px] font-semibold text-amber-300/90 cursor-help"
                  title="월별 실거래 대표가격 기준입니다.&#10;고점월 또는 저점월의 거래 표본이 1건으로,&#10;시장가격 대표성이 낮을 수 있습니다."
                >
                  [저표본 구간]
                </span>
              )}
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-slate-800/80 space-y-1">
            <div className="flex items-center justify-between">
              <span>고점:</span>
              <span className="text-slate-300 font-mono">
                {hasData && mddPeakPrice > 0 ? `${formatPrice(mddPeakPrice)} (${mddPeakDate})` : '-'}
                {mddPeakTradeCount !== undefined && mddPeakPrice > 0 && (
                  <span className="text-slate-500 text-[10px] ml-1 font-sans">({mddPeakTradeCount}건)</span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>저점:</span>
              <span className="text-slate-300 font-mono">
                {hasData && mddTroughPrice > 0 ? `${formatPrice(mddTroughPrice)} (${mddTroughDate})` : '-'}
                {mddTroughTradeCount !== undefined && mddTroughPrice > 0 && (
                  <span className="text-slate-500 text-[10px] ml-1 font-sans">({mddTroughTradeCount}건)</span>
                )}
              </span>
            </div>
            {mddIsLowSample && mddPeakTradeCount !== undefined && mddTroughTradeCount !== undefined && (
              <div
                className="text-[10px] text-amber-300/80 pt-1.5 border-t border-slate-800/60 flex items-center justify-between cursor-help"
                title="월별 실거래 대표가격 기준입니다.&#10;고점월 또는 저점월의 거래 표본이 1건으로,&#10;시장가격 대표성이 낮을 수 있습니다."
              >
                <span className="text-amber-400/90 font-medium">표본 특이사항</span>
                <span className="font-mono">고점월 거래 {mddPeakTradeCount}건 · 저점월 거래 {mddTroughTradeCount}건</span>
              </div>
            )}
          </div>
        </div>

        {/* 3. CAGR (Compound Annual Growth Rate) */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-xs font-bold text-slate-300">연평균 상승률 (CAGR)</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              {hasData && cagrPct !== null && !isNaN(cagrPct) ? (
                <>
                  <span
                    className={`text-xl sm:text-2xl font-black tracking-tight ${
                      cagrPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {cagrPct >= 0 ? `+${cagrPct}%` : `${cagrPct}%`}
                  </span>
                  <span className="text-xs text-slate-400">/년</span>
                </>
              ) : (
                <span className="text-xl sm:text-2xl font-bold text-slate-500 tracking-tight">-</span>
              )}
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-slate-800/80 space-y-1">
            <div className="flex items-center justify-between">
              <span>선택 기간:</span>
              <span className="text-slate-300 font-mono">
                {userPeriodStart && userPeriodEnd ? `${userPeriodStart} ~ ${userPeriodEnd}` : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between truncate">
              <span>실제 관측:</span>
              <span className="text-emerald-300/90 font-mono font-medium">
                {cagrStartPeriod && cagrEndPeriod ? `${cagrStartPeriod} ~ ${cagrEndPeriod}` : '데이터 부족'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
