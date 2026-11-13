/**
 * Phase 8B-1: Dunchon Redevelopment Evidence Collection & Source Audit Types
 * 
 * Rules:
 * 1. Evidence items MUST be traceable to an explicit source in the manifest.
 * 2. Source URLs must be real or null; no fabricated or guessed URLs.
 * 3. Confidence and Tier must follow Phase 8A 5-tier Source Hierarchy.
 * 4. Automatic similarity inference is strictly prohibited.
 */

import { RedevelopmentConfidence, RedevelopmentSourceType } from './redevelopment';

export type EvidenceCategory =
  | 'PROJECT_MILESTONE'
  | 'PREDECESSOR_STRUCTURE'
  | 'SUCCESSOR_STRUCTURE'
  | 'AREA_MAPPING'
  | 'FINANCIAL_CONTRIBUTION'
  | 'CONSTRUCTION_COST'
  | 'LAND_SHARE';

export type AuditStatus =
  | 'AUDITED_FACT'          // Officially confirmed statutory fact
  | 'AUDITED_SAMPLE'        // Documented specific sample (e.g. member book)
  | 'AUDITED_RANGE'         // Multi-source consistent estimate/range
  | 'UNRESOLVED_DISPUTE'    // Conflicting positions (e.g. builder demand vs reb decision)
  | 'UNKNOWN_REJECTED';     // Unverifiable claim or rejected heuristic

export type SourceTier =
  | 'TIER_1_STATUTORY_OFFICIAL'    // 지자체 인가/고시 원문
  | 'TIER_2_PUBLIC_SYSTEM'         // 정보몽땅, 부동산원, 전자공시
  | 'TIER_3_ASSOCIATION_BUILDER'   // 조합 총회 책자, 시공단 공문
  | 'TIER_4_REPUTABLE_MEDIA'       // 제도권 주요 언론사 공식 보도
  | 'TIER_5_SECONDARY_RESEARCH';   // 2차 분석/연구 자료

export interface RedevelopmentSourceManifestItem {
  sourceId: string;
  sourceType: RedevelopmentSourceType;
  sourceTier: SourceTier;
  tierNumber: 1 | 2 | 3 | 4 | 5;
  title: string;
  publisher: string;
  publishDate: string; // YYYY-MM-DD
  url?: string | null;
  documentNumber?: string | null;
  evidenceCategory: EvidenceCategory[];
  notes: string;
}

export interface RedevelopmentEvidenceItem {
  evidenceId: string;
  category: EvidenceCategory;
  subCategory: string;
  claim: string;
  metricName?: string;
  metricValue?: string | number | boolean | Record<string, unknown> | null;
  unit?: string;
  asOfDate?: string; // YYYY-MM-DD
  sourceId: string; // Foreign key into SourceManifest
  sourceTier: SourceTier;
  confidence: RedevelopmentConfidence;
  auditStatus: AuditStatus;
  auditNotes: string;
  // Phase 8E Standardized Provenance Fields
  sourceOrganization?: string | null;
  sourceType?: string | null;
  documentTitle?: string | null;
  systemTitle?: string | null;
  documentNumber?: string | null;
  sourceUrl?: string | null;
  sourceIdentifier?: string | null;
  sourceLocation?: string | null; // e.g. "p.42 표 3-1", "제3조 제2항"
  retrievedDate?: string | null; // YYYY-MM-DD or ISO
  backedValue?: string | number | boolean | Record<string, unknown> | null;
  evidenceClass?: 'OFFICIAL' | 'REFERENCE';
  verificationStatus?: 'VERIFIED' | 'SUPPORTED' | 'PENDING' | 'UNSUPPORTED' | 'CONFLICTING';
  calculationEligibility?: 'ELIGIBLE' | 'INELIGIBLE';
}

export interface RedevelopmentEvidenceCatalog {
  schemaVersion: 1;
  lineageId: string;
  projectId: string;
  catalogVersion: string;
  generatedAt: string;
  sourceHierarchyPolicy: {
    tier1: string;
    tier2: string;
    tier3: string;
    tier4: string;
    tier5: string;
  };
  metricsSummary: {
    totalItems: number;
    byCategory: Record<EvidenceCategory, number>;
    byConfidence: Record<RedevelopmentConfidence, number>;
    byAuditStatus: Record<AuditStatus, number>;
    verifiedSourceCount: number;
  };
  items: RedevelopmentEvidenceItem[];
}

export interface RedevelopmentEvidenceSummary {
  schemaVersion: 1;
  lineageId: string;
  projectId: string;
  projectName: string;
  auditedAt: string;
  milestoneChronology: {
    safetyDiagnosis: string | null;
    promotionCommitteeApproval: string;
    associationEstablishment: string;
    projectApproval: string;
    managementDisposition: string;
    demolitionPeriod: string;
    constructionStart: string;
    constructionSuspension: string;
    constructionResumption: string;
    generalSale: string;
    completionAndMoveIn: string;
    transferNotice: string;
  };
  predecessorComplexesSummary: {
    complexId: string;
    complexName: string;
    builtYear: number;
    floors: string;
    totalUnits: number;
    areaFamilyCount: number;
    representativeExclusiveArea: number;
    landSharePyeongRange: string;
  }[];
  successorComplexSummary: {
    complexId: string;
    complexName: string;
    completionYear: number;
    maxFloors: number;
    totalBuildings: number;
    totalUnits: number;
    rentalUnits: number;
    memberUnits: number;
    generalSaleUnits: number;
    areaFamilyCount: number;
    exclusiveAreaRange: string;
  };
  areaMappingAudit: {
    verifiedPrimaryCount: number;
    partialRangeCount: number;
    unknownCount: number;
    automaticInferredCount: 0; // MUST BE ZERO
    mappingPolicyExplanation: string;
  };
  financialContributionAudit: {
    managementDispositionDate: string;
    statutoryProportionalRatePct: number;
    avgMemberSalePricePerPyeongKrw: number;
    avgGeneralSalePricePerPyeongKrw: number;
    priorAssetValuationRangeKrw: string;
    avgAdditionalContributionRangeKrw: string;
    sampleCases: {
      predecessorDescription: string;
      successorSelectedArea: string;
      approximateContributionOrRefundKrw: number;
      isRefund: boolean;
      source: string;
    }[];
  };
  constructionCostAudit: {
    initialContract2016Krw: number;
    revisedContract2020Krw: number;
    revisedIncrementKrw: number;
    builderDemanded2022Krw: number;
    builderDemandedIncrementKrw: number;
    rebVerificationTargetKrw: number;
    rebVerificationReducedKrw: number;
    rebVerificationAcceptedKrw: number;
    rebUnverifiableItemsKrw: number;
    infrastructureAdditional2024Krw: number;
  };
  landShareAudit: {
    complexId: string;
    pyeongLabel: string;
    exclusiveAreaSqm: number;
    landSharePyeong: number;
    landShareSqm: number;
  }[];
  conclusions: string[];
}

/**
 * Phase 8B-2: Primary-Source Verification Types
 */

export type SourceAccessStatus =
  | 'ACCESSIBLE_PRIMARY'
  | 'ACCESSIBLE_SECONDARY'
  | 'SEARCH_RESULT_ONLY'
  | 'BROKEN_URL'
  | 'LOGIN_REQUIRED'
  | 'CONTENT_NOT_FOUND'
  | 'SOURCE_MISMATCH';

export type EvidenceVerificationStatus =
  | 'VERIFIED_PRIMARY'
  | 'CORROBORATED_PRIMARY'
  | 'SUPPORTED_SECONDARY'
  | 'CONFLICTING'
  | 'SOURCE_DOES_NOT_SUPPORT'
  | 'SOURCE_UNAVAILABLE'
  | 'INSUFFICIENT';

export type ClaimClassification =
  | 'ELIGIBLE'
  | 'APPLICATION_OPTION'
  | 'APPLICATION_EXAMPLE'
  | 'ESTIMATED_SCENARIO'
  | 'ACTUAL_ALLOCATION'
  | 'FINAL_ALLOCATION'
  | 'ANALYTICAL_INFERENCE'
  | 'FACT';

export type PendingRejectionReason =
  | 'INSUFFICIENT_SOURCE'
  | 'SECONDARY_ONLY'
  | 'CONFLICTING'
  | 'UNCONFIRMED_DATE'
  | 'INFERENCE_NOT_FACT'
  | 'REJECTED_HEURISTIC'
  | 'OTHER';

export interface SourceAuditItem {
  sourceId: string;
  publisher: string;
  title: string;
  url: string | null;
  publishedDate: string;
  sourceType: RedevelopmentSourceType;
  sourceTier: SourceTier;
  tierNumber: 1 | 2 | 3 | 4 | 5;
  accessStatus: SourceAccessStatus;
  isIndependentSource: boolean;
  primaryOrSecondary: 'PRIMARY' | 'SECONDARY';
  supportedEvidenceIds: string[];
  auditFindings: string;
  limitations: string;
}

export interface RedevelopmentSourceAuditFile {
  schemaVersion: 1;
  lineageId: string;
  projectId: string;
  auditedAt: string;
  totalSources: number;
  byAccessStatus: Record<SourceAccessStatus, number>;
  byTier: Record<SourceTier, number>;
  primaryCount: number;
  secondaryCount: number;
  items: SourceAuditItem[];
}

export interface EvidenceVerificationItem {
  evidenceId: string;
  category: EvidenceCategory;
  subCategory: string;
  originalClaim: string;
  claimedValue?: string | number | boolean | Record<string, unknown> | null;
  unit?: string;
  asOfDate?: string;
  sourceId: string;
  sourceTier: SourceTier;
  verificationStatus: EvidenceVerificationStatus;
  originalConfidence: RedevelopmentConfidence;
  adjustedConfidence: RedevelopmentConfidence;
  originalAuditStatus: AuditStatus;
  adjustedAuditStatus: AuditStatus;
  claimClassification: ClaimClassification;
  pageSectionCitation: string | null;
  verificationNotes: string;
  isVerifiedCandidate: boolean;
}

export interface RedevelopmentEvidenceVerificationFile {
  schemaVersion: 1;
  lineageId: string;
  projectId: string;
  auditedAt: string;
  totalItems: number;
  byVerificationStatus: Record<EvidenceVerificationStatus, number>;
  byAdjustedConfidence: Record<RedevelopmentConfidence, number>;
  byClaimClassification: Record<ClaimClassification, number>;
  verifiedCandidateCount: number;
  pendingCount: number;
  items: EvidenceVerificationItem[];
}

export interface VerifiedCandidateItem {
  candidateId: string;
  evidenceId: string;
  category: EvidenceCategory;
  subCategory: string;
  verifiedClaim: string;
  verifiedValue: string | number | boolean | Record<string, unknown> | null;
  unit?: string;
  asOfDate?: string;
  sourceId: string;
  sourceTier: SourceTier;
  verificationStatus: EvidenceVerificationStatus;
  confidence: RedevelopmentConfidence;
  claimClassification: ClaimClassification;
  usableInAnalysis: boolean;
  analysisUsageNotes: string;
}

export interface RedevelopmentVerifiedCandidatesFile {
  schemaVersion: 1;
  lineageId: string;
  projectId: string;
  generatedAt: string;
  candidateCount: number;
  byCategory: Record<EvidenceCategory, number>;
  candidates: VerifiedCandidateItem[];
}

export interface EvidencePendingItem {
  pendingId: string;
  evidenceId: string;
  category: EvidenceCategory;
  subCategory: string;
  originalClaim: string;
  claimedValue?: string | number | boolean | Record<string, unknown> | null;
  unit?: string;
  sourceId: string;
  sourceTier: SourceTier;
  rejectionReason: PendingRejectionReason;
  missingRequirement: string;
  potentialResolution: string;
}

export interface RedevelopmentSourceManifest {
  schemaVersion: 1;
  lineageId: string;
  projectId: string;
  manifestVersion: string;
  updatedAt: string;
  totalSources: number;
  byTier: Record<SourceTier, number>;
  sources: RedevelopmentSourceManifestItem[];
}

export type DunchonEvidenceCatalog = RedevelopmentEvidenceCatalog;
export type DunchonSourceAuditDataset = RedevelopmentSourceAuditFile;
export type DunchonEvidenceVerificationDataset = RedevelopmentEvidenceVerificationFile;
export type DunchonVerifiedCandidatesDataset = RedevelopmentVerifiedCandidatesFile;
export type DunchonEvidencePendingDataset = any;


