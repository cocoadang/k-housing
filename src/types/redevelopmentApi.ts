/**
 * Phase 8C-3: Redevelopment API & Public Contract Types
 * 
 * Strict separation of public API contracts, error contracts,
 * provenance metadata, and domain calculation results.
 */

import type {
  AnalysisMode,
  PriceMetricType,
  PriceSelectionPolicy,
  EvidenceEligibilityPolicy,
  AnalysisReadiness,
  CalculationAvailability,
  AnalysisTarget,
  OwnerNominalValueAnalysisResult,
  OwnerCostAdjustedValueAnalysisResult,
  OwnerXirrAnalysisResult,
  LandShareAnalysisResult,
  TargetLandShareResult,
  ProjectCostAnalysisResult,
  ProjectCostEventComparison,
  LineageReadinessSummary,
} from './redevelopmentAnalysis';
import type { RedevelopmentMilestoneCategory } from './redevelopment';

// ============================================================================
// 1. Error Contract
// ============================================================================
export type RedevelopmentErrorCode =
  | 'INVALID_LINEAGE'
  | 'INVALID_COMPLEX'
  | 'INVALID_AREA_FAMILY'
  | 'INVALID_MONTH'
  | 'INVALID_ANALYSIS_MODE'
  | 'INVALID_PRICE_METRIC'
  | 'INVALID_PRICE_SELECTION_POLICY'
  | 'INVALID_EVIDENCE_POLICY'
  | 'V2_READ_FAILED'
  | 'INTERNAL_ANALYSIS_ERROR';

export interface RedevelopmentApiErrorResponse {
  error: {
    code: RedevelopmentErrorCode;
    message: string;
    details?: any;
  };
}

// ============================================================================
// 2. Lineage List & Detail Contract
// ============================================================================
export interface RedevelopmentLineageListItem {
  lineageId: string;
  displayName: string;
  redevelopmentType?: 'RECONSTRUCTION' | 'REDEVELOPMENT' | 'URBAN_PUBLIC_HOUSING_COMPLEX';
  redevelopmentTypeLabel?: string;
  predecessors: {
    complexId: string;
    complexName: string;
    isHistoricalOnly: boolean;
  }[];
  successors: {
    complexId: string;
    complexName: string;
  }[];
  analysisCapabilities: string[];
  sourceSummary: {
    verifiedActualMappingCount: number;
    evidenceCount: number;
    sourcesCount: number;
  };
}

export interface RedevelopmentLineagesResponse {
  success: boolean;
  lineages: RedevelopmentLineageListItem[];
}

export interface RedevelopmentMilestonePublic {
  milestoneId: string;
  name: string;
  date: string; // Primary representative date
  category?: RedevelopmentMilestoneCategory;
  approvalDate?: string | null;     // 행정 인가/승인일
  noticeDate?: string | null;       // 지자체 고시/공고일
  noticeNumber?: string | null;     // 고시 번호 (예: 강동구 고시 제2015-93호)
  filingDate?: string | null;       // 신청/신고 접수일
  occurrenceDate?: string | null;   // 실제 착수/사건 발생일
  sourceText?: string;
  evidenceClass: 'OFFICIAL' | 'REFERENCE';
  verificationStatus: 'VERIFIED' | 'SUPPORTED' | 'PENDING' | 'UNSUPPORTED' | 'CONFLICTING';
  calculationEligibility: 'ELIGIBLE' | 'INELIGIBLE';
  evidenceLevel: 'VERIFIED' | 'SUPPORTED' | 'PENDING' | 'UNSUPPORTED'; // compatibility
  isConfirmed: boolean;
  notes?: string;
}

export interface RedevelopmentLineageDetailResponse {
  success: boolean;
  lineage: {
    lineageId: string;
    projectId: string;
    displayName: string;
    description: string;
    redevelopmentType?: 'RECONSTRUCTION' | 'REDEVELOPMENT' | 'URBAN_PUBLIC_HOUSING_COMPLEX';
    redevelopmentTypeLabel?: string;
    status?: string;
    milestones: {
      promotionCommitteeApprovalDate?: string | null;
      districtDesignationDate?: string | null;
      associationApprovalDate?: string | null;
      projectApprovalDate?: string | null;
      projectNoticeDate?: string | null;
      projectNoticeNumber?: string | null;
      complexPlanApprovalDate?: string | null;
      managementDispositionApprovalDate?: string | null;
      managementDispositionNoticeDate?: string | null;
      managementDispositionNoticeNumber?: string | null;
      demolitionDate?: string | null;
      constructionStartDate?: string | null;
      generalSaleDate?: string | null;
      completionDate?: string | null;
      moveInDate?: string | null;
    };
    timeline?: RedevelopmentMilestonePublic[];
    units: {
      before: number | null;
      after: number;
    };
    predecessors: {
      complexId: string;
      complexName: string;
      isHistoricalOnly: boolean;
    }[];
    successors: {
      complexId: string;
      complexName: string;
    }[];
    mappingCoverage: {
      predecessorFamilies: number;
      verifiedActual: number;
      verifiedOption: number;
      partial: number;
      unknown: number;
      applicationExamples: number;
      automatic: number;
    };
    readiness: LineageReadinessSummary;
    evidenceSummary: {
      evidenceCount: number;
      primarySourcesCount: number;
      proportionalRatePct?: number | null;
      proportionalRateEligibility: string;
      constructionCostEventsCount: number;
    };
  };
}

// ============================================================================
// 3. Targets Contract
// ============================================================================
export interface RedevelopmentTargetInfo {
  complexId: string;
  complexName: string;
  areaFamilyId: string;
  areaFamilyLabel: string;
  exclusiveAreaRepresentative: number;
  exclusiveAreaPyeong?: number;
  supplyAreaRepresentative?: number | null;
  legacyPyeongLabel?: string | null;
  hasPriceData: boolean;
  firstObservedMonth: string | null;
  lastObservedMonth: string | null;
  observedMonthCount: number;
  historicalOnly: boolean;
  mappingKnowledgeStatus?: 'VERIFIED_ACTUAL' | 'VERIFIED_OPTION' | 'PARTIAL' | 'UNKNOWN';
}

export interface RedevelopmentResearchExample {
  exampleId: string;
  evidenceId: string;
  sourceAreaFamily: string;
  predecessorAppraisedValueKrw?: number | null; // 종전자산평가액 (공식 확인 불가 시 null)
  rightsValueKrw?: number | null; // 권리가액 (공식 확인 불가 시 null)
  targetSuccessorAreaFamily: string;
  memberSalePriceKrw?: number | null; // 조합원분양가 (공식 확인 불가 시 null)
  financialOutcomeType: 'ADDITIONAL_CONTRIBUTION' | 'REFUND';
  amountKrw: number;
  productionEligibility: 'RESEARCH_ONLY';
  exampleType: 'APPLICATION_EXAMPLE';
  notes: string;
  evidenceGrade?: string; // 'REFERENCE (RESEARCH_ONLY)'
}

export interface RedevelopmentTargetsResponse {
  success: boolean;
  lineageId: string;
  predecessorTargets: RedevelopmentTargetInfo[];
  successorTargets: RedevelopmentTargetInfo[];
  researchExamples?: RedevelopmentResearchExample[];
}

// ============================================================================
// 4. Price Availability Contract
// ============================================================================
export interface CompactMonthRange {
  startYmd: string;
  endYmd: string;
  count: number;
}

export interface RedevelopmentPriceAvailabilityResponse {
  success: boolean;
  complexId: string;
  complexName: string;
  areaFamilyId: string;
  areaFamilyLabel: string;
  hasPriceData: boolean;
  firstObservedMonth: string | null;
  lastObservedMonth: string | null;
  observedMonthCount: number;
  observedMonths: string[]; // sorted array of YYYYMM strings
  compactRanges: CompactMonthRange[];
}

// ============================================================================
// 5. Land Share Public Contract
// ============================================================================
export interface LandShareTierPublic {
  tierId: string;
  complexNumber: number;
  pyeongName: string;
  canonicalValueSqm: number;
  canonicalValuePyeong: number;
  sourceId: string;
  evidenceId: string;
  eligibility: string;
}

export interface LandSharePredecessorRatioPublic {
  complexId: string;
  complexName?: string;
  areaFamilyId: string;
  areaFamilyLabel: string;
  exclusiveAreaSqm: number;
  matchedTierId: string;
  landShareSqm: number;
  landShareRatioPercent: number;
}

export interface RedevelopmentLandShareResponse {
  success: boolean;
  lineageId: string;
  metadata: {
    recordCount: number;
    nominalCategoryCount: number;
    uniqueLandShareValueCount: number;
    uniqueAreaFamilyCount: number;
    explanation: string;
  };
  tiers: LandShareTierPublic[];
  predecessorRatios: LandSharePredecessorRatioPublic[];
  warnings: string[];
}

// ============================================================================
// 6. Construction Costs Public Contract
// ============================================================================
export interface ConstructionCostEventPublic {
  eventId: string;
  eventDate: string;
  totalCostKrw: number;
  costPerPyeongKrw?: number;
  status: string;
  publicStatusLabel: string;
  sourceId: string;
  evidenceId: string;
  confidence: string;
  eligibility: string;
  description: string;
}

export interface RedevelopmentConstructionCostsResponse {
  success: boolean;
  lineageId: string;
  currentPhase: string;
  isFinal: boolean;
  rebAuditSummary?: {
    targetAmountKrw: number;
    reducedAmountKrw: number;
    recognizedAmountKrw: number;
    unverifiableAmountKrw: number;
  };
  events: ConstructionCostEventPublic[];
  comparisons: ProjectCostEventComparison[];
  notes: string[];
}

// ============================================================================
// 7. Redevelopment Analysis Request & Response Public Contract
// ============================================================================
export interface RedevelopmentAnalysisApiRequest {
  lineageId: string;
  analysisMode?: AnalysisMode; // default: 'VERIFIED_HISTORICAL'
  predecessorTarget: {
    complexId: string;
    areaFamilyId: string;
  };
  successorTarget: {
    complexId: string;
    areaFamilyId: string;
  };
  predecessorMonth: string; // YYYYMM or YYYY-MM
  successorMonth: string; // YYYYMM or YYYY-MM
  priceMetric?: PriceMetricType; // default: 'MEDIAN_PRICE'
  priceSelectionPolicy?: PriceSelectionPolicy; // default: 'EXACT_MONTH'
  selectionPolicy?: PriceSelectionPolicy; // alias
  evidencePolicy?: EvidenceEligibilityPolicy; // default: 'VERIFIED_ONLY'
}

export interface PriceObservationPublic {
  complexId: string;
  areaFamilyId: string;
  requestedMonth: string;
  actualObservationMonth: string | null;
  selectionPolicy: PriceSelectionPolicy;
  priceMetric: PriceMetricType;
  value: number | null;
  unit: string;
  tradeCount: number;
}

export interface PriceSourceProvenancePublic {
  collection: string;
  documentId: string;
  dealYmd: string;
  tradeCount: number;
}

export interface EvidenceSourceProvenancePublic {
  sourceId: string;
  sourceType: string;
  confidence: string;
  productionEligibility: string;
  title?: string;
}

export interface RedevelopmentAnalysisApiResponse {
  success: boolean;
  request: {
    lineageId: string;
    analysisMode: AnalysisMode;
    predecessorTarget: AnalysisTarget;
    successorTarget: AnalysisTarget;
    predecessorMonth: string;
    successorMonth: string;
    priceMetric: PriceMetricType;
    priceSelectionPolicy: PriceSelectionPolicy;
    evidencePolicy: EvidenceEligibilityPolicy;
  };
  scenario: boolean;
  historicalMappingVerified: boolean;
  analysis: {
    ownerEconomics: {
      nominalValue: OwnerNominalValueAnalysisResult;
      costAdjustedValue: OwnerCostAdjustedValueAnalysisResult;
      xirr: OwnerXirrAnalysisResult;
    };
    projectEconomics: {
      constructionCosts: ProjectCostAnalysisResult | null;
    };
    landShare: TargetLandShareResult | LandShareAnalysisResult | null;
  };
  predecessorObservation: PriceObservationPublic | null;
  successorObservation: PriceObservationPublic | null;
  readiness: {
    overall: AnalysisReadiness;
    nominalValue: AnalysisReadiness;
    costAdjusted: AnalysisReadiness;
    xirr: AnalysisReadiness;
    landShare: AnalysisReadiness;
    constructionCost: AnalysisReadiness;
  };
  provenance: {
    priceSources: PriceSourceProvenancePublic[];
    evidenceSources: EvidenceSourceProvenancePublic[];
  };
  warnings: string[];
  missingRequirements: string[];
  evaluatedAt: string;
}
