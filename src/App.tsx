import { DataStatus } from './components/DataStatus';
import { parseHousingRoute } from './utils/housingRoute';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TARGET_COMPLEXES } from './data/complexesData';
import {
  AreaCategory,
  BaselineOption,
  ComplexInfo,
  TradeRecord,
  ApiErrorDetail,
  MapComplexSummary,
} from './types';
import {
  aggregateTradesByMonth,
  calculateCAGRAnalysis,
  calculateMDD,
  calculateMultiComplexComparison,
  calculateDetailedPriceMetrics,
} from './utils/calculations';
import { formatAreaCategoryLabel, getAreaCategory } from './utils/areaUtils';
import { dataService } from './services/dataService';
import { Header, MainNavTab } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MultiComplexCompare } from './components/MultiComplexCompare';
import { PriceAnalysisView } from './components/PriceAnalysis/PriceAnalysisView';
import { AiAnalysisDrawer, type AiSelection } from './components/AiAnalysisDrawer';
import { MapExplorerView } from './components/Map/MapExplorerView';
import { RedevelopmentAnalysis } from './components/RedevelopmentAnalysis';
import { Menu } from 'lucide-react';

// Dynamic initial dates calculation (Last 5 years by default for analysis)
const getInitialDates = (yearsBack = 5) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const endStr = `${y}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;
  const startY = y - yearsBack;
  const startStr = `${startY}-${m < 10 ? '0' + m : m}-01`;
  return { startStr, endStr };
};

export default function App() {
  const initialDates = useMemo(() => getInitialDates(5), []);
  const launchRoute = useMemo(() => parseHousingRoute(window.location.search), []);

  // 1. Navigation View State: 'MAP' | 'ANALYSIS' | 'COMPARE'
  const [activeView, setActiveView] = useState<MainNavTab>(() => parseHousingRoute(window.location.search).view);

  // 2. Sidebar & Filter States (Default: Banpo Xi, 59㎡, 5Y)
  const [selectedRegion, setSelectedRegion] = useState<'ALL' | 'SEOUL_METRO' | 'BUSAN'>('SEOUL_METRO');
  const [selectedComplexId, setSelectedComplexId] = useState<string>(() => parseHousingRoute(window.location.search).complexId);
  const [selectedArea, setSelectedArea] = useState<AreaCategory>(launchRoute.areaCategory || '59');
  const [selectedPeriod, setSelectedPeriod] = useState<'1Y' | '3Y' | '5Y' | '10Y' | 'ALL'>('5Y');
  const [startDate, setStartDate] = useState<string>(initialDates.startStr);
  const [endDate, setEndDate] = useState<string>(initialDates.endStr);
  const [baselineOption, setBaselineOption] = useState<BaselineOption>('FIRST_AVAILABLE');
  const [excludeCancelled, setExcludeCancelled] = useState<boolean>(true);
  const [excludeOutliers, setExcludeOutliers] = useState<boolean>(true);

  // 3. Multi-complex Benchmark Mode
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([
    'banpo_xi',
    'banpo_acro',
    'jamsil_els',
    'mapo_raemian_prugio',
  ]);

  // 4. Modals & Drawers
  const [aiSelection, setAiSelection] = useState<AiSelection | null>(null);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // 5. Real Data State & Network/API Error Handling
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<ApiErrorDetail | null>(null);
  const [tradesMap, setTradesMap] = useState<Record<string, TradeRecord[]>>({});
  const [mapSummaries, setMapSummaries] = useState<Record<string, MapComplexSummary>>({});

  // Primary active complex metadata
  const currentComplex: ComplexInfo = useMemo(() => {
    return (
      TARGET_COMPLEXES.find((c) => c.id === selectedComplexId) ||
      TARGET_COMPLEXES[0]
    );
  }, [selectedComplexId]);

  // Auto-switch to defaultArea if currentComplex does not support selectedArea
  useEffect(() => {
    if (activeView === 'ANALYSIS' && launchRoute.areaCategory && selectedComplexId === launchRoute.complexId) return;
    if (currentComplex?.areaCapabilities) {
      if (selectedArea === '59' && !currentComplex.areaCapabilities.has59) {
        setSelectedArea(currentComplex.areaCapabilities.defaultArea);
      } else if (selectedArea === '84' && !currentComplex.areaCapabilities.has84) {
        setSelectedArea(currentComplex.areaCapabilities.defaultArea);
      }
    }
  }, [selectedComplexId, currentComplex, selectedArea, activeView, launchRoute]);

  // Derive startYmd & endYmd for API queries (e.g. "202509", "202608")
  const startYmd = useMemo(() => startDate.replace(/[^0-9]/g, '').slice(0, 6), [startDate]);
  const endYmd = useMemo(() => endDate.replace(/[^0-9]/g, '').slice(0, 6), [endDate]);

  // Fetch lightweight map summaries for MAP view
  const fetchMapSummaries = useCallback(async () => {
    try {
      const summaries = await dataService.getMapSummaries(selectedArea, startYmd, endYmd);
      if (summaries && Object.keys(summaries).length > 0) {
        setMapSummaries(summaries);
      }
    } catch (err) {
      console.warn('[Map Summaries] Failed to fetch lightweight summaries:', err);
    }
  }, [selectedArea, startYmd, endYmd]);

  useEffect(() => {
    if (activeView === 'MAP') {
      fetchMapSummaries();
    }
  }, [activeView, fetchMapSummaries]);

  // Fetch real detailed trades only for active complex and benchmark comparison complexes
  const fetchActiveTrades = useCallback(async () => {
    // In MAP and ANALYSIS views, raw bulk trades are not downloaded in full (handled by focused scatter and cursor ledger)
    if (activeView === 'MAP' || activeView === 'ANALYSIS' || activeView === 'COMPARE') {
      return;
    }

    setIsLoading(true);
    setApiError(null);

    const targetComplexesToFetch = [currentComplex];
    const effectiveStart = startYmd;
    const effectiveEnd = endYmd;

    try {
      const results = await Promise.all(
        targetComplexesToFetch.map((c) =>
          dataService.getTradesForComplex(c, effectiveStart, effectiveEnd, 'ALL')
        )
      );

      const newTradesMap: Record<string, TradeRecord[]> = {};
      let firstError: ApiErrorDetail | null = null;

      results.forEach((res, idx) => {
        const c = targetComplexesToFetch[idx];
        if (res.success) {
          newTradesMap[c.id] = res.data;
        } else {
          newTradesMap[c.id] = [];
          if (c.id === currentComplex.id && res.error) {
            firstError = res.error;
          }
        }
      });

      setTradesMap((prev) => ({ ...prev, ...newTradesMap }));
      if (firstError) {
        setApiError(firstError);
      }
    } catch (err: any) {
      setApiError({
        code: 'NETWORK_ERROR',
        message: err.message || '데이터 통신 중 오류가 발생했습니다.',
        source: '국토교통부 아파트 매매 실거래가 공개시스템',
        target: currentComplex.name,
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentComplex, compareMode, activeView, selectedCompareIds, startYmd, endYmd]);

  useEffect(() => {
    fetchActiveTrades();
  }, [fetchActiveTrades]);

  // Raw Trades for primary complex from OpenAPI
  const rawTrades = useMemo(() => {
    return tradesMap[currentComplex.id] || [];
  }, [tradesMap, currentComplex.id]);

  // Filtered Trades for primary complex (Area, Date, Cancel, Outliers)
  const filteredTrades = useMemo(() => {
    return rawTrades.filter((t) => {
      // Area filter
      const tradeArea = t.areaCategory || getAreaCategory(t.exclusiveArea, t.complexId || currentComplex.id);
      if (selectedArea !== 'ALL' && tradeArea !== selectedArea) {
        return false;
      }
      // Date filter
      if (t.dealYmd < startYmd || t.dealYmd > endYmd) {
        return false;
      }
      // Cancel trade filter
      if (excludeCancelled && t.isCancelled) {
        return false;
      }
      // Outlier / Direct deal filter
      if (excludeOutliers && (t.isOutlier || t.dealType === '직거래')) {
        return false;
      }
      return true;
    });
  }, [rawTrades, selectedArea, startYmd, endYmd, excludeCancelled, excludeOutliers]);

  // Count of filtered-out trades
  const filteredOutCount = rawTrades.length - filteredTrades.length;

  // Monthly Aggregated Time-Series for Primary Complex (Median representative price)
  const monthlyAggs = useMemo(() => {
    return aggregateTradesByMonth(filteredTrades);
  }, [filteredTrades]);

  // Latest monthly representative price record
  const latestAgg = useMemo(() => {
    return monthlyAggs.length > 0 ? monthlyAggs[monthlyAggs.length - 1] : null;
  }, [monthlyAggs]);

  // CAGR & Baseline Analysis
  const cagrResult = useMemo(() => {
    return calculateCAGRAnalysis(monthlyAggs, baselineOption);
  }, [monthlyAggs, baselineOption]);

  // MDD & ATH Recovery
  const mddResult = useMemo(() => {
    return calculateMDD(monthlyAggs);
  }, [monthlyAggs]);

  // Selected compare complexes list
  const selectedCompareComplexes = useMemo(() => {
    return selectedCompareIds
      .map((id) => TARGET_COMPLEXES.find((c) => c.id === id))
      .filter(Boolean) as ComplexInfo[];
  }, [selectedCompareIds]);

  // Multi-complex Comparison computation (Normalized Base 100)
  const comparisonData = useMemo(() => {
    return calculateMultiComplexComparison(
      selectedCompareComplexes,
      tradesMap,
      selectedArea,
      startDate,
      endDate,
      excludeCancelled,
      excludeOutliers
    );
  }, [
    selectedCompareComplexes,
    tradesMap,
    selectedArea,
    startDate,
    endDate,
    excludeCancelled,
    excludeOutliers,
  ]);

  // Toggle complex selection in compare mode (min 2, max 5)
  const handleToggleCompareId = (id: string) => {
    setSelectedCompareIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 2) return prev; // Keep minimum 2
        return prev.filter((item) => item !== id);
      } else {
        if (prev.length >= 5) return prev; // Max 5
        return [...prev, id];
      }
    });
  };

  // Switch to Analysis View for a specific complex
  const handleNavigateToAnalysis = (complexId: string) => {
    setSelectedComplexId(complexId);
    // Retain user's chosen area category strictly without automatic fallback
    setActiveView('ANALYSIS');
  };

  // Period preset change handler for Price Analysis
  const handleSelectPeriod = (period: '1Y' | '3Y' | '5Y' | '10Y' | 'ALL') => {
    setSelectedPeriod(period);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    const endStr = `${y}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;

    if (period === '1Y') {
      const startY = y - 1;
      setStartDate(`${startY}-${m < 10 ? '0' + m : m}-01`);
      setEndDate(endStr);
    } else if (period === '3Y') {
      const startY = y - 3;
      setStartDate(`${startY}-${m < 10 ? '0' + m : m}-01`);
      setEndDate(endStr);
    } else if (period === '5Y') {
      const startY = y - 5;
      setStartDate(`${startY}-${m < 10 ? '0' + m : m}-01`);
      setEndDate(endStr);
    } else if (period === '10Y') {
      const startY = y - 10;
      setStartDate(`${startY}-01-01`);
      setEndDate(endStr);
    } else if (period === 'ALL') {
      setStartDate('2006-01-01');
      setEndDate(endStr);
    }
  };

  // Full history trades for selected complex & area (for true multi-year ATH / CAGR / Period returns)
  const allHistoryTrades = useMemo(() => {
    return rawTrades.filter((t) => {
      const tradeArea = t.areaCategory || getAreaCategory(t.exclusiveArea, t.complexId || currentComplex.id);
      if (selectedArea !== 'ALL' && tradeArea !== selectedArea) return false;
      if (excludeCancelled && t.isCancelled) return false;
      if (excludeOutliers && (t.isOutlier || t.dealType === '직거래')) return false;
      return true;
    });
  }, [rawTrades, selectedArea, excludeCancelled, excludeOutliers, currentComplex.id]);

  const allHistoryMonthlyAggs = useMemo(() => {
    return aggregateTradesByMonth(allHistoryTrades);
  }, [allHistoryTrades]);

  // Detailed Price Metrics for Single Complex Deep-Dive
  const detailedPriceMetrics = useMemo(() => {
    const aggsToUse = allHistoryMonthlyAggs.length > 0 ? allHistoryMonthlyAggs : monthlyAggs;
    return calculateDetailedPriceMetrics(aggsToUse, selectedArea);
  }, [allHistoryMonthlyAggs, monthlyAggs, selectedArea]);

  // CSV Export Handler
  const handleExportCsv = () => {
    if (filteredTrades.length === 0) return;

    const headers = [
      '계약일자',
      '단지명',
      '법정동',
      '전용면적(㎡)',
      '공급면적',
      '실거래가(만원)',
      '전용㎡당단가(만원)',
      '층수',
      '거래유형',
      '취소여부',
      '취소일자',
    ];

    const rows = filteredTrades.map((t) => [
      t.dealDate,
      `"${t.complexName}"`,
      `"${currentComplex.district}"`,
      t.exclusiveArea,
      '"공급면적 확인 불가"',
      t.price,
      t.pricePerSqm || (t.exclusiveArea > 0 ? Math.round((t.price * 10000) / t.exclusiveArea) : 0),
      t.floor,
      `"${t.dealType || '중개거래'}"`,
      t.isCancelled ? '취소' : '정상',
      t.cancelDate || '',
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `${currentComplex.shortName}_${selectedArea}㎡_실거래가_${startDate}_${endDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* 1. Top Navigation Bar with View Tabs: [지도] [가격분석] [단지비교] */}
      <Header
        primaryComplex={currentComplex}
        activeView={activeView}
        onSelectView={(v) => {
          setActiveView(v);
          if (v === 'COMPARE') setCompareMode(true);
        }}
        onOpenAiDrawer={() => { if(activeView !== 'ANALYSIS' || aiSelection?.complexId !== currentComplex.id) setAiSelection({complexId:currentComplex.id,selectedArea, startYmd:startDate.replace(/\D/g,''),endYmd:endDate.replace(/\D/g,'')}); setIsAiDrawerOpen(true); }}
        onExportCsv={handleExportCsv}
        selectedCompareCount={selectedCompareIds.length}
      />

      <DataStatus />

      {/* 2. View 1: Map-based Region & Complex Explorer */}
      {activeView === 'MAP' && (
        <MapExplorerView
          complexes={TARGET_COMPLEXES}
          tradesMap={tradesMap}
          mapSummaries={mapSummaries}
          selectedComplexId={selectedComplexId}
          onSelectComplex={(id) => {
            setSelectedComplexId(id);
          }}
          onNavigateToAnalysis={handleNavigateToAnalysis}
          selectedCompareIds={selectedCompareIds}
          onToggleCompareId={handleToggleCompareId}
          selectedArea={selectedArea}
          onSelectArea={setSelectedArea}
          excludeCancelled={excludeCancelled}
          excludeOutliers={excludeOutliers}
          baselineOption={baselineOption}
          startDate={startDate}
          endDate={endDate}
        />
      )}

      {/* 3. View 2: Single Complex Deep-Dive Price Analysis Screen */}
      {activeView === 'ANALYSIS' && (
        <main className="flex-1 p-3 sm:p-6 lg:p-8">
          <PriceAnalysisView
            complex={currentComplex}
            onSelectComplex={(id) => {
              setSelectedComplexId(id);
            }}
            onAnalysisSelectionChange={setAiSelection}
            initialPreferredCategory={selectedArea}
            requirePreferredCategory={Boolean(launchRoute.areaCategory && selectedComplexId === launchRoute.complexId)}
            allAreaTrades={rawTrades}
            onNavigateToMap={() => setActiveView('MAP')}
            onOpenAiDrawer={(selection) => { setAiSelection({complexId:currentComplex.id,...selection}); setIsAiDrawerOpen(true); }}
            isLoadingTrades={isLoading}
            apiError={apiError}
            onRetryFetch={fetchActiveTrades}
          />
        </main>
      )}

      {/* 4. View 3: Multi-Complex Benchmark Comparison */}
      {activeView === 'COMPARE' && (
        <div className="flex-1 flex max-w-7xl w-full mx-auto">
          {/* Mobile Sidebar Toggle Button */}
          <div className="lg:hidden fixed bottom-5 right-5 z-40">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-500 text-slate-950 font-bold shadow-xl text-xs"
            >
              <Menu className="w-4 h-4" />
              <span>비교 설정</span>
            </button>
          </div>

          <Sidebar
            selectedRegion={selectedRegion}
            onSelectRegion={setSelectedRegion}
            selectedComplexId={selectedComplexId}
            onSelectComplex={(id) => {
              setSelectedComplexId(id);
              if (!selectedCompareIds.includes(id)) {
                setSelectedCompareIds((prev) => [id, ...prev.slice(0, 3)]);
              }
            }}
            selectedArea={selectedArea}
            onSelectArea={setSelectedArea}
            startDate={startDate}
            endDate={endDate}
            onDateChange={(s, e) => {
              setStartDate(s);
              setEndDate(e);
            }}
            baselineOption={baselineOption}
            onBaselineChange={setBaselineOption}
            excludeCancelled={excludeCancelled}
            onToggleExcludeCancelled={() => setExcludeCancelled(!excludeCancelled)}
            excludeOutliers={excludeOutliers}
            onToggleExcludeOutliers={() => setExcludeOutliers(!excludeOutliers)}
            compareMode={true}
            onToggleCompareMode={() => {}}
            selectedCompareIds={selectedCompareIds}
            onToggleCompareId={handleToggleCompareId}
            isMobileOpen={isMobileSidebarOpen}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
          />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-x-hidden">
            <MultiComplexCompare
              compareIds={selectedCompareIds}
              onNavigateToAnalysis={handleNavigateToAnalysis}
            />
          </main>
        </div>
      )}

      {/* 5. View 4: Redevelopment Analysis Screen */}
      {activeView === 'REDEVELOPMENT' && (
        <main className="flex-1 p-3 sm:p-6 lg:p-8">
          <RedevelopmentAnalysis />
        </main>
      )}

      {/* AI Market Analyst Drawer */}
      <AiAnalysisDrawer
        isOpen={isAiDrawerOpen}
        onClose={() => setIsAiDrawerOpen(false)}
        complex={currentComplex}
        selection={aiSelection}
      />
    </div>
  );
}
