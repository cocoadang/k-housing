/**
 * Phase 8B-3: Redevelopment Normalized Seed Types
 * Strictly enforces semantic isolation, unit conversion, and calculation readiness.
 */

export type ProductionEligibility =
  | 'VERIFIED'
  | 'SUPPORTED'
  | 'RESEARCH_ONLY'
  | 'PENDING'
  | 'NOT_APPLICABLE';

export type MappingCoverageStatus =
  | 'VERIFIED_ACTUAL'
  | 'VERIFIED_OPTION'
  | 'PARTIAL'
  | 'UNKNOWN';

export type FinancialSemanticType =
  | 'PREDECESSOR_APPRAISAL_VALUE'
  | 'RIGHTS_VALUE'
  | 'MEMBER_SALE_PRICE'
  | 'ADDITIONAL_CONTRIBUTION'
  | 'ADDITIONAL_CHARGE'
  | 'REFUND';

export type ConstructionCostStatus =
  | 'SIGNED_CONTRACT'
  | 'REQUESTED'
  | 'PROPOSED'
  | 'VERIFIED'
  | 'AGREED'
  | 'FINAL';

export type CalculationReadinessStatus =
  | 'READY'
  | 'PARTIAL'
  | 'NOT_READY';

// 1. Project Seed
export interface NormalizedProjectMilestone {
  milestoneId: string;
  evidenceId: string;
  name: string;
  date: string;
  category?: 'PROJECT_MILESTONE' | 'BACKGROUND_HISTORY';
  approvalDate?: string | null;
  noticeDate?: string | null;
  noticeNumber?: string | null;
  filingDate?: string | null;
  occurrenceDate?: string | null;
  sourceId: string;
  sourceTier: string;
  evidenceClass?: 'OFFICIAL' | 'REFERENCE';
  verificationStatus?: 'VERIFIED' | 'SUPPORTED' | 'PENDING' | 'UNSUPPORTED' | 'CONFLICTING';
  calculationEligibility?: 'ELIGIBLE' | 'INELIGIBLE';
  eligibility: ProductionEligibility;
  isConfirmed: boolean;
  notes: string;
}

export interface NormalizedProjectSeed {
  schemaVersion: 1;
  lineageId: string;
  projectId: string;
  name: string;
  currentStatus: string;
  projectType?: 'RECONSTRUCTION' | 'REDEVELOPMENT' | 'URBAN_PUBLIC_HOUSING_COMPLEX';
  redevelopmentTypeLabel?: string;
  predecessor: {
    totalUnits: number;
    complexes: {
      complexNumber: 1 | 2 | 3 | 4;
      name: string;
      builtYear: number;
      floors: number;
      units: number;
      areaFamilyCount: number;
      areaFamilies: string[];
    }[];
  };
  successor: {
    name: string;
    totalUnits: number;
    buildingCount: number;
    maxFloors: number;
    unitsBreakdown: {
      rental: number;
      memberSaleEstimated: number;
      generalSale: number;
      reserve: number;
    };
    areaFamilies: string[];
  };
  milestones: NormalizedProjectMilestone[];
  generatedAt: string;
}

// 2. Mapping Seed
export interface PredecessorAreaFamilyCoverage {
  familyId: string;
  complexNumber: 1 | 2 | 3 | 4;
  pyeongName: string;
  exclusiveAreaSqm: number;
  coverageStatus: MappingCoverageStatus;
  actualAllocationCount: number;
  hasApplicationExample: boolean;
  applicationExampleEvidenceIds: string[];
  notes: string;
}

export interface NormalizedMappingSeed {
  schemaVersion: 1;
  lineageId: string;
  projectId: string;
  summary: {
    predecessorFamilies: number;
    verifiedActual: number;
    verifiedOption: number;
    partial: number;
    unknown: number;
    applicationExamples: number;
    automatic: number;
  };
  mappingPolicy?: {
    evidenceId: string;
    policyType: string;
    rule: string;
    automaticInferredMappingAllowed: boolean;
    automaticMappingCount: number;
  };
  actualMappings?: any[];
  coverageRecords: PredecessorAreaFamilyCoverage[];
  applicationExamples: {
    exampleId: string;
    evidenceId: string;
    sourceAreaFamily: string;
    targetSuccessorAreaFamily: string;
    financialOutcomeType: 'ADDITIONAL_CONTRIBUTION' | 'REFUND';
    amountKrw: number;
    eligibility: 'RESEARCH_ONLY';
    notes: string;
  }[];
  generatedAt: string;
}

// 3. Financial Seed
export interface NormalizedFinancialMetric {
  metricKey: string;
  semanticType: FinancialSemanticType;
  value: number | { min: number; max: number } | null;
  unit: string;
  asOfDate: string;
  eligibility: ProductionEligibility;
  sourceId: string;
  isRosterAvailable: boolean;
  notes: string;
}

export interface NormalizedFinancialSeed {
  schemaVersion: 1;
  lineageId: string;
  projectId: string;
  proportionalRate: {
    evidenceId: string;
    valuePct: number;
    unit: string;
    asOfDate: string;
    eligibility: ProductionEligibility;
    evidenceClass?: 'OFFICIAL' | 'REFERENCE';
    verificationStatus?: 'VERIFIED' | 'SUPPORTED' | 'PENDING' | 'UNSUPPORTED';
    calculationEligibility?: 'ELIGIBLE' | 'INELIGIBLE';
    sourceId: string;
    notes: string;
  };
  generalSalePrice: {
    evidenceId: string;
    pricePerPyeong: number;
    unit: string;
    asOfDate: string;
    eligibility: ProductionEligibility;
    sourceId: string;
    notes: string;
  };
  memberSalePrice: {
    evidenceId: string;
    averagePricePerPyeong: number;
    unit: string;
    asOfDate: string;
    eligibility: ProductionEligibility;
    sourceId: string;
    notes: string;
  };
  metricsBySemanticType: Record<FinancialSemanticType, any>;
  applicationExampleProhibition: {
    rule: string;
    enforced: boolean;
  };
  generatedAt: string;
}

// 4. Construction Cost Seed
export interface NormalizedCostEvent {
  eventId: string;
  evidenceId: string;
  date: string;
  eventName: string;
  amountKrw: number;
  status: ConstructionCostStatus;
  eligibility: ProductionEligibility;
  sourceId: string;
  parties: string[];
  notes: string;
}

export interface NormalizedConstructionCostSeed {
  schemaVersion: 1;
  lineageId: string;
  projectId: string;
  costEvents: NormalizedCostEvent[];
  rebAuditBreakdown: {
    targetAmountKrw: number;
    reducedAmountKrw: number;
    recognizedAmountKrw: number;
    unverifiableAmountKrw: number;
    notes: string;
  };
  currentCostPhase: string;
  isFinal: boolean;
  finalTotalCostKrw: number | null;
  generatedAt: string;
}

// 5. Land Share Seed
export interface NormalizedLandShareTier {
  tierId: string;
  evidenceId?: string;
  complexNumber: 1 | 2 | 3 | 4;
  complexType?: 'LOW_RISE' | 'HIGH_RISE' | string;
  pyeongName: string;
  subType?: string;
  sourceOriginalValue: number;
  sourceOriginalUnit: 'PYEONG';
  canonicalValueSqm: number;
  isDerived: boolean;
  derivationMethod: 'PYEONG_TO_SQM_400_DIV_121';
  eligibility: ProductionEligibility;
  sourceId: string;
}

export interface NormalizedLandShareSeed {
  schemaVersion: 1;
  lineageId: string;
  projectId: string;
  canonicalUnit: 'SQM';
  totalDistinctTiers: number;
  evidenceId?: string;
  sourceId?: string;
  eligibility?: ProductionEligibility;
  tiers: NormalizedLandShareTier[];
  inferenceProhibition: {
    rule: string;
    enforced: boolean;
  };
  generatedAt: string;
}

// 6. Analysis Seed
export interface NormalizedAnalysisSeed {
  schemaVersion: 1;
  lineageId: string;
  projectId: string;
  readinessSummary: {
    nominalAssetValue: CalculationReadinessStatus;
    costAdjustedValue: CalculationReadinessStatus;
    xirr: CalculationReadinessStatus;
    landShare: CalculationReadinessStatus;
    constructionCostTimeline: CalculationReadinessStatus;
  };
  readinessDetails: {
    module: string;
    status: CalculationReadinessStatus;
    blockers: string[];
    availableData: string[];
  }[];
  productionEligibilityDistribution: {
    VERIFIED: number;
    SUPPORTED: number;
    RESEARCH_ONLY: number;
    PENDING: number;
    total: number;
  };
  generatedAt: string;
}
