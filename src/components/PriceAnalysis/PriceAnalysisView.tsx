import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ComplexInfo,
  AreaCategory,
  MonthlyAggregate,
  TradeRecord,
  DetailedPriceMetrics,
  AreaFamilyMetadata,
  AreaFamilyMonthlyPoint,
  AnalysisPeriod,
} from '../../types';
import { PriceAnalysisHeader } from './PriceAnalysisHeader';
import { CoreMetricsCards } from './CoreMetricsCards';
import { MainPriceChart } from './MainPriceChart';
import { DrawdownAnalysisSection } from './DrawdownAnalysisSection';
import { PeriodReturnsSection } from './PeriodReturnsSection';
import { TransactionLedger } from './TransactionLedger';
import { RefreshCw, ServerCrash, Info, ArrowRight } from 'lucide-react';
import { dataService } from '../../services/dataService';
import {
  getDefaultAreaFamily,
  convertAreaFamilyPointToMonthlyAggregate,
  isTransactionMatchingAreaFamily,
  formatAreaFamilySubtext,
} from '../../utils/areaFamilyUtils';
import { calculateDetailedPriceMetrics } from '../../utils/calculations';

interface PriceAnalysisViewProps {
  complex: ComplexInfo;
  onSelectComplex: (id: string) => void;
  initialPreferredCategory?: AreaCategory;
  allAreaTrades?: TradeRecord[];
  onNavigateToMap: () => void;
  onOpenAiDrawer: () => void;
  isLoadingTrades?: boolean;
  apiError?: { message: string; target?: string } | null;
  onRetryFetch?: () => void;
  // Optional backward compatibility props
  selectedArea?: AreaCategory;
  onSelectArea?: (area: AreaCategory) => void;
}

export const PriceAnalysisView: React.FC<PriceAnalysisViewProps> = ({
  complex,
  onSelectComplex,
  initialPreferredCategory = '59',
  allAreaTrades = [],
  onNavigateToMap,
  onOpenAiDrawer,
  isLoadingTrades = false,
  apiError = null,
  onRetryFetch,
}) => {
  // Default to the current month so new source revisions are immediately visible.
  const [analysisPeriod, setAnalysisPeriod] = useState<AnalysisPeriod>(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return { startMonth:`${year-5}.${month}`, endMonth:`${year}.${month}`, startYmd:`${year-5}${month}`, endYmd:`${year}${month}`, presetId:'5Y' };
  });

  // 2. AreaFamily metadata state
  const [areaFamilies, setAreaFamilies] = useState<AreaFamilyMetadata[]>([]);
  const [selectedAreaFamilyId, setSelectedAreaFamilyId] = useState<string | null>(null);
  const [isLoadingFamilies, setIsLoadingFamilies] = useState<boolean>(true);
  const [familyError, setFamilyError] = useState<string | null>(null);

  // 3. V2 Monthly price points state
  const [monthlyAggs, setMonthlyAggs] = useState<MonthlyAggregate[]>([]);
  const [allHistoryAggs, setAllHistoryAggs] = useState<MonthlyAggregate[]>([]);
  const [isLoadingMonthly, setIsLoadingMonthly] = useState<boolean>(false);
  const [monthlyError, setMonthlyError] = useState<string | null>(null);

  // 3-1. Focused Scatter Trades (Only for selected AreaFamily + custom date range)
  const [scatterTrades, setScatterTrades] = useState<TradeRecord[]>([]);
  const [isLoadingScatter, setIsLoadingScatter] = useState<boolean>(false);

  // 3-2. All-Time High Individual Canonical Trade (역대 최고 실거래가)
  const [athTrade, setAthTrade] = useState<TradeRecord | null>(null);

  // Current selected AreaFamily metadata object
  const selectedFamily = useMemo(() => {
    return areaFamilies.find((f) => f.areaFamilyId === selectedAreaFamilyId) || null;
  }, [areaFamilies, selectedAreaFamilyId]);

  // Dynamically update ALL preset start month to the family's first deal month
  useEffect(() => {
    if (analysisPeriod.presetId === 'ALL' && selectedFamily?.firstDealYmd && selectedFamily.firstDealYmd.length === 6) {
      const y = selectedFamily.firstDealYmd.slice(0, 4);
      const m = selectedFamily.firstDealYmd.slice(4, 6);
      const newStartMonth = `${y}.${m}`;
      if (analysisPeriod.startYmd !== selectedFamily.firstDealYmd) {
        setAnalysisPeriod((prev) => ({
          ...prev,
          startYmd: selectedFamily.firstDealYmd!,
          startMonth: newStartMonth,
        }));
      }
    }
  }, [analysisPeriod.presetId, selectedFamily?.firstDealYmd]);

  // Load AreaFamilies on complex change
  useEffect(() => {
    let isCancelled = false;
    setIsLoadingFamilies(true);
    setFamilyError(null);

    // Immediately clear previous complex's stale data
    setAreaFamilies([]);
    setSelectedAreaFamilyId(null);
    setMonthlyAggs([]);
    setAllHistoryAggs([]);

    dataService
      .getComplexAreaFamilies(complex.id)
      .then((res) => {
        if (isCancelled) return;
        if (res && res.success && res.families) {
          setAreaFamilies(res.families);
          const defaultFamily = getDefaultAreaFamily(res.families, initialPreferredCategory);
          if (defaultFamily) {
            setSelectedAreaFamilyId(defaultFamily.areaFamilyId);
          }
        } else {
          setFamilyError(res?.error?.message || '주택형 목록을 조회하지 못했습니다.');
        }
      })
      .catch((err) => {
        if (isCancelled) return;
        setFamilyError(err?.message || '주택형 데이터 통신 오류');
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingFamilies(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [complex.id, initialPreferredCategory]);

  // Load V2 Monthly prices for selected AreaFamily within analysisPeriod
  const fetchMonthlyData = useCallback(() => {
    if (!selectedAreaFamilyId) {
      setMonthlyAggs([]);
      setAllHistoryAggs([]);
      return () => {};
    }

    const currentFamily = areaFamilies.find((f) => f.areaFamilyId === selectedAreaFamilyId);
    // If family has no monthly data registered, do not query or return empty
    if (currentFamily && !currentFamily.hasMonthlyData) {
      setMonthlyAggs([]);
      setAllHistoryAggs([]);
      setIsLoadingMonthly(false);
      return () => {};
    }

    let isCancelled = false;
    setIsLoadingMonthly(true);
    setMonthlyError(null);

    // Query period monthly points and full history monthly points in parallel
    Promise.all([
      dataService.getAreaFamilyMonthlyPrices(
        complex.id,
        selectedAreaFamilyId,
        analysisPeriod.startYmd,
        analysisPeriod.endYmd
      ),
      dataService.getAreaFamilyMonthlyPrices(complex.id, selectedAreaFamilyId),
    ])
      .then(([periodRes, fullRes]) => {
        if (isCancelled) return;

        if (periodRes && periodRes.success) {
          const aggs = (periodRes.points || []).map(convertAreaFamilyPointToMonthlyAggregate);
          setMonthlyAggs(aggs);
        } else {
          setMonthlyError(periodRes?.error?.message || '월별 가격 데이터를 불러오지 못했습니다.');
        }

        if (fullRes && fullRes.success) {
          const fullAggs = (fullRes.points || []).map(convertAreaFamilyPointToMonthlyAggregate);
          setAllHistoryAggs(fullAggs);
        }
      })
      .catch((err) => {
        if (isCancelled) return;
        setMonthlyError(err?.message || '월별 가격 데이터 로딩 실패');
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingMonthly(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [complex.id, selectedAreaFamilyId, analysisPeriod.startYmd, analysisPeriod.endYmd, areaFamilies]);

  useEffect(() => {
    const cancelFn = fetchMonthlyData();
    return () => {
      if (cancelFn) cancelFn();
    };
  }, [fetchMonthlyData]);

  // 4. Calculate Detailed Price Metrics from V2 Monthly SSOT with custom period applied
  const metrics: DetailedPriceMetrics = useMemo(() => {
    const aggsToUse = allHistoryAggs.length > 0 ? allHistoryAggs : monthlyAggs;
    const standardCategory: AreaCategory =
      selectedFamily?.standardAreaCategory === '84' ? '84' : '59';
    return calculateDetailedPriceMetrics(aggsToUse, standardCategory, analysisPeriod);
  }, [allHistoryAggs, monthlyAggs, selectedFamily, analysisPeriod]);

  // 5. Fetch focused scatter trades for selected AreaFamily and custom period
  useEffect(() => {
    let isMounted = true;
    if (!selectedAreaFamilyId) {
      setScatterTrades([]);
      return;
    }
    setIsLoadingScatter(true);
    dataService
      .getAreaFamilyScatterTrades(
        complex.id,
        selectedAreaFamilyId,
        analysisPeriod.startYmd,
        analysisPeriod.endYmd
      )
      .then((trades) => {
        if (isMounted) {
          const valid = trades.filter((t) => t.price > 0 && !t.isCancelled);
          setScatterTrades(valid);
        }
      })
      .catch((err) => {
        console.warn('[PriceAnalysisView] Failed to fetch scatter trades:', err);
        if (isMounted) setScatterTrades([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingScatter(false);
      });

    return () => {
      isMounted = false;
    };
  }, [complex.id, selectedAreaFamilyId, analysisPeriod.startYmd, analysisPeriod.endYmd]);

  // 5-1. All-Time High Individual Trade (역대 신고가)
  // Fetched directly from the server for the selected AreaFamily across the entire transaction history
  useEffect(() => {
    let isMounted = true;
    if (!selectedAreaFamilyId) {
      setAthTrade(null);
      return;
    }
    dataService
      .getAreaFamilyAthTrade(complex.id, selectedAreaFamilyId)
      .then((trade) => {
        if (isMounted) setAthTrade(trade);
      })
      .catch((err) => {
        console.warn('[PriceAnalysisView] Failed to fetch ATH trade:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [complex.id, selectedAreaFamilyId]);

  const filteredTrades = scatterTrades;

  // 6. CSV Export Handler
  const handleExportCsv = () => {
    if (filteredTrades.length === 0) return;

    const headers = [
      '계약일자',
      '단지명',
      '법정동',
      '주택형',
      '전용면적(㎡)',
      '공급면적',
      '실거래가(만원)',
      '평단가(만원)',
      '층수',
      '거래유형',
      '취소여부',
      '취소일자',
    ];

    const hasSupplyArea = typeof selectedFamily?.representativeSupplyArea === 'number' && selectedFamily.representativeSupplyArea > 0;
    const supplyPyeong = hasSupplyArea ? selectedFamily!.representativeSupplyArea / 3.305785 : null;

    const supplyAreaStr = hasSupplyArea
      ? `"공급 ${selectedFamily!.representativeSupplyArea}㎡ / ${supplyPyeong!.toFixed(2)}평"`
      : '"공급면적 확인 불가"';

    const rows = filteredTrades.map((t) => [
      t.dealDate,
      `"${t.complexName}"`,
      `"${complex.district}"`,
      `"${selectedFamily?.label || selectedAreaFamilyId}"`,
      t.exclusiveArea,
      supplyAreaStr,
      t.price,
      hasSupplyArea && supplyPyeong && t.price > 0 ? Math.round(t.price / supplyPyeong) : '확인불가',
      t.floor,
      `"${t.dealType || '확인불가'}"`,
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
      `${complex.shortName}_${selectedFamily?.label || selectedAreaFamilyId}_실거래가_${analysisPeriod.startYmd}-${analysisPeriod.endYmd}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isGlobalLoading = isLoadingFamilies || isLoadingMonthly || isLoadingTrades;
  const activeError = familyError || monthlyError || (apiError ? apiError.message : null);

  return (
    <div className="space-y-6 max-w-7xl w-full mx-auto pb-12">
      {/* A. 단지 / AreaFamily / 기간 선택 Top Bar */}
      <PriceAnalysisHeader
        complex={complex}
        onSelectComplex={onSelectComplex}
        areaFamilies={areaFamilies}
        selectedAreaFamilyId={selectedAreaFamilyId}
        onSelectAreaFamily={(id) => setSelectedAreaFamilyId(id)}
        isLoadingFamilies={isLoadingFamilies}
        analysisPeriod={analysisPeriod}
        onChangePeriod={(p) => setAnalysisPeriod(p)}
        onNavigateToMap={onNavigateToMap}
        onOpenAiDrawer={onOpenAiDrawer}
      />

      {/* Loading state indicator banner */}
      {isGlobalLoading && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center justify-between animate-pulse">
          <span className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>월별 대표 실거래가(V2 SSOT) 데이터를 집계하고 있습니다...</span>
          </span>
        </div>
      )}

      {/* API / Network Error Banner */}
      {activeError && (
        <div className="p-4 sm:p-5 bg-rose-950/60 border border-rose-800 rounded-2xl text-rose-200 space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ServerCrash className="w-5 h-5 text-rose-400 shrink-0" />
              <h3 className="font-bold text-sm sm:text-base text-rose-100">
                실거래 데이터를 불러오지 못했습니다
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                if (onRetryFetch) onRetryFetch();
                fetchMonthlyData();
              }}
              disabled={isGlobalLoading}
              className="px-3 py-1 bg-rose-900 hover:bg-rose-800 rounded-lg text-xs font-semibold text-rose-100 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGlobalLoading ? 'animate-spin' : ''}`} />
              다시 시도
            </button>
          </div>
          <p className="text-xs leading-relaxed text-rose-200">{activeError}</p>
        </div>
      )}

      {/* Informational: Selected Family has no monthly data */}
      {!activeError && !isGlobalLoading && selectedFamily && !selectedFamily.hasMonthlyData && (
        <div className="p-4 sm:p-5 bg-slate-900 border border-slate-800 rounded-2xl text-slate-300 space-y-2">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-amber-300">
                {selectedFamily.label} 실거래 데이터 없음
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed mt-1">
                {complex.name}에 등록된 주택형({formatAreaFamilySubtext(selectedFamily)})이지만, 현재 국토교통부 실거래 데이터가 존재하지 않습니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Informational: No trades in selected period for this family */}
      {!activeError &&
        !isGlobalLoading &&
        selectedFamily?.hasMonthlyData &&
        monthlyAggs.length === 0 && (
          <div className="p-4 sm:p-5 bg-slate-900 border border-slate-800 rounded-2xl text-slate-300 space-y-3">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-amber-300">
                  선택 기간 실거래 데이터 없음 ({selectedFamily.label})
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed mt-1">
                  선택하신 기간({analysisPeriod.startMonth} ~ {analysisPeriod.endMonth}) 내에 해당 주택형의 실거래 내역이 없습니다. 기간을 &apos;전체&apos; 또는 더 넓은 범위로 변경해보세요.
                </p>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() =>
                      setAnalysisPeriod({
                        startMonth: '2006.01',
                        endMonth: `${new Date().getFullYear()}.${String(new Date().getMonth()+1).padStart(2,'0')}`,
                        startYmd: '200601',
                        endYmd: `${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}`,
                        presetId: 'ALL',
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-slate-950 transition-colors shadow-md"
                  >
                    <span>전체 기간으로 보기</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* B. 핵심 지표 4개 */}
      <CoreMetricsCards
        metrics={metrics}
        selectedArea={selectedFamily?.standardAreaCategory === '84' ? '84' : '59'}
        selectedFamily={selectedFamily}
        athTrade={athTrade}
      />

      {/* C. 가격 + 거래량 메인 차트 (V2 SSOT Monthly) */}
      <MainPriceChart
        complex={complex}
        monthlyAggs={monthlyAggs}
        trades={filteredTrades}
        selectedArea={selectedFamily?.standardAreaCategory === '84' ? '84' : '59'}
        selectedFamily={selectedFamily}
        analysisPeriod={analysisPeriod}
      />

      {/* D. 상승/하락 분석 (ATH, 낙폭, MDD, CAGR) */}
      <DrawdownAnalysisSection metrics={metrics} />

      {/* E. 기간별 수익률 (1Y, 3Y, 5Y, 10Y, 전체) */}
      <PeriodReturnsSection periodReturns={metrics.periodReturns} />

      {/* F. 실제 실거래 내역 원장 (서버사이드 Cursor Pagination) */}
      <TransactionLedger
        complex={complex}
        selectedAreaFamilyId={selectedAreaFamilyId}
        selectedFamily={selectedFamily}
        startYmd={analysisPeriod.startYmd}
        endYmd={analysisPeriod.endYmd}
        onExportCsv={handleExportCsv}
      />
    </div>
  );
};
