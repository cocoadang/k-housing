import React from 'react';
import {
  HardHat,
  AlertCircle,
  FileCheck,
  TrendingUp,
  Scale,
  Calendar,
  Building,
  DollarSign,
  ArrowRight,
  GitCommit,
  HelpCircle,
  AlertTriangle,
} from 'lucide-react';
import { EvidenceBadge } from './EvidenceBadge';
import type { RedevelopmentConstructionCostsResponse } from '../../types/redevelopmentApi';

interface ProjectEconomicsSectionProps {
  constructionCosts: RedevelopmentConstructionCostsResponse | null;
  isLoading: boolean;
}

export const ProjectEconomicsSection: React.FC<ProjectEconomicsSectionProps> = ({
  constructionCosts,
  isLoading,
}) => {
  const formatKrwEok = (amount: number | null | undefined): string => {
    if (!amount) return '-';
    const eok = Math.round(amount / 100000000);
    const jo = Math.floor(eok / 10000);
    const remainderEok = eok % 10000;
    if (jo > 0) {
      return remainderEok > 0 ? `${jo}조 ${remainderEok.toLocaleString()}억 원` : `${jo}조 원`;
    }
    return `${eok.toLocaleString()}억 원`;
  };

  const getStatusBadge = (status: string, publicStatusLabel?: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'REQUESTED' || s.includes('INCREASE')) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
          증액 요구 (미확정)
        </span>
      );
    }
    if (s === 'VERIFIED') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
          부동산원 검증
        </span>
      );
    }
    if (s === 'SIGNED_CONTRACT' || s === 'CONTRACT') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          계약 체결
        </span>
      );
    }
    if (s === 'AGREED') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/30">
          총회 의결
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
        {publicStatusLabel || status}
      </span>
    );
  };

  const reb = constructionCosts?.rebAuditSummary;
  const events = constructionCosts?.events || [];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-6 shadow-md">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <HardHat className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base sm:text-lg font-bold text-slate-100">
              재건축 사업 전체 공사비 분석 (Project Construction Economics)
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            시공단과의 도급계약, 공사비 증액 요구 내역 및 한국부동산원(REB) 검증 결과를 시간 순서로 제공합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">총 {events.length}개 공식 변동 이벤트</span>
        </div>
      </div>

      {/* 2. Phase 8L: 공사비와 개별 부담 연계 UI (Cost-to-Contribution Chain) */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-200">
              <GitCommit className="w-4 h-4 text-emerald-400" />
              <span>공사비 변동과 개별 조합원 부담 연계 구조 (Cost-to-Contribution Flow)</span>
            </div>
            <p className="text-[11px] text-slate-400">
              공사비 변동이 개별 분담금에 도달하기까지의 법정 절차입니다. 공사비 증가액을 조합원 수로 단순 1/N 나누는 것은 금지됩니다.
            </p>
          </div>
          <div className="text-[11px] font-bold text-rose-400 bg-rose-950/40 border border-rose-800/60 px-2.5 py-1 rounded">
            개별 조합원 부담 영향: 공식자료 부족으로 계산 불가
          </div>
        </div>

        {/* 4-Step Connection Timeline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 relative">
          {/* Step 1: 공사비 변동 */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-400">1. 공사비 변동</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  공식 관측
                </span>
              </div>
              <div className="text-xs font-bold text-slate-200 mt-2">
                도급계약 체결 및 증액 검증
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                시공단 계약(2.67조) → 증액요구(3.23조) → 부동산원 검증 인정(1,621억) 등 총 공사지출액 변동
              </p>
            </div>
            <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-2">
              계약서 및 REB 검증보고서 기준
            </div>
          </div>

          {/* Step 2: 사업수지/비례율 변동 */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300">2. 사업수지/비례율 변동</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  비례율 연동
                </span>
              </div>
              <div className="text-xs font-bold text-slate-200 mt-2">
                총수입·총지출 재정산
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                공사비 변동분뿐만 아니라 일반분양가 상향 수익, 옵션 수입, 사업비 금융비용 증감이 복합 상쇄
              </p>
            </div>
            <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-2">
              ⚠️ 단순 1/N 배분 절대 불가
            </div>
          </div>

          {/* Step 3: 관리처분변경 */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300">3. 관리처분변경</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  법정 인가
                </span>
              </div>
              <div className="text-xs font-bold text-slate-200 mt-2">
                조합총회 의결 및 인가고시
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                변경된 비례율과 사업예산에 대해 조합원 총회 가결 및 관할 구청의 관리처분계획 변경인가 고시
              </p>
            </div>
            <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-2">
              도시정비법상 법정 확정 요건
            </div>
          </div>

          {/* Step 4: 공식 분담금 변화 */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-400">4. 공식 분담금 변화</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  계산 불가
                </span>
              </div>
              <div className="text-xs font-bold text-rose-400 mt-2">
                개별 통지서 공공 비공개
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                변경 관리처분인가에 따른 개별 조합원의 분담금 변화 자료는 공공 미공개로 현재 확인 불가
              </p>
            </div>
            <div className="text-[10px] text-rose-400/80 border-t border-slate-800/80 pt-2 font-medium">
              개별 조합원 부담 영향: 공식자료 부족으로 계산 불가
            </div>
          </div>
        </div>
      </div>

      {/* 3. REB Verification Audit Breakdown Card */}
      {reb && (reb.targetAmountKrw > 0 || reb.recognizedAmountKrw > 0) ? (
        <div className="bg-slate-950 border border-sky-500/30 rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-sky-400" />
              <span className="text-xs sm:text-sm font-bold text-slate-200">
                한국부동산원(REB) 공사비 검증 내역 요약
              </span>
            </div>
            <EvidenceBadge level="VERIFIED" size="sm" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg">
              <div className="text-[11px] text-slate-400 font-medium">부동산원 검증대상액</div>
              <div className="text-base sm:text-lg font-bold text-slate-100 mt-0.5">
                {formatKrwEok(reb?.targetAmountKrw)}
              </div>
              <div className="text-[10px] text-slate-500">조합·시공단 검증 의뢰분</div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg">
              <div className="text-[11px] text-slate-400 font-medium">검증 인정액</div>
              <div className="text-base sm:text-lg font-bold text-emerald-400 mt-0.5">
                {formatKrwEok(reb?.recognizedAmountKrw)}
              </div>
              <div className="text-[10px] text-emerald-500/80">정당 증액 사유 인정</div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg">
              <div className="text-[11px] text-slate-400 font-medium">부동산원 감액 조정액</div>
              <div className="text-base sm:text-lg font-bold text-rose-400 mt-0.5">
                {formatKrwEok(reb?.reducedAmountKrw)}
              </div>
              <div className="text-[10px] text-rose-500/80">시공단 요구액 삭감</div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg">
              <div className="text-[11px] text-slate-400 font-medium">검증 불가분 (합의)</div>
              <div className="text-base sm:text-lg font-bold text-slate-400 mt-0.5">
                {formatKrwEok(reb?.unverifiableAmountKrw)}
              </div>
              <div className="text-[10px] text-slate-500">금융손실/분양지연손실</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-500 flex items-center gap-2.5">
          <Scale className="w-4 h-4 text-slate-600 shrink-0" />
          <span>한국부동산원 공사비 검증 내역: 사업시행계획 인가 및 시공사 본계약 체결 이후 분쟁 시 진행되는 항목으로 현재 등록된 내역이 없습니다.</span>
        </div>
      )}

      {/* 4. Construction Cost Timeline */}
      <div className="space-y-3">
        <div className="text-xs font-bold text-slate-300">
          공사비 변동 이력 타임라인
        </div>

        {events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {events.map((evt) => (
              <div
                key={evt.eventId}
                className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                      <Calendar className="w-3 h-3" />
                      {evt.eventDate}
                    </span>
                    {getStatusBadge(evt.status, evt.publicStatusLabel)}
                  </div>

                  <div className="text-lg font-extrabold text-slate-100">
                    {formatKrwEok(evt.totalCostKrw)}
                  </div>

                  {evt.costPerPyeongKrw && (
                    <div className="text-[11px] text-slate-400">
                      평당 공사비: 약 {Math.round(evt.costPerPyeongKrw / 10000).toLocaleString()}만원
                    </div>
                  )}

                  <p className="text-xs text-slate-400 leading-relaxed pt-1">
                    {evt.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
                  <span>근거: {evt.evidenceId}</span>
                  <EvidenceBadge level={evt.eligibility} size="sm" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 text-center text-xs text-slate-500">
            시공사 본계약 체결 전 단계로 공개된 법정 공사비 변동 이벤트가 없습니다. (사업 초기/계획 단계)
          </div>
        )}
      </div>

      {/* 5. Mandatory Disclaimers for Construction Costs */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 sm:p-4 text-xs text-slate-400 space-y-2">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>공사비 주의사항:</strong> 공사비 증액 요구(REQUESTED_INCREASE)는 시공사업단의 일방 청구액이며 확정 계약금액(FINAL)이 아닙니다.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            사업 전체 공사비 변동은 일반분양 수입, 옵션 수입, 상가 매각 대금 및 사업비 금융비용에 따라 흡수·정산되므로 개별 조합원의 분담금과 단순 1/N 비례하지 않습니다.
          </p>
        </div>
      </div>
    </div>
  );
};
