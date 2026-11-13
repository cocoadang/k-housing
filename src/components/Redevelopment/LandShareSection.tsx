import React from 'react';
import { Landmark, Info, AlertTriangle, Layers, Percent } from 'lucide-react';
import { EvidenceBadge } from './EvidenceBadge';
import { HISTORICAL_COMPLEXES } from '../../data/redevelopmentLineages';
import { TARGET_COMPLEXES } from '../../data/complexesData';
import { formatExclusiveArea } from '../../utils/redevelopmentAreaFormatters';
import type { RedevelopmentLandShareResponse } from '../../types/redevelopmentApi';

interface LandShareSectionProps {
  landShareData: RedevelopmentLandShareResponse | null;
  isLoading: boolean;
}

const getComplexDisplayName = (complexId: string, itemComplexName?: string): string => {
  if (itemComplexName) return itemComplexName;
  const hist = HISTORICAL_COMPLEXES.find((h) => h.id === complexId);
  if (hist) return hist.name;
  const target = TARGET_COMPLEXES.find((t) => t.id === complexId);
  if (target) return target.name;
  const match = complexId.match(/\d+$/);
  return match ? `제${match[0]}단지` : complexId;
};

export const LandShareSection: React.FC<LandShareSectionProps> = ({
  landShareData,
  isLoading,
}) => {
  const meta = landShareData?.metadata;
  const ratios = landShareData?.predecessorRatios || [];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5 shadow-md">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base sm:text-lg font-bold text-slate-100">
              종전 단지 대지지분 분석 (Land Share & Predecessor Ratios)
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            {meta?.explanation || '종전 건축물의 전용면적 대비 공인 대지권 지분 면적 및 비율 통계입니다.'}
          </p>
        </div>
        <EvidenceBadge level="VERIFIED" size="sm" />
      </div>

      {/* 2. Metadata Precision Badges (No Ambiguity: 상세 레코드 17개, 명목 카테고리 15개, 고유값 12개, AreaFamily 16개) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
          <div className="text-[11px] text-slate-400 font-medium">상세 레코드 수</div>
          <div className="text-base sm:text-lg font-bold text-slate-100 mt-0.5">
            {meta?.recordCount != null ? `${meta.recordCount}개 티어` : '-'}
          </div>
          <div className="text-[10px] text-slate-500">동별 세부 지분 포함</div>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
          <div className="text-[11px] text-slate-400 font-medium">명목 카테고리 수</div>
          <div className="text-base sm:text-lg font-bold text-emerald-400 mt-0.5">
            {meta?.nominalCategoryCount != null ? `${meta.nominalCategoryCount}개` : '-'}
          </div>
          <div className="text-[10px] text-slate-500">단지-평형 조합 분류</div>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
          <div className="text-[11px] text-slate-400 font-medium">고유 대지지분 값</div>
          <div className="text-base sm:text-lg font-bold text-sky-400 mt-0.5">
            {meta?.uniqueLandShareValueCount != null ? `${meta.uniqueLandShareValueCount}개 면적` : '-'}
          </div>
          <div className="text-[10px] text-slate-500">독립된 ㎡ 면적값</div>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
          <div className="text-[11px] text-slate-400 font-medium">종전 AreaFamily</div>
          <div className="text-base sm:text-lg font-bold text-slate-100 mt-0.5">
            {meta?.uniqueAreaFamilyCount != null ? `${meta.uniqueAreaFamilyCount}개 평형군` : '-'}
          </div>
          <div className="text-[10px] text-slate-500">거래 분석 대상군</div>
        </div>
      </div>

      {/* 3. Predecessor Land Share Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 font-semibold">
            <tr>
              <th className="p-3 sm:px-4">종전 단지</th>
              <th className="p-3 sm:px-4">평형군</th>
              <th className="p-3 sm:px-4">전용면적</th>
              <th className="p-3 sm:px-4">대지지분</th>
              <th className="p-3 sm:px-4">법정 기준</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {ratios.length > 0 ? (
              ratios.map((r) => (
                <tr key={r.areaFamilyId} className="hover:bg-slate-900/40 transition-colors">
                  <td className="p-3 sm:px-4 font-semibold text-slate-200">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      {getComplexDisplayName(r.complexId, r.complexName)}
                    </span>
                  </td>
                  <td className="p-3 sm:px-4 font-medium text-slate-200">
                    {r.areaFamilyLabel}
                  </td>
                  <td className="p-3 sm:px-4 text-slate-300 font-mono">
                    {formatExclusiveArea(r.exclusiveAreaSqm)}
                  </td>
                  <td className="p-3 sm:px-4 font-semibold text-slate-100 font-mono">
                    {r.landShareSqm.toFixed(2)}㎡
                  </td>
                  <td className="p-3 sm:px-4 text-[11px] text-slate-500">
                    관리처분인가 고시 기준
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="p-6 text-center text-xs text-slate-500">
                  단지형 아파트 대지지분 규격이 아닌 재개발 저층 주거지(단독·다세대) 구역으로 일괄 평형별 대지지분이 존재하지 않습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Mandatory Legal / Methodology Disclaimer */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 sm:p-4 text-xs text-slate-400 flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>대지지분 안내:</strong> 대지지분(대지권비율)은 자산의 물리적 토지 지분 비율을 나타내는 기술적 통계이며,
          재건축 수익률, 신축 평형 배정 순위, 또는 권리가액을 단독으로 추론하거나 결정하지 않습니다.
        </p>
      </div>
    </div>
  );
};
