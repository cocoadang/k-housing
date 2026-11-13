/**
 * Firestore Architecture & Schema Design (Phase 2~4 Data Layer Blueprint)
 * 
 * Target Collections:
 * 1. `regions`: Hierarchical administrative district metadata
 * 2. `complexes`: Apt complex registry with GPS, built year, categories
 * 3. `rebPriceIndexes`: Korea Real Estate Board (R-ONE) monthly price index time series
 * 4. `transactions`: Raw transaction ledger synced from MOLIT OpenAPI
 * 5. `monthlyComplexPrices`: Pre-aggregated monthly metrics (median, CAGR, MDD cache)
 * 6. `settings`: App configuration, API keys metadata, sync checkpoints
 */

export interface FirestoreRegionDoc {
  id: string; // e.g. "seoul_gangnam", "gyeonggi_seongnam_sujeong"
  province: string; // "서울특별시", "경기도", "부산광역시"
  city: string; // "서울시", "성남시 수정구", "부산시"
  district: string; // "강남구", "수정구", "해운대구"
  subRegion: string; // "압구정", "구성남", "센텀시티"
  lawdCd: string; // "11680", "41131"
  rOneRegionKey: string; // "gangnamZone", "seongnam", "busanHaeundae"
  isActive: boolean;
  updatedAt: string; // ISO 8601
}

export interface FirestoreComplexDoc {
  id: string; // e.g. "sanseong_foreastia", "apgujeong_hyundai"
  name: string;
  shortName: string;
  regionId: string; // Ref to regions collection
  province: string;
  city: string;
  district: string;
  neighborhood: string;
  subRegion: string;
  lawdCd: string;
  dong: string;
  builtYear: number;
  totalUnits: number;
  featuredAreas: number[]; // [59, 84, 114]
  representativeArea: number; // 59 or 84
  category: 'NEW' | 'OLD' | 'REDEVELOPMENT' | 'RECONSTRUCTION' | 'LANDMARK';
  description: string;
  badge?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FirestoreRebPriceIndexDoc {
  id: string; // YYYYMM (e.g. "202408")
  date: string; // "202408"
  baseYearMonth: string; // "202106" = 100.0
  indices: {
    seoulAll: number;
    gangnamZone: number;
    dosimZone: number;
    seobukZone: number;
    gwacheon: number;
    seongnam: number;
    busanAll: number;
    busanHaeundae: number;
    [key: string]: number;
  };
  syncedAt: string;
}

export interface FirestoreTransactionDoc {
  id: string; // unique hash or {lawdCd}_{dealYmd}_{seq}
  complexId: string;
  complexName: string;
  dealDate: string; // "2024-08-15"
  dealYmd: string; // "202408"
  price: number; // in 만원
  exclusiveArea: number; // ㎡
  areaCategory: '59' | '84' | '114_PLUS' | 'OTHER';
  areaFamilyId?: string; // Phase 1: Optional 단지별 주택형 ID
  standardAreaCategory?: '59' | '84' | 'OTHER'; // Phase 1: Optional 표준 지도/거시 카테고리
  pyeong: number;
  pricePerPyeong: number;
  pricePerSqm: number;
  floor: number;
  isCancelled: boolean;
  normalRowCount?: number;
  cancellationRowCount?: number;
  activeCount?: number;
  cancelDate?: string;
  cancelDates?: string[];
  registrationDate?: string;
  dealType?: '중개거래' | '직거래' | string;
  isOutlier?: boolean;
  dataSource: 'MOCK' | 'LIVE' | 'MOLIT_OPENAPI' | 'LOCAL_CACHE';
  syncedAt: string;
}

export interface FirestoreMonthlyComplexPriceDoc {
  id: string; // {complexId}_{areaCategory}_{dealYmd}
  complexId: string;
  areaCategory: 'ALL' | '59' | '84' | '114_PLUS';
  dealYmd: string; // "202408"
  year: number;
  month: number;
  displayDate: string; // "2024.08"
  medianPrice: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  medianPricePerPyeong: number;
  medianPricePerSqm: number;
  tradeCount: number;
  volume: number;
  reliability: 'HIGH' | 'MEDIUM' | 'LOW' | 'NO_DATA';
  movingAvg6M: number;
  cagrFromBase: number;
  drawdownFromAth: number;
  calculatedAt: string;
}

/**
 * Phase 1 Architecture: AreaFamily 기반 월별 집계 스키마
 * (실제 마이그레이션은 후속 Phase에서 진행하며, 현재 문서는 건드리지 않음)
 */
export interface FirestoreAreaFamilyMonthlyPriceDoc {
  id: string; // {complexId}_{areaFamilyId}_{dealYmd}
  complexId: string;
  areaFamilyId: string;
  dealYmd: string; // "202408"

  tradeCount: number;
  activeCount: number;

  medianPrice: number;
  averagePrice: number;
  minPrice: number;
  maxPrice: number;

  medianPricePerSqm: number;
  averagePricePerSqm: number;

  reliability: 'HIGH' | 'MEDIUM' | 'LOW' | 'NO_DATA';
  calculatedAt: string;
}

export interface FirestoreRedevelopmentLineageDoc {
  id: string; // e.g. "dunchon_redevelopment"
  name: string;
  predecessorComplexIds: string[];
  successorComplexIds: string[];
  projectId: string;
  description?: string;
  updatedAt: string;
}

export interface FirestoreRedevelopmentProjectDoc {
  id: string;
  projectName: string;
  lineageId: string;
  milestones?: Record<string, string>;
  units?: { before?: number; after?: number };
  financials?: {
    totalProjectCost?: number;
    totalConstructionCost?: number;
    constructionCostPerPyeong?: number;
  };
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  updatedAt: string;
}

export interface FirestoreSettingDoc {
  id: string; // "system_config"
  dataMode: 'MOCK' | 'LIVE';
  defaultArea: '59' | '84';
  defaultBaseline: string; // "2017_05"
  lastMolitSyncAt?: string;
  lastROneSyncAt?: string;
  syncStatus: 'IDLE' | 'SYNCING' | 'ERROR';
}

/**
 * Repository interface blueprint for seamless transition from MOCK to Firestore
 */
export interface IComplexRepository {
  getComplexes(filter?: { province?: string; subRegion?: string }): Promise<FirestoreComplexDoc[]>;
  getComplexById(id: string): Promise<FirestoreComplexDoc | null>;
}

export interface ITransactionRepository {
  getTrades(complexId: string, filter?: { areaCategory?: string; startYmd?: string; endYmd?: string }): Promise<FirestoreTransactionDoc[]>;
  saveTrades(trades: FirestoreTransactionDoc[]): Promise<number>;
}

export interface IPriceIndexRepository {
  getIndices(startYmd: string, endYmd: string): Promise<FirestoreRebPriceIndexDoc[]>;
}
