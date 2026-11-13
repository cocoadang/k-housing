import React from 'react';
import {
  Scale,
  Activity,
  TrendingDown,
  Award,
} from 'lucide-react';
import { DetailedPriceMetrics, AreaCategory, AreaFamilyMetadata, TradeRecord } from '../../types';
import { formatPrice, formatPyeongPrice } from '../../utils/calculations';

interface CoreMetricsCardsProps {
  metrics: DetailedPriceMetrics;
  selectedArea: AreaCategory;
  selectedFamily?: AreaFamilyMetadata | null;
  athTrade?: TradeRecord | null;
}

export const CoreMetricsCards: React.FC<CoreMetricsCardsProps> = ({
  metrics,
  selectedArea,
  selectedFamily,
  athTrade,
}) => {
  const {
    latestMedianPrice,
    latestMedianDate,
    latestTransactionCount,
    latestConfidenceLabel,
    mddPct,
    allTimeMddPct,
    allTimeMddPeakDate,
    allTimeMddTroughDate,
    allTimeMddPeakTradeCount,
    allTimeMddTroughTradeCount,
    allTimeMddIsLowSample,
    mddPeakDate,
    mddTroughDate,
    mddPeakTradeCount,
    mddTroughTradeCount,
    mddIsLowSample,
    hasData,
  } = metrics;

  // Calculate pyeong price strictly using actual supplyAreaSqm / 3.305785
  const supplyArea = selectedFamily?.representativeSupplyArea;
  const hasSupplyArea = typeof supplyArea === 'number' && supplyArea > 0;
  const supplyPyeong = hasSupplyArea ? supplyArea / 3.305785 : null;

  const pyeongPrice =
    hasSupplyArea && supplyPyeong && hasData && latestMedianPrice > 0
      ? Math.round(latestMedianPrice / supplyPyeong)
      : null;

  // All-time MDD value and period dates
  const displayMddPct = allTimeMddPct !== undefined ? allTimeMddPct : mddPct;
  const displayPeakDate = allTimeMddPeakDate && allTimeMddPeakDate !== '-' ? allTimeMddPeakDate : mddPeakDate;
  const displayTroughDate = allTimeMddTroughDate && allTimeMddTroughDate !== '-' ? allTimeMddTroughDate : mddTroughDate;
  const displayPeakTradeCount = allTimeMddPeakTradeCount !== undefined ? allTimeMddPeakTradeCount : mddPeakTradeCount;
  const displayTroughTradeCount = allTimeMddTroughTradeCount !== undefined ? allTimeMddTroughTradeCount : mddTroughTradeCount;
  const displayIsLowSample = allTimeMddIsLowSample !== undefined ? allTimeMddIsLowSample : mddIsLowSample;

  const lowSampleTooltip =
    '월별 실거래 대표가격 기준입니다.\n고점월 또는 저점월의 거래 표본이 1건으로,\n시장가격 대표성이 낮을 수 있습니다.';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* 1. Recent Representative Price */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm hover:border-slate-700 transition-colors flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-bold text-slate-300">최근 대표가격</span>
            <Scale className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
            {hasData ? formatPrice(latestMedianPrice) : '-'}
          </div>
        </div>
        <div className="text-[11px] text-slate-400 mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-1">
          <span className="font-mono text-slate-300">{latestMedianDate} 기준</span>
          {hasData && (
            <span className="text-slate-400">
              {latestTransactionCount}건 ·{' '}
              <strong className={
                latestConfidenceLabel === '거래 충분' ? 'text-emerald-400' :
                latestConfidenceLabel === '거래 보통' ? 'text-sky-400' :
                latestConfidenceLabel === '거래 적음' ? 'text-amber-400' : 'text-slate-500'
              }>
                {latestConfidenceLabel}
              </strong>
            </span>
          )}
        </div>
      </div>

      {/* 2. Pyeong Price (실제 공급면적 기준 평단가) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm hover:border-slate-700 transition-colors flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-bold text-slate-300">
              평단가 (공급기준)
            </span>
            <Activity className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-teal-300 tracking-tight">
            {pyeongPrice !== null ? (
              formatPyeongPrice(pyeongPrice)
            ) : (
              <span className="text-base sm:text-lg font-bold text-slate-400">
                평단가 계산 불가
              </span>
            )}
          </div>
        </div>
        <div className="text-[11px] text-slate-400 mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-1">
          {hasSupplyArea && supplyPyeong ? (
            <>
              <span className="font-mono text-slate-300">공급 {supplyArea}㎡ ({supplyPyeong.toFixed(1)}평)</span>
              <span className="text-slate-500">최근 대표가 기준</span>
            </>
          ) : (
            <span className="text-slate-500">공급면적 확인 불가</span>
          )}
        </div>
      </div>

      {/* 3. All-Time MDD (전체기간 MDD) - Replacing 1-Year Change */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm hover:border-slate-700 transition-colors flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-bold text-slate-300">전체기간 MDD</span>
            <div className="flex items-center gap-1.5">
              {displayIsLowSample && (
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 cursor-help"
                  title={lowSampleTooltip}
                >
                  저표본 구간
                </span>
              )}
              <TrendingDown className="w-4 h-4 text-rose-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 flex-wrap">
            {hasData && displayMddPct !== undefined && displayMddPct !== 0 ? (
              <span className="text-xl sm:text-2xl font-black tracking-tight text-rose-400">
                {displayMddPct}%
              </span>
            ) : hasData ? (
              <span className="text-xl sm:text-2xl font-black tracking-tight text-emerald-400">
                0.0%
              </span>
            ) : (
              <span className="text-xl sm:text-2xl font-bold text-slate-500 tracking-tight">-</span>
            )}
            {displayIsLowSample && (
              <span
                className="text-[11px] font-semibold text-amber-300/90 cursor-help"
                title={lowSampleTooltip}
              >
                [저표본 구간]
              </span>
            )}
          </div>
        </div>
        <div className="text-[11px] text-slate-400 mt-2.5 pt-2 border-t border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <span>최대 하락폭</span>
            <span className="text-slate-300 font-mono text-[10px]">
              {hasData && displayPeakDate && displayTroughDate && displayPeakDate !== '-' ? (
                `${displayPeakDate} → ${displayTroughDate}`
              ) : (
                '월별 대표가 기준'
              )}
            </span>
          </div>
          {hasData && displayPeakTradeCount !== undefined && displayTroughTradeCount !== undefined && displayPeakDate && displayPeakDate !== '-' && (
            <div
              className={`flex items-center justify-between text-[10px] ${
                displayIsLowSample ? 'text-amber-300/80 font-medium' : 'text-slate-500'
              }`}
              title={displayIsLowSample ? lowSampleTooltip : undefined}
            >
              <span className={displayIsLowSample ? 'text-amber-400/90' : 'text-slate-500'}>
                {displayIsLowSample ? '표본 수' : '거래 표본'}
              </span>
              <span className="font-mono">
                고점월 거래 {displayPeakTradeCount}건 · 저점월 거래 {displayTroughTradeCount}건
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 4. All-Time High Individual Trade (역대 신고가) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm hover:border-slate-700 transition-colors flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-bold text-slate-300">
              역대 신고가
            </span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-300 tracking-tight">
            {athTrade && athTrade.price > 0 ? (
              formatPrice(athTrade.price)
            ) : (
              <span className="text-slate-500">-</span>
            )}
          </div>
        </div>
        <div className="text-[11px] text-slate-400 mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-1 font-mono">
          {athTrade && athTrade.price > 0 ? (
            <>
              <span className="text-slate-300">{athTrade.dealDate}</span>
              <span className="text-slate-400">{athTrade.floor ? `${athTrade.floor}층` : ''}</span>
            </>
          ) : (
            <span className="text-slate-500 font-sans">거래 이력 없음</span>
          )}
        </div>
      </div>
    </div>
  );
};
