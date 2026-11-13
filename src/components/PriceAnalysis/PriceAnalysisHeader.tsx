import React, { useState, useRef, useEffect } from 'react';
import {
  Building2,
  ChevronDown,
  Search,
  MapPin,
  Sparkles,
  Layers,
  Calendar,
  Filter,
} from 'lucide-react';
import { ComplexInfo, AreaCategory, AreaFamilyMetadata, AnalysisPeriod } from '../../types';
import { TARGET_COMPLEXES } from '../../data/complexesData';
import { formatAreaFamilyButtonLabel, formatAreaFamilySubtext } from '../../utils/areaFamilyUtils';

interface PriceAnalysisHeaderProps {
  complex: ComplexInfo;
  onSelectComplex: (id: string) => void;
  areaFamilies: AreaFamilyMetadata[];
  selectedAreaFamilyId: string | null;
  onSelectAreaFamily: (familyId: string) => void;
  isLoadingFamilies?: boolean;
  analysisPeriod: AnalysisPeriod;
  onChangePeriod: (period: AnalysisPeriod) => void;
  onNavigateToMap: () => void;
  onOpenAiDrawer: () => void;
}

export const PriceAnalysisHeader: React.FC<PriceAnalysisHeaderProps> = ({
  complex,
  onSelectComplex,
  areaFamilies,
  selectedAreaFamilyId,
  onSelectAreaFamily,
  isLoadingFamilies = false,
  analysisPeriod,
  onChangePeriod,
  onNavigateToMap,
  onOpenAiDrawer,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<'ALL' | 'SEOUL_METRO' | 'BUSAN'>('ALL');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter complexes for dropdown
  const filteredComplexes = TARGET_COMPLEXES.filter((c) => {
    const matchesRegion = selectedRegionFilter === 'ALL' || c.region === selectedRegionFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.shortName.toLowerCase().includes(q) ||
      c.district.toLowerCase().includes(q);
    return matchesRegion && matchesSearch;
  });

  const periodOptions: { id: '1Y' | '3Y' | '5Y' | '10Y' | 'ALL'; label: string }[] = [
    { id: '1Y', label: '1년' },
    { id: '3Y', label: '3년' },
    { id: '5Y', label: '5년' },
    { id: '10Y', label: '10년' },
    { id: 'ALL', label: '전체' },
  ];

  const selectedFamily = areaFamilies.find((f) => f.areaFamilyId === selectedAreaFamilyId);

  const handleSelectPreset = (preset: '1Y' | '3Y' | '5Y' | '10Y' | 'ALL') => {
    const endYear = 2026;
    const endMonthNum = 9;
    const endMonth = '2026.09';
    const endYmd = '202609';

    let startYear = 2021;
    let startMonthNum = 9;

    if (preset === '1Y') {
      startYear = 2025;
      startMonthNum = 9;
    } else if (preset === '3Y') {
      startYear = 2023;
      startMonthNum = 9;
    } else if (preset === '5Y') {
      startYear = 2021;
      startMonthNum = 9;
    } else if (preset === '10Y') {
      startYear = 2016;
      startMonthNum = 9;
    } else if (preset === 'ALL') {
      if (selectedFamily?.firstDealYmd && selectedFamily.firstDealYmd.length === 6) {
        startYear = parseInt(selectedFamily.firstDealYmd.slice(0, 4), 10);
        startMonthNum = parseInt(selectedFamily.firstDealYmd.slice(4, 6), 10);
      } else {
        startYear = 2006;
        startMonthNum = 1;
      }
    }

    const startMonthStr = startMonthNum < 10 ? `0${startMonthNum}` : `${startMonthNum}`;
    const startMonth = `${startYear}.${startMonthStr}`;
    const startYmd = `${startYear}${startMonthStr}`;

    onChangePeriod({
      startMonth,
      endMonth,
      startYmd,
      endYmd,
      presetId: preset,
    });
  };

  const handleStartMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value; // "YYYY-MM"
    if (!val) return;
    const [y, m] = val.split('-');
    const newStartMonth = `${y}.${m}`;
    const newStartYmd = `${y}${m}`;
    let newEndYmd = analysisPeriod.endYmd;
    let newEndMonth = analysisPeriod.endMonth;

    // Ensure start <= end
    if (newStartYmd > newEndYmd) {
      newEndYmd = newStartYmd;
      newEndMonth = newStartMonth;
    }

    onChangePeriod({
      startMonth: newStartMonth,
      endMonth: newEndMonth,
      startYmd: newStartYmd,
      endYmd: newEndYmd,
      presetId: 'CUSTOM',
    });
  };

  const handleEndMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value; // "YYYY-MM"
    if (!val) return;
    const [y, m] = val.split('-');
    const newEndMonth = `${y}.${m}`;
    const newEndYmd = `${y}${m}`;
    let newStartYmd = analysisPeriod.startYmd;
    let newStartMonth = analysisPeriod.startMonth;

    // Ensure start <= end
    if (newStartYmd > newEndYmd) {
      newStartYmd = newEndYmd;
      newStartMonth = newEndMonth;
    }

    onChangePeriod({
      startMonth: newStartMonth,
      endMonth: newEndMonth,
      startYmd: newStartYmd,
      endYmd: newEndYmd,
      presetId: 'CUSTOM',
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
      {/* 1. Complex Selector & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Complex Dropdown Trigger */}
        <div className="relative flex-1" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full text-left bg-slate-950/80 hover:bg-slate-800/80 border border-slate-700/80 hover:border-slate-600 rounded-xl p-3.5 transition-all flex items-center justify-between gap-3 group shadow-inner"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 group-hover:scale-105 transition-transform">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-black text-slate-100 tracking-tight truncate">
                    {complex.name}
                  </h1>
                  {complex.badge && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                      {complex.badge}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-300 font-medium">{complex.district}</span>
                  <span className="text-slate-600">·</span>
                  <span>준공 {complex.builtYear}년</span>
                  <span className="text-slate-600">·</span>
                  <span>{complex.totalUnits.toLocaleString()}세대</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 group-hover:text-emerald-400 shrink-0">
              <span className="hidden sm:inline">단지 변경</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180 text-emerald-400' : ''}`} />
            </div>
          </button>

          {/* Searchable Complex Selection Dropdown */}
          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 space-y-2.5 max-h-[420px] flex flex-col backdrop-blur-xl">
              {/* Region Filter Chips & Search Input */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedRegionFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      selectedRegionFilter === 'ALL'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    전체
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRegionFilter('SEOUL_METRO')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      selectedRegionFilter === 'SEOUL_METRO'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    서울·수도권
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRegionFilter('BUSAN')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      selectedRegionFilter === 'BUSAN'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    부산
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="단지명, 지역명으로 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Complex List */}
              <div className="overflow-y-auto flex-1 divide-y divide-slate-800/60 pr-1 space-y-0.5">
                {filteredComplexes.length > 0 ? (
                  filteredComplexes.map((c) => {
                    const isSelected = c.id === complex.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          onSelectComplex(c.id);
                          setIsDropdownOpen(false);
                          setSearchQuery('');
                        }}
                        className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 font-semibold'
                            : 'hover:bg-slate-800/70 text-slate-300 hover:text-white'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs truncate">{c.name}</span>
                            {c.badge && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                {c.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {c.district} · {c.builtYear}년 · {c.totalUnits}세대
                          </p>
                        </div>
                        {isSelected && (
                          <span className="text-xs font-bold text-emerald-400 shrink-0">선택됨</span>
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="py-6 text-center text-xs text-slate-500">
                    검색 조건에 맞는 아파트 단지가 없습니다.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick Utility Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onNavigateToMap}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition-colors shadow-sm"
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>지도에서 위치 보기</span>
          </button>
          <button
            type="button"
            onClick={onOpenAiDrawer}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-slate-950 transition-colors shadow-md shadow-emerald-600/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI 시장 진단</span>
          </button>
        </div>
      </div>

      {/* 2. Area & Period Selectors Bar */}
      <div className="pt-3 border-t border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Area Family Selector Chips */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-slate-400 font-semibold flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5 text-emerald-400" />
            주택형:
          </span>
          <div className="inline-flex max-w-full overflow-x-auto no-scrollbar bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1 items-center">
            {isLoadingFamilies && areaFamilies.length === 0 ? (
              <span className="text-xs text-slate-500 px-3 py-1 animate-pulse">
                주택형 조회 중...
              </span>
            ) : areaFamilies.length > 0 ? (
              areaFamilies.map((family) => {
                const isActive = selectedAreaFamilyId === family.areaFamilyId;
                const hasData = family.hasMonthlyData;
                const buttonLabel = formatAreaFamilyButtonLabel(family);
                const subtext = formatAreaFamilySubtext(family);

                return (
                  <button
                    key={family.areaFamilyId}
                    type="button"
                    onClick={() => hasData && onSelectAreaFamily(family.areaFamilyId)}
                    disabled={!hasData}
                    title={
                      !hasData
                        ? `${family.label} · 유효 실거래 데이터 없음`
                        : `${family.label} (${subtext}) · 총 ${family.tradeCount}건`
                    }
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all text-xs whitespace-nowrap shrink-0 flex items-center gap-1 ${
                      !hasData
                        ? 'opacity-40 cursor-not-allowed bg-slate-900 border border-slate-800/80 text-slate-500'
                        : isActive
                        ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <span>{buttonLabel}</span>
                    {!hasData && (
                      <span className="text-[10px] text-slate-500 font-normal">
                        (거래 없음)
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              <span className="text-xs text-slate-500 px-3 py-1">
                등록된 주택형 없음
              </span>
            )}
          </div>
          {selectedFamily && (
            <span className="text-[11px] text-slate-400 font-medium">
              {selectedFamily.label}
              {selectedFamily.exactAreas && selectedFamily.exactAreas.length > 1 && (
                <span className="text-slate-500 ml-1.5 font-mono text-[10px]">
                  ({formatAreaFamilySubtext(selectedFamily)})
                </span>
              )}
            </span>
          )}
        </div>

        {/* Custom Period Month Inputs & Preset Chips */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400 font-medium flex items-center gap-1 pl-1">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">분석기간:</span>
            </span>
            <input
              type="month"
              value={analysisPeriod.startMonth.replace('.', '-')}
              min="2006-01"
              max="2026-12"
              onChange={handleStartMonthChange}
              className="bg-slate-900 border border-slate-700/80 hover:border-slate-600 focus:border-sky-500 rounded-lg px-2 py-1 text-slate-200 text-xs font-mono focus:outline-none transition-colors"
              title="분석 시작월"
            />
            <span className="text-slate-500 font-bold">~</span>
            <input
              type="month"
              value={analysisPeriod.endMonth.replace('.', '-')}
              min="2006-01"
              max="2026-12"
              onChange={handleEndMonthChange}
              className="bg-slate-900 border border-slate-700/80 hover:border-slate-600 focus:border-sky-500 rounded-lg px-2 py-1 text-slate-200 text-xs font-mono focus:outline-none transition-colors"
              title="분석 종료월"
            />
          </div>

          <div className="inline-flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
            {periodOptions.map((opt) => {
              const isActive = analysisPeriod.presetId === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectPreset(opt.id)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all text-xs ${
                    isActive
                      ? 'bg-sky-500 text-slate-950 shadow-md font-extrabold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
