import type {
  ContributionMatrixData,
  ContributionMatrixColumn,
  ContributionMatrixRow,
  ContributionCellData,
  PlanVersionComparison,
} from '../types/redevelopmentContributionMatrix';

/**
 * 올림픽파크포레온(둔촌주공) 신축 신청 가능 주택형 열 정의
 * 각 신축형에는 조합원분양가 슬롯이 연결되며, 공식 검증 원본 미확보 시 DATA_NOT_AVAILABLE
 */
export const DUNCHON_SUCCESSOR_COLUMNS: ContributionMatrixColumn[] = [
  {
    successorFamilyId: 'foreon_29',
    successorAreaFamilyLabel: '신축 전용 29㎡',
    exclusiveAreaSqm: 29.53,
    memberSalePriceKrw: 'DATA_NOT_AVAILABLE',
  },
  {
    successorFamilyId: 'foreon_39',
    successorAreaFamilyLabel: '신축 전용 39㎡',
    exclusiveAreaSqm: 39.88,
    memberSalePriceKrw: 'DATA_NOT_AVAILABLE',
  },
  {
    successorFamilyId: 'foreon_49',
    successorAreaFamilyLabel: '신축 전용 49㎡',
    exclusiveAreaSqm: 49.92,
    memberSalePriceKrw: 'DATA_NOT_AVAILABLE',
  },
  {
    successorFamilyId: 'foreon_59',
    successorAreaFamilyLabel: '신축 전용 59㎡',
    exclusiveAreaSqm: 59.99,
    memberSalePriceKrw: 'DATA_NOT_AVAILABLE',
  },
  {
    successorFamilyId: 'foreon_84',
    successorAreaFamilyLabel: '신축 전용 84㎡',
    exclusiveAreaSqm: 84.95,
    memberSalePriceKrw: 'DATA_NOT_AVAILABLE',
  },
  {
    successorFamilyId: 'foreon_95',
    successorAreaFamilyLabel: '신축 전용 95㎡',
    exclusiveAreaSqm: 95.89,
    memberSalePriceKrw: 'DATA_NOT_AVAILABLE',
  },
  {
    successorFamilyId: 'foreon_109',
    successorAreaFamilyLabel: '신축 전용 109㎡',
    exclusiveAreaSqm: 109.85,
    memberSalePriceKrw: 'DATA_NOT_AVAILABLE',
  },
  {
    successorFamilyId: 'foreon_134',
    successorAreaFamilyLabel: '신축 전용 134㎡',
    exclusiveAreaSqm: 134.42,
    memberSalePriceKrw: 'DATA_NOT_AVAILABLE',
  },
];

/**
 * 기본 빈 셀 생성 (원자료 부재 시 절대 계산하여 채우지 않고 DATA_NOT_AVAILABLE 유지)
 */
function createEmptyCell(notes: string = '공식 세부 분담금 자료 미확보 (임의 계산 금지)'): ContributionCellData {
  return {
    outcomeType: 'DATA_NOT_AVAILABLE',
    amountKrw: null,
    provenance: 'DATA_NOT_AVAILABLE',
    notes,
  };
}

/**
 * 둔촌주공 종전자산 유형 행 정의 및 매트릭스 셀 데이터
 */
export function buildDunchonContributionMatrix(): ContributionMatrixData {
  const columns = DUNCHON_SUCCESSOR_COLUMNS;

  // 16개 종전자산 주택형 행 정의 (단지별 전용면적 및 법정 대지지분)
  const rawRows: Omit<ContributionMatrixRow, 'cells'>[] = [
    // 1단지
    {
      predecessorComplexId: 'dunchon_jugong_1',
      predecessorComplexName: '둔촌주공 1단지',
      predecessorFamilyId: 'dunchon_1_25',
      predecessorAreaFamilyLabel: '25㎡형 (구 7.5평형)',
      exclusiveAreaSqm: 25.52,
      predecessorAppraisedValueKrw: 'DATA_NOT_AVAILABLE',
      rightsValueKrw: 'DATA_NOT_AVAILABLE',
      landShareSqm: 29.83,
    },
    {
      predecessorComplexId: 'dunchon_jugong_1',
      predecessorComplexName: '둔촌주공 1단지',
      predecessorFamilyId: 'dunchon_1_51',
      predecessorAreaFamilyLabel: '51㎡형 (구 16평형)',
      exclusiveAreaSqm: 50.84,
      predecessorAppraisedValueKrw: 'DATA_NOT_AVAILABLE',
      rightsValueKrw: 'DATA_NOT_AVAILABLE',
      landShareSqm: 59.83,
    },
    {
      predecessorComplexId: 'dunchon_jugong_1',
      predecessorComplexName: '둔촌주공 1단지',
      predecessorFamilyId: 'dunchon_1_58',
      predecessorAreaFamilyLabel: '58㎡형 (구 18평형)',
      exclusiveAreaSqm: 58.21,
      predecessorAppraisedValueKrw: 'DATA_NOT_AVAILABLE',
      rightsValueKrw: 'DATA_NOT_AVAILABLE',
      landShareSqm: 65.57,
    },
    {
      predecessorComplexId: 'dunchon_jugong_1',
      predecessorComplexName: '둔촌주공 1단지',
      predecessorFamilyId: 'dunchon_1_80',
      predecessorAreaFamilyLabel: '80㎡형 (구 25평형)',
      exclusiveAreaSqm: 80.03,
      predecessorAppraisedValueKrw: 'DATA_NOT_AVAILABLE',
      rightsValueKrw: 'DATA_NOT_AVAILABLE',
      landShareSqm: 89.26,
    },
    {
      predecessorComplexId: 'dunchon_jugong_1',
      predecessorComplexName: '둔촌주공 1단지',
      predecessorFamilyId: 'dunchon_1_88',
      predecessorAreaFamilyLabel: '88㎡형 (구 27평형)',
      exclusiveAreaSqm: 88.43,
      predecessorAppraisedValueKrw: 'DATA_NOT_AVAILABLE',
      rightsValueKrw: 'DATA_NOT_AVAILABLE',
      landShareSqm: 98.42,
    },

    // 2단지
    {
      predecessorComplexId: 'dunchon_jugong_2',
      predecessorComplexName: '둔촌주공 2단지',
      predecessorFamilyId: 'dunchon_2_51',
      predecessorAreaFamilyLabel: '51㎡형 (구 16평형)',
      exclusiveAreaSqm: 51.67,
      predecessorAppraisedValueKrw: 'DATA_NOT_AVAILABLE',
      rightsValueKrw: 'DATA_NOT_AVAILABLE',
      landShareSqm: 59.83,
    },
    {
      predecessorComplexId: 'dunchon_jugong_2',
      predecessorComplexName: '둔촌주공 2단지',
      predecessorFamilyId: 'dunchon_2_80',
      predecessorAreaFamilyLabel: '80㎡형 (구 25평형)',
      exclusiveAreaSqm: 80.03,
      predecessorAppraisedValueKrw: 'DATA_NOT_AVAILABLE',
      rightsValueKrw: 'DATA_NOT_AVAILABLE',
      landShareSqm: 89.26,
    },
    {
      predecessorComplexId: 'dunchon_jugong_2',
      predecessorComplexName: '둔촌주공 2단지',
      predecessorFamilyId: 'dunchon_2_88',
      predecessorAreaFamilyLabel: '88㎡형 (구 27평형)',
      exclusiveAreaSqm: 88.43,
      predecessorAppraisedValueKrw: 'DATA_NOT_AVAILABLE',
      rightsValueKrw: 'DATA_NOT_AVAILABLE',
      landShareSqm: 98.42,
    },

    // 3단지
    {
      predecessorComplexId: 'dunchon_jugong_3',
      predecessorComplexName: '둔촌주공 3단지',
      predecessorFamilyId: 'dunchon_3_71',
      predecessorAreaFamilyLabel: '71㎡형 (구 23평형)',
      exclusiveAreaSqm: 70.87,
      predecessorAppraisedValueKrw: 'DATA_NOT_AVAILABLE',
      rightsValueKrw: 'DATA_NOT_AVAILABLE',
      landShareSqm: 56.66,
    },
    {
      predecessorComplexId: 'dunchon_jugong_3',
      predecessorComplexName: '둔촌주공 3단지',
      predecessorFamilyId: 'dunchon_3_96',
      predecessorAreaFamilyLabel: '96㎡형 (구 31평형)',
      exclusiveAreaSqm: 96.75,
      predecessorAppraisedValueKrw: 'DATA_NOT_AVAILABLE',
      rightsValueKrw: 'DATA_NOT_AVAILABLE',
      landShareSqm: 64.13,
    },
    {
      predecessorComplexId: 'dunchon_jugong_3',
      predecessorComplexName: '둔촌주공 3단지',
      predecessorFamilyId: 'dunchon_3_98',
      predecessorAreaFamilyLabel: '98㎡형 (구 34평형 A)',
      exclusiveAreaSqm: 98.66,
      predecessorAppraisedValueKrw: 'DATA_NOT_AVAILABLE',
      rightsValueKrw: 'DATA_NOT_AVAILABLE',
      landShareSqm: 65.79,
    },
    {
      predecessorComplexId: 'dunchon_jugong_3',
      predecessorComplexName: '둔촌주공 3단지',
      predecessorFamilyId: 'dunchon_3_99',
      predecessorAreaFamilyLabel: '99㎡형 (구 34평형 B)',
      exclusiveAreaSqm: 99.61,
      predecessorAppraisedValueKrw: 'DATA_NOT_AVAILABLE',
      rightsValueKrw: 'DATA_NOT_AVAILABLE',
      landShareSqm: 65.79,
    },

    // 4단지
    {
      predecessorComplexId: 'dunchon_jugong_4',
      predecessorComplexName: '둔촌주공 4단지',
      predecessorFamilyId: 'dunchon_4_71',
      predecessorAreaFamilyLabel: '71㎡형 (구 23평형)',
      exclusiveAreaSqm: 71.58,
      predecessorAppraisedValueKrw: 'DATA_NOT_AVAILABLE',
      rightsValueKrw: 'DATA_NOT_AVAILABLE',
      landShareSqm: 56.66,
    },
    {
      predecessorComplexId: 'dunchon_jugong_4',
      predecessorComplexName: '둔촌주공 4단지',
      predecessorFamilyId: 'dunchon_4_78',
      predecessorAreaFamilyLabel: '78㎡형 (구 25평형)',
      exclusiveAreaSqm: 78.24,
      predecessorAppraisedValueKrw: 'DATA_NOT_AVAILABLE',
      rightsValueKrw: 'DATA_NOT_AVAILABLE',
      landShareSqm: 62.00,
    },
    {
      predecessorComplexId: 'dunchon_jugong_4',
      predecessorComplexName: '둔촌주공 4단지',
      predecessorFamilyId: 'dunchon_4_97',
      predecessorAreaFamilyLabel: '97㎡형 (구 31평형)',
      exclusiveAreaSqm: 97.72,
      predecessorAppraisedValueKrw: 'DATA_NOT_AVAILABLE',
      rightsValueKrw: 'DATA_NOT_AVAILABLE',
      landShareSqm: 64.13,
    },
    {
      predecessorComplexId: 'dunchon_jugong_4',
      predecessorComplexName: '둔촌주공 4단지',
      predecessorFamilyId: 'dunchon_4_99',
      predecessorAreaFamilyLabel: '99㎡형 (구 34평형)',
      exclusiveAreaSqm: 99.61,
      predecessorAppraisedValueKrw: 'DATA_NOT_AVAILABLE',
      rightsValueKrw: 'DATA_NOT_AVAILABLE',
      landShareSqm: 65.79,
    },
  ];

  let officialGazetteCount = 0;
  let associationDocCount = 0;
  let referenceCount = 0;
  let unavailableCount = 0;

  const rows: ContributionMatrixRow[] = rawRows.map((row) => {
    const cells: Record<string, ContributionCellData> = {};

    columns.forEach((col) => {
      // Default: DATA_NOT_AVAILABLE
      cells[col.successorFamilyId] = createEmptyCell();
    });

    // 1. Research Example 1: 1단지 51형 -> 신축 84형 (1.88억 분담)
    if (row.predecessorFamilyId === 'dunchon_1_51') {
      cells['foreon_84'] = {
        outcomeType: 'ADDITIONAL_CONTRIBUTION',
        amountKrw: 188_000_000,
        provenance: 'REFERENCE',
        evidenceId: 'evi_mapping_sample_1',
        sourceTitle: '조합원 분양신청 통보 기준 추가분담금 안내 (언론/부동산 재게시)',
        notes: '1단지 16평형 소유자가 신축 84㎡ 신청 시 약 1.88억 원 추가분담금 발생 (연구 참고사례)',
      };
      referenceCount++;
    }

    // 2. Research Example 2: 3단지 71형 -> 신축 84형 (0.43억 분담)
    if (row.predecessorFamilyId === 'dunchon_3_71') {
      cells['foreon_84'] = {
        outcomeType: 'ADDITIONAL_CONTRIBUTION',
        amountKrw: 43_000_000,
        provenance: 'REFERENCE',
        evidenceId: 'evi_mapping_sample_2',
        sourceTitle: '조합원 분양신청 통보 기준 추가분담금 안내 (언론/부동산 재게시)',
        notes: '3단지 23평형 소유자가 신축 84㎡ 신청 시 약 4,300만 원 추가분담금 발생 (연구 참고사례)',
      };
      referenceCount++;
    }

    // 3. Research Example 3: 4단지 99형 -> 신축 49형 (2.57억 환급)
    if (row.predecessorFamilyId === 'dunchon_4_99') {
      cells['foreon_49'] = {
        outcomeType: 'REFUND',
        amountKrw: 257_000_000,
        provenance: 'REFERENCE',
        evidenceId: 'evi_mapping_sample_3',
        sourceTitle: '조합원 분양신청 다운사이징 환급 예시 (언론/부동산 재게시)',
        notes: '4단지 34평형 소유자가 신축 49㎡ 다운사이징 신청 시 약 2.57억 원 환급금 발생 (연구 참고사례)',
      };
      referenceCount++;
    }

    // Count remaining as unavailable
    columns.forEach((col) => {
      if (cells[col.successorFamilyId].outcomeType === 'DATA_NOT_AVAILABLE') {
        unavailableCount++;
      }
    });

    return {
      ...row,
      cells,
    };
  });

  return {
    lineageId: 'lineage_dunchon_jugong',
    planVersion: '관리처분계획 기준 분담금 매트릭스 (참고 및 원자료)',
    approvalDate: '2019-12-03',
    columns,
    rows,
    provenanceSummary: {
      officialGazetteRecords: officialGazetteCount,
      associationDocumentRecords: associationDocCount,
      referenceRecords: referenceCount,
      unavailableCells: unavailableCount,
    },
  };
}

/**
 * 향후 연결: 시점별 관리처분계획 변경에 따른 공사비 및 분담금표 변화 비교 템플릿
 * 원칙: 공사비 변동을 단순 1/N로 추정하지 않고, 인가된 시점별 관리처분계획서 원본 간의 공식 변화만 비교
 */
export const DUNCHON_PLAN_VERSION_COMPARISON: PlanVersionComparison = {
  lineageId: 'lineage_dunchon_jugong',
  versions: [
    {
      versionId: 'plan_2019',
      versionLabel: '최초 관리처분계획인가 (2019.12)',
      approvedYmd: '2019-12-03',
      totalConstructionCostKrw: 2_670_800_000_000, // 약 2.67조원
      proportionalRatePercent: null, // 강동구 고시 제2017-68호/2019-94호 원문에 비례율 미명시로 PENDING / INELIGIBLE (138.62% 등 미검증치 배제)
      matrix: buildDunchonContributionMatrix(),
    },
    {
      versionId: 'plan_2022',
      versionLabel: '공사비 증액 협상 및 관리처분총회 (2022.10)',
      approvedYmd: '2022-10-28',
      totalConstructionCostKrw: 4_367_700_000_000, // 약 4.36조원
      proportionalRatePercent: null, // 2022 관리처분계획변경 총회책자 원본 미확보로 PENDING / INELIGIBLE (120.35% 등 언론추정치 배제)
      matrix: buildDunchonContributionMatrix(), // 추후 세부 총회 원본 입수 시 ASSOCIATION_DOCUMENT로 반영
    },
  ],
  notes: '공사비 변동이 개별 분담금에 미치는 영향은 단순 공사비 증가액 ÷ 조합원 수(1/N)로 계산하지 않고, 사업수지 재산정 및 관리처분계획 변경 인가에 수반되는 공식 분담금표 변화를 통해서만 비교합니다. 공식 원문 미검증 비례율은 PENDING 처리되어 표기되지 않습니다.',
};
