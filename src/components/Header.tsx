import React from 'react';
import {
  Building2,
  Sparkles,
  Download,
  Database,
  RefreshCw,
  TrendingUp,
  Activity,
  Layers,
  MapPin,
  BarChart3,
} from 'lucide-react';
import { ComplexInfo } from '../types';

export type MainNavTab = 'MAP' | 'ANALYSIS' | 'COMPARE' | 'REDEVELOPMENT';

interface HeaderProps {
  primaryComplex: ComplexInfo;
  activeView: MainNavTab;
  onSelectView: (view: MainNavTab) => void;
  onOpenAiDrawer: () => void;
  onExportCsv: () => void;
  selectedCompareCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  primaryComplex,
  activeView,
  onSelectView,
  onOpenAiDrawer,
  onExportCsv,
  selectedCompareCount,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md shrink-0">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2.5 sm:gap-4">
        {/* Left: App Brand & Primary Complex */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow shadow-emerald-900/40 shrink-0">
            <Building2 className="w-4 h-4 text-slate-950 font-bold" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-xs sm:text-sm font-bold tracking-tight text-slate-100 whitespace-nowrap">
                K-Housing Analytics
              </h1>
              {activeView !== 'MAP' && (
                <span className="hidden lg:inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  국토교통부 연동
                </span>
              )}
            </div>
            {activeView !== 'MAP' && (
              <p className="text-[11px] text-slate-400 truncate hidden sm:block">
                선택: <span className="text-emerald-300 font-medium">{primaryComplex.name}</span>
              </p>
            )}
          </div>
        </div>

        {/* Center: Main View Navigation Tabs [지도 탐색] [가격 분석] [단지 비교] */}
        <nav className="flex items-center bg-slate-950/90 p-0.5 sm:p-1 rounded-xl border border-slate-800 shadow-inner">
          <button
            onClick={() => onSelectView('MAP')}
            className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeView === 'MAP'
                ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>지도 탐색</span>
          </button>

          <button
            onClick={() => onSelectView('ANALYSIS')}
            className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeView === 'ANALYSIS'
                ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>가격 분석</span>
          </button>

          <button
            onClick={() => onSelectView('COMPARE')}
            className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeView === 'COMPARE'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>단지 비교 {selectedCompareCount > 0 ? `(${selectedCompareCount})` : ''}</span>
          </button>

          <button
            onClick={() => onSelectView('REDEVELOPMENT')}
            className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeView === 'REDEVELOPMENT'
                ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>재건축 분석</span>
          </button>
        </nav>

        {/* Right Action Bar (Only shown in Analysis / Compare, kept hidden or minimal in MAP to preserve focus) */}
        {activeView !== 'MAP' ? (
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap shrink-0">
            <button
              onClick={onOpenAiDrawer}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 hover:from-teal-400 hover:to-emerald-400 shadow shadow-emerald-500/20 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">AI 시장 진단</span>
              <span className="sm:hidden">AI</span>
            </button>

            {activeView === 'ANALYSIS' && (
              <button
                onClick={onExportCsv}
                className="hidden lg:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 transition-colors"
                title="실거래가 데이터 CSV 다운로드"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>CSV 저장</span>
              </button>
            )}
          </div>
        ) : (
          <div className="hidden sm:block w-1" />
        )}
      </div>
    </header>
  );
};
