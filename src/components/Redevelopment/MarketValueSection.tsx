import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  ArrowRight,
  AlertTriangle,
  Info,
  Calendar,
  Layers,
  HelpCircle,
  Clock,
  Database,
  CheckCircle2,
  XCircle,
  Scale,
  Hash,
} from 'lucide-react';
import { EvidenceBadge } from './EvidenceBadge';
import {
  formatExclusiveArea,
  formatSupplyAreaWithPyeong,
  formatLegacyPyeong,
  formatTargetSelectorOption,
  formatPricePerExclusiveSqm,
  formatPricePerSupplyPyeong,
} from '../../utils/redevelopmentAreaFormatters';
import type {
  RedevelopmentTargetInfo,
  RedevelopmentPriceAvailabilityResponse,
  RedevelopmentAnalysisApiResponse,
} from '../../types/redevelopmentApi';
import type { AnalysisMode, PriceMetricType } from '../../types/redevelopmentAnalysis';

interface MarketValueSectionProps {
  predecessorTargets: RedevelopmentTargetInfo[];
  successorTargets: RedevelopmentTargetInfo[];
  selectedPredecessorTarget: RedevelopmentTargetInfo | null;
  onSelectPredecessorTarget: (t: RedevelopmentTargetInfo) => void;
  selectedSuccessorTarget: RedevelopmentTargetInfo | null;
  onSelectSuccessorTarget: (t: RedevelopmentTargetInfo) => void;
  predecessorAvailability: RedevelopmentPriceAvailabilityResponse | null;
  successorAvailability: RedevelopmentPriceAvailabilityResponse | null;
  selectedPredMonth: string;
  onChangePredMonth: (m: string) => void;
  selectedSuccMonth: string;
  onChangeSuccMonth: (m: string) => void;
  priceMetric: PriceMetricType;
  onChangePriceMetric: (pm: PriceMetricType) => void;
  analysisMode: AnalysisMode;
  onChangeAnalysisMode: (mode: AnalysisMode) => void;
  analysisResult: RedevelopmentAnalysisApiResponse | null;
  isAnalyzing: boolean;
  analysisError: string | null;
  onTriggerAnalysis: () => void;
}

export const MarketValueSection: React.FC<MarketValueSectionProps> = ({
  predecessorTargets,
  successorTargets,
  selectedPredecessorTarget,
  onSelectPredecessorTarget,
  selectedSuccessorTarget,
  onSelectSuccessorTarget,
  predecessorAvailability,
  successorAvailability,
  selectedPredMonth,
  onChangePredMonth,
  selectedSuccMonth,
  onChangeSuccMonth,
  priceMetric,
  onChangePriceMetric,
  analysisMode,
  onChangeAnalysisMode,
  analysisResult,
  isAnalyzing,
  analysisError,
  onTriggerAnalysis,
}) => {
  // Format currency in 억 / 만원
  const formatPriceManwon = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return '해당 월 실거래 없음';
    const eok = Math.floor(val / 10000);
    const remainder = Math.round(val % 10000);
    if (eok > 0 && remainder > 0) {
      return `${eok}억 ${remainder.toLocaleString()}만원`;
    } else if (eok > 0) {
      return `${eok}억원`;
    }
    return `${val.toLocaleString()}만원`;
  };

  const formatMonthDisplay = (ymd: string): string => {
    if (!ymd || ymd.length < 6) return ymd;
    return `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}`;
  };

  const nominalVal = analysisResult?.analysis?.ownerEconomics?.nominalValue;
  const predObs = analysisResult?.predecessorObservation;
  const succObs = analysisResult?.successorObservation;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-6 shadow-md">
      {/* 1. Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base sm:text-lg font-bold text-slate-100">
              시장가격(실거래가) 비교 분석 (Market Price Comparison)
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            정비사업 전후 자산의 국토교통부 실거래가 기반 시장가격 변화를 비교합니다.
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <EvidenceBadge level="SUPPORTED" size="sm" />
          <span className="text-xs text-slate-400">국토교통부 실거래가 기반</span>
        </div>
      </div>

      {/* 2. Interactive Selection Controls (Grid 2-Col for Pred vs Succ) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Predecessor (종전 자산) Selector */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              종전 자산 선택 (Predecessor Target)
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              {predecessorTargets.length > 0 ? `${predecessorTargets.length}개 평형군` : '대상 없음'}
            </span>
          </div>

          {/* Predecessor Target Select */}
          <div className="space-y-1.5">
            <label htmlFor="pred-target-select" className="text-[11px] font-semibold text-slate-400">
              종전 단지 및 평형군 (AreaFamily)
            </label>
            <select
              id="pred-target-select"
              value={selectedPredecessorTarget?.areaFamilyId || ''}
              disabled={predecessorTargets.length === 0}
              onChange={(e) => {
                const found = predecessorTargets.find((t) => t.areaFamilyId === e.target.value);
                if (found) onSelectPredecessorTarget(found);
              }}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs sm:text-sm rounded-lg p-2.5 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
            >
              {predecessorTargets.length > 0 ? (
                predecessorTargets.map((t) => (
                  <option key={t.areaFamilyId} value={t.areaFamilyId}>
                    {formatTargetSelectorOption(t)}
                  </option>
                ))
              ) : (
                <option value="">선택 가능한 종전 단지/평형군 없음 (재개발 단독·다세대 구역)</option>
              )}
            </select>
          </div>

          {/* Predecessor Month Select */}
          <div className="space-y-1.5">
            <label htmlFor="pred-month-select" className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
              <span>기준월 (관측월: {predecessorAvailability?.observedMonthCount ?? 0}개월)</span>
              <span className="text-slate-500">실거래 기준</span>
            </label>
            <select
              id="pred-month-select"
              value={selectedPredMonth}
              disabled={predecessorTargets.length === 0}
              onChange={(e) => onChangePredMonth(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs sm:text-sm rounded-lg p-2.5 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
            >
              {predecessorAvailability?.observedMonths && predecessorAvailability.observedMonths.length > 0 ? (
                predecessorAvailability.observedMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthDisplay(m)} (실거래 관측)
                  </option>
                ))
              ) : (
                <option value={selectedPredMonth}>{formatMonthDisplay(selectedPredMonth)}</option>
              )}
            </select>
          </div>
        </div>

        {/* Right: Successor (신축 자산) Selector */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              신축 자산 선택 (Successor Target)
            </span>
            <span className="text-[11px] text-emerald-400 font-medium">
              {successorTargets.length > 0 ? `${successorTargets.length}개 평형군` : '대상 없음'}
            </span>
          </div>

          {/* Successor Target Select */}
          <div className="space-y-1.5">
            <label htmlFor="succ-target-select" className="text-[11px] font-semibold text-slate-400">
              신축 단지 및 평형군 (AreaFamily)
            </label>
            <select
              id="succ-target-select"
              value={selectedSuccessorTarget?.areaFamilyId || ''}
              disabled={successorTargets.length === 0}
              onChange={(e) => {
                const found = successorTargets.find((t) => t.areaFamilyId === e.target.value);
                if (found) onSelectSuccessorTarget(found);
              }}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs sm:text-sm rounded-lg p-2.5 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
            >
              {successorTargets.length > 0 ? (
                successorTargets.map((t) => (
                  <option key={t.areaFamilyId} value={t.areaFamilyId}>
                    {formatTargetSelectorOption(t)}
                  </option>
                ))
              ) : (
                <option value="">선택 가능한 신축 단지/평형군 없음 (미준공/공급공고 전)</option>
              )}
            </select>
          </div>

          {/* Successor Month Select */}
          <div className="space-y-1.5">
            <label htmlFor="succ-month-select" className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
              <span>기준월 (관측월: {successorAvailability?.observedMonthCount ?? 0}개월)</span>
              <span className="text-emerald-400">입주권/신축 실거래</span>
            </label>
            <select
              id="succ-month-select"
              value={selectedSuccMonth}
              onChange={(e) => onChangeSuccMonth(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs sm:text-sm rounded-lg p-2.5 focus:outline-none focus:border-emerald-500"
            >
              {successorAvailability?.observedMonths && successorAvailability.observedMonths.length > 0 ? (
                successorAvailability.observedMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthDisplay(m)} (실거래 관측)
                  </option>
                ))
              ) : (
                <option value={selectedSuccMonth}>{formatMonthDisplay(selectedSuccMonth)}</option>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* 3. Global Filter Bar: Price Metric & Trigger Action */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          {/* Analysis Mode Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold">분석 모드:</span>
            <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-700 text-xs">
              <button
                id="mode-verified-historical-btn"
                onClick={() => onChangeAnalysisMode('VERIFIED_HISTORICAL')}
                className={`px-2.5 py-1 rounded font-bold transition-all ${
                  analysisMode === 'VERIFIED_HISTORICAL'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                확인된 역사적 관계
              </button>
              <button
                id="mode-user-scenario-btn"
                onClick={() => onChangeAnalysisMode('USER_SCENARIO')}
                className={`px-2.5 py-1 rounded font-bold transition-all ${
                  analysisMode === 'USER_SCENARIO'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                사용자 비교 시나리오
              </button>
            </div>
          </div>

          {/* Price Metric Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold">가격 기준:</span>
            <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-700 text-xs">
              <button
                id="metric-median-btn"
                onClick={() => onChangePriceMetric('MEDIAN_PRICE')}
                className={`px-2.5 py-1 rounded font-bold transition-all ${
                  priceMetric === 'MEDIAN_PRICE'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                중위가격 (권장)
              </button>
              <button
                id="metric-average-btn"
                onClick={() => onChangePriceMetric('AVERAGE_PRICE')}
                className={`px-2.5 py-1 rounded font-bold transition-all ${
                  priceMetric === 'AVERAGE_PRICE'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                평균가격
              </button>
            </div>
          </div>
        </div>

        <button
          id="trigger-analysis-btn"
          onClick={onTriggerAnalysis}
          disabled={isAnalyzing}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs sm:text-sm hover:bg-emerald-400 transition-colors disabled:opacity-50 shadow-md shadow-emerald-500/20"
        >
          {isAnalyzing ? (
            <span>분석 계산 중...</span>
          ) : (
            <span>가치분석 실행</span>
          )}
        </button>
      </div>

      {/* 4. Comparison Results Display */}
      {analysisMode === 'VERIFIED_HISTORICAL' ? (
        <div id="historical-mode-container" className="bg-slate-950/80 border border-slate-800 rounded-xl p-6 text-center space-y-3">
          <div className="inline-flex p-3 rounded-full bg-amber-500/10 text-amber-400 mb-1">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-slate-200">
            공개자료에서 종전 평형과 신축 평형의 실제 배정 관계를 확인할 수 없습니다.
          </h3>
          <p className="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed">
            원칙(CALCULATE WHEN JUSTIFIED, REFUSE WHEN NOT JUSTIFIED)에 따라 임의의 면적 매핑이나 연속 수익률 추정을 원천 차단합니다. 두 주택형의 시장가격 변화를 살펴보시려면 <strong>‘사용자 비교 시나리오’</strong> 모드를 이용해주세요.
          </p>
        </div>
      ) : (
        <div id="scenario-mode-container" className="space-y-4">
          {/* Scenario Mandatory Disclaimer (ALWAYS VISIBLE!) */}
          <div
            id="scenario-disclaimer"
            className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 sm:p-4 text-xs text-amber-300 flex items-start gap-2.5"
          >
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>시나리오 분석 유의사항:</strong> 사용자가 선택한 두 평형의 시장가격 비교입니다. 실제 조합원의 배정평형이나 투자수익률을 의미하지 않습니다. 조합원이 실제 어떤 신축 주택형을 신청했을 때 발생하는 법정 분담금/환급금 산정은 아래 <strong>‘조합원 분담금 매트릭스’</strong>를 참고하세요.
            </p>
          </div>

          {/* Left-Right Comparison Cards (NOT a continuous chart!) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card A: Predecessor Value */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                  종전 시장가격
                </span>
                <span className="text-[11px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  거래월: {predObs?.actualObservationMonth ? formatMonthDisplay(predObs.actualObservationMonth) : (predObs ? formatMonthDisplay(predObs.requestedMonth) : formatMonthDisplay(selectedPredMonth))}
                </span>
              </div>

              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-100">
                  {predObs?.value ? formatPriceManwon(predObs.value) : '해당 월 실거래 없음'}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {selectedPredecessorTarget?.complexName} {selectedPredecessorTarget?.areaFamilyLabel}
                </div>
              </div>

              {/* 6 Essential Comparison Dimensions Grid */}
              <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-800/80 text-xs space-y-2">
                <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-slate-400" />
                  <span>면적 및 기준 명세</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">전용면적:</span>
                    <span className="font-semibold text-slate-200">
                      {formatExclusiveArea(selectedPredecessorTarget?.exclusiveAreaRepresentative)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">공급면적:</span>
                    <span className="font-semibold text-slate-300">
                      {formatSupplyAreaWithPyeong(selectedPredecessorTarget?.supplyAreaRepresentative)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">관행 평형명:</span>
                    <span className="font-semibold text-slate-300">
                      {formatLegacyPyeong(selectedPredecessorTarget?.legacyPyeongLabel) || '미지정'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">거래건수:</span>
                    <span className="font-semibold text-slate-200">{predObs?.tradeCount ?? 0}건</span>
                  </div>
                </div>

                {/* Price Units Breakdown */}
                <div className="pt-1.5 border-t border-slate-800 text-[11px] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">전용㎡당 가격:</span>
                    <span className="font-mono font-medium text-slate-200">
                      {formatPricePerExclusiveSqm(predObs?.value, selectedPredecessorTarget?.exclusiveAreaRepresentative)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">공급평당 가격:</span>
                    <span className="font-mono font-medium text-slate-400 text-[10px]">
                      {formatPricePerSupplyPyeong(predObs?.value, selectedPredecessorTarget?.supplyAreaRepresentative).text}
                    </span>
                  </div>
                </div>
              </div>

              {/* Price Provenance */}
              <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center justify-between">
                  <span>기준월 / 통계:</span>
                  <span className="text-slate-300 font-medium">
                    {predObs?.actualObservationMonth ? formatMonthDisplay(predObs.actualObservationMonth) : '-'} (
                    {priceMetric === 'MEDIAN_PRICE' ? '중위가격' : '평균가격'})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>거래 건수:</span>
                  <span className="text-slate-300 font-medium">{predObs?.tradeCount ?? 0}건</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>데이터 출처:</span>
                  <span className="text-slate-500 truncate max-w-[180px]">monthlyComplexPrices_v2</span>
                </div>
              </div>
            </div>

            {/* Card B: Successor Value */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  신축 시장가격
                </span>
                <span className="text-[11px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/60">
                  거래월: {succObs?.actualObservationMonth ? formatMonthDisplay(succObs.actualObservationMonth) : (succObs ? formatMonthDisplay(succObs.requestedMonth) : formatMonthDisplay(selectedSuccMonth))}
                </span>
              </div>

              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
                  {succObs?.value ? formatPriceManwon(succObs.value) : '해당 월 실거래 없음'}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {selectedSuccessorTarget?.complexName} {selectedSuccessorTarget?.areaFamilyLabel}
                </div>
              </div>

              {/* 6 Essential Comparison Dimensions Grid */}
              <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-800/80 text-xs space-y-2">
                <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-emerald-400" />
                  <span>면적 및 기준 명세</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">전용면적:</span>
                    <span className="font-semibold text-emerald-300">
                      {formatExclusiveArea(selectedSuccessorTarget?.exclusiveAreaRepresentative)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">공급면적:</span>
                    <span className="font-semibold text-slate-300">
                      {formatSupplyAreaWithPyeong(selectedSuccessorTarget?.supplyAreaRepresentative)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">관행 평형명:</span>
                    <span className="font-semibold text-slate-300">
                      {formatLegacyPyeong(selectedSuccessorTarget?.legacyPyeongLabel) || '미지정'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">거래건수:</span>
                    <span className="font-semibold text-emerald-300">{succObs?.tradeCount ?? 0}건</span>
                  </div>
                </div>

                {/* Price Units Breakdown */}
                <div className="pt-1.5 border-t border-slate-800 text-[11px] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">전용㎡당 가격:</span>
                    <span className="font-mono font-medium text-emerald-300">
                      {formatPricePerExclusiveSqm(succObs?.value, selectedSuccessorTarget?.exclusiveAreaRepresentative)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">공급평당 가격:</span>
                    <span className="font-mono font-medium text-slate-400 text-[10px]">
                      {formatPricePerSupplyPyeong(succObs?.value, selectedSuccessorTarget?.supplyAreaRepresentative).text}
                    </span>
                  </div>
                </div>
              </div>

              {/* Price Provenance */}
              <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center justify-between">
                  <span>기준월 / 통계:</span>
                  <span className="text-slate-300 font-medium">
                    {succObs?.actualObservationMonth ? formatMonthDisplay(succObs.actualObservationMonth) : '-'} (
                    {priceMetric === 'MEDIAN_PRICE' ? '중위가격' : '평균가격'})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>거래 건수:</span>
                  <span className="text-slate-300 font-medium">{succObs?.tradeCount ?? 0}건</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>데이터 출처:</span>
                  <span className="text-slate-500 truncate max-w-[180px]">monthlyComplexPrices_v2</span>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Difference Metrics (Neutral Terminology ONLY: 시장가격 변화, 명목 자산가치 변화, 배수) */}
          {nominalVal?.availability === 'AVAILABLE' && nominalVal.value !== null && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <div className="text-xs text-slate-400 font-semibold">
                  {nominalVal.displayLabel || '시나리오 명목 자산가치 변화'}
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-100">
                  {nominalVal.value >= 0 ? '+' : ''}
                  {formatPriceManwon(nominalVal.value)}
                </div>
                <div className="text-[11px] text-slate-500">
                  경과 기간: 약 {nominalVal.elapsedYears ?? 0}년 ({nominalVal.elapsedDays ?? 0}일)
                </div>
              </div>

              {/* Multiplier Badge */}
              {predObs?.value && succObs?.value && (
                <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-3 text-center shrink-0 min-w-[140px]">
                  <div className="text-[11px] text-slate-400 font-medium">명목 자산가치 배수</div>
                  <div className="text-lg font-bold text-emerald-400">
                    {(succObs.value / predObs.value).toFixed(2)}배
                  </div>
                  <div className="text-[10px] text-slate-500">시나리오 단순 비율</div>
                </div>
              )}
            </div>
          )}

          {/* Missing Price Notice if either is null */}
          {(nominalVal?.availability === 'DATA_NOT_AVAILABLE' || (!predObs?.value && !succObs?.value)) && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-center text-slate-400 text-xs space-y-1">
              <div className="font-semibold text-slate-300">해당 월 실거래 없음</div>
              <p className="text-[11px] text-slate-500">
                선택하신 기준월에 국토교통부 실거래 거래 내역이 존재하지 않아 시장가격 변화를 계산할 수 없습니다.
                상단 셀렉터에서 관측 거래가 있는 월을 선택해 주세요.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
