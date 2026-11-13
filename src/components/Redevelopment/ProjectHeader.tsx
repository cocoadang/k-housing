import React from 'react';
import {
  Building2,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Calendar,
  Layers,
  ChevronDown,
} from 'lucide-react';
import type { RedevelopmentLineageDetailResponse, RedevelopmentLineageListItem } from '../../types/redevelopmentApi';

interface ProjectHeaderProps {
  lineages: RedevelopmentLineageListItem[];
  selectedLineageId: string;
  onSelectLineageId: (id: string) => void;
  lineageDetail: RedevelopmentLineageDetailResponse['lineage'] | null;
  isLoading: boolean;
  landShareCount?: number;
  constructionCostCount?: number;
}

export const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  lineages,
  selectedLineageId,
  onSelectLineageId,
  lineageDetail,
  isLoading,
  landShareCount,
  constructionCostCount,
}) => {
  const unitsBefore = lineageDetail?.units?.before ?? null;
  const unitsAfter = lineageDetail?.units?.after ?? null;
  const moveInDate = lineageDetail?.milestones?.moveInDate ?? null;
  const associationDate = lineageDetail?.milestones?.associationApprovalDate ?? null;

  return (
    <div className="space-y-4">
      {selectedLineageId === 'chokjin3_redevelopment' && (
        <a href="https://apt.dsoom.com/#/status/chokjin-3" className="inline-flex text-sm text-emerald-400 underline">
          촉진3 최신 사업현황·진행 소식 보기
        </a>
      )}
      {/* 1. Trust & Methodology Notice Banner (Clear & Compact) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 sm:p-4 text-xs text-slate-300 flex items-start gap-3 shadow-sm">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-200">
            공개자료 기반 정비사업 가치분석 원칙
          </p>
          <p className="text-slate-400 leading-relaxed">
            본 분석은 국토교통부 실거래가 공개시스템 및 지자체·조합 공식 고시 등 공개된 실거래 및 정비사업 자료를 기반으로 합니다.
            개별 조합원의 실제 배정평형, 분담금 및 현금흐름은 공개자료 범위에 따라 확인되지 않을 수 있습니다.
          </p>
        </div>
      </div>

      {/* 2. Main Project Card with Lineage Selector & Unit Transformation */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {lineageDetail?.redevelopmentTypeLabel || '주택재건축정비사업'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                {lineageDetail?.redevelopmentType === 'URBAN_PUBLIC_HOUSING_COMPLEX'
                  ? '공공주택 특별법 근거'
                  : '도시 및 주거환경정비법 근거'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                {lineageDetail?.status === 'COMPLETED' ? '준공 완료' : (lineageDetail?.status === 'IN_PROGRESS' ? '사업 진행중' : '준공 완료')} {moveInDate ? `(${moveInDate.slice(0, 4)}.${moveInDate.slice(5, 7)} 입주)` : ''}
              </span>
            </div>

            {/* Lineage Selector Dropdown */}
            <div className="relative inline-block">
              <label htmlFor="lineage-selector" className="sr-only">정비사업 선택</label>
              <div className="flex items-center gap-2">
                <select
                  id="lineage-selector"
                  value={selectedLineageId}
                  onChange={(e) => onSelectLineageId(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-white font-bold text-lg sm:text-xl rounded-xl px-3 py-1.5 pr-8 appearance-none cursor-pointer focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  {lineages.length > 0 ? (
                    lineages.map((l) => (
                      <option key={l.lineageId} value={l.lineageId}>
                        {l.displayName}
                      </option>
                    ))
                  ) : (
                    <option value="dunchon_redevelopment">
                      둔촌주공 재건축 → 올림픽파크포레온
                    </option>
                  )}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 -ml-7 pointer-events-none" />
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-400">
              {lineageDetail?.description || '정비사업 상세 정보'}
            </p>
          </div>

          {/* Unit Transformation Metric Badges */}
          <div className="flex items-center gap-2 sm:gap-4 bg-slate-950/80 p-3 sm:p-4 rounded-xl border border-slate-800 shrink-0">
            <div className="text-center sm:text-left">
              <div className="text-[11px] text-slate-400 font-medium">종전 단지</div>
              <div className="text-base sm:text-lg font-bold text-slate-200">
                {lineageDetail?.lineageId === 'dunchon_redevelopment' || lineageDetail?.lineageId === 'lineage_dunchon_olympic'
                  ? '둔촌주공 1~4단지'
                  : lineageDetail?.predecessors?.length
                  ? lineageDetail.predecessors.length > 2
                    ? `${lineageDetail.predecessors[0].complexName} 외 ${lineageDetail.predecessors.length - 1}개 단지`
                    : lineageDetail.predecessors.map((p) => p.complexName).join(', ')
                  : '종전 저층 주거지 (단독·다세대 등)'}
              </div>
              <div className="text-xs text-emerald-400 font-semibold">
                {unitsBefore != null ? `${unitsBefore.toLocaleString()} 세대` : '종전 아파트 없음 (저층 주거지)'}
              </div>
            </div>

            <div className="flex items-center justify-center text-slate-600 px-1">
              <ArrowRight className="w-5 h-5" />
            </div>

            <div className="text-center sm:text-left">
              <div className="text-[11px] text-slate-400 font-medium">신축 단지</div>
              <div className="text-base sm:text-lg font-bold text-slate-100">
                {lineageDetail?.successors?.[0]?.complexName || '신축 단지'}
              </div>
              <div className="text-xs text-emerald-400 font-semibold">
                {unitsAfter != null ? `${unitsAfter.toLocaleString()} 세대` : '확인 불가'}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Capability Summary Cards (User-Friendly Readiness Badges) */}
        <div className="pt-4 space-y-2">
          <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>분석 기능 준비도 및 데이터 한계 (Capability Readiness)</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
            {/* 1. Market Value */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400">시장가격 비교</span>
              <div className="flex items-center gap-1 mt-1 text-emerald-400 font-bold text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{(lineageDetail?.predecessors?.length || 0) > 0 && (lineageDetail?.successors?.length || 0) > 0 && lineageDetail?.readiness.nominalScenario.availability === 'AVAILABLE' ? '가능 (시나리오)' : '자료 부족'}</span>
              </div>
            </div>

            {/* 2. Actual Mapping */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400">실제 평형 배정</span>
              <div className="flex items-center gap-1 mt-1 text-slate-400 font-semibold text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>자료 부족 (0건)</span>
              </div>
            </div>

            {/* 3. Cost Adjusted */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400">비용 반영 분석</span>
              <div className="flex items-center gap-1 mt-1 text-sky-400 font-semibold text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>{lineageDetail?.readiness.costAdjusted.readiness || '자료 미확보'}</span>
              </div>
            </div>

            {/* 4. XIRR */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400">XIRR (연환산수익률)</span>
              <div className="flex items-center gap-1 mt-1 text-slate-400 font-semibold text-xs">
                <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>계산 불가</span>
              </div>
            </div>

            {/* 5. Land Share */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400">종전 대지지분</span>
              <div className="flex items-center gap-1 mt-1 text-emerald-400 font-bold text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{landShareCount ? `확인 가능 (${landShareCount}티어)` : '자료 미확보'}</span>
              </div>
            </div>

            {/* 6. Construction Costs */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400">사업 공사비 이력</span>
              <div className="flex items-center gap-1 mt-1 text-emerald-400 font-bold text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{constructionCostCount ? `확인 가능 (${constructionCostCount}이벤트)` : '자료 미확보'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
