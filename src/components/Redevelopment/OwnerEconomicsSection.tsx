import { buildDunchonContributionMatrix } from '../../data/dunchonContributionMatrix';
import React, { useState } from 'react';
import {
  Wallet,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Info,
  ArrowRight,
  FileText,
  XCircle,
  Table as TableIcon,
  LayoutGrid,
  GitCommit,
  CheckCircle2,
  HelpCircle,
  Building,
} from 'lucide-react';
import { EvidenceBadge } from './EvidenceBadge';
import { formatExclusiveArea, formatAreaFamilyText } from '../../utils/redevelopmentAreaFormatters';
import { ContributionMatrixTable } from './ContributionMatrixTable';
import type {
  RedevelopmentResearchExample,
  RedevelopmentTargetInfo,
  RedevelopmentLandShareResponse,
} from '../../types/redevelopmentApi';

interface OwnerEconomicsSectionProps {
  lineageId: string;
  researchExamples?: RedevelopmentResearchExample[];
  selectedPredecessorTarget?: RedevelopmentTargetInfo | null;
  selectedSuccessorTarget?: RedevelopmentTargetInfo | null;
  landShareData?: RedevelopmentLandShareResponse | null;
}

export const OwnerEconomicsSection: React.FC<OwnerEconomicsSectionProps> = ({
  lineageId,
  researchExamples = [],
  selectedPredecessorTarget,
  selectedSuccessorTarget,
  landShareData,
}) => {
  const [isExamplesOpen, setIsExamplesOpen] = useState<boolean>(false);
  const [exampleViewMode, setExampleViewMode] = useState<'table' | 'card'>('table');

  // Attempt to find land share for selected predecessor target if available
  const matchedLandShare = React.useMemo(() => {
    if (!selectedPredecessorTarget || !landShareData?.tiers) return null;
    const targetLabel = selectedPredecessorTarget.areaFamilyLabel || '';
    const complexName = selectedPredecessorTarget.complexName || '';
    
    // Check match by complex number and pyeong name
    return landShareData.tiers.find((tier) => {
      const complexMatch = complexName.includes(`${tier.complexNumber}단지`);
      const pyeongMatch = targetLabel.includes(tier.pyeongName) || tier.pyeongName.includes(targetLabel);
      return complexMatch && pyeongMatch;
    }) || null;
  }, [selectedPredecessorTarget, landShareData]);

  if (lineageId !== 'dunchon_redevelopment') return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
      <h2 className="font-bold text-slate-100">조합원 개별 경제성 및 분담금 분석</h2>
      <p className="text-sm text-slate-400">선택한 사업의 개별 종전자산평가액, 권리가액 및 신청 주택형별 조합원분양가 자료가 충분하지 않습니다. 분담금과 연환산수익률을 계산할 수 없습니다.</p>
      <p className="text-sm text-slate-400">종전자산평가액 → 권리가액 → 신청 주택형별 조합원분양가 → 추가분담금 / 환급금</p>
      <p className="text-xs text-slate-500">공개 참고사례 {researchExamples.length}건 · 다른 사업의 분담금 표는 적용하지 않습니다.</p>
    </section>
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-6 shadow-md">
      {/* 1. Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base sm:text-lg font-bold text-slate-100">
              조합원 개별 경제성 및 분담금 분석 (Owner Economics)
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            종전자산 유형 → 종전자산평가액 → 권리가액 → 신축 신청 주택형 → 조합원분양가 → 추가분담금 / 환급금 구조 기반 분석
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EvidenceBadge level="ASSOCIATION_DOCUMENT" size="sm" />
          <span className="text-xs text-slate-500">관리처분계획 기준</span>
        </div>
      </div>

      {/* 2. Concept Cards Grid (Clear Data Gap Notice on Numbers) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Additional Contribution / Refund */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">조합원 추가분담금 / 환급금 원칙</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              법정 원칙
            </span>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-200">
            조합원분양가 - 권리가액
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            관리처분계획 상 종전자산 권리가액과 신청 신축형 조합원분양가의 차액으로 정산되며, 실제 배정 관계보다 신청 평형별 분담금 비교가 핵심입니다.
          </p>
        </div>

        {/* Card 2: Cost-Adjusted Value */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">비용 반영 가치 (Cost Adjusted)</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
              PARTIAL
            </span>
          </div>
          <div className="text-base sm:text-lg font-black text-sky-400">
            일부 산정 가능 (조건부)
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            취득가액 및 분담금 지출 내역이 특정되는 시나리오 연구 사례에 한하여 제한적으로 기준 산출이 가능합니다.
          </p>
        </div>

        {/* Card 3: XIRR (Internal Rate of Return) */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">연환산 내부수익률 (XIRR)</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
              NOT READY
            </span>
          </div>
          <div className="text-base sm:text-lg font-black text-rose-400 flex items-center gap-1.5">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>계산 불가</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            개별 조합원의 실제 납부금액과 납부일자 자료가 충분하지 않습니다. 가상의 날짜나 추정 이자율을 적용한 임의 수익률 조작은 엄격히 금지됩니다.
          </p>
        </div>
      </div>

      {/* 3. 새로운 핵심 구조: 법정 정산 6단계 파이프라인 (Settlement Pipeline) */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-200">
              <GitCommit className="w-4 h-4 text-emerald-400" />
              <span>종전 자산 법정 정산 연결 흐름 (Settlement Pipeline)</span>
            </div>
            <p className="text-[11px] text-slate-400">
              종전자산 대지지분부터 추가분담금/환급금까지의 단계별 법정 정산 산정 흐름입니다.
            </p>
          </div>
          <div className="text-[10px] text-amber-400 bg-amber-950/40 border border-amber-800/60 px-2 py-1 rounded">
            ⚠️ 대지지분만으로 감정평가액 추정 산출 금지
          </div>
        </div>

        {/* 5-Step Visual Pipeline Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 relative">
          {/* Step 1: 대지지분 */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300">1. 대지지분</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  matchedLandShare ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
                }`}>
                  {matchedLandShare ? '지분 확인됨' : '선택형'}
                </span>
              </div>
              <div className="text-xs font-black text-slate-100 mt-2 truncate">
                {selectedPredecessorTarget
                  ? `${selectedPredecessorTarget.complexName} ${selectedPredecessorTarget.areaFamilyLabel}`
                  : '종전 자산 선택'}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {selectedPredecessorTarget
                  ? `${formatExclusiveArea(selectedPredecessorTarget.exclusiveAreaRepresentative)} / 지분 ${matchedLandShare?.canonicalValueSqm.toFixed(2) ?? '확인중'}㎡`
                  : '16개 주택형 고시'}
              </div>
            </div>
            <p className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-2 leading-tight">
              인가 고시 기준 법정 대지지분 연결
            </p>
          </div>

          {/* Step 2: 종전자산평가액 */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300">2. 종전자산평가액</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                  확인 불가
                </span>
              </div>
              <div className="text-xs font-black text-slate-400 mt-2">
                DATA_NOT_AVAILABLE
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                공식 개별 감정평가액 비공개
              </div>
            </div>
            <p className="text-[10px] text-amber-400/80 border-t border-slate-800/80 pt-2 leading-tight">
              ⚠️ 대지지분으로 평가액 임의 추정 금지
            </p>
          </div>

          {/* Step 3: 권리가액 */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300">3. 권리가액</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                  확인 불가
                </span>
              </div>
              <div className="text-xs font-black text-slate-400 mt-2">
                DATA_NOT_AVAILABLE
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                평가액 × 비례율 산정
              </div>
            </div>
            <p className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-2 leading-tight">
              평가액 부재 시 권리가액 산출 불가
            </p>
          </div>

          {/* Step 4: 조합원분양가 */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300">4. 조합원분양가</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  신청주택형
                </span>
              </div>
              <div className="text-xs font-black text-slate-100 mt-2 truncate">
                {selectedSuccessorTarget
                  ? selectedSuccessorTarget.areaFamilyLabel
                  : '신청 희망 주택형'}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {selectedSuccessorTarget
                  ? `${formatExclusiveArea(selectedSuccessorTarget.exclusiveAreaRepresentative)} (분양가 비공개)`
                  : '전용 59㎡, 84㎡ 등 8개형'}
              </div>
            </div>
            <p className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-2 leading-tight">
              인가 관리처분계획 기준 분양가
            </p>
          </div>

          {/* Step 5: 분담금 / 환급금 */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300">5. 분담금 / 환급금</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  매트릭스 참조
                </span>
              </div>
              <div className="text-xs font-black text-emerald-400 mt-2">
                조합원분양가 - 권리가액
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                연구사례 3건 확인
              </div>
            </div>
            <p className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-2 leading-tight">
              하단 분담금 매트릭스에서 상세 확인
            </p>
          </div>
        </div>
      </div>

      {/* 4. 조합원 분담금 매트릭스 (Contribution Matrix) */}
      <ContributionMatrixTable matrixData={buildDunchonContributionMatrix()} />

      {/* 5. Collapsible Section: Public Research Examples Detail (APPLICATION_EXAMPLE / RESEARCH_ONLY) */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2 flex-wrap">
            <FlaskConical className="w-4 h-4 text-amber-400" />
            <span className="text-xs sm:text-sm font-bold text-slate-200">
              공개자료 참고 사례 (Research Examples) 세부 목록
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              RESEARCH_ONLY ({researchExamples.length}건)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setExampleViewMode('table')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded font-medium transition-all ${
                  exampleViewMode === 'table' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>표 형태</span>
              </button>
              <button
                onClick={() => setExampleViewMode('card')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded font-medium transition-all ${
                  exampleViewMode === 'card' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>카드 형태</span>
              </button>
            </div>

            {/* Collapse Toggle */}
            <button
              onClick={() => setIsExamplesOpen(!isExamplesOpen)}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1"
            >
              <span>{isExamplesOpen ? '접기' : '상세 펼치기'}</span>
              {isExamplesOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Collapsible Content */}
        {isExamplesOpen && (
          <div className="p-4 space-y-4">
            <div className="text-xs text-slate-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 leading-relaxed">
              <strong>참고자료 고지:</strong> 아래 사례는 조합 총회 전후 언론 보도 및 부동산 커뮤니티에 공개된 개별 조합원 분양신청 통보 예시 자료이며, 실제 최종 조합원 배정 결과가 아닙니다.
              조합의 최종 공인 관리처분계획 세부 책자(ASSOCIATION_DOCUMENT)와 구분하여 <strong>RESEARCH_ONLY(참고 연구용)</strong>로 표기됩니다.
            </div>

            {exampleViewMode === 'table' ? (
              /* View Mode 1: Detailed Table */
              <div className="overflow-x-auto border border-slate-800 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3">종전 주택형</th>
                      <th className="p-3">종전자산평가액</th>
                      <th className="p-3">권리가액</th>
                      <th className="p-3">신축 신청형</th>
                      <th className="p-3">조합원분양가</th>
                      <th className="p-3">정산 결과 (분담금/환급금)</th>
                      <th className="p-3 text-center">Evidence 등급</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                    {researchExamples.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-slate-500">
                          등록된 공개 연구 사례가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      researchExamples.map((ex) => {
                        const isRefund = ex.financialOutcomeType === 'REFUND' || ex.amountKrw < 0;
                        const absAmount = Math.abs(ex.amountKrw);
                        const amountInEok = (absAmount / 100000000).toFixed(2);

                        return (
                          <tr key={ex.exampleId} className="hover:bg-slate-900/40 transition-colors">
                            <td className="p-3 font-medium text-slate-200">
                              {formatAreaFamilyText(ex.sourceAreaFamily)}
                            </td>
                            <td className="p-3 text-slate-500 font-mono">
                              {ex.predecessorAppraisedValueKrw != null
                                ? `${(ex.predecessorAppraisedValueKrw / 100000000).toFixed(2)}억 원`
                                : '확인 불가'}
                            </td>
                            <td className="p-3 text-slate-500 font-mono">
                              {ex.rightsValueKrw != null
                                ? `${(ex.rightsValueKrw / 100000000).toFixed(2)}억 원`
                                : '확인 불가'}
                            </td>
                            <td className="p-3 font-medium text-slate-300">
                              {formatAreaFamilyText(ex.targetSuccessorAreaFamily)}
                            </td>
                            <td className="p-3 text-slate-500 font-mono">
                              {ex.memberSalePriceKrw != null
                                ? `${(ex.memberSalePriceKrw / 100000000).toFixed(2)}억 원`
                                : '확인 불가'}
                            </td>
                            <td className="p-3">
                              <span
                                className={`font-bold font-mono ${
                                  isRefund ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {isRefund ? '환급금' : '추가분담금'} 약 {amountInEok}억 원
                              </span>
                              <span className="text-[10px] text-slate-500 block">
                                ({absAmount.toLocaleString()}원)
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                REFERENCE (RESEARCH_ONLY)
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* View Mode 2: Card View */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {researchExamples.map((ex, idx) => {
                  const isRefund = ex.financialOutcomeType === 'REFUND' || ex.amountKrw < 0;
                  const absAmount = Math.abs(ex.amountKrw);
                  return (
                    <div key={ex.exampleId || idx} className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-300">
                          사례 {idx + 1} ({isRefund ? '환급 가상안' : '분담금 가상안'})
                        </span>
                        <EvidenceBadge level="RESEARCH_ONLY" size="sm" />
                      </div>
                      <div className="text-xs text-slate-400">
                        {formatAreaFamilyText(ex.sourceAreaFamily)} → {formatAreaFamilyText(ex.targetSuccessorAreaFamily)}
                      </div>
                      <div className={`text-sm font-bold ${isRefund ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isRefund ? '환급금' : '추가분담금'} {absAmount.toLocaleString()}원
                      </div>
                      {ex.notes && (
                        <p className="text-[10px] text-slate-500">
                          {ex.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
