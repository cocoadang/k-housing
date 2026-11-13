import { parseHousingRoute } from '../../utils/housingRoute';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  RefreshCw,
  AlertCircle,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';
import { ProjectHeader } from './ProjectHeader';
import { MarketValueSection } from './MarketValueSection';
import { ProjectTimelineSection } from './ProjectTimelineSection';
import { OwnerEconomicsSection } from './OwnerEconomicsSection';
import { ProjectEconomicsSection } from './ProjectEconomicsSection';
import { LandShareSection } from './LandShareSection';
import { redevelopmentApiClient } from '../../services/redevelopmentApiClient';
import type {
  RedevelopmentLineageListItem,
  RedevelopmentLineageDetailResponse,
  RedevelopmentTargetInfo,
  RedevelopmentResearchExample,
  RedevelopmentPriceAvailabilityResponse,
  RedevelopmentLandShareResponse,
  RedevelopmentConstructionCostsResponse,
  RedevelopmentAnalysisApiResponse,
} from '../../types/redevelopmentApi';
import type { AnalysisMode, PriceMetricType } from '../../types/redevelopmentAnalysis';

export const RedevelopmentAnalysisView: React.FC = () => {
  // 1. Lineage State
  const [lineages, setLineages] = useState<RedevelopmentLineageListItem[]>([]);
  const [selectedLineageId, setSelectedLineageId] = useState<string>(() => parseHousingRoute(window.location.search).lineageId);
  const [lineageDetail, setLineageDetail] = useState<RedevelopmentLineageDetailResponse['lineage'] | null>(null);

  // 2. Targets State
  const [predecessorTargets, setPredecessorTargets] = useState<RedevelopmentTargetInfo[]>([]);
  const [successorTargets, setSuccessorTargets] = useState<RedevelopmentTargetInfo[]>([]);
  const [researchExamples, setResearchExamples] = useState<RedevelopmentResearchExample[]>([]);
  const [selectedPredecessorTarget, setSelectedPredecessorTarget] = useState<RedevelopmentTargetInfo | null>(null);
  const [selectedSuccessorTarget, setSelectedSuccessorTarget] = useState<RedevelopmentTargetInfo | null>(null);

  // 3. Price Availability & Months
  const [predecessorAvailability, setPredecessorAvailability] = useState<RedevelopmentPriceAvailabilityResponse | null>(null);
  const [successorAvailability, setSuccessorAvailability] = useState<RedevelopmentPriceAvailabilityResponse | null>(null);
  const [selectedPredMonth, setSelectedPredMonth] = useState<string>('201911');
  const [selectedSuccMonth, setSelectedSuccMonth] = useState<string>('202608');

  // 4. Analysis Parameters
  const [priceMetric, setPriceMetric] = useState<PriceMetricType>('MEDIAN_PRICE');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('VERIFIED_HISTORICAL');
  const [analysisResult, setAnalysisResult] = useState<RedevelopmentAnalysisApiResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // 5. Sections Data
  const [landShareData, setLandShareData] = useState<RedevelopmentLandShareResponse | null>(null);
  const [constructionCosts, setConstructionCosts] = useState<RedevelopmentConstructionCostsResponse | null>(null);

  // 6. Section Loading & Partial Error States
  const [isLoadingLineage, setIsLoadingLineage] = useState<boolean>(true);
  const [lineageError, setLineageError] = useState<string | null>(null);
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});

  // --------------------------------------------------------------------------
  // Fetch Lineage List & Static Detail
  // --------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    async function loadLineages() {
      setIsLoadingLineage(true);
      setLineageError(null);
      try {
        const linRes = await redevelopmentApiClient.getLineages();
        if (isMounted) {
          setLineages(linRes.lineages || []);
        }
      } catch (err: any) {
        if (isMounted) {
          setLineageError(err?.message || '정비사업 계보 목록을 불러오지 못했습니다.');
        }
      } finally {
        if (isMounted) setIsLoadingLineage(false);
      }
    }

    loadLineages();
    return () => {
      isMounted = false;
    };
  }, []);

  // --------------------------------------------------------------------------
  // Fetch Lineage Detail, Targets, LandShare, ConstructionCosts for Selected Lineage
  // --------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    async function loadLineageData() {
      if (!selectedLineageId) return;

      // Reset section errors
      setSectionErrors({});

      // 1. Lineage Detail
      setAnalysisResult(null);
      setAnalysisError(null);

      redevelopmentApiClient
        .getLineageDetail(selectedLineageId)
        .then((res) => {
          if (isMounted) setLineageDetail(res.lineage);
        })
        .catch((err) => {
          if (isMounted) {
            setSectionErrors((prev) => ({
              ...prev,
              detail: err?.message || '사업 상세 정보를 불러오지 못했습니다.',
            }));
          }
        });

      // 2. Targets
      redevelopmentApiClient
        .getTargets(selectedLineageId)
        .then((res) => {
          if (isMounted) {
            const preds = res.predecessorTargets || [];
            const succs = res.successorTargets || [];
            setPredecessorTargets(preds);
            setSuccessorTargets(succs);
            setResearchExamples(res.researchExamples || []);

            // Set initial defaults if not selected or if invalid for current lineage
            const currentPredStillValid = preds.some(
              (p) => p.complexId === selectedPredecessorTarget?.complexId && p.areaFamilyId === selectedPredecessorTarget?.areaFamilyId
            );
            if (!currentPredStillValid) {
              if (preds.length > 0) {
                const defaultPred = preds.find((p) => p.hasPriceData) || preds[0];
                setSelectedPredecessorTarget(defaultPred);
              } else {
                setSelectedPredecessorTarget(null);
              }
            }

            const currentSuccStillValid = succs.some(
              (s) => s.complexId === selectedSuccessorTarget?.complexId && s.areaFamilyId === selectedSuccessorTarget?.areaFamilyId
            );
            if (!currentSuccStillValid) {
              if (succs.length > 0) {
                const defaultSucc = succs.find((s) => s.hasPriceData) || succs[0];
                setSelectedSuccessorTarget(defaultSucc);
              } else {
                setSelectedSuccessorTarget(null);
              }
            }
          }
        })
        .catch((err) => {
          if (isMounted) {
            setSectionErrors((prev) => ({
              ...prev,
              targets: err?.message || '분석 대상 평형군 목록을 불러오지 못했습니다.',
            }));
          }
        });

      // 3. Land Share
      redevelopmentApiClient
        .getLandShare(selectedLineageId)
        .then((res) => {
          if (isMounted) setLandShareData(res);
        })
        .catch((err) => {
          if (isMounted) {
            setSectionErrors((prev) => ({
              ...prev,
              landShare: err?.message || '대지지분 정보를 불러오지 못했습니다.',
            }));
          }
        });

      // 4. Construction Costs
      redevelopmentApiClient
        .getConstructionCosts(selectedLineageId)
        .then((res) => {
          if (isMounted) setConstructionCosts(res);
        })
        .catch((err) => {
          if (isMounted) {
            setSectionErrors((prev) => ({
              ...prev,
              construction: err?.message || '공사비 내역을 불러오지 못했습니다.',
            }));
          }
        });
    }

    loadLineageData();
    return () => {
      isMounted = false;
    };
  }, [selectedLineageId]);

  // --------------------------------------------------------------------------
  // Update Price Availability when Targets Change
  // --------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    async function loadPredecessorAvailability() {
      if (!selectedPredecessorTarget) return;
      try {
        const res = await redevelopmentApiClient.getPriceAvailability(
          selectedPredecessorTarget.complexId,
          selectedPredecessorTarget.areaFamilyId
        );
        if (isMounted) {
          setPredecessorAvailability(res);
          if (res.lastObservedMonth) {
            setSelectedPredMonth(res.lastObservedMonth);
          }
        }
      } catch (err) {
        console.warn('Predecessor availability fetch failed:', err);
      }
    }

    loadPredecessorAvailability();
    return () => {
      isMounted = false;
    };
  }, [selectedPredecessorTarget]);

  useEffect(() => {
    let isMounted = true;

    async function loadSuccessorAvailability() {
      if (!selectedSuccessorTarget) return;
      try {
        const res = await redevelopmentApiClient.getPriceAvailability(
          selectedSuccessorTarget.complexId,
          selectedSuccessorTarget.areaFamilyId
        );
        if (isMounted) {
          setSuccessorAvailability(res);
          if (res.lastObservedMonth) {
            setSelectedSuccMonth(res.lastObservedMonth);
          }
        }
      } catch (err) {
        console.warn('Successor availability fetch failed:', err);
      }
    }

    loadSuccessorAvailability();
    return () => {
      isMounted = false;
    };
  }, [selectedSuccessorTarget]);

  // --------------------------------------------------------------------------
  // Execute Analysis on User Trigger or Parameters Change
  // --------------------------------------------------------------------------
  const executeAnalysis = useCallback(async () => {
    if (!selectedPredecessorTarget || !selectedSuccessorTarget) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const res = await redevelopmentApiClient.runAnalysis({
        lineageId: selectedLineageId,
        analysisMode,
        predecessorTarget: {
          complexId: selectedPredecessorTarget.complexId,
          areaFamilyId: selectedPredecessorTarget.areaFamilyId,
        },
        successorTarget: {
          complexId: selectedSuccessorTarget.complexId,
          areaFamilyId: selectedSuccessorTarget.areaFamilyId,
        },
        predecessorMonth: selectedPredMonth,
        successorMonth: selectedSuccMonth,
        priceMetric,
        priceSelectionPolicy: 'EXACT_MONTH',
        evidencePolicy: 'VERIFIED_ONLY',
      });

      setAnalysisResult(res);
    } catch (err: any) {
      setAnalysisError(err?.message || '분석 실행 중 오류가 발생했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [
    selectedLineageId,
    analysisMode,
    selectedPredecessorTarget,
    selectedSuccessorTarget,
    selectedPredMonth,
    selectedSuccMonth,
    priceMetric,
  ]);

  // Auto-run analysis when targets/mode/months change
  useEffect(() => {
    if (selectedPredecessorTarget && selectedSuccessorTarget) {
      executeAnalysis();
    }
  }, [
    selectedLineageId,
    analysisMode,
    selectedPredecessorTarget,
    selectedSuccessorTarget,
    selectedPredMonth,
    selectedSuccMonth,
    priceMetric,
  ]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Global Error Banner if Lineage Fails entirely */}
      {lineageError && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{lineageError}</span>
        </div>
      )}

      {/* Section A: Project Header & Capability Summary */}
      <ProjectHeader
        lineages={lineages}
        selectedLineageId={selectedLineageId}
        onSelectLineageId={setSelectedLineageId}
        lineageDetail={lineageDetail}
        isLoading={isLoadingLineage}
        landShareCount={landShareData?.tiers?.length}
        constructionCostCount={constructionCosts?.events?.length}
      />

      {/* Section B: Market Value Analysis (Most Interactive Section) */}
      <MarketValueSection
        predecessorTargets={predecessorTargets}
        successorTargets={successorTargets}
        selectedPredecessorTarget={selectedPredecessorTarget}
        onSelectPredecessorTarget={setSelectedPredecessorTarget}
        selectedSuccessorTarget={selectedSuccessorTarget}
        onSelectSuccessorTarget={setSelectedSuccessorTarget}
        predecessorAvailability={predecessorAvailability}
        successorAvailability={successorAvailability}
        selectedPredMonth={selectedPredMonth}
        onChangePredMonth={setSelectedPredMonth}
        selectedSuccMonth={selectedSuccMonth}
        onChangeSuccMonth={setSelectedSuccMonth}
        priceMetric={priceMetric}
        onChangePriceMetric={setPriceMetric}
        analysisMode={analysisMode}
        onChangeAnalysisMode={setAnalysisMode}
        analysisResult={analysisResult}
        isAnalyzing={isAnalyzing}
        analysisError={analysisError}
        onTriggerAnalysis={executeAnalysis}
      />

      {/* Section C: Project Timeline */}
      <ProjectTimelineSection
        lineageDetail={lineageDetail}
        isLoading={isLoadingLineage}
        landShareCount={landShareData?.tiers?.length}
        constructionCostCount={constructionCosts?.events?.length}
      />

      {/* Section D: Owner Economics */}
      <OwnerEconomicsSection
        key={selectedLineageId}
        lineageId={selectedLineageId}
        researchExamples={researchExamples}
        selectedPredecessorTarget={selectedPredecessorTarget}
        selectedSuccessorTarget={selectedSuccessorTarget}
        landShareData={landShareData}
      />

      {/* Section E: Project Economics (Construction Costs) */}
      <ProjectEconomicsSection
        constructionCosts={constructionCosts}
        isLoading={false}
      />

      {/* Section F: Land Share Analysis */}
      <LandShareSection
        landShareData={landShareData}
        isLoading={false}
      />
    </div>
  );
};
