import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  CompareTarget,
  ResolvedCompareTarget,
  CompareMode,
  ComparePeriod,
  CompareCalculationResult,
  AreaFamily,
} from '../types';
import { formatPrice, formatSqmPrice } from '../utils/calculations';
import { TARGET_COMPLEXES } from '../data/complexesData';
import { AREA_FAMILIES_REGISTRY } from '../data/areaFamilies';
import { loadCompareSeries, resolveCompareTarget } from '../services/compareDataService';
import { calculateCompare } from '../utils/compareCalculations';
import {
  Layers,
  TrendingUp,
  BarChart3,
  Plus,
  ArrowRight,
  Percent,
  X,
  Building2,
  AlertTriangle,
  RefreshCw,
  Search,
} from 'lucide-react';

export interface MultiComplexCompareProps {
  initialTargets?: CompareTarget[];
  onNavigateToAnalysis?: (complexId: string) => void;
  // Legacy optional props for backward compatibility
  compareIds?: string[];
  onToggleCompareId?: (id: string) => void;
  normalizedSeries?: any[];
  stats?: any[];
  selectedArea?: any;
  onSelectArea?: (area: any) => void;
  baselineOption?: any;
  onBaselineChange?: (b: any) => void;
}

const LINE_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#06b6d4'];

const COMPARE_MODES: { value: CompareMode; label: string; desc: string }[] = [
  { value: 'ABSOLUTE_PRICE', label: '절대가격', desc: '월별 실거래 대표가격(만원)' },
  { value: 'PRICE_PER_PYEONG', label: '평당가', desc: '공급면적 기준 평당 가격(만원/평)' },
  { value: 'BASE_100', label: '가격지수 (Base 100)', desc: '공통 기준월 대비 상대 수익률 지수' },
];

const PERIOD_OPTIONS: { value: ComparePeriod; label: string }[] = [
  { value: '1Y', label: '최근 1년' },
  { value: '3Y', label: '최근 3년' },
  { value: '5Y', label: '최근 5년' },
  { value: '10Y', label: '최근 10년' },
  { value: 'ALL', label: '전체 기간' },
];

/**
 * Resolve initial CompareTarget[] from props
 */
function getInitialTargets(
  initialTargets?: CompareTarget[],
  compareIds?: string[]
): CompareTarget[] {
  if (initialTargets && initialTargets.length >= 2) {
    return initialTargets;
  }
  if (compareIds && compareIds.length >= 2) {
    return compareIds.slice(0, 5).map((cId) => {
      const families = AREA_FAMILIES_REGISTRY[cId] || [];
      const f84 = families.find((f) => f.standardCategory === '84' && f.id !== 'namcheon_xi_142');
      const f59 = families.find((f) => f.standardCategory === '59' && f.id !== 'namcheon_xi_142');
      const family = f84 || f59 || families[0];
      return {
        complexId: cId,
        areaFamilyId: family ? family.id : `${cId}_84`,
      };
    });
  }
  return [
    { complexId: 'banpo_xi', areaFamilyId: 'banpo_xi_84' },
    { complexId: 'jamsil_els', areaFamilyId: 'jamsil_els_84' },
  ];
}

export const MultiComplexCompare: React.FC<MultiComplexCompareProps> = ({
  initialTargets,
  onNavigateToAnalysis,
  compareIds,
}) => {
  // 1. Independent Target State: CompareTarget[]
  const [targets, setTargets] = useState<CompareTarget[]>(() =>
    getInitialTargets(initialTargets, compareIds)
  );

  // 2. Mode and Period State
  const [compareMode, setCompareMode] = useState<CompareMode>('ABSOLUTE_PRICE');
  const [period, setPeriod] = useState<ComparePeriod>('ALL');

  // 3. Calculation & Loading State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [calcResult, setCalcResult] = useState<CompareCalculationResult | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // 4. Add Modal State
  const [isAddMenuOpen, setIsAddMenuOpen] = useState<boolean>(false);
  const [filterRegion, setFilterRegion] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedComplexToAdd, setSelectedComplexToAdd] = useState<string | null>(null);

  // 5. Race Condition Guard Ref
  const reqIdRef = useRef<number>(0);

  // Synchronize when initialTargets prop explicitly changes
  useEffect(() => {
    if (initialTargets && initialTargets.length >= 2) {
      setTargets(initialTargets);
    }
  }, [initialTargets]);

  // Main Data Loading Effect via Phase 7A Data & Calculation Layer
  useEffect(() => {
    const currentReqId = ++reqIdRef.current;
    setIsLoading(true);
    setFetchError(null);

    loadCompareSeries(targets)
      .then((loadedResults) => {
        if (reqIdRef.current !== currentReqId) return; // Discard stale responses
        const result = calculateCompare(loadedResults, {
          mode: compareMode,
          period,
        });
        setCalcResult(result);
        setIsLoading(false);
      })
      .catch((err: any) => {
        if (reqIdRef.current !== currentReqId) return;
        setFetchError(err?.message || '비교 데이터 로딩 중 오류가 발생했습니다.');
        setIsLoading(false);
      });
  }, [targets, compareMode, period]);

  // Target Management Handlers
  const handleAreaFamilyChange = (targetIndex: number, newAreaFamilyId: string) => {
    const target = targets[targetIndex];
    if (!target || target.areaFamilyId === newAreaFamilyId) return;

    // Check exact duplicate: same complexId + newAreaFamilyId already exists
    const isDuplicate = targets.some(
      (t, idx) =>
        idx !== targetIndex &&
        t.complexId === target.complexId &&
        t.areaFamilyId === newAreaFamilyId
    );
    if (isDuplicate) return;

    // TARGET_AREA_CHANGE_INDEPENDENT: Update only this target!
    setTargets((prev) =>
      prev.map((t, idx) => (idx === targetIndex ? { ...t, areaFamilyId: newAreaFamilyId } : t))
    );
  };

  const handleRemoveTarget = (targetIndex: number) => {
    if (targets.length <= 2) return; // Keep minimum 2 targets
    setTargets((prev) => prev.filter((_, idx) => idx !== targetIndex));
  };

  const handleAddTarget = (complexId: string, areaFamilyId: string) => {
    if (targets.length >= 5) return;
    const targetKey = `${complexId}::${areaFamilyId}`;
    if (targets.some((t) => `${t.complexId}::${t.areaFamilyId}` === targetKey)) return;

    setTargets((prev) => [...prev, { complexId, areaFamilyId }]);
    setIsAddMenuOpen(false);
    setSelectedComplexToAdd(null);
  };

  // Prepare flattened chart data from Phase 7A unifiedChartPoints
  const chartData = useMemo(() => {
    if (!calcResult) return [];
    return calcResult.unifiedChartPoints.map((pt) => ({
      displayDate: pt.displayDate,
      date: pt.date,
      ...pt.values,
    }));
  }, [calcResult]);

  // Filter available complexes for Add Modal
  const filteredComplexesToAdd = useMemo(() => {
    return TARGET_COMPLEXES.filter((c) => {
      if (filterRegion === 'SEOUL' && !c.province.includes('서울')) return false;
      if (filterRegion === 'GYEONGGI' && !c.province.includes('경기')) return false;
      if (filterRegion === 'BUSAN' && c.region !== 'BUSAN') return false;

      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchName = c.name.toLowerCase().includes(query);
        const matchDistrict = c.district.toLowerCase().includes(query);
        const matchShort = c.shortName.toLowerCase().includes(query);
        return matchName || matchDistrict || matchShort;
      }
      return true;
    });
  }, [filterRegion, searchQuery]);

  // Tooltip Formatter
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl text-xs space-y-1.5 z-50 min-w-[240px]">
        <div className="font-bold text-slate-200 border-b border-slate-800 pb-1 flex items-center justify-between">
          <span>{label}</span>
          <span className="text-[10px] text-slate-400 font-normal">
            {compareMode === 'BASE_100'
              ? calcResult?.commonBaseYmd
                ? `기준(${calcResult.commonBaseYmd.slice(0, 4)}.${calcResult.commonBaseYmd.slice(4, 6)}) = 100`
                : '기준 = 100'
              : compareMode === 'PRICE_PER_PYEONG'
              ? '단위: 만원/평 (공급면적 기준)'
              : '단위: 만원'}
          </span>
        </div>
        <div className="space-y-1.5 pt-1">
          {payload.map((item: any) => {
            const val = item.value;
            if (val === null || val === undefined) return null;

            let formattedVal = '';
            if (compareMode === 'BASE_100') {
              const diffPct = Math.round((val - 100) * 10) / 10;
              formattedVal = `${val.toFixed(1)}p (${diffPct >= 0 ? `+${diffPct}%` : `${diffPct}%`})`;
            } else if (compareMode === 'PRICE_PER_PYEONG') {
              formattedVal = `${Math.round(val).toLocaleString()} 만원/평`;
            } else {
              formattedVal = formatPrice(val);
            }

            return (
              <div key={item.dataKey} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-300 truncate font-medium">{item.name}</span>
                </span>
                <span className="font-mono font-bold" style={{ color: item.color }}>
                  {formattedVal}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Comparison Header & Target Cards */}
      <div className="bg-slate-900 border border-indigo-900/50 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                <Layers className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-100 tracking-tight">
                  단지·주택형 다중 비교 분석 (최대 5개)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  단지별 전용 주택형(AreaFamily) 단위 독립 비교 및 상대 수익률·공급평당 가격 분석
                </p>
              </div>
            </div>
          </div>

          {/* Compare Mode Selector Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start lg:self-auto">
            {COMPARE_MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => setCompareMode(m.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  compareMode === m.value
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={m.desc}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Target Chips & Per-Target AreaFamily Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              비교 대상 ({targets.length}/5):
            </span>

            {/* Period Selector */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-500 text-[11px] mr-1 font-medium">기간:</span>
              {PERIOD_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    period === p.value
                      ? 'bg-slate-800 text-indigo-300 border border-indigo-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap pt-1">
            {targets.map((target, idx) => {
              const resolved = resolveCompareTarget(target).resolved;
              const families = AREA_FAMILIES_REGISTRY[target.complexId] || [];
              const color = LINE_COLORS[idx % LINE_COLORS.length];
              const targetKey = `${target.complexId}::${target.areaFamilyId}`;

              return (
                <div
                  key={targetKey}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border bg-slate-950/90 shadow-sm"
                  style={{ borderColor: `${color}60` }}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-slate-200 font-semibold">{resolved?.shortName || target.complexId}</span>

                  {/* Per-target AreaFamily Selector */}
                  <select
                    value={target.areaFamilyId}
                    onChange={(e) => handleAreaFamilyChange(idx, e.target.value)}
                    className="bg-slate-900 text-indigo-300 border border-slate-700/80 rounded-lg px-2 py-0.5 text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {families.map((f) => {
                      const isSelf = f.id === target.areaFamilyId;
                      const isDuplicate = targets.some(
                        (other, oIdx) =>
                          oIdx !== idx &&
                          other.complexId === target.complexId &&
                          other.areaFamilyId === f.id
                      );
                      const hasData = f.id !== 'namcheon_xi_142';
                      const match = f.label.match(/(\d+)㎡?형?/);
                      const buttonLabel = match
                        ? `${match[1]}㎡형`
                        : `${Math.round(f.representativeExclusiveArea)}㎡형`;

                      return (
                        <option
                          key={f.id}
                          value={f.id}
                          disabled={!hasData || (isDuplicate && !isSelf)}
                          className="bg-slate-900 text-slate-100"
                        >
                          {buttonLabel}
                          {!hasData ? ' · 거래 없음' : ''}
                          {isDuplicate && !isSelf ? ' (이미 선택됨)' : ''}
                        </option>
                      );
                    })}
                  </select>

                  {targets.length > 2 && (
                    <button
                      onClick={() => handleRemoveTarget(idx)}
                      className="p-0.5 text-slate-400 hover:text-rose-300 rounded hover:bg-slate-800 transition-colors ml-0.5"
                      title="비교에서 제거"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Add Target Button & Modal */}
            {targets.length < 5 && (
              <div className="relative">
                <button
                  onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>비교 대상 추가</span>
                </button>

                {isAddMenuOpen && (
                  <div className="absolute top-full left-0 mt-2 z-50 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <span className="text-xs font-bold text-slate-200">
                        {selectedComplexToAdd ? '평형(AreaFamily) 선택' : '비교 단지 선택'}
                      </span>
                      <button
                        onClick={() => {
                          setIsAddMenuOpen(false);
                          setSelectedComplexToAdd(null);
                        }}
                        className="text-slate-400 hover:text-white p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {!selectedComplexToAdd ? (
                      <>
                        <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1.5 rounded-lg border border-slate-800">
                          <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <input
                            type="text"
                            placeholder="단지명 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none w-full"
                          />
                        </div>

                        <div className="flex items-center gap-1 text-[11px]">
                          {['ALL', 'SEOUL', 'GYEONGGI', 'BUSAN'].map((r) => (
                            <button
                              key={r}
                              onClick={() => setFilterRegion(r)}
                              className={`px-2 py-0.5 rounded-lg font-medium transition-colors ${
                                filterRegion === r
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {r === 'ALL' ? '전체' : r === 'SEOUL' ? '서울' : r === 'GYEONGGI' ? '경기' : '부산'}
                            </button>
                          ))}
                        </div>

                        <div className="max-h-56 overflow-y-auto space-y-1 no-scrollbar">
                          {filteredComplexesToAdd.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => setSelectedComplexToAdd(c.id)}
                              className="w-full text-left p-2 rounded-xl bg-slate-950/60 hover:bg-slate-800 text-xs flex items-center justify-between text-slate-200 transition-colors"
                            >
                              <div>
                                <div className="font-bold text-slate-100">{c.name}</div>
                                <div className="text-[10px] text-slate-400">{c.district} · {c.subRegion}</div>
                              </div>
                              <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-xs text-slate-300 font-medium pb-1 flex items-center justify-between">
                          <span className="font-bold text-indigo-400">
                            {TARGET_COMPLEXES.find((c) => c.id === selectedComplexToAdd)?.name}
                          </span>
                          <button
                            onClick={() => setSelectedComplexToAdd(null)}
                            className="text-[11px] text-slate-400 hover:text-slate-200"
                          >
                            단지 다시 선택
                          </button>
                        </div>

                        <div className="max-h-56 overflow-y-auto space-y-1.5 no-scrollbar">
                          {(AREA_FAMILIES_REGISTRY[selectedComplexToAdd] || []).map((f) => {
                            const targetKey = `${selectedComplexToAdd}::${f.id}`;
                            const isAlreadyAdded = targets.some(
                              (t) => `${t.complexId}::${t.areaFamilyId}` === targetKey
                            );
                            const hasData = f.id !== 'namcheon_xi_142';
                            const match = f.label.match(/(\d+)㎡?형?/);
                            const buttonLabel = match
                              ? `${match[1]}㎡형`
                              : `${Math.round(f.representativeExclusiveArea)}㎡형`;

                            return (
                              <button
                                key={f.id}
                                disabled={isAlreadyAdded || !hasData}
                                onClick={() => handleAddTarget(selectedComplexToAdd, f.id)}
                                className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                                  isAlreadyAdded || !hasData
                                    ? 'bg-slate-950/40 text-slate-500 cursor-not-allowed border border-slate-900'
                                    : 'bg-slate-950/70 hover:bg-indigo-950/80 text-slate-200 border border-slate-800 hover:border-indigo-600/50'
                                }`}
                              >
                                <div>
                                  <div className="font-bold text-slate-100 flex items-center gap-1.5">
                                    <span>{buttonLabel}</span>
                                    {!hasData && (
                                      <span className="text-[10px] text-rose-400 font-normal">
                                        (거래 없음)
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400">{f.label}</div>
                                </div>
                                <span className="text-[11px] text-indigo-400 font-medium">
                                  {isAlreadyAdded ? '추가됨' : '+ 추가'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Compare Chart Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm sm:text-base font-bold text-slate-100">
              {compareMode === 'BASE_100'
                ? '상대 수익률 지수 추이 (Base 100)'
                : compareMode === 'PRICE_PER_PYEONG'
                ? '공급평당 시세 추이 (만원/평)'
                : '실거래 대표가격 추이 (만원)'}
            </h3>
          </div>

          {/* Base 100 Common Base Month Info or Error Warning */}
          {compareMode === 'BASE_100' && (
            <div>
              {calcResult?.base100Status === 'SUCCESS' && calcResult.commonBaseYmd ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-950/80 border border-indigo-500/40 text-xs text-indigo-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  <span>
                    기준월:{' '}
                    <strong className="font-mono text-white">
                      {calcResult.commonBaseYmd.slice(0, 4)}.{calcResult.commonBaseYmd.slice(4, 6)}
                    </strong>{' '}
                    = 100
                  </span>
                </div>
              ) : calcResult?.base100Status === 'NO_COMMON_BASE_MONTH' ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-950/60 border border-amber-600/40 text-xs text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>선택한 기간에 모든 비교 대상의 공통 거래월이 없습니다.</span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Partial Failure Warning Banner (if any target has NO_MONTHLY_DATA) */}
        {calcResult?.targets.some((t) => t.status !== 'SUCCESS') && (
          <div className="flex items-center gap-2 flex-wrap text-xs bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              미관측 타깃:
            </span>
            {calcResult.targets
              .filter((t) => t.status !== 'SUCCESS')
              .map((t) => (
                <span
                  key={t.target.targetKey}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-rose-950/60 border border-rose-800/40 text-rose-300 text-[11px]"
                >
                  <span>
                    {t.target.shortName} · {t.target.areaFamilyButtonLabel}:
                  </span>
                  <span className="font-semibold">
                    {t.status === 'DATA_NOT_AVAILABLE'
                      ? '공급면적 미확인 (평당가 산출 제외)'
                      : '거래 데이터 없음'}
                  </span>
                </span>
              ))}
          </div>
        )}

        {/* Chart Viewport */}
        <div className="h-[340px] sm:h-[420px] w-full pt-2 relative">
          {isLoading && (
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-xl">
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>데이터 불러오는 중...</span>
              </div>
            </div>
          )}

          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} vertical={false} />
                <XAxis
                  dataKey="displayDate"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  minTickGap={28}
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  domain={['auto', 'auto']}
                  tickFormatter={(v) => {
                    if (compareMode === 'BASE_100') return `${v}p`;
                    if (compareMode === 'PRICE_PER_PYEONG') return `${v}만/평`;
                    return formatPrice(v);
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />

                {calcResult?.targets
                  .filter((t) => t.status === 'SUCCESS')
                  .map((t, idx) => {
                    const color = LINE_COLORS[idx % LINE_COLORS.length];
                    return (
                      <Line
                        key={t.target.targetKey}
                        type="monotone"
                        dataKey={t.target.targetKey}
                        name={`${t.target.shortName} · ${t.target.areaFamilyButtonLabel}`}
                        stroke={color}
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 5, fill: color }}
                        connectNulls={false}
                      />
                    );
                  })}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              {fetchError || '선택한 기간에 표시할 실거래 데이터가 없습니다.'}
            </div>
          )}
        </div>
      </div>

      {/* 3. Comprehensive Metrics Table (Desktop >= 768px) */}
      <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm sm:text-base font-bold text-slate-100">
            타깃별 핵심 지표 종합 비교표
          </h3>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="text-[11px] uppercase bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700">
              <tr>
                <th className="py-3 px-3">단지명 / 주택형</th>
                <th className="py-3 px-3">최근 대표가격</th>
                <th className="py-3 px-3">기간 수익률</th>
                <th className="py-3 px-3">연평균 복합 성장률(CAGR)</th>
                <th className="py-3 px-3">최대 낙폭(MDD)</th>
                <th className="py-3 px-3">역대 최고가</th>
                <th className="py-3 px-3">총 거래 건수</th>
                {onNavigateToAnalysis && <th className="py-3 px-3 text-center">심층분석</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {calcResult?.targets.map((tr, idx) => {
                const color = LINE_COLORS[idx % LINE_COLORS.length];
                const { target, status, metrics } = tr;
                const isNoData = status !== 'SUCCESS' || !metrics;

                if (isNoData) {
                  return (
                    <tr key={target.targetKey} className="hover:bg-slate-800/40 transition-colors opacity-75">
                      <td className="py-3 px-3 font-semibold flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <div>
                          <div className="text-slate-100">{target.complexName}</div>
                          <div className="text-[11px] text-indigo-300 font-medium">
                            {target.areaFamilyButtonLabel}
                          </div>
                        </div>
                      </td>
                      <td
                        colSpan={onNavigateToAnalysis ? 7 : 6}
                        className="py-3 px-3 text-amber-400 font-medium italic"
                      >
                        {status === 'DATA_NOT_AVAILABLE'
                          ? '공급면적 데이터 부재로 평당가 산출 불가 (DATA_NOT_AVAILABLE)'
                          : '선택한 기간에 거래 데이터가 없습니다. (거래 데이터 없음)'}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={target.targetKey} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-semibold flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <div>
                        <div className="text-slate-100">{target.complexName}</div>
                        <div className="text-[11px] text-indigo-300 font-medium">
                          {target.areaFamilyButtonLabel}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-100 font-mono">
                      {formatPrice(metrics.lastObservedPrice)}
                      <span className="text-[10px] text-slate-500 block font-normal">
                        {metrics.lastObservedDate}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold font-mono">
                      <span className={metrics.returnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {metrics.returnPct >= 0 ? `+${metrics.returnPct}%` : `${metrics.returnPct}%`}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold font-mono">
                      {metrics.cagrPct != null ? (
                        <span className={metrics.cagrPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {metrics.cagrPct >= 0 ? `+${metrics.cagrPct}%/년` : `${metrics.cagrPct}%/년`}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-medium text-rose-400 font-mono">
                      <div>
                        -{metrics.mddPct}%
                        {metrics.mddIsLowSample && (
                          <span
                            className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-sans font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 cursor-help inline-block align-middle"
                            title="월별 실거래 대표가격 기준입니다.&#10;고점월 또는 저점월의 거래 표본이 1건으로,&#10;시장가격 대표성이 낮을 수 있습니다."
                          >
                            저표본 구간
                          </span>
                        )}
                      </div>
                      {metrics.mddIsLowSample && metrics.mddPeakTradeCount !== undefined && metrics.mddTroughTradeCount !== undefined && (
                        <span className="text-[10px] text-slate-400 block font-normal mt-0.5">
                          고점 {metrics.mddPeakTradeCount}건 · 저점 {metrics.mddTroughTradeCount}건
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-300 font-mono">
                      {formatPrice(metrics.athPrice)}
                      <span className="text-[10px] text-slate-500 block">({metrics.athDate})</span>
                    </td>
                    <td className="py-3 px-3 text-slate-300 font-mono">
                      {metrics.totalTrades.toLocaleString()}건
                      <span className="text-[10px] text-slate-500 block">
                        ({metrics.observedMonthsCount}개월)
                      </span>
                    </td>
                    {onNavigateToAnalysis && (
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => onNavigateToAnalysis(target.complexId)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-emerald-600 hover:text-slate-950 text-slate-300 text-xs font-semibold transition-colors inline-flex items-center gap-1"
                        >
                          <span>분석</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Mobile Cards (< 768px) */}
      <div className="md:hidden space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-100">
            타깃별 핵심 지표 카드 ({calcResult?.targets.length || 0}개)
          </h3>
        </div>

        {calcResult?.targets.map((tr, idx) => {
          const color = LINE_COLORS[idx % LINE_COLORS.length];
          const { target, status, metrics } = tr;
          const isNoData = status !== 'SUCCESS' || !metrics;

          return (
            <div
              key={target.targetKey}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <div>
                    <h4 className="font-bold text-sm text-slate-100 truncate">{target.complexName}</h4>
                    <p className="text-[11px] text-indigo-400 font-medium">{target.areaFamilyButtonLabel}</p>
                  </div>
                </div>
                {onNavigateToAnalysis && (
                  <button
                    onClick={() => onNavigateToAnalysis(target.complexId)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 active:bg-emerald-500 text-slate-950 text-xs font-bold shrink-0 flex items-center gap-1"
                  >
                    <span>상세분석</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {!isNoData ? (
                <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">최근 대표가격</span>
                    <span className="text-sm font-bold text-emerald-400 font-mono">
                      {formatPrice(metrics.lastObservedPrice)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">기간 수익률</span>
                    <span className="font-semibold font-mono text-[11px]">
                      <span className={metrics.returnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {metrics.returnPct >= 0 ? `+${metrics.returnPct}%` : `${metrics.returnPct}%`}
                      </span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">CAGR</span>
                    <span className="font-semibold font-mono text-[11px] text-slate-200">
                      {metrics.cagrPct != null ? `${metrics.cagrPct}%/년` : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">최대낙폭</span>
                    <span className="font-semibold font-mono text-[11px] text-rose-400">
                      -{metrics.mddPct}%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-950/60 rounded-xl border border-amber-900/40 text-xs text-amber-300">
                  선택한 기간에 거래 데이터가 없습니다.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
