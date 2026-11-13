import React, { useState, useMemo } from 'react';
import {
  Table as TableIcon,
  HelpCircle,
  FileText,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Info,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { EvidenceBadge } from './EvidenceBadge';
import { formatExclusiveArea } from '../../utils/redevelopmentAreaFormatters';
import type {
  ContributionMatrixData,
  ContributionMatrixRow,
  ContributionCellData,
} from '../../types/redevelopmentContributionMatrix';
import { buildDunchonContributionMatrix, DUNCHON_PLAN_VERSION_COMPARISON } from '../../data/dunchonContributionMatrix';

interface ContributionMatrixTableProps {
  matrixData: ContributionMatrixData;
  className?: string;
}

export const ContributionMatrixTable: React.FC<ContributionMatrixTableProps> = ({
  matrixData,
  className = '',
}) => {
  // Complex Filter: 'ALL' | 1 | 2 | 3 | 4
  const [selectedComplexFilter, setSelectedComplexFilter] = useState<string>('ALL');
  // Unit toggle: 'EOG' (억 원) | 'MANWON' (만 원)
  const [unitMode, setUnitMode] = useState<'EOG' | 'MANWON'>('EOG');
  // Selected Cell for modal / detail view
  const [selectedCell, setSelectedCell] = useState<{
    row: ContributionMatrixRow;
    colKey: string;
    colLabel: string;
    colAreaSqm: number;
    cell: ContributionCellData;
  } | null>(null);

  // Future Timeline Expansion Toggle
  const [isTimelineOpen, setIsTimelineOpen] = useState<boolean>(false);

  // Filtered rows by predecessor complex
  const filteredRows = useMemo(() => {
    if (selectedComplexFilter === 'ALL') return matrixData.rows;
    return matrixData.rows.filter((r) =>
      r.predecessorComplexName.includes(`${selectedComplexFilter}단지`)
    );
  }, [matrixData, selectedComplexFilter]);

  // Format money helper
  const formatMoney = (amountKrw: number | null, outcomeType: string) => {
    if (amountKrw === null || outcomeType === 'DATA_NOT_AVAILABLE') {
      return 'DATA_NOT_AVAILABLE';
    }
    const absVal = Math.abs(amountKrw);
    const isRefund = outcomeType === 'REFUND' || amountKrw < 0;

    if (unitMode === 'EOG') {
      const eog = absVal / 100_000_000;
      const formatted = eog >= 1 ? `${eog.toFixed(2)}억` : `${Math.round(absVal / 10_000).toLocaleString()}만`;
      return isRefund ? `-${formatted} (환급)` : `+${formatted} (분담)`;
    } else {
      const manwon = Math.round(absVal / 10_000);
      return isRefund ? `-${manwon.toLocaleString()}만원` : `+${manwon.toLocaleString()}만원`;
    }
  };

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-6 shadow-md ${className}`}>
      {/* 1. Header & Context */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <TableIcon className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base sm:text-lg font-bold text-slate-100">
              조합원 분담금 매트릭스 (Contribution Matrix)
            </h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            조합원이 종전자산 유형을 기준으로 신축 주택형을 신청했을 때 발생하는 법정 추가분담금 및 환급금 매트릭스입니다.
          </p>
        </div>

        {/* Provenance Badge & Unit Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setUnitMode('EOG')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                unitMode === 'EOG' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              억원 단위
            </button>
            <button
              onClick={() => setUnitMode('MANWON')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                unitMode === 'MANWON' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              만원 단위
            </button>
          </div>
        </div>
      </div>

      {/* 2. Evidence Classification Notice Bar */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
        <div className="flex items-center gap-2 font-bold text-slate-200">
          <Info className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>자료 출처(Evidence) 및 데이터 검증 정책</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1 text-[11px]">
          <div className="bg-slate-900/90 border border-indigo-500/20 rounded-lg p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-indigo-300">
              <EvidenceBadge level="OFFICIAL_GAZETTE" size="sm" />
            </div>
            <p className="text-slate-400 leading-snug">
              강동구청 관리처분계획인가 고시 (총사업비, 총괄 권리가액/비례율 등)
            </p>
          </div>

          <div className="bg-slate-900/90 border border-emerald-500/20 rounded-lg p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-300">
              <EvidenceBadge level="ASSOCIATION_DOCUMENT" size="sm" />
            </div>
            <p className="text-slate-400 leading-snug">
              조합 총회책자 및 관리처분 세부 원본 서류 (공식 진위 검증 시 영구 보존)
            </p>
          </div>

          <div className="bg-slate-900/90 border border-amber-500/20 rounded-lg p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-amber-300">
              <EvidenceBadge level="REFERENCE" size="sm" />
            </div>
            <p className="text-slate-400 leading-snug">
              언론보도 및 부동산 커뮤니티 재게시 사례 (Research Examples로 격리 관리)
            </p>
          </div>

          <div className="bg-slate-900/90 border border-slate-700/40 rounded-lg p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-400">
              <EvidenceBadge level="DATA_NOT_AVAILABLE" size="sm" />
            </div>
            <p className="text-slate-400 leading-snug">
              원자료 미확보 셀: 절대 임의 계산하지 않고 미확보로 명시 보호
            </p>
          </div>
        </div>
      </div>

      {/* 3. Complex Filter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-400 mr-1">종전 단지 필터:</span>
        {['ALL', '1', '2', '3', '4'].map((cKey) => (
          <button
            key={cKey}
            onClick={() => setSelectedComplexFilter(cKey)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              selectedComplexFilter === cKey
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            {cKey === 'ALL' ? '전체 단지 (16개 유형)' : `${cKey}단지`}
          </button>
        ))}
      </div>

      {/* 4. Matrix Table with Sticky Column */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 shadow-inner">
        <div className="overflow-x-auto max-h-[540px]">
          <table className="w-full text-left text-xs border-collapse min-w-[980px]">
            {/* Table Head: Columns & Member Sale Prices */}
            <thead className="bg-slate-900/95 sticky top-0 z-20 backdrop-blur border-b border-slate-800">
              <tr>
                {/* Fixed Left Columns: Predecessor Specs */}
                <th
                  rowSpan={2}
                  className="py-3 px-3.5 font-bold text-slate-300 border-r border-slate-800 sticky left-0 bg-slate-900 z-30 min-w-[130px]"
                >
                  종전 단지
                </th>
                <th
                  rowSpan={2}
                  className="py-3 px-3.5 font-bold text-slate-300 border-r border-slate-800 min-w-[110px]"
                >
                  종전 전용면적
                </th>
                <th
                  rowSpan={2}
                  className="py-3 px-3 font-bold text-slate-400 border-r border-slate-800 min-w-[85px]"
                >
                  대지지분
                </th>
                <th
                  rowSpan={2}
                  className="py-3 px-3 font-bold text-slate-400 border-r border-slate-800 min-w-[100px]"
                >
                  종전자산평가액
                </th>
                <th
                  rowSpan={2}
                  className="py-3 px-3 font-bold text-slate-400 border-r border-slate-800 min-w-[95px]"
                >
                  권리가액
                </th>

                {/* Right Columns: Successor Types */}
                {matrixData.columns.map((col) => (
                  <th
                    key={col.successorFamilyId}
                    className="py-2.5 px-3 text-center border-r border-slate-800 last:border-r-0 min-w-[120px]"
                  >
                    <div className="font-bold text-slate-200">
                      {col.successorAreaFamilyLabel}
                    </div>
                    <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                      {formatExclusiveArea(col.exclusiveAreaSqm)}
                    </div>
                  </th>
                ))}
              </tr>

              {/* Sub-header: 조합원분양가 for each column */}
              <tr className="bg-slate-950/90 text-[10px] text-slate-400 border-t border-slate-800/60">
                {matrixData.columns.map((col) => (
                  <th
                    key={`price-${col.successorFamilyId}`}
                    className="py-1.5 px-2 text-center border-r border-slate-800 last:border-r-0 font-normal"
                  >
                    <span className="text-slate-500">분양가: </span>
                    <span className="text-slate-400 font-medium">
                      {col.memberSalePriceKrw === 'DATA_NOT_AVAILABLE' ? '확인 불가' : col.memberSalePriceKrw}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-800/80">
              {filteredRows.map((row) => (
                <tr
                  key={row.predecessorFamilyId}
                  className="hover:bg-slate-900/50 transition-colors"
                >
                  {/* Sticky Column: Predecessor Complex */}
                  <td className="py-3 px-3.5 font-bold text-slate-200 border-r border-slate-800 sticky left-0 bg-slate-950 z-10">
                    <div className="truncate">{row.predecessorComplexName}</div>
                    <div className="text-[10px] text-slate-500 font-normal">{row.predecessorAreaFamilyLabel}</div>
                  </td>

                  {/* Predecessor Exclusive Area */}
                  <td className="py-3 px-3.5 text-slate-300 font-medium border-r border-slate-800">
                    {formatExclusiveArea(row.exclusiveAreaSqm)}
                  </td>

                  {/* Land Share */}
                  <td className="py-3 px-3 text-slate-400 border-r border-slate-800 font-mono text-[11px]">
                    {row.landShareSqm ? `${row.landShareSqm.toFixed(2)}㎡` : '확인 불가'}
                  </td>

                  {/* Appraised Value (Row level) */}
                  <td className="py-3 px-3 text-slate-400 border-r border-slate-800 text-[11px]">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-slate-900 text-slate-400 border border-slate-800">
                      확인 불가
                    </span>
                  </td>

                  {/* Rights Value (Row level) */}
                  <td className="py-3 px-3 text-slate-400 border-r border-slate-800 text-[11px]">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-slate-900 text-slate-400 border border-slate-800">
                      확인 불가
                    </span>
                  </td>

                  {/* Successor Cells */}
                  {matrixData.columns.map((col) => {
                    const cell = row.cells[col.successorFamilyId];
                    const isAvailable = cell && cell.outcomeType !== 'DATA_NOT_AVAILABLE';
                    const isRefund = cell?.outcomeType === 'REFUND';

                    return (
                      <td
                        key={col.successorFamilyId}
                        onClick={() =>
                          setSelectedCell({
                            row,
                            colKey: col.successorFamilyId,
                            colLabel: col.successorAreaFamilyLabel,
                            colAreaSqm: col.exclusiveAreaSqm,
                            cell,
                          })
                        }
                        className={`py-2.5 px-3 text-center border-r border-slate-800 last:border-r-0 cursor-pointer transition-all ${
                          isAvailable
                            ? isRefund
                              ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-bold'
                              : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold'
                            : 'hover:bg-slate-900 text-slate-500'
                        }`}
                      >
                        {isAvailable ? (
                          <div className="space-y-1">
                            <div className="text-xs">
                              {formatMoney(cell.amountKrw, cell.outcomeType)}
                            </div>
                            <div className="flex justify-center">
                              <EvidenceBadge level={cell.provenance} size="sm" />
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 select-none">
                            DATA_NOT_AVAILABLE
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Detail Modal / Drawer on Cell Click */}
      {selectedCell && (
        <div
          id="contribution-cell-modal"
          className="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-200 text-sm">
                세부 분담금 정보: {selectedCell.row.predecessorComplexName} (
                {formatExclusiveArea(selectedCell.row.exclusiveAreaSqm)}) → {selectedCell.colLabel} (
                {formatExclusiveArea(selectedCell.colAreaSqm)})
              </span>
            </div>
            <button
              onClick={() => setSelectedCell(null)}
              className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 bg-slate-900 rounded border border-slate-800"
            >
              닫기
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[11px]">정산 결과 유형</div>
              <div className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                {selectedCell.cell.outcomeType === 'REFUND' ? (
                  <>
                    <TrendingDown className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">환급금 발생</span>
                  </>
                ) : selectedCell.cell.outcomeType === 'ADDITIONAL_CONTRIBUTION' ? (
                  <>
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-400">추가분담금 납부</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-400">자료 미확보 (DATA_NOT_AVAILABLE)</span>
                  </>
                )}
              </div>
              <div className="text-slate-300 font-semibold pt-1">
                {selectedCell.cell.amountKrw !== null
                  ? `${(Math.abs(selectedCell.cell.amountKrw) / 100_000_000).toFixed(2)}억 원 (${selectedCell.cell.amountKrw.toLocaleString()}원)`
                  : '공식 데이터 부재로 금액 산출 불가'}
              </div>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[11px]">자료 출처 및 검증 상태</div>
              <div className="pt-0.5">
                <EvidenceBadge level={selectedCell.cell.provenance} size="sm" />
              </div>
              <div className="text-slate-400 text-[11px] pt-1">
                {selectedCell.cell.sourceTitle || '공식 인가 서류 또는 총회 원본 입수 대기 중'}
              </div>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[11px]">법정 정산 공식 및 비고</div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {selectedCell.cell.notes || '공식/검증 원자료가 없는 항목은 임의 계산하지 않습니다.'}
              </p>
              <div className="text-[10px] text-slate-500">
                수식: 추가분담금 = 조합원분양가 - 권리가액 (종전자산평가액 × 비례율)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Future Timeline & Cost Escalation Connection Hook */}
      <div className="bg-slate-950 border border-slate-800/80 rounded-xl overflow-hidden">
        <button
          onClick={() => setIsTimelineOpen(!isTimelineOpen)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-900/60 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span className="text-xs sm:text-sm font-bold text-slate-200">
              향후 연결: 시점별 관리처분계획 변경 및 공사비 변동 비교 구조
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{isTimelineOpen ? '접기' : '비교 구조 펼치기'}</span>
            {isTimelineOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isTimelineOpen && (
          <div className="p-4 pt-0 border-t border-slate-800/60 space-y-3.5 text-xs text-slate-400">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-amber-300 leading-relaxed">
              <strong>엄격한 분석 원칙:</strong> 공사비 변동이 개별 조합원 분담금에 미치는 영향은 단순 공사비 증가액 ÷ 조합원 수(1/N)로 추정하지 않습니다.
              오직 조합 총회 및 관할 구청의 인가를 받은 관리처분계획 변경(비례율 재산정 및 공식 분담금표 갱신) 자료를 통해서만 시점별 차이를 비교합니다.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {DUNCHON_PLAN_VERSION_COMPARISON.versions.map((ver, vIdx) => (
                <div key={ver.versionId} className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {ver.versionLabel}
                    </span>
                    <span className="text-[10px] text-slate-500">버전 #{vIdx + 1}</span>
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between text-slate-400">
                      <span>총 공사비:</span>
                      <span className="text-slate-200 font-mono">
                        {ver.totalConstructionCostKrw ? `${(ver.totalConstructionCostKrw / 1_000_000_000_000).toFixed(2)}조 원` : '미확인'}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>사업 비례율:</span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        {ver.proportionalRatePercent ? `${ver.proportionalRatePercent}%` : 'PENDING (공식원문 미명시)'}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>분담금 세부표 입수 상태:</span>
                      <span className="text-emerald-400 font-medium">검증 및 연구사례 매트릭스 등록됨</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
