import React, { useState } from 'react';
import {
  SlidersHorizontal,
  MapPin,
  Building,
  Maximize2,
  Calendar,
  Filter,
  CheckSquare,
  Square,
  Layers,
  Info,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Database,
  Search,
} from 'lucide-react';
import { AreaCategory, BaselineOption, ComplexInfo } from '../types';
import { TARGET_COMPLEXES } from '../data/complexesData';

interface SidebarProps {
  selectedRegion: 'ALL' | 'SEOUL_METRO' | 'BUSAN';
  onSelectRegion: (region: 'ALL' | 'SEOUL_METRO' | 'BUSAN') => void;
  selectedComplexId: string;
  onSelectComplex: (id: string) => void;
  selectedArea: AreaCategory;
  onSelectArea: (area: AreaCategory) => void;
  startDate: string;
  endDate: string;
  onDateChange: (start: string, end: string) => void;
  baselineOption: BaselineOption;
  onBaselineChange: (b: BaselineOption) => void;
  excludeCancelled: boolean;
  onToggleExcludeCancelled: () => void;
  excludeOutliers: boolean;
  onToggleExcludeOutliers: () => void;
  compareMode: boolean;
  onToggleCompareMode: () => void;
  selectedCompareIds: string[];
  onToggleCompareId: (id: string) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  selectedRegion,
  onSelectRegion,
  selectedComplexId,
  onSelectComplex,
  selectedArea,
  onSelectArea,
  startDate,
  endDate,
  onDateChange,
  baselineOption,
  onBaselineChange,
  excludeCancelled,
  onToggleExcludeCancelled,
  excludeOutliers,
  onToggleExcludeOutliers,
  compareMode,
  onToggleCompareMode,
  selectedCompareIds,
  onToggleCompareId,
  isMobileOpen,
  onCloseMobile,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isPreprocessingOpen, setIsPreprocessingOpen] = useState(true);

  // Filter complexes by selected region & search
  const filteredComplexes = TARGET_COMPLEXES.filter((c) => {
    const matchesRegion = selectedRegion === 'ALL' || c.region === selectedRegion;
    const matchesSearch =
      searchTerm === '' ||
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.district.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.shortName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesRegion && matchesSearch;
  });

  const applyDatePreset = (preset: '1Y' | '3Y' | '5Y' | '10Y') => {
    const now = new Date();
    const currentY = now.getFullYear();
    const currentM = now.getMonth() + 1;
    const currentD = now.getDate();
    const endFormatted = `${currentY}-${currentM < 10 ? '0' + currentM : currentM}-${currentD < 10 ? '0' + currentD : currentD}`;

    switch (preset) {
      case '1Y': {
        const startY = currentY - 1;
        const startFormatted = `${startY}-${currentM < 10 ? '0' + currentM : currentM}-01`;
        onDateChange(startFormatted, endFormatted);
        break;
      }
      case '3Y': {
        const startY = currentY - 3;
        const startFormatted = `${startY}-${currentM < 10 ? '0' + currentM : currentM}-01`;
        onDateChange(startFormatted, endFormatted);
        break;
      }
      case '5Y': {
        const startY = currentY - 5;
        const startFormatted = `${startY}-${currentM < 10 ? '0' + currentM : currentM}-01`;
        onDateChange(startFormatted, endFormatted);
        break;
      }
      case '10Y': {
        const startY = currentY - 10;
        const startFormatted = `${startY}-01-01`;
        onDateChange(startFormatted, endFormatted);
        break;
      }
    }
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-72 sm:w-80 bg-slate-900 border-r border-slate-800 text-slate-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:h-[calc(100vh-65px)] overflow-y-auto flex flex-col ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm tracking-wide">
          <SlidersHorizontal className="w-4 h-4" />
          <span>분석 조건 파라미터 (Sidebar)</span>
        </div>
        <button
          onClick={onCloseMobile}
          className="lg:hidden text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
        >
          ✕
        </button>
      </div>

      <div className="p-4 space-y-6 flex-1 text-xs sm:text-sm">
        {/* 1. Region Selector */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            1. 대상 권역 필터
          </label>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950/60 rounded-lg border border-slate-800">
            <button
              onClick={() => onSelectRegion('ALL')}
              className={`py-1.5 px-2 rounded-md font-medium text-xs transition-colors ${
                selectedRegion === 'ALL'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              전체 권역
            </button>
            <button
              onClick={() => onSelectRegion('SEOUL_METRO')}
              className={`py-1.5 px-2 rounded-md font-medium text-xs transition-colors ${
                selectedRegion === 'SEOUL_METRO'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              서울/수도권
            </button>
            <button
              onClick={() => onSelectRegion('BUSAN')}
              className={`py-1.5 px-2 rounded-md font-medium text-xs transition-colors ${
                selectedRegion === 'BUSAN'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              부산 핵심지
            </button>
          </div>
        </div>

        {/* 2. Target Complex Selection */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-emerald-400" />
              2. 기준 타깃 아파트 단지
            </span>
            <span className="text-[11px] text-slate-500">{filteredComplexes.length}개 단지</span>
          </label>

          {/* Quick Search */}
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="단지명/동/지역 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="space-y-1 max-h-48 overflow-y-auto pr-1 rounded-lg border border-slate-800/80 bg-slate-950/40 p-1.5">
            {filteredComplexes.map((complex) => {
              const isSelected = selectedComplexId === complex.id;
              return (
                <button
                  key={complex.id}
                  onClick={() => onSelectComplex(complex.id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md flex items-center justify-between text-xs transition-all ${
                    isSelected
                      ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800/70 border border-transparent'
                  }`}
                >
                  <div className="truncate pr-2">
                    <div className="truncate font-medium">{complex.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{complex.district}</div>
                  </div>
                  {complex.badge && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 whitespace-nowrap shrink-0">
                      {complex.badge.split('/')[0]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Dedicated Area Filtering */}
        <div>
          {(() => {
            const currentComplex = TARGET_COMPLEXES.find((c) => c.id === selectedComplexId);
            const has59 = currentComplex?.areaCapabilities ? currentComplex.areaCapabilities.has59 : true;
            const has84 = currentComplex?.areaCapabilities ? currentComplex.areaCapabilities.has84 : true;

            return (
              <>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
                  3. 전용면적 필터
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => has59 && onSelectArea('59')}
                    disabled={!has59}
                    title={!has59 ? `${currentComplex?.name || '해당 단지'}는 59형이 공급되지 않는 단지입니다` : undefined}
                    className={`py-1.5 px-2 rounded-lg font-medium text-xs transition-colors border ${
                      !has59
                        ? 'opacity-30 cursor-not-allowed bg-slate-950/40 border-slate-900 text-slate-600 line-through'
                        : selectedArea === '59'
                        ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 font-bold'
                        : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    전용 59㎡
                  </button>
                  <button
                    onClick={() => has84 && onSelectArea('84')}
                    disabled={!has84}
                    title={!has84 ? `${currentComplex?.name || '해당 단지'}는 84형이 공급되지 않는 단지입니다` : undefined}
                    className={`py-1.5 px-2 rounded-lg font-medium text-xs transition-colors border ${
                      !has84
                        ? 'opacity-30 cursor-not-allowed bg-slate-950/40 border-slate-900 text-slate-600 line-through'
                        : selectedArea === '84'
                        ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 font-bold'
                        : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    전용 84㎡
                  </button>
                </div>
              </>
            );
          })()}
        </div>

        {/* 4. Date Range & Period Presets */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              4. 분석 기간 설정
            </span>
            <span className="text-[10px] text-emerald-400 font-mono">
              실거래 데이터 기준
            </span>
          </label>
          <div className="grid grid-cols-4 gap-1 mb-2">
            <button
              onClick={() => applyDatePreset('1Y')}
              className="py-1 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-medium text-center"
            >
              최근 1년
            </button>
            <button
              onClick={() => applyDatePreset('3Y')}
              className="py-1 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-medium text-center"
            >
              최근 3년
            </button>
            <button
              onClick={() => applyDatePreset('5Y')}
              className="py-1 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-medium text-center"
            >
              최근 5년
            </button>
            <button
              onClick={() => applyDatePreset('10Y')}
              className="py-1 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-medium text-center"
            >
              전체 10년
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block mb-0.5">시작 연월</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => onDateChange(e.target.value, endDate)}
                className="w-full py-1 px-2 bg-slate-950 border border-slate-800 rounded text-slate-300 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block mb-0.5">종료 연월</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => onDateChange(startDate, e.target.value)}
                className="w-full py-1 px-2 bg-slate-950 border border-slate-800 rounded text-slate-300 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* 5. Baseline (CAGR / Normalized Return Anchor) */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              5. 수익률 기준 시점 (Baseline)
            </span>
          </label>
          <select
            value={baselineOption}
            onChange={(e) => onBaselineChange(e.target.value as BaselineOption)}
            className="w-full py-1.5 px-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="FIRST_AVAILABLE">데이터 조회 시작 시점 (Auto)</option>
            <option value="2017_05">2017.05 (문재인 정부 출범기)</option>
            <option value="2020_01">2020.01 (코로나 유동성 팽창기)</option>
            <option value="2022_12">2022.12 (금리인상 저점 바닥)</option>
            <option value="2024_01">2024.01 (최근 1년 반등기)</option>
          </select>
        </div>

        {/* 6. Multi-Complex Selection for Benchmark Compare */}
        <div className="pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              6. 다중 단지 비교 선택 (2~4개)
            </label>
            <button
              onClick={onToggleCompareMode}
              className={`text-[11px] px-2 py-0.5 rounded font-medium transition-colors ${
                compareMode ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {compareMode ? '비교 활성' : '비교 켜기'}
            </button>
          </div>
          {compareMode && (
            <div className="space-y-1 max-h-40 overflow-y-auto pr-1 bg-slate-950/60 p-2 rounded-lg border border-indigo-900/40">
              <div className="text-[11px] text-slate-400 mb-1.5">
                현재 선택: <span className="text-indigo-300 font-bold">{selectedCompareIds.length}개</span> (최대 4개)
              </div>
              {filteredComplexes.map((c) => {
                const isChecked = selectedCompareIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => onToggleCompareId(c.id)}
                    className={`w-full flex items-center justify-between p-1.5 rounded text-left text-xs transition-colors ${
                      isChecked ? 'bg-indigo-950/80 text-indigo-200 font-medium' : 'text-slate-400 hover:bg-slate-800/50'
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                    {isChecked ? (
                      <CheckSquare className="w-3.5 h-3.5 text-indigo-400 shrink-0 ml-1" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-600 shrink-0 ml-1" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 7. Data Preprocessing Accordion */}
        <div className="pt-2 border-t border-slate-800">
          <button
            onClick={() => setIsPreprocessingOpen(!isPreprocessingOpen)}
            className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 hover:text-slate-200"
          >
            <span className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-emerald-400" />
              7. 데이터 전처리 & 필터링
            </span>
            {isPreprocessingOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          {isPreprocessingOpen && (
            <div className="space-y-2 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800 text-xs">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={excludeCancelled}
                  onChange={onToggleExcludeCancelled}
                  className="mt-0.5 rounded border-slate-700 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="text-slate-200 font-medium block">해제/취소 거래 제외</span>
                  <span className="text-[10px] text-slate-500 block">
                    해제사유발생일이 등록된 무효 계약 필터링
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2 cursor-pointer pt-1 border-t border-slate-800/60">
                <input
                  type="checkbox"
                  checked={excludeOutliers}
                  onChange={onToggleExcludeOutliers}
                  className="mt-0.5 rounded border-slate-700 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="text-slate-200 font-medium block">직거래 및 비정상 이상치 필터링</span>
                  <span className="text-[10px] text-slate-500 block">
                    특수관계인 저가 직거래 및 지분 거래 제거
                  </span>
                </div>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/80 text-[11px] text-slate-500 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Database className="w-3 h-3 text-emerald-500" /> In-Memory Cache: ON
        </span>
        <span className="text-emerald-400">v2.4 Ready</span>
      </div>
    </aside>
  );
};
