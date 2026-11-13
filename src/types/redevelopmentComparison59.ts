/**
 * Phase 8I / 8J — 전용 59㎡ 표준화 비교 모델 타입 정의
 * 
 * 1. 면적 규칙:
 *    - ㎡ = 전용면적 기준
 *    - 평/평당가 = 공급면적 ÷ 3.3 (또는 3.33058) 기준
 *    - supplyAreaSqm 부재 시 평당가 지표는 엄격히 DATA_NOT_AVAILABLE
 * 2. 신뢰도 체계:
 *    - OFFICIAL_FACT / MARKET_DATA / ACTUAL_USER_COST만 포함 -> VERIFIED_COST
 *    - USER_SCENARIO 포함 -> SCENARIO_COST
 *    - REFERENCE 1개라도 포함 -> REFERENCE_COST
 * 3. 평당가 명칭 완벽 분리:
 *    - MARKET_PRICE_PER_SUPPLY_PYEONG vs TOTAL_COST_PER_SUPPLY_PYEONG
 */

// =================================================================
// 1. Evidence Tier & Provenance
// =================================================================
export type ComparisonEvidenceTier =
  | 'OFFICIAL_FACT'       // 관리처분인가 등 공식 행정 확정치
  | 'MARKET_DATA'         // 검증된 MOLIT 실거래가 v2 데이터
  | 'ACTUAL_USER_COST'    // 사용자가 입력한 실제 지출액 (매입가, 세금 등 실지출 영수증)
  | 'USER_SCENARIO'       // 사용자 시뮬레이션 가상치 (가상 금리, 예상 분담금)
  | 'REFERENCE'           // 시공사 제안/보도, 총회 가계약 등 참고치
  | 'DATA_NOT_AVAILABLE'; // 데이터 부재

export interface ValueWithProvenance<T> {
  value: T;
  tier: ComparisonEvidenceTier | CostConfidenceTier;
  sourceId?: string;
  evidenceId?: string;
  rationale?: string;
}

// =================================================================
// 2. Scenario 구조 (SINGLE vs RANGE 각 슬롯별 독립 Provenance)
// =================================================================
export type ScenarioValue<T> =
  | {
      variant: 'SINGLE';
      slot: ValueWithProvenance<T>;
    }
  | {
      variant: 'RANGE';
      low: ValueWithProvenance<T>;
      base: ValueWithProvenance<T>;
      high: ValueWithProvenance<T>;
      activeScenario: 'LOW' | 'BASE' | 'HIGH';
    };

export type CostConfidenceTier =
  | 'VERIFIED_COST'   // 추정/REFERENCE 없이 실제 확인된 값(OFFICIAL_FACT, MARKET_DATA, ACTUAL_USER_COST)만 사용
  | 'SCENARIO_COST'   // USER_SCENARIO가 포함된 시뮬레이션 원가
  | 'REFERENCE_COST'; // REFERENCE가 1개라도 포함된 참고 원가

// =================================================================
// 3. 투자 총원가 구성요소 (Investor Total Cost)
// =================================================================
export interface InvestmentCostStructure59 {
  purchasePriceKrw: ScenarioValue<number | null>;          // 실제 투자자 매입가격 (미확인이면 null, tier: DATA_NOT_AVAILABLE)
  additionalContributionKrw: ScenarioValue<number | null>; // 추가분담금/환급금 (signed number, 미확인이면 null)
  acquisitionTaxKrw: ScenarioValue<number | null>;         // 취득/부대세금 (미확인이면 null)
  financingCostKrw?: ScenarioValue<number | null>;        // 금융비용 (미확인이면 null)
  otherExpensesKrw?: ScenarioValue<number | null>;        // 기타 실지출 (미확인이면 null)
}

export interface TotalCost59Result {
  tier: CostConfidenceTier | 'DATA_NOT_AVAILABLE';
  amountKrw: ScenarioValue<number | null>;
  activeAmountKrw: number | null;
  isCalculable: boolean;
  unavailabilityReason?: string;
  contributingTiers: ComparisonEvidenceTier[];
}

// =================================================================
// 4. Benchmark 시장가격 방법론 & 속성
// =================================================================
export type BenchmarkPriceMethod =
  | 'MONTHLY_MEDIAN'      // 당월 실거래 중앙값
  | 'RECENT_3M_MEDIAN'    // 최근 3개월 실거래 중앙값
  | 'SINGLE_TRANSACTION'; // 단일 최근 실거래가

export interface BenchmarkProperty {
  benchmarkComplexId: string;
  benchmarkComplexName: string;
  areaFamilyId: string;
  exclusiveAreaSqm: number;              // 반드시 59㎡ 계열 (58.0 ~ 62.0㎡, 타 면적 환산 절대 금지)
  supplyAreaSqm: number | null;          // null 허용 (없으면 평당가 N/A)
  
  marketPriceKrw: number;
  priceMethod: BenchmarkPriceMethod;
  valuationDate: string;                 // 기준시점 (YYYY-MM 또는 YYYY-MM-DD)
  observationStart: string;              // 관측 시작일
  observationEnd: string;                // 관측 종료일
  transactionCount: number;              // 표본 거래 건수
  
  selectionMethod: 'USER_SELECTED' | 'POLICY_DEFAULT';
  selectionReason: string;               // 선정 사유
  tier: 'MARKET_DATA';
}

// =================================================================
// 5. 정비사업 사업 정산 데이터 (참고 및 P 산출용, 원가 대체 금지)
// =================================================================
export interface RedevelopmentSettlementData {
  appraisedPredecessorValueKrw: number | null; // 종전자산평가액
  proportionalRatePct: number | null;          // 비례율 (%)
  rightsValueKrw: number | null;               // 권리가액 (= 평가액 * 비례율)
  memberSalePrice59Krw: number | null;         // 전용 59㎡ 조합원 분양가
  officialContribution59Krw: number | null;    // 법정 공식 분담금 (= 분양가 - 권리가액, signed)
  evidenceTier: 'OFFICIAL_FACT' | 'REFERENCE' | 'DATA_NOT_AVAILABLE';
}

// =================================================================
// 6. 참고 및 보도 수치 데이터 (REFERENCE, 공식 사실과 엄격 분리)
// =================================================================
export interface RedevelopmentReferenceData {
  mediaEstimatedContributionRangeKrw?: {
    min: number;
    max: number;
    source: string;
    status: 'REFERENCE' | 'INELIGIBLE';
    notes: string;
  };
  mediaRightsValueRangeKrw?: {
    min: number;
    max: number;
    source: string;
    status: 'REFERENCE' | 'INELIGIBLE';
    notes: string;
  };
  generalAssemblyProportionalRatePct?: {
    valuePct: number;
    source: string;
    status: 'PENDING' | 'INELIGIBLE';
    notes: string;
  };
}

// =================================================================
// 7. 비교 시점 관계 (Timing)
// =================================================================
export type ComparisonTiming =
  | 'SAME_PERIOD'                       // 동일 기간/월 비교
  | 'HISTORICAL_COST_VS_CURRENT_VALUE'  // 과거 확정/투입 원가 vs 현재 신축 시장가치
  | 'OTHER';

// =================================================================
// 8. 최종 59㎡ 표준화 비교 모델 결과
// =================================================================
export interface Standardized59ComparisonModel {
  schemaVersion: 1;
  isUserSimulation?: boolean;
  targetProperty: {
    propertyType: 'RECONSTRUCTION' | 'REDEVELOPMENT' | 'URBAN_PUBLIC_HOUSING_COMPLEX' | 'GENERAL_APARTMENT';
    lineageId?: string;
    complexId?: string;
    displayName: string;
    exclusiveAreaSqm: number;
    supplyAreaSqm: number | null;
    costValuationDate?: string; // 원가 기준일자
  };
  comparisonTiming: ComparisonTiming;
  timingNotice?: string;

  settlement?: RedevelopmentSettlementData;
  references?: RedevelopmentReferenceData;
  investmentCost: InvestmentCostStructure59;
  totalCost59: TotalCost59Result;
  benchmark: BenchmarkProperty;

  // 핵심 KPI (면적 원칙 & 평당가 명칭 완벽 분리)
  kpis: {
    // 1) 대상 단지 원가 지표
    totalCostPerExclusiveSqm: number | null;
    TOTAL_COST_PER_SUPPLY_PYEONG: number | null | 'DATA_NOT_AVAILABLE';

    // 2) 비교 벤치마크 신축 아파트 지표
    benchmarkPricePerExclusiveSqm: number;
    MARKET_PRICE_PER_SUPPLY_PYEONG: number | null | 'DATA_NOT_AVAILABLE';

    // 3) 상대 비교 지표
    costRatio59Pct: number | null;    // 신축환산원가율 = (총투입원가 / 벤치마크 신축가) * 100
    discountRate59Pct: number | null; // 신축 대비 할인/프리미엄율 = (벤치마크가 - 총투입원가) / 벤치마크가 * 100
    valueDelta59Krw: number | null;   // 예상 가치차이 = 벤치마크가 - 총투입원가
  };

  timeline: {
    durationYearsMonths: string | null;
    xirr: number | null | 'NOT_CALCULABLE';
    xirrReason?: string;
  };
}
