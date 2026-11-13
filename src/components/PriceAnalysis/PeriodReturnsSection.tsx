import React from 'react';
import { Calendar, TrendingUp, TrendingDown, HelpCircle, Percent } from 'lucide-react';
import { PeriodReturnItem } from '../../types';
import { formatPrice } from '../../utils/calculations';

interface PeriodReturnsSectionProps {
  periodReturns: PeriodReturnItem[];
}

export const PeriodReturnsSection: React.FC<PeriodReturnsSectionProps> = ({
  periodReturns,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-3 gap-1">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sky-400" />
            기간별 가격 변화율 (수익률)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            현재월 기준 1년·3년·5년·10년·15년·20년 및 데이터 최초월 기준 전체기간 누적 변화율과 연평균 상승률(CAGR)
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-950/60 px-2.5 py-1 rounded-lg border border-slate-800/80 w-fit">
          <Percent className="w-3 h-3 text-emerald-400" />
          <span>월별 대표 중위가격 기준</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-3.5">
        {periodReturns.map((item) => {
          const isValid = item.status === 'VALID' && item.returnPct !== null;
          const isPositive = isValid && item.returnPct! >= 0;
          const isCagrPositive = isValid && item.cagrPct !== null && item.cagrPct !== undefined && item.cagrPct >= 0;

          return (
            <div
              key={item.periodKey}
              className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between hover:border-slate-700 transition-colors"
            >
              <div>
                {/* Period Label & Trend Icon */}
                <div className="flex items-center justify-between text-slate-400 mb-1.5">
                  <span className="text-xs font-bold text-slate-300">{item.label}</span>
                  {isValid ? (
                    isPositive ? (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                    )
                  ) : (
                    <HelpCircle className="w-3.5 h-3.5 text-slate-600" />
                  )}
                </div>

                {/* Cumulative Return % */}
                <div className="text-lg sm:text-xl font-black tracking-tight">
                  {isValid ? (
                    <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                      {isPositive ? `+${item.returnPct}%` : `${item.returnPct}%`}
                    </span>
                  ) : (
                    <span className="text-slate-500 font-bold text-base">-</span>
                  )}
                </div>

                {/* Annual Average Growth Rate (CAGR) */}
                {isValid && item.cagrPct !== null && item.cagrPct !== undefined ? (
                  <div className="mt-1.5 flex items-center justify-between text-[11px] bg-slate-900/90 px-2 py-0.5 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px]">연평균</span>
                    <span
                      className={`font-bold font-mono text-[11px] ${
                        isCagrPositive ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isCagrPositive ? `+${item.cagrPct}%` : `${item.cagrPct}%`}
                    </span>
                  </div>
                ) : (
                  <div className="mt-1.5 text-[10px] text-slate-500 py-0.5">
                    연평균 산출불가
                  </div>
                )}
              </div>

              {/* Start/End Period and Prices */}
              <div className="text-[11px] text-slate-400 mt-2.5 pt-2 border-t border-slate-800/80 truncate">
                {isValid && item.startPeriod && item.endPeriod ? (
                  <div className="space-y-0.5">
                    <div className="text-slate-300 font-mono text-[10px]">
                      {item.startPeriod} ~ {item.endPeriod}
                    </div>
                    {item.startPrice && item.endPrice && (
                      <div className="text-[10px] text-slate-500 font-mono truncate" title={`${formatPrice(item.startPrice)} → ${formatPrice(item.endPrice)}`}>
                        {formatPrice(item.startPrice)} → {formatPrice(item.endPrice)}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-slate-500 text-[10px]">분석 기간 부족</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
