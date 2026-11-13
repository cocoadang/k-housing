import { ComplexInfo, RedevelopmentLineage, RedevelopmentProject, RedevelopmentCostRecord, ConstructionCostHistory, RedevelopmentAreaMapping } from '../types';

/**
 * Redevelopment Lineages and Historical Complexes Registry
 * 
 * CRITICAL ARCHITECTURAL RULES:
 * 1. Predecessors (구 둔촌주공 1~4단지 등) and Successors (올림픽파크포레온 등)
 *    have strictly independent price time series. They are NEVER combined or synthesized.
 * 2. Predecessor complexes are flagged with `historicalOnly: true` and `isActive: false`.
 *    They are managed in `HISTORICAL_COMPLEXES` rather than polluting the active `TARGET_COMPLEXES`.
 * 3. Additional contributions (`additionalContribution`) are defined on a per-Pair or per-Case basis,
 *    never as a single global value for the whole complex.
 * 4. Construction cost records (`ConstructionCostHistory`) are project variables,
 *    not directly added to individual investment costs.
 */

// =========================================================================
// 1. 재건축 구 단지 (Historical Complexes) - 둔촌주공 1~4단지
// =========================================================================
export const HISTORICAL_COMPLEXES: ComplexInfo[] = [
  {
    id: 'dunchon_jugong_1',
    name: '둔촌주공1단지',
    shortName: '둔촌주공1단지',
    apiAliases: ['둔촌주공1', '둔촌주공1단지', '둔촌주공아파트1단지'],
    region: 'SEOUL_METRO',
    province: '서울특별시',
    city: '서울시',
    district: '강동구 둔촌동',
    neighborhood: '둔촌동',
    subRegion: '강동',
    lawdCd: '11740',
    dong: '둔촌동',
    latitude: 37.5204,
    longitude: 127.1350,
    location: { lat: 37.5204, lng: 127.1350 },
    builtYear: 1980,
    totalUnits: 1640,
    featuredAreas: [25, 52, 79],
    representativeArea: 52,
    areaCapabilities: {
      has59: false,
      has84: false,
      defaultArea: '84',
    },
    category: 'RECONSTRUCTION',
    description: '구 둔촌주공 1단지 (저층, 1980년 준공, 올림픽파크포레온으로 재건축 완료 멸실)',
    historicalOnly: true,
    isActive: false,
    redevelopmentLineageId: 'dunchon_redevelopment',
  },
  {
    id: 'dunchon_jugong_2',
    name: '둔촌주공2단지',
    shortName: '둔촌주공2단지',
    apiAliases: ['둔촌주공2', '둔촌주공2단지', '둔촌주공아파트2단지'],
    region: 'SEOUL_METRO',
    province: '서울특별시',
    city: '서울시',
    district: '강동구 둔촌동',
    neighborhood: '둔촌동',
    subRegion: '강동',
    lawdCd: '11740',
    dong: '둔촌동',
    latitude: 37.5204,
    longitude: 127.1350,
    location: { lat: 37.5204, lng: 127.1350 },
    builtYear: 1980,
    totalUnits: 900,
    featuredAreas: [52, 79],
    representativeArea: 52,
    areaCapabilities: {
      has59: false,
      has84: false,
      defaultArea: '84',
    },
    category: 'RECONSTRUCTION',
    description: '구 둔촌주공 2단지 (저층, 1980년 준공, 올림픽파크포레온으로 재건축 완료 멸실)',
    historicalOnly: true,
    isActive: false,
    redevelopmentLineageId: 'dunchon_redevelopment',
  },
  {
    id: 'dunchon_jugong_3',
    name: '둔촌주공3단지',
    shortName: '둔촌주공3단지',
    apiAliases: ['둔촌주공3', '둔촌주공3단지', '둔촌주공아파트3단지'],
    region: 'SEOUL_METRO',
    province: '서울특별시',
    city: '서울시',
    district: '강동구 둔촌동',
    neighborhood: '둔촌동',
    subRegion: '강동',
    lawdCd: '11740',
    dong: '둔촌동',
    latitude: 37.5204,
    longitude: 127.1350,
    location: { lat: 37.5204, lng: 127.1350 },
    builtYear: 1980,
    totalUnits: 1480,
    featuredAreas: [79, 99],
    representativeArea: 79,
    areaCapabilities: {
      has59: false,
      has84: false,
      defaultArea: '84',
    },
    category: 'RECONSTRUCTION',
    description: '구 둔촌주공 3단지 (고층, 1980년 준공, 올림픽파크포레온으로 재건축 완료 멸실)',
    historicalOnly: true,
    isActive: false,
    redevelopmentLineageId: 'dunchon_redevelopment',
  },
  {
    id: 'dunchon_jugong_4',
    name: '둔촌주공4단지',
    shortName: '둔촌주공4단지',
    apiAliases: ['둔촌주공4', '둔촌주공4단지', '둔촌주공아파트4단지'],
    region: 'SEOUL_METRO',
    province: '서울특별시',
    city: '서울시',
    district: '강동구 둔촌동',
    neighborhood: '둔촌동',
    subRegion: '강동',
    lawdCd: '11740',
    dong: '둔촌동',
    latitude: 37.5204,
    longitude: 127.1350,
    location: { lat: 37.5204, lng: 127.1350 },
    builtYear: 1980,
    totalUnits: 1910,
    featuredAreas: [79, 99],
    representativeArea: 79,
    areaCapabilities: {
      has59: false,
      has84: false,
      defaultArea: '84',
    },
    category: 'RECONSTRUCTION',
    description: '구 둔촌주공 4단지 (고층, 1980년 준공, 올림픽파크포레온으로 재건축 완료 멸실)',
    historicalOnly: true,
    isActive: false,
    redevelopmentLineageId: 'dunchon_redevelopment',
  },
];

// =========================================================================
// 2. 둔촌주공 재건축 정비사업 Lineage
// =========================================================================
export const DUNCHON_REDEVELOPMENT_LINEAGE: RedevelopmentLineage = {
  schemaVersion: 1,
  lineageId: 'dunchon_redevelopment',
  id: 'dunchon_redevelopment',
  lineageName: '둔촌주공아파트 주택재건축정비사업',
  name: '둔촌주공아파트 주택재건축정비사업',
  projectType: 'RECONSTRUCTION',
  redevelopmentTypeLabel: '주택재건축정비사업',
  predecessorComplexIds: [
    'dunchon_jugong_1',
    'dunchon_jugong_2',
    'dunchon_jugong_3',
    'dunchon_jugong_4',
  ],
  successorComplexIds: ['gangdong_olympic_park'],
  projectId: 'proj_dunchon_olympic_park',
  description: '강동구 둔촌동 둔촌주공아파트 1~4단지(5,930세대)를 올림픽파크포레온(12,032세대)으로 재건축한 국내 최대 규모 정비사업',
  sourceMetadata: [
    {
      sourceType: 'OFFICIAL_DOCUMENT',
      sourceName: '서울특별시 강동구청 고시 제2017-68호',
      sourceDocumentTitle: '둔촌주공아파트 주택재건축정비사업 관리처분계획인가 고시',
      publisher: '서울특별시 강동구청',
      asOfDate: '2017-05-04',
      confidence: 'VERIFIED',
      notes: '법정 관리처분계획인가 고시 원문'
    }
  ]
};

// =========================================================================
// 3. 둔촌주공 정비사업 프로젝트 스키마 구조
// (검증되지 않은 재무 숫자는 하드코딩하지 않으며 공식 출처 레퍼런스를 보존)
// =========================================================================
export const DUNCHON_REDEVELOPMENT_PROJECT: RedevelopmentProject = {
  schemaVersion: 1,
  projectId: 'proj_dunchon_olympic_park',
  id: 'proj_dunchon_olympic_park',
  projectName: '둔촌주공아파트 주택재건축정비사업',
  lineageId: 'dunchon_redevelopment',
  projectType: 'RECONSTRUCTION',
  redevelopmentTypeLabel: '주택재건축정비사업',
  status: 'COMPLETED',
  predecessorComplexIds: [
    'dunchon_jugong_1',
    'dunchon_jugong_2',
    'dunchon_jugong_3',
    'dunchon_jugong_4',
  ],
  successorComplexIds: ['gangdong_olympic_park'],

  milestoneDates: {
    safetyDiagnosisDate: null,
    promotionCommitteeApprovalDate: '2003-10-27',
    associationEstablishmentDate: '2009-12-28',
    projectApprovalDate: '2015-07-30',
    projectNoticeDate: '2015-08-05',
    projectNoticeNumber: '강동구 고시 제2015-93호',
    managementDispositionDate: '2017-05-02',
    managementDispositionNoticeDate: '2017-05-04',
    managementDispositionNoticeNumber: '강동구 고시 제2017-68호',
    demolitionStartDate: '2019-12-01',
    constructionStartDate: '2019-12-03',
    generalSaleDate: '2022-12-05',
    completionDate: '2024-11-27',
    moveInDate: '2024-11-27',
  },

  promotionCommitteeApprovalDate: '2003-10-27',
  associationApprovalDate: '2009-12-28',
  projectApprovalDate: '2015-07-30',
  projectNoticeDate: '2015-08-05',
  projectNoticeNumber: '강동구 고시 제2015-93호',
  managementDispositionApprovalDate: '2017-05-02',
  managementDispositionNoticeDate: '2017-05-04',
  managementDispositionNoticeNumber: '강동구 고시 제2017-68호',
  demolitionDate: '2019-12-01',
  constructionStartDate: '2019-12-03',
  generalSaleDate: '2022-12-05',
  completionDate: '2024-11-27',

  beforeUnits: 5930,
  afterUnits: 12032,
  units: {
    before: 5930,
    after: 12032,
  },

  sourceMetadata: [
    {
      sourceType: 'OFFICIAL_DOCUMENT',
      sourceName: '서울특별시 강동구청 관리처분계획인가 고시 (제2017-68호)',
      publisher: '서울특별시 강동구청',
      asOfDate: '2017-05-04',
      confidence: 'VERIFIED',
    },
    {
      sourceType: 'STATUTORY_PLAN',
      sourceName: '둔촌주공 재건축정비사업조합 관리처분총회 책자',
      publisher: '둔촌주공아파트 주택재건축정비사업조합',
      asOfDate: '2016-10-22',
      confidence: 'HIGH',
    },
  ],
  confidence: 'HIGH',
};

// =========================================================================
// 3-B. 두 번째 정비사업 — 증산4구역 도심 공공주택 복합사업 (공공재개발)
// =========================================================================
export const JEUNGSAN4_REDEVELOPMENT_LINEAGE: RedevelopmentLineage = {
  schemaVersion: 1,
  lineageId: 'jeungsan4_redevelopment',
  id: 'jeungsan4_redevelopment',
  lineageName: '증산4구역 도심 공공주택 복합사업',
  name: '증산4구역 도심 공공주택 복합사업',
  projectType: 'URBAN_PUBLIC_HOUSING_COMPLEX',
  redevelopmentTypeLabel: '도심 공공주택 복합사업',
  predecessorComplexIds: [],
  successorComplexIds: [],
  projectId: 'proj_jeungsan4_complex',
  description:
    '은평구 증산동 205-33번지 일원 저층 주거지를 공공주도 복합개발을 통해 3,509세대 규모 공동주택으로 조성하는 도심 공공주택 복합사업 (서울시 고시 제2024-678호 복합사업계획 승인)',
  sourceMetadata: [
    {
      sourceType: 'STATUTORY_PLAN',
      sourceName: '서울특별시 복합사업계획 승인 및 지형도면 등의 고시 (제2024-678호)',
      publisher: '서울특별시',
      asOfDate: '2024-12-30',
      confidence: 'VERIFIED',
      evidenceClass: 'OFFICIAL',
      verificationStatus: 'VERIFIED',
      calculationEligibility: 'ELIGIBLE',
    },
    {
      sourceType: 'OFFICIAL_DOCUMENT',
      sourceName: '국토교통부 증산4 도심 공공주택 복합지구 지정 고시',
      publisher: '국토교통부',
      asOfDate: '2021-12-31',
      confidence: 'VERIFIED',
      evidenceClass: 'OFFICIAL',
      verificationStatus: 'VERIFIED',
      calculationEligibility: 'ELIGIBLE',
    },
  ],
};

export const JEUNGSAN4_REDEVELOPMENT_PROJECT: RedevelopmentProject = {
  schemaVersion: 1,
  projectId: 'proj_jeungsan4_complex',
  id: 'proj_jeungsan4_complex',
  projectName: '서울 증산4 도심 공공주택 복합지구',
  lineageId: 'jeungsan4_redevelopment',
  projectType: 'URBAN_PUBLIC_HOUSING_COMPLEX',
  redevelopmentTypeLabel: '도심 공공주택 복합사업',
  status: 'IN_PROGRESS',
  predecessorComplexIds: [],
  successorComplexIds: [],

  milestoneDates: {
    districtDesignationDate: '2021-12-31',
    complexPlanApprovalDate: '2024-12-30',
    projectApprovalDate: '2024-12-30',
    projectNoticeDate: '2024-12-30',
    projectNoticeNumber: '서울특별시 고시 제2024-678호',
    managementDispositionDate: null,
    managementDispositionNoticeDate: null,
    managementDispositionNoticeNumber: null,
    demolitionStartDate: null,
    constructionStartDate: null,
    generalSaleDate: null,
    completionDate: null,
    moveInDate: null,
  },

  districtDesignationDate: '2021-12-31',
  projectApprovalDate: '2024-12-30',
  projectNoticeDate: '2024-12-30',
  projectNoticeNumber: '서울특별시 고시 제2024-678호',
  managementDispositionApprovalDate: null,
  managementDispositionNoticeDate: null,
  managementDispositionNoticeNumber: null,
  demolitionDate: null,
  constructionStartDate: null,
  generalSaleDate: null,
  completionDate: null,

  beforeUnits: null,
  afterUnits: 3509,
  units: {
    before: null,
    after: 3509,
  },

  sourceMetadata: [
    {
      sourceType: 'STATUTORY_PLAN',
      sourceName: '서울특별시 복합사업계획 승인 고시 (제2024-678호)',
      publisher: '서울특별시',
      asOfDate: '2024-12-30',
      confidence: 'VERIFIED',
      evidenceClass: 'OFFICIAL',
      verificationStatus: 'VERIFIED',
      calculationEligibility: 'ELIGIBLE',
    },
    {
      sourceType: 'OFFICIAL_DOCUMENT',
      sourceName: '국토교통부 증산4 도심 공공주택 복합지구 지정 고시',
      publisher: '국토교통부',
      asOfDate: '2021-12-31',
      confidence: 'VERIFIED',
      evidenceClass: 'OFFICIAL',
      verificationStatus: 'VERIFIED',
      calculationEligibility: 'ELIGIBLE',
    },
  ],
  confidence: 'HIGH',
};

// =========================================================================
// 3-C. 세 번째 정비사업 — 부산 시민공원 촉진3구역 주택정비형 재개발사업
// =========================================================================
export const CHOKJIN3_REDEVELOPMENT_LINEAGE: RedevelopmentLineage = {
  schemaVersion: 1,
  lineageId: 'chokjin3_redevelopment',
  id: 'chokjin3_redevelopment',
  lineageName: '부산 시민공원 촉진3구역 주택정비형 재개발',
  name: '부산 시민공원 촉진3구역 주택정비형 재개발',
  projectType: 'REDEVELOPMENT',
  redevelopmentTypeLabel: '주택재개발정비사업',
  predecessorComplexIds: [],
  successorComplexIds: [],
  projectId: 'proj_chokjin3_redevelopment',
  description:
    '부산진구 범전동 71-5번지 일원 저층 노후 주거지를 지하 5층~지상 최고 60층 18개동 3,545세대 규모 하이엔드 대단지 아크로 라로체로 재개발하는 부산 대표 재정비촉진사업 (부산진구 고시 제2024-95호 관리처분계획인가)',
  sourceMetadata: [
    {
      sourceType: 'STATUTORY_PLAN',
      sourceName: '부산광역시 부산진구 관리처분계획인가 고시 (제2024-95호)',
      publisher: '부산광역시 부산진구청',
      asOfDate: '2024-06-05',
      confidence: 'VERIFIED',
      evidenceClass: 'OFFICIAL',
      verificationStatus: 'VERIFIED',
      calculationEligibility: 'ELIGIBLE',
    },
    {
      sourceType: 'STATUTORY_PLAN',
      sourceName: '부산광역시 부산진구 사업시행계획인가 고시 (제2022-147호)',
      publisher: '부산광역시 부산진구청',
      asOfDate: '2022-10-19',
      confidence: 'VERIFIED',
      evidenceClass: 'OFFICIAL',
      verificationStatus: 'VERIFIED',
      calculationEligibility: 'ELIGIBLE',
    },
    {
      sourceType: 'OFFICIAL_DOCUMENT',
      sourceName: '부산진구청 조합설립인가 공문',
      publisher: '부산광역시 부산진구청',
      asOfDate: '2017-06-23',
      confidence: 'VERIFIED',
      evidenceClass: 'OFFICIAL',
      verificationStatus: 'VERIFIED',
      calculationEligibility: 'ELIGIBLE',
    },
  ],
};

export const CHOKJIN3_REDEVELOPMENT_PROJECT: RedevelopmentProject = {
  schemaVersion: 1,
  projectId: 'proj_chokjin3_redevelopment',
  id: 'proj_chokjin3_redevelopment',
  projectName: '시민공원주변(재정비촉진지구) 촉진3구역 주택정비형 재개발사업',
  lineageId: 'chokjin3_redevelopment',
  projectType: 'REDEVELOPMENT',
  redevelopmentTypeLabel: '주택재개발정비사업',
  status: 'IN_PROGRESS',
  predecessorComplexIds: [],
  successorComplexIds: [],

  milestoneDates: {
    districtDesignationDate: '2007-05-23',
    associationEstablishmentDate: '2017-06-23',
    projectApprovalDate: '2022-10-13',
    projectNoticeDate: '2022-10-19',
    projectNoticeNumber: '부산광역시 부산진구 고시 제2022-147호',
    managementDispositionDate: '2024-05-23',
    managementDispositionNoticeDate: '2024-06-05',
    managementDispositionNoticeNumber: '부산광역시 부산진구 고시 제2024-95호',
    demolitionStartDate: null,
    constructionStartDate: null,
    generalSaleDate: null,
    completionDate: null,
    moveInDate: null,
  },

  districtDesignationDate: '2007-05-23',
  associationApprovalDate: '2017-06-23',
  projectApprovalDate: '2022-10-13',
  projectNoticeDate: '2022-10-19',
  projectNoticeNumber: '부산광역시 부산진구 고시 제2022-147호',
  managementDispositionApprovalDate: '2024-05-23',
  managementDispositionNoticeDate: '2024-06-05',
  managementDispositionNoticeNumber: '부산광역시 부산진구 고시 제2024-95호',
  demolitionDate: null,
  constructionStartDate: null,
  generalSaleDate: null,
  completionDate: null,

  beforeUnits: null,
  afterUnits: 3545,
  units: {
    before: null,
    after: 3545,
  },

  sourceMetadata: [
    {
      sourceType: 'STATUTORY_PLAN',
      sourceName: '부산광역시 부산진구 관리처분계획인가 고시 (제2024-95호)',
      publisher: '부산광역시 부산진구청',
      asOfDate: '2024-06-05',
      confidence: 'VERIFIED',
      evidenceClass: 'OFFICIAL',
      verificationStatus: 'VERIFIED',
      calculationEligibility: 'ELIGIBLE',
    },
    {
      sourceType: 'STATUTORY_PLAN',
      sourceName: '부산광역시 부산진구 사업시행계획인가 고시 (제2022-147호)',
      publisher: '부산광역시 부산진구청',
      asOfDate: '2022-10-19',
      confidence: 'VERIFIED',
      evidenceClass: 'OFFICIAL',
      verificationStatus: 'VERIFIED',
      calculationEligibility: 'ELIGIBLE',
    },
  ],
  confidence: 'HIGH',
};

// =========================================================================
// 4. 레지스트리 목록 및 조회 헬퍼
// =========================================================================
export const REDEVELOPMENT_LINEAGES_REGISTRY: RedevelopmentLineage[] = [
  DUNCHON_REDEVELOPMENT_LINEAGE,
  JEUNGSAN4_REDEVELOPMENT_LINEAGE,
  CHOKJIN3_REDEVELOPMENT_LINEAGE,
];

export const REDEVELOPMENT_PROJECTS_REGISTRY: RedevelopmentProject[] = [
  DUNCHON_REDEVELOPMENT_PROJECT,
  JEUNGSAN4_REDEVELOPMENT_PROJECT,
  CHOKJIN3_REDEVELOPMENT_PROJECT,
];

export function getRedevelopmentLineage(lineageId: string): RedevelopmentLineage | undefined {
  if (lineageId === 'lineage_dunchon_olympic' || lineageId === 'dunchon_redevelopment') {
    return DUNCHON_REDEVELOPMENT_LINEAGE;
  }
  return REDEVELOPMENT_LINEAGES_REGISTRY.find(
    (l) => l.lineageId === lineageId || l.id === lineageId
  );
}

export function getRedevelopmentProject(projectId: string): RedevelopmentProject | undefined {
  return REDEVELOPMENT_PROJECTS_REGISTRY.find(
    (p) => p.projectId === projectId || p.id === projectId || p.lineageId === projectId
  );
}

export function getLineageForComplex(complexId: string): RedevelopmentLineage | undefined {
  return REDEVELOPMENT_LINEAGES_REGISTRY.find(
    (l) => l.predecessorComplexIds.includes(complexId) || l.successorComplexIds.includes(complexId)
  );
}

export function getHistoricalComplexById(complexId: string): ComplexInfo | undefined {
  return HISTORICAL_COMPLEXES.find((c) => c.id === complexId);
}

/**
 * 동적 정비사업 Lineage 및 Project 등록 헬퍼 (Phase 8E)
 * 새로운 사업 추가 시 코드를 수정하지 않고 Seed 및 Registry 등록만으로 작동할 수 있도록 지원
 */
export function registerRedevelopmentLineage(
  lineage: RedevelopmentLineage,
  project?: RedevelopmentProject
): void {
  const targetId = lineage.lineageId || lineage.id;
  const existingIdx = REDEVELOPMENT_LINEAGES_REGISTRY.findIndex(
    (l) => (l.lineageId || l.id) === targetId
  );
  if (existingIdx >= 0) {
    REDEVELOPMENT_LINEAGES_REGISTRY[existingIdx] = lineage;
  } else {
    REDEVELOPMENT_LINEAGES_REGISTRY.push(lineage);
  }

  if (project) {
    const targetProjId = project.projectId || project.id;
    const pIdx = REDEVELOPMENT_PROJECTS_REGISTRY.findIndex(
      (p) => (p.projectId || p.id) === targetProjId || p.lineageId === targetId
    );
    if (pIdx >= 0) {
      REDEVELOPMENT_PROJECTS_REGISTRY[pIdx] = project;
    } else {
      REDEVELOPMENT_PROJECTS_REGISTRY.push(project);
    }
  }
}

export function isRegisteredLineage(lineageId: string): boolean {
  return REDEVELOPMENT_LINEAGES_REGISTRY.some(
    (l) => l.lineageId === lineageId || l.id === lineageId
  );
}

export function isPredecessorComplex(complexId: string): boolean {
  return (
    HISTORICAL_COMPLEXES.some((c) => c.id === complexId) ||
    REDEVELOPMENT_LINEAGES_REGISTRY.some((l) =>
      l.predecessorComplexIds.includes(complexId)
    )
  );
}
