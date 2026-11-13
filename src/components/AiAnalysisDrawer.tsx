import React, { useState, useEffect } from 'react';
import { Sparkles, Building2, TrendingUp, ShieldAlert, RefreshCw, X, Award, CheckCircle2 } from 'lucide-react';
import { ComplexInfo, CAGRResult, MDDResult, MonthlyAggregate, AreaCategory, BaselineOption } from '../types';

interface AiAnalysisDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  complex: ComplexInfo;
  latestAgg: MonthlyAggregate | null;
  cagrResult: CAGRResult | null;
  mddResult: MDDResult;
  selectedArea: AreaCategory;
  baselineOption: BaselineOption;
}

export const AiAnalysisDrawer: React.FC<AiAnalysisDrawerProps> = ({
  isOpen,
  onClose,
  complex,
  latestAgg,
  cagrResult,
  mddResult,
  selectedArea,
  baselineOption,
}) => {
  const [analysisText, setAnalysisText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchAiAnalysis = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complexes: [complex],
          selectedArea,
          baseline: baselineOption,
          metricsSummary: {
            latestPrice: latestAgg?.medianPrice,
            pyeongPrice: latestAgg?.medianPricePerPyeong,
            cagr: cagrResult?.cagr,
            totalReturn: cagrResult?.totalReturnPct,
            mdd: mddResult.mddPct,
            recoveryRate: mddResult.currentRecoveryPct,
            isNewHigh: mddResult.isNewHigh,
          },
        }),
      });

      const data = await res.json();
      setAnalysisText(data.analysis || '분석 결과를 불러오지 못했습니다.');
    } catch (e: any) {
      setAnalysisText(`분석 생성 중 오류가 발생했습니다: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !analysisText) {
      fetchAiAnalysis();
    }
  }, [isOpen, complex.id, selectedArea, baselineOption]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-700 h-full flex flex-col shadow-2xl text-slate-200">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-500 text-slate-950 font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                AI 부동산 수석 데이터 엔지니어 진단
              </h3>
              <p className="text-xs text-slate-400">
                {complex.name} ({complex.district}) · Gemini 심층 정량 분석 리포트
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs sm:text-sm leading-relaxed">
          {/* Quick Indicator Badge summary */}
          <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <div>
              <span className="text-[10px] text-slate-400 block">연평균 복합 성장률</span>
              <span className="text-sm font-bold text-emerald-400 font-mono">
                {(cagrResult?.cagr || 0) >= 0 ? `+${cagrResult?.cagr}%/년` : `${cagrResult?.cagr}%/년`}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">최대 낙폭 (MDD)</span>
              <span className="text-sm font-bold text-rose-400 font-mono">
                {mddResult.mddPct}%
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">전고점 회복률</span>
              <span className="text-sm font-bold text-amber-300 font-mono">
                {mddResult.currentRecoveryPct}%
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
              <p className="text-xs font-medium">실거래가 시계열 및 R-ONE 지표를 종합 분석 중입니다...</p>
            </div>
          ) : (
            <div className="bg-slate-950/40 p-4 sm:p-5 rounded-xl border border-slate-800 space-y-3 whitespace-pre-wrap text-slate-300 font-sans leading-normal">
              {analysisText}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            onClick={fetchAiAnalysis}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 font-medium text-xs rounded-lg text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            다시 분석 생성
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 font-bold text-xs rounded-lg text-slate-950 transition-colors"
          >
            확인 및 닫기
          </button>
        </div>
      </div>
    </div>
  );
};
