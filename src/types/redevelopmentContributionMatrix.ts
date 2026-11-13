/**
 * Types and schema for Reconstruction Contribution / Settlement Matrix
 * 
 * Flow:
 * 종전자산 유형 → 종전자산평가액 → 권리가액 → 신축 신청 주택형 → 조합원분양가 → 추가분담금 / 환급금
 */

export type ContributionProvenanceType =
  | 'OFFICIAL_GAZETTE'       // 지자체 관리처분계획인가 고시 (강동구 고시 등 공적 고시)
  | 'ASSOCIATION_DOCUMENT'   // 조합 총회책자 / 관리처분계획 세부 원본 서류 (진위 검증 완료)
  | 'REFERENCE'              // 언론 보도, 부동산 커뮤니티 재게시 등 참고자료 (RESEARCH_ONLY)
  | 'DATA_NOT_AVAILABLE';    // 공식/검증 원자료 부재

export interface ContributionCellData {
  outcomeType: 'ADDITIONAL_CONTRIBUTION' | 'REFUND' | 'DATA_NOT_AVAILABLE';
  amountKrw: number | null; // 단위: KRW (원), DATA_NOT_AVAILABLE인 경우 null
  provenance: ContributionProvenanceType;
  evidenceId?: string;
  sourceTitle?: string;
  sourceDate?: string;
  notes?: string;
}

export interface ContributionMatrixRow {
  predecessorComplexId: string;
  predecessorComplexName: string;
  predecessorFamilyId: string;
  predecessorAreaFamilyLabel: string;
  exclusiveAreaSqm: number;
  // 각 행에 연결되는 지표 (공식 확인된 경우만 number, 아니면 null / 'DATA_NOT_AVAILABLE')
  predecessorAppraisedValueKrw: number | null | 'DATA_NOT_AVAILABLE'; // 종전자산평가액
  rightsValueKrw: number | null | 'DATA_NOT_AVAILABLE'; // 권리가액
  landShareSqm?: number | null; // 기준 대지지분 (㎡)
  // 신축 주택형 ID -> 셀 데이터
  cells: Record<string, ContributionCellData>;
}

export interface ContributionMatrixColumn {
  successorFamilyId: string;
  successorAreaFamilyLabel: string;
  exclusiveAreaSqm: number;
  memberSalePriceKrw: number | null | 'DATA_NOT_AVAILABLE'; // 조합원분양가
}

export interface ContributionMatrixData {
  lineageId: string;
  planVersion: string; // 예: "2019.12 관리처분계획인가 고시 기준"
  approvalDate?: string;
  columns: ContributionMatrixColumn[];
  rows: ContributionMatrixRow[];
  provenanceSummary: {
    officialGazetteRecords: number;
    associationDocumentRecords: number;
    referenceRecords: number;
    unavailableCells: number;
  };
}

/**
 * 시점별 관리처분 변경 및 공사비 변동 비교용 인터페이스 (향후 확장 구조)
 * 원칙: 공사비 증가액을 조합원 수로 나누어 개별 분담금을 추정하지 않고,
 * 인가된 관리처분계획 변경 버전 간의 공식 분담금표 차이만 비교
 */
export interface PlanVersionComparison {
  lineageId: string;
  versions: {
    versionId: string;
    versionLabel: string;
    approvedYmd: string;
    totalConstructionCostKrw?: number | null;
    proportionalRatePercent?: number | null;
    matrix: ContributionMatrixData;
  }[];
  notes: string;
}
