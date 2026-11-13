/**
 * Phase 8C-1: Redevelopment Value Analysis Engine Foundation Types
 * 
 * CORE ARCHITECTURAL PRINCIPLE:
 * "CALCULATE WHEN JUSTIFIED, REFUSE WHEN NOT JUSTIFIED"
 * 
 * Strict Domain Isolation:
 * 1. OWNER ECONOMICS: Individual member rights, basis, cash flows, value multiples.
 * 2. PROJECT ECONOMICS: Total project costs, contractor demands, REB audits, cost timeline.
 * 3. NO automatic conversion between Project Construction Costs and Individual Contributions.
 * 4. NO automatic similarity inference or successor mapping generation.
 * 5. NO continuous price series across redevelopment boundary; NO cross-boundary CAGR/MDD/ATH/Volatility.
 */

import {
  ProductionEligibility,
  MappingCoverageStatus,
  FinancialSemanticType,
  ConstructionCostStatus,
  CalculationReadinessStatus,
} from './redevelopmentNormalizedSeed';

export type AnalysisReadiness = CalculationReadinessStatus; // 'READY' | 'PARTIAL' | 'NOT_READY'

export type CalculationAvailability =
  | 'AVAILABLE'
  | 'DATA_NOT_AVAILABLE'
  | 'INSUFFICIENT_EVIDENCE'
  | 'UNVERIFIED_MAPPING'
  | 'MISSING_CASH_FLOW_DATES'
  | 'MISSING_COST_BASIS'
  | 'MISSING_SUCCESSOR_VALUE'
  | 'MISSING_PREDECESSOR_VALUE'
  | 'UNSUPPORTED_EVIDENCE'
  | 'INVALID_INPUT'
  | 'NO_SOLUTION';

export type EvidenceEligibilityPolicy = 'VERIFIED_ONLY' | 'ALLOW_SUPPORTED';

export type ValueMetricType =
  | 'NOMINAL_ASSET_VALUE_CHANGE'
  | 'NOMINAL_ASSET_VALUE_MULTIPLE'
  | 'SCENARIO_NOMINAL_VALUE_CHANGE'
  | 'SCENARIO_NOMINAL_VALUE_MULTIPLE'
  | 'COST_ADJUSTED_VALUE_CHANGE'
  | 'COST_ADJUSTED_VALUE_MULTIPLE'
  | 'XIRR'
  | 'LAND_SHARE_RATIO'
  | 'LAND_SHARE_DIFFERENCE'
  | 'CONSTRUCTION_COST_TIMELINE'
  | 'CONSTRUCTION_COST_EVENT_CHANGE';

export type AnalysisMode = 'VERIFIED_HISTORICAL' | 'USER_SCENARIO';

export type PredecessorBasisType =
  | 'MARKET_VALUE'
  | 'APPRAISAL_VALUE'
  | 'RIGHTS_VALUE'
  | 'ACTUAL_ACQUISITION_COST';

export type OwnerCashFlowType =
  | 'ACQUISITION'
  | 'ADDITIONAL_CONTRIBUTION'
  | 'ADDITIONAL_CHARGE'
  | 'REFUND'
  | 'OTHER_VERIFIED_OUTFLOW'
  | 'OTHER_VERIFIED_INFLOW';

export type PriceSelectionPolicy =
  | 'EXACT_MONTH'
  | 'LATEST_OBSERVED_ON_OR_BEFORE'
  | 'EARLIEST_OBSERVED_ON_OR_AFTER';

export type PriceMetricType = 'MEDIAN_PRICE' | 'AVERAGE_PRICE';

export interface PriceObservation {
  complexId: string;
  areaFamilyId: string;
  requestedMonth: string; // YYYYMM
  actualObservationMonth: string | null; // YYYYMM
  selectionPolicy: PriceSelectionPolicy;
  priceMetric: PriceMetricType;
  value: number | null; // 만원 (KRW_MANWON)
  unit: 'KRW_MANWON';
  tradeCount: number;
  monthDistance: number;
  sourceCollection: 'monthlyComplexPrices_v2';
  documentId: string | null;
}

export interface PriceResolutionResult {
  availability: CalculationAvailability;
  observation: PriceObservation | null;
  warnings: string[];
  missingRequirements: string[];
  metadata?: any;
}

export interface PriceProvenance {
  sourceCollection: 'monthlyComplexPrices_v2';
  documentId: string;
  complexId: string;
  areaFamilyId: string;
  dealYmd: string;
  priceMetric: PriceMetricType;
  tradeCount: number;
  observedAt?: string;
}

export interface AnalysisTarget {
  complexId: string;
  areaFamilyId: string;
}

export interface RedevelopmentAnalysisRequest {
  lineageId: string;
  analysisMode: AnalysisMode;
  predecessorTarget: AnalysisTarget;
  successorTarget: AnalysisTarget;
  predecessorMonth: string; // YYYYMM or YYYY-MM
  successorMonth: string; // YYYYMM or YYYY-MM
  priceMetric?: PriceMetricType; // default 'MEDIAN_PRICE'
  priceSelectionPolicy?: PriceSelectionPolicy; // default 'EXACT_MONTH'
  selectionPolicy?: PriceSelectionPolicy; // alias for priceSelectionPolicy
  evidencePolicy?: EvidenceEligibilityPolicy; // default 'VERIFIED_ONLY'
}

export interface ProvenanceMetadata {
  sourceIds: string[];
  evidenceIds: string[];
  inputRecordIds: string[];
  productionEligibility: ProductionEligibility[];
  evaluatedAt: string;
}

export interface AnalysisObservationPoint {
  date: string; // YYYY-MM or YYYYMM
  price: number; // 만원
  unit: string; // e.g. "KRW_MANWON"
  tradeCount?: number;
  complexId: string;
  areaFamilyId: string;
  selectionPolicyUsed: PriceSelectionPolicy;
  documentId?: string | null;
  sourceCollection?: 'monthlyComplexPrices_v2';
}

export interface OwnerCashFlowItem {
  flowId: string;
  flowType: OwnerCashFlowType;
  amount: number; // positive = outflow from owner (납부/지출), negative = inflow to owner (환급/수령)
  unit: 'KRW_MANWON' | 'KRW_WON';
  date: string | null; // YYYY-MM-DD. NULL if unrecorded. Strictly NO fabrication!
  sourceId: string;
  evidenceId: string;
  productionEligibility: ProductionEligibility;
  notes?: string;
}

/**
 * Base analysis result contract.
 * Every calculation returns rich metadata, assumptions, provenance, and warnings.
 * When calculation is not available, value is NULL (never 0).
 */
export interface AnalysisResultContract<T = number | Record<string, any>> {
  metricType: ValueMetricType;
  availability: CalculationAvailability;
  readiness: AnalysisReadiness;
  value: T | null;
  unit: string;
  displayLabel: string; // Strictly non-ROI wording, e.g. "명목 자산가치 변화", "대지지분 비율"
  analysisMode: AnalysisMode;
  inputs: Record<string, any>;
  provenance: ProvenanceMetadata;
  assumptions: string[];
  warnings: string[];
  missingRequirements: string[];
}

/**
 * 1. Owner Economics: Nominal Asset Value Analysis Result
 */
export interface OwnerNominalValueAnalysisResult extends AnalysisResultContract<number> {
  predecessorObservation?: AnalysisObservationPoint | null;
  successorObservation?: AnalysisObservationPoint | null;
  elapsedDays?: number | null;
  elapsedYears?: number | null;
  historicalMappingVerified: boolean;
}

/**
 * 2. Owner Economics: Cost Adjusted Value Analysis Result
 */
export interface OwnerCostAdjustedValueAnalysisResult extends AnalysisResultContract<number> {
  basisType: PredecessorBasisType;
  predecessorBasisAmount: number | null;
  totalOutflows: number | null;
  totalRefunds: number | null;
  netEconomicBasis: number | null;
  successorValue: number | null;
  cashFlowsIncluded: OwnerCashFlowItem[];
}

/**
 * 3. Owner Economics: XIRR Analysis Result
 */
export interface OwnerXirrAnalysisResult extends AnalysisResultContract<number> {
  cashFlowCount: number;
  startDate: string | null;
  endDate: string | null;
  totalOutflow: number | null;
  finalSuccessorValue: number | null;
  iterationsUsed?: number;
}

/**
 * 4. Land Share Analysis Result (Descriptive Only, No Causal Inference)
 */
export interface LandShareRatioItem {
  tierId: string;
  complexNumber: number;
  pyeongName: string;
  exclusiveAreaSqm: number;
  landShareSqm: number;
  landShareRatio: number; // landShareSqm / exclusiveAreaSqm
  sourceOriginalPyeong: number;
}

export interface LandShareAnalysisResult extends AnalysisResultContract<LandShareRatioItem[]> {
  rankingsByRatio: {
    tierId: string;
    pyeongName: string;
    landShareRatio: number;
    rank: number;
  }[];
}

export interface TargetLandShareResult extends AnalysisResultContract<number | null> {
  exclusiveAreaSqm?: number;
  landShareSqm?: number;
  ratioPercent?: number;
}

export interface LandShareSimilarityResult extends AnalysisResultContract<{
  tierA: string;
  tierB: string;
  differenceSqm: number;
  differencePercent: number;
}> {
  causalInferenceWarning: string;
}

/**
 * 5. Project Economics: Construction Cost Analysis Result
 */
export interface ProjectCostEventComparison {
  priorEventId: string;
  priorStatus: ConstructionCostStatus;
  priorAmountKrw: number;
  priorDate: string;
  targetEventId: string;
  targetStatus: ConstructionCostStatus;
  targetAmountKrw: number;
  targetDate: string;
  differenceAmountKrw: number;
  differencePercent: number;
  comparisonSemanticLabel: string; // e.g. "REQUESTED_CHANGE_FROM_PRIOR_CONTRACT"
}

export interface ProjectCostAnalysisResult extends AnalysisResultContract<ProjectCostEventComparison[]> {
  totalEventsTracked: number;
  rebAuditSummary?: {
    targetAmountKrw: number;
    reducedAmountKrw: number;
    recognizedAmountKrw: number;
    unverifiableAmountKrw: number;
  };
  currentCostPhase: string;
  isFinal: boolean;
}

/**
 * Overall Readiness Evaluation for Lineage
 */
export interface LineageReadinessSummary {
  lineageId: string;
  projectId: string;
  evidencePolicy: EvidenceEligibilityPolicy;
  nominalHistorical: {
    readiness: AnalysisReadiness;
    availability: CalculationAvailability;
    missingRequirements: string[];
    warnings: string[];
  };
  nominalScenario: {
    readiness: AnalysisReadiness;
    availability: CalculationAvailability;
    missingRequirements: string[];
    warnings: string[];
  };
  costAdjusted: {
    readiness: AnalysisReadiness;
    availability: CalculationAvailability;
    missingRequirements: string[];
    warnings: string[];
  };
  xirr: {
    readiness: AnalysisReadiness;
    availability: CalculationAvailability;
    missingRequirements: string[];
    warnings: string[];
  };
  landShare: {
    readiness: AnalysisReadiness;
    availability: CalculationAvailability;
    missingRequirements: string[];
    warnings: string[];
  };
  constructionCostTimeline: {
    readiness: AnalysisReadiness;
    availability: CalculationAvailability;
    missingRequirements: string[];
    warnings: string[];
  };
  evaluatedAt: string;
}

/**
 * Comprehensive Orchestrated Analysis Result for Redevelopment Lineage
 */
export interface ComprehensiveRedevelopmentAnalysisResult {
  lineageId: string;
  analysisMode: AnalysisMode;
  scenario: boolean;
  historicalMappingVerified: boolean;
  predecessorTarget: AnalysisTarget;
  successorTarget: AnalysisTarget;
  predecessorPriceResolution: PriceResolutionResult;
  successorPriceResolution: PriceResolutionResult;
  startObservationMonth: string | null;
  endObservationMonth: string | null;
  elapsedMonths: number | null;
  elapsedYears: number | null;
  nominalValueResult: OwnerNominalValueAnalysisResult;
  costAdjustedResult: OwnerCostAdjustedValueAnalysisResult;
  xirrResult: OwnerXirrAnalysisResult;
  landShareResult?: TargetLandShareResult | LandShareAnalysisResult | null;
  constructionCostResult?: ProjectCostAnalysisResult | null;
  priceProvenance: {
    predecessor?: PriceProvenance | null;
    successor?: PriceProvenance | null;
  };
  evidenceProvenance: ProvenanceMetadata;
  warnings: string[];
  missingRequirements: string[];
  evaluatedAt: string;
}

