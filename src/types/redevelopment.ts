/**
 * Phase 8A: Redevelopment Data Model & Lineage Foundation
 * 
 * CRITICAL ARCHITECTURAL PRINCIPLES:
 * 1. PREDECESSOR and SUCCESSOR are NOT a continuous price time series.
 *    No merged series, no synthetic price points, no cross-boundary CAGR/MDD/ATH/Base100.
 * 2. RedevelopmentLineage represents a RELATIONSHIP, not a price series.
 * 3. Separation of Contribution (개인 분담금) vs Construction Cost (사업 공사비).
 * 4. Strict source hierarchy and confidence modeling.
 * 5. Area mapping supports 1:N and UNKNOWN; NO automatic similarity inference.
 */

// =========================================================================
// 1. Source Hierarchy & Confidence
// =========================================================================

/**
 * 정비사업 출처 2대 분류 (Phase 8D-1B)
 * - OFFICIAL: 공적 장부, 인가대장, 지자체 관보/고시, 서울시 정보몽땅, RTMS, 청약홈 등 공식 사실 데이터
 * - REFERENCE: 언론 보도, 인터뷰, 총회 예시, 커뮤니티, 비공식 추정치 (참고 정보로만 표시, 계산 사용 불가)
 */
export type RedevelopmentEvidenceClass = 'OFFICIAL' | 'REFERENCE';

/**
 * 정비사업 사실 검증 상태 (Phase 8D-1B)
 * - VERIFIED: 1차 공식 원문 또는 공적 시스템에서 실제 내용이 확인됨
 * - SUPPORTED: 2차 공적 기록 또는 다수 자료에서 일치 확인됨
 * - PENDING: 공식 확인 대기 또는 원문 직접 대조 미완료
 * - UNSUPPORTED: 근거가 확인되지 않거나 기각됨
 * - CONFLICTING: 복수 출처 간 내용이 상충됨
 */
export type RedevelopmentVerificationStatus =
  | 'VERIFIED'
  | 'SUPPORTED'
  | 'PENDING'
  | 'UNSUPPORTED'
  | 'CONFLICTING';

/**
 * 프로덕션 계산 활용 자격 (Phase 8D-1B)
 * - ELIGIBLE: OFFICIAL + VERIFIED 조건을 충족하여 공식 계산에 사용 가능
 * - INELIGIBLE: REFERENCE이거나 미검증 상태로 계산 사용 불가
 */
export type RedevelopmentCalculationEligibility = 'ELIGIBLE' | 'INELIGIBLE';

/**
 * 정비사업 출처 분류 체계 (우선순위 계층)
 * 1. OFFICIAL_DOCUMENT: 조합/정비사업/정부/지자체 공식 문서
 * 2. STATUTORY_PLAN: 사업시행계획, 관리처분계획, 법정 인가/고시
 * 3. BUILDER_OFFICIAL: 시공사/상장사 공식 공시 및 IR 자료
 * 4. REPUTABLE_MEDIA: 신뢰할 수 있는 언론의 공식문서 인용 보도
 * 5. SECONDARY_RESEARCH: 기타 2차 자료 및 연구 보고서
 */
export type RedevelopmentSourceType =
  | 'OFFICIAL_DOCUMENT'
  | 'STATUTORY_PLAN'
  | 'BUILDER_OFFICIAL'
  | 'REPUTABLE_MEDIA'
  | 'SECONDARY_RESEARCH';

/**
 * 정비사업 데이터 신뢰도
 * - VERIFIED: 공식문서 원본으로 직접 확인된 수치
 * - HIGH: 법정 고시 또는 언론의 공식문서 직접 인용
 * - MEDIUM: 다수 2차 자료가 일치하는 수치
 * - LOW: 단순 추정치 (프로덕션 팩트로 사용 불가)
 * - UNKNOWN: 확인 불가 (기본값)
 */
export type RedevelopmentConfidence =
  | 'VERIFIED'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'UNKNOWN';

export interface RedevelopmentSourceMetadata {
  sourceType: RedevelopmentSourceType;
  sourceName: string;
  sourceOrganization?: string | null;
  documentTitle?: string | null;
  systemTitle?: string | null;
  documentNumber?: string | null;
  sourceUrl?: string | null;
  sourceIdentifier?: string | null;
  sourceDocumentTitle?: string | null;
  sourceLocation?: string | null;
  publisher?: string | null;
  asOfDate?: string | null; // YYYY-MM-DD
  retrievedDate?: string | null; // YYYY-MM-DD
  retrievedAt?: string | null; // ISO Timestamp
  backedValue?: string | number | boolean | Record<string, unknown> | null;
  confidence: RedevelopmentConfidence;
  evidenceClass?: RedevelopmentEvidenceClass;
  verificationStatus?: RedevelopmentVerificationStatus;
  calculationEligibility?: RedevelopmentCalculationEligibility;
  notes?: string | null;
}

/**
 * 표준화된 공식 출처 Provenance (Phase 8E)
 */
export interface RedevelopmentSourceProvenance {
  sourceOrganization?: string | null;
  sourceType: RedevelopmentSourceType;
  documentTitle?: string | null;
  systemTitle?: string | null;
  documentNumber?: string | null;
  sourceUrl?: string | null;
  sourceIdentifier?: string | null;
  sourceLocation?: string | null;
  asOfDate?: string | null;
  retrievedDate?: string | null;
  backedValue?: string | number | boolean | Record<string, unknown> | null;
  evidenceClass: RedevelopmentEvidenceClass;
  verificationStatus: RedevelopmentVerificationStatus;
  calculationEligibility: RedevelopmentCalculationEligibility;
  notes?: string | null;
}

// =========================================================================
// 2. Lineage & Project
// =========================================================================

export type RedevelopmentProjectType =
  | 'RECONSTRUCTION' // 주택재건축 (도시 및 주거환경정비법)
  | 'REDEVELOPMENT'  // 주택재개발 (도시 및 주거환경정비법)
  | 'URBAN_PUBLIC_HOUSING_COMPLEX'; // 도심 공공주택 복합사업 (공공주택 특별법)

export type RedevelopmentMilestoneCategory =
  | 'PROJECT_MILESTONE'   // 프로젝트 자체의 법정 인허가/추진 마일스톤
  | 'BACKGROUND_HISTORY'; // 종전 구역 해제, 추진 경과 등 사전 역사/배경

export type RedevelopmentProjectStatus =
  | 'PLANNING'
  | 'IN_PROGRESS'
  | 'COMPLETED';

export interface RedevelopmentMilestoneDates {
  safetyDiagnosisDate?: string | null;              // 안전진단 통과 (재건축)
  promotionCommitteeApprovalDate?: string | null;   // 추진위원회 승인 (2003-10-27)
  districtDesignationDate?: string | null;          // 정비구역/복합지구 지정 (2006-11-02 / 2021-12-31)
  associationEstablishmentDate?: string | null;     // 조합설립인가 (2009-12-28, 도심복합은 미해당)
  projectApprovalDate?: string | null;              // 사업시행인가 (2015-07-30) / 복합사업계획승인 의제 (2024-12-30)
  projectNoticeDate?: string | null;                // 사업시행인가 고시일 (2015-08-05) / 복합사업계획승인 고시일 (2024-12-30)
  projectNoticeNumber?: string | null;              // 인가/승인 고시 번호
  complexPlanApprovalDate?: string | null;          // 복합사업계획승인 (도심 공공주택 복합사업 전용)
  managementDispositionDate?: string | null;        // 관리처분계획인가 (2017-05-02, 도심복합은 별도 보상체계)
  managementDispositionNoticeDate?: string | null;  // 관리처분계획인가 고시일 (2017-05-04)
  managementDispositionNoticeNumber?: string | null;// 관리처분계획인가 고시 번호
  demolitionStartDate?: string | null;              // 철거 착수 (2019-12-01)
  constructionStartDate?: string | null;            // 착공 신고 (2019-12-03)
  generalSaleDate?: string | null;                  // 일반/공공분양
  completionDate?: string | null;                   // 준공
  moveInDate?: string | null;                       // 입주
}

/**
 * RedevelopmentLineage
 * 구 단지군(Predecessors)과 신축 단지군(Successors)의 정비사업 승계 관계 표현
 */
export interface RedevelopmentLineage {
  schemaVersion?: number; // 1
  lineageId?: string;
  id?: string; // Compatibility alias for lineageId
  lineageName?: string;
  name?: string; // Compatibility alias for lineageName
  projectType?: RedevelopmentProjectType;
  redevelopmentTypeLabel?: string;
  predecessorComplexIds: string[];
  successorComplexIds: string[];
  projectId?: string | null;
  description?: string | null;
  sourceMetadata?: RedevelopmentSourceMetadata[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * RedevelopmentProject
 * 정비사업 법정 인허가 마일스톤, 규모 및 공사비 등 사업 정보
 */
export interface RedevelopmentProject {
  schemaVersion?: number; // 1
  projectId?: string;
  id?: string; // Compatibility alias for projectId
  lineageId: string;
  projectName: string;
  projectType?: RedevelopmentProjectType;
  redevelopmentTypeLabel?: string;
  status?: RedevelopmentProjectStatus;
  predecessorComplexIds?: string[];
  successorComplexIds?: string[];
  milestoneDates?: RedevelopmentMilestoneDates;

  // Flattened milestone dates for backward compatibility
  promotionCommitteeApprovalDate?: string | null;
  districtDesignationDate?: string | null;
  associationApprovalDate?: string | null;
  projectApprovalDate?: string | null;
  projectNoticeDate?: string | null;
  projectNoticeNumber?: string | null;
  managementDispositionApprovalDate?: string | null;
  managementDispositionNoticeDate?: string | null;
  managementDispositionNoticeNumber?: string | null;
  demolitionDate?: string | null;
  constructionStartDate?: string | null;
  generalSaleDate?: string | null;
  completionDate?: string | null;

  beforeUnits?: number | null;
  afterUnits?: number | null;

  units?: {
    before?: number | null;
    after?: number | null;
  };
  floorAreaRatio?: {
    beforePct?: number | null;
    afterPct?: number | null;
  };
  floorAreaRatioBefore?: number | null;
  floorAreaRatioAfter?: number | null;
  totalProjectCost?: number | null;
  totalConstructionCost?: number | null;
  constructionCostPerPyeong?: number | null;
  generalSalePriceAvg?: number | null;
  memberSalePriceAvg?: number | null;

  sourceMetadata?: RedevelopmentSourceMetadata[];
  sourceReferences?: any[];
  confidence?: RedevelopmentConfidence;
  createdAt?: string;
  updatedAt?: string;
}

// =========================================================================
// 3. Area Mapping
// =========================================================================

export type RedevelopmentMappingStatus =
  | 'VERIFIED'  // 공식 관리처분/조합원 분양 결과로 검증됨
  | 'PARTIAL'   // 일부 사례 또는 선택지 검증됨
  | 'UNKNOWN';  // 미확인 (정상 상태, 임의 추론 금지)

export type RedevelopmentMappingType =
  | 'DIRECT'                 // 1:1 고정 배정
  | 'OPTIONAL'               // 조합원 선택 가능 평형
  | 'MULTIPLE_POSSIBILITIES' // 1:N 배정 가능성 존재
  | 'OFFICIAL'               // 공식 배정 (compatibility)
  | 'VERIFIED_CASE'          // 검증 사례 (compatibility)
  | 'USER_DEFINED'           // 사용자 정의 (compatibility)
  | 'UNKNOWN';               // 미확인

/**
 * RedevelopmentAreaMapping
 * 구 평형군(Predecessor AreaFamily)과 신축 평형군(Successor AreaFamily)의 배정 관계
 */
export interface RedevelopmentAreaMapping {
  schemaVersion?: number; // 1
  mappingId?: string;
  id?: string; // Compatibility alias for mappingId
  lineageId: string;
  predecessorComplexId: string;
  predecessorAreaFamilyId: string;
  successorComplexId: string;
  successorAreaFamilyId: string;
  mappingStatus?: RedevelopmentMappingStatus;
  mappingType: RedevelopmentMappingType;
  confidence?: RedevelopmentConfidence;
  sourceMetadata?: RedevelopmentSourceMetadata[];
  sourceReferences?: any[];
  notes?: string | null;
}

// =========================================================================
// 4. Contribution (조합원 추가분담금 - 개인 관점 현금흐름)
// =========================================================================

export type RedevelopmentCostStatus =
  | 'ESTIMATED'               // 초기 조합설립/사업시행 단계 추정치
  | 'MANAGEMENT_DISPOSITION' // 관리처분계획인가 총회 의결치
  | 'REVISED'                 // 공사비 증액 등 변경 관리처분치
  | 'FINAL';                  // 준공 후 청산/최종 정산치

export interface RedevelopmentPaymentStage {
  stageName: string; // 계약금, 중도금1차, 잔금 등
  ratioPct?: number | null;
  scheduledDate?: string | null; // YYYY-MM-DD
  actualDate?: string | null;    // YYYY-MM-DD (XIRR 계산 필수)
  amount?: number | null;        // 만원
}

/**
 * RedevelopmentCostHistory
 * 조합원 개인 관점의 추가분담금 및 종전자산 권리가액 이력 (버전 관리)
 */
export interface RedevelopmentCostHistory {
  schemaVersion: number; // 1
  costHistoryId: string;
  id?: string; // Compatibility alias for costHistoryId
  lineageId: string;
  projectId?: string | null;
  predecessorComplexId: string;
  predecessorAreaFamilyId: string;
  successorComplexId: string;
  successorAreaFamilyId: string;

  // 금융/자산 가치 (단위: 만원)
  previousAssetValue?: number | null; // 종전자산 감정평가액
  proportionalRatePct?: number | null; // 비례율 (%)
  rightValue?: number | null;          // 권리가액
  memberSalePrice?: number | null;     // 조합원 분양가
  additionalContribution?: number | null; // 추가분담금 (+: 납부, -: 환급)

  status: RedevelopmentCostStatus;
  announcedDate?: string | null; // 발표/의결일 (YYYY-MM-DD)
  effectiveDate?: string | null; // 적용 기준일 (YYYY-MM-DD)

  // 현금흐름 시점 (XIRR 안전성 보장용)
  paymentSchedule?: RedevelopmentPaymentStage[];

  sourceMetadata?: RedevelopmentSourceMetadata[];
  notes?: string | null;
}

// =========================================================================
// 5. Construction Cost (정비사업 공사비 - 사업 관점 건설비용)
// =========================================================================

export type RedevelopmentCostBasis =
  | 'TOTAL_PROJECT' // 총공사비
  | 'PER_PYEONG'    // 평당공사비
  | 'PER_SQM';      // ㎡당공사비

export type ConstructionCostStatus =
  | 'ESTIMATED'
  | 'CONTRACT'
  | 'DISPUTE_VERIFICATION'
  | 'SETTLEMENT'
  | 'FINAL';

/**
 * RedevelopmentConstructionCostHistory
 * 정비사업 전체의 공사비 변동 이력 (개인 분담금과 엄격히 분리)
 */
export interface RedevelopmentConstructionCostHistory {
  schemaVersion: number; // 1
  constructionCostHistoryId: string;
  id?: string; // Compatibility alias for constructionCostHistoryId
  projectId: string;
  amount: number; // 수치
  unit: 'KRW_MANWON' | 'KRW_EOK' | 'KRW_WON';
  costBasis: RedevelopmentCostBasis;
  status: ConstructionCostStatus;
  effectiveDate?: string | null; // YYYY-MM-DD
  contractor?: string | null;    // 시공사명
  increaseAmount?: number | null;
  increaseRatePct?: number | null;
  sourceMetadata?: RedevelopmentSourceMetadata[];
  notes?: string | null;
}

// Backward-compatibility aliases
export type RedevelopmentCostRecord = RedevelopmentCostHistory;
export type ConstructionCostHistory = RedevelopmentConstructionCostHistory;

// =========================================================================
// 6. Land Share (대지지분 모델)
// =========================================================================

/**
 * RedevelopmentLandShare
 * 대지지분 모델 (㎡를 canonical unit으로 두고 평형은 계산값으로 파생)
 */
export interface RedevelopmentLandShare {
  schemaVersion: number; // 1
  predecessorComplexId: string;
  predecessorAreaFamilyId: string;
  landShareSqm: number; // Canonical Unit (㎡)
  landSharePyeong?: number; // Presentation Unit (landShareSqm / 3.305785)
  sourceMetadata?: RedevelopmentSourceMetadata[];
  notes?: string | null;
}

// =========================================================================
// 7. Future Investment Analysis Model Readiness
// =========================================================================

/**
 * 미래 분석 A: Nominal Asset Value Multiple
 * successor market value / predecessor reference market value
 */
export interface NominalAssetValueAnalysisInput {
  lineageId: string;
  predecessorComplexId: string;
  predecessorAreaFamilyId: string;
  predecessorReferenceYmd: string;
  predecessorReferencePrice: number; // 만원

  successorComplexId: string;
  successorAreaFamilyId: string;
  successorReferenceYmd: string;
  successorReferencePrice: number; // 만원
}

export interface NominalAssetValueAnalysisResult {
  nominalMultiple: number; // e.g. 2.5 (25억 / 10억)
  nominalChangePct: number; // e.g. +150%
  predecessorReferencePrice: number;
  successorReferencePrice: number;
  durationMonths: number;
  disclaimer: string; // "단순 자산 명목가치 변화이며, 추가분담금 및 현금유출을 감안한 실제 투자수익률이 아닙니다."
}

/**
 * 미래 분석 B: Cost Adjusted Value Multiple
 * successor market value / (predecessor basis + owner additional cash outflows)
 */
export interface CostAdjustedValueAnalysisInput {
  predecessorBasisPrice: number; // 취득가/기준가 (만원)
  totalOwnerCashOutflows: number; // 추가분담금 등 총 납입액 (만원)
  totalOwnerCashInflows: number;  // 환급금 등 유입액 (만원)
  successorMarketValue: number;   // 신축 시장가치 (만원)
}

export interface CostAdjustedValueAnalysisResult {
  totalNetInvested: number; // predecessorBasisPrice + totalOwnerCashOutflows - totalOwnerCashInflows
  successorMarketValue: number;
  costAdjustedMultiple: number;
  costAdjustedReturnPct: number;
}

/**
 * 미래 분석 C: Cash Flow XIRR
 * 실제 납부일자가 존재하는 현금흐름만으로 계산
 */
export interface CashFlowItem {
  date: string; // YYYY-MM-DD (반드시 유효한 일자)
  amount: number; // 음수: 유출(매수, 분담금 납부), 양수: 유입(환급, 최종 자산가치)
  description: string;
}

export interface CashFlowXirrAnalysisInput {
  cashFlows: CashFlowItem[];
}

export interface CashFlowXirrAnalysisResult {
  isXirrCalculable: boolean;
  xirrAnnualPct: number | null; // % 연환산 수익률
  reasonIfNotCalculable?: string; // e.g. "실제 현금흐름 납부일자 부재로 XIRR 계산 불가"
}

/**
 * 미래 분석 D: Benchmark Excess Value
 * 재건축 보유 vs 동일 기간 벤치마크 (인과적 초과수익 주장 금지)
 */
export interface BenchmarkExcessAnalysisInput {
  lineageId: string;
  assetReturnPct: number;
  benchmarkId: string;
  benchmarkReturnPct: number;
  periodStartYmd: string;
  periodEndYmd: string;
}

export interface BenchmarkExcessAnalysisResult {
  assetReturnPct: number;
  benchmarkReturnPct: number;
  excessReturnPct: number; // assetReturnPct - benchmarkReturnPct
  disclaimer: string; // "단순 동일 기간 시장 벤치마크 대비 수치 차이이며, 재건축 사업만의 인과적 초과수익을 의미하지 않습니다."
}
