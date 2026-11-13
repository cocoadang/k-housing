/**
 * Phase 8J: 전용 59㎡ 표준화 비교 계산 엔진 (Comparison59Engine)
 * 
 * 1. Scenario SINGLE/RANGE 활성값 추출
 * 2. 투자 총투입원가 계산 (purchasePrice + signed additionalContribution + tax + financing + other)
 * 3. CostConfidenceTier 판정:
 *    - REFERENCE 포함 -> REFERENCE_COST
 *    - USER_SCENARIO 포함 -> SCENARIO_COST
 *    - ACTUAL_USER_COST, OFFICIAL_FACT, MARKET_DATA만 포함 -> VERIFIED_COST
 * 4. 면적 규칙:
 *    - ㎡ = 전용면적 기준
 *    - 평 = 공급면적 / 3.3 (또는 3.33058)
 *    - 공급면적 부재 시 평당 지표는 DATA_NOT_AVAILABLE
 * 5. 84㎡ -> 59㎡ 비례환산 절대 거부
 * 6. Timing 판정:
 *    - 동일 월 -> SAME_PERIOD
 *    - 원가 기준일 < 벤치마크 기준일 -> HISTORICAL_COST_VS_CURRENT_VALUE
 *    - 기타 -> OTHER
 */

import type {
  ComparisonEvidenceTier,
  ValueWithProvenance,
  ScenarioValue,
  CostConfidenceTier,
  InvestmentCostStructure59,
  TotalCost59Result,
  BenchmarkProperty,
  RedevelopmentSettlementData,
  RedevelopmentReferenceData,
  ComparisonTiming,
  Standardized59ComparisonModel,
} from '../types/redevelopmentComparison59';

export interface Comparison59Input {
  isUserSimulation?: boolean;
  targetProperty: {
    propertyType: 'RECONSTRUCTION' | 'REDEVELOPMENT' | 'URBAN_PUBLIC_HOUSING_COMPLEX' | 'GENERAL_APARTMENT';
    lineageId?: string;
    complexId?: string;
    displayName: string;
    exclusiveAreaSqm: number;
    supplyAreaSqm: number | null;
    costValuationDate?: string;
  };
  investmentCost: InvestmentCostStructure59;
  settlement?: RedevelopmentSettlementData;
  references?: RedevelopmentReferenceData;
  benchmark: BenchmarkProperty;
  timeline?: {
    durationYearsMonths?: string | null;
    xirr?: number | null | 'NOT_CALCULABLE';
    xirrReason?: string;
  };
}

export class Comparison59Engine {
  /**
   * ScenarioValue에서 활성화된 값을 추출하고 출처 Provenance를 반환
   */
  public static extractActiveSlot<T>(scenario: ScenarioValue<T>): ValueWithProvenance<T> {
    if (scenario.variant === 'SINGLE') {
      return scenario.slot;
    }
    if (scenario.variant === 'RANGE') {
      switch (scenario.activeScenario) {
        case 'LOW':
          return scenario.low;
        case 'HIGH':
          return scenario.high;
        case 'BASE':
        default:
          return scenario.base;
      }
    }
    throw new Error('Invalid scenario variant');
  }

  /**
   * 활성화된 슬롯들의 Tier 목록을 기반으로 CostConfidenceTier 판정
   */
  public static evaluateConfidenceTier(tiers: ComparisonEvidenceTier[]): CostConfidenceTier | 'DATA_NOT_AVAILABLE' {
    if (tiers.includes('DATA_NOT_AVAILABLE')) {
      return 'DATA_NOT_AVAILABLE';
    }
    // 1개라도 REFERENCE 포함 시 REFERENCE_COST
    if (tiers.includes('REFERENCE')) {
      return 'REFERENCE_COST';
    }
    // USER_SCENARIO 포함 시 SCENARIO_COST
    if (tiers.includes('USER_SCENARIO')) {
      return 'SCENARIO_COST';
    }
    // ACTUAL_USER_COST, OFFICIAL_FACT, MARKET_DATA만 있는 경우 VERIFIED_COST
    return 'VERIFIED_COST';
  }

  /**
   * 원가 기준시점과 벤치마크 시장가 기준시점을 비교하여 ComparisonTiming 판정
   */
  public static evaluateComparisonTiming(
    costDate?: string,
    benchmarkValuationDate?: string
  ): { timing: ComparisonTiming; notice?: string } {
    if (!costDate || !benchmarkValuationDate) {
      return { timing: 'OTHER' };
    }

    const costNormalized = costDate.slice(0, 7); // YYYY-MM
    const benchNormalized = benchmarkValuationDate.slice(0, 7);

    if (costNormalized === benchNormalized) {
      return {
        timing: 'SAME_PERIOD',
        notice: `동일 시점(${costNormalized}) 기준 원가 및 시장가 비교입니다.`,
      };
    }

    if (costNormalized < benchNormalized) {
      return {
        timing: 'HISTORICAL_COST_VS_CURRENT_VALUE',
        notice: `과거 투입/확정원가(${costNormalized})와 현재 신축 시장가치(${benchNormalized})를 비교한 지표입니다. 단순 현재 할인율이 아닌 기간 보유에 따른 가치 차이로 해석해야 합니다.`,
      };
    }

    return {
      timing: 'OTHER',
      notice: `원가 시점(${costNormalized})과 비교 시점(${benchNormalized})이 다릅니다.`,
    };
  }

  /**
   * 59㎡ 표준화 비교 모델 산출 메인 함수
   */
  public static calculate(input: Comparison59Input): Standardized59ComparisonModel {
    const { targetProperty, investmentCost, settlement, references, benchmark, timeline, isUserSimulation } = input;

    // 1. 59㎡ 면적 일치 검증 (58.0 ~ 62.0㎡ 외 거부)
    if (benchmark.exclusiveAreaSqm < 58.0 || benchmark.exclusiveAreaSqm > 62.0) {
      throw new Error(
        `[Comparison59Engine] 84㎡ 등 타 면적을 59㎡로 비례 환산할 수 없습니다. (제공된 벤치마크 전용면적: ${benchmark.exclusiveAreaSqm}㎡)`
      );
    }
    if (targetProperty.exclusiveAreaSqm < 58.0 || targetProperty.exclusiveAreaSqm > 62.0) {
      throw new Error(
        `[Comparison59Engine] 대상 주택이 전용 59㎡ 계열이 아닙니다. (대상 전용면적: ${targetProperty.exclusiveAreaSqm}㎡)`
      );
    }

    // 2. 투자 총원가 구성요소 활성값 및 Tier 추출
    const purchaseSlot = this.extractActiveSlot(investmentCost.purchasePriceKrw);
    const contribSlot = this.extractActiveSlot(investmentCost.additionalContributionKrw);
    const taxSlot = this.extractActiveSlot(investmentCost.acquisitionTaxKrw);
    const financeSlot = investmentCost.financingCostKrw
      ? this.extractActiveSlot(investmentCost.financingCostKrw)
      : null;
    const otherSlot = investmentCost.otherExpensesKrw
      ? this.extractActiveSlot(investmentCost.otherExpensesKrw)
      : null;

    const contributingTiers: ComparisonEvidenceTier[] = [
      purchaseSlot.tier as ComparisonEvidenceTier,
      contribSlot.tier as ComparisonEvidenceTier,
      taxSlot.tier as ComparisonEvidenceTier,
    ];
    if (financeSlot) contributingTiers.push(financeSlot.tier as ComparisonEvidenceTier);
    if (otherSlot) contributingTiers.push(otherSlot.tier as ComparisonEvidenceTier);

    // 필수 비용 부재 검사: purchasePrice나 additionalContribution이 null이거나 DATA_NOT_AVAILABLE이면 총원가 산출 불가
    const isPurchaseAvailable = purchaseSlot.value !== null && purchaseSlot.tier !== 'DATA_NOT_AVAILABLE';
    const isContribAvailable = contribSlot.value !== null && contribSlot.tier !== 'DATA_NOT_AVAILABLE';
    const isCalculable = isPurchaseAvailable && isContribAvailable;

    let totalCostTier: CostConfidenceTier | 'DATA_NOT_AVAILABLE';
    let activeTotalCost: number | null = null;
    let totalCostAmountKrw: ScenarioValue<number | null>;

    if (!isCalculable) {
      totalCostTier = 'DATA_NOT_AVAILABLE';
      activeTotalCost = null;
      const reasons: string[] = [];
      if (!isPurchaseAvailable) reasons.push('매입가격(purchasePriceKrw) 미확인');
      if (!isContribAvailable) reasons.push('추가분담금(additionalContributionKrw) 공식 미확인');

      totalCostAmountKrw = {
        variant: 'SINGLE',
        slot: {
          value: null,
          tier: 'DATA_NOT_AVAILABLE',
          rationale: `필수 원가 항목 결측으로 총원가 산출 불가 (${reasons.join(', ')})`,
        },
      };
    } else {
      totalCostTier = this.evaluateConfidenceTier(contributingTiers);

      const activePurchase = purchaseSlot.value as number;
      const activeContrib = contribSlot.value as number;
      const activeTax = taxSlot.value ?? 0;
      const activeFinance = financeSlot?.value ?? 0;
      const activeOther = otherSlot?.value ?? 0;

      activeTotalCost = activePurchase + activeContrib + activeTax + activeFinance + activeOther;

      // Range 생성 필요 여부 확인
      const isAnyRange =
        investmentCost.purchasePriceKrw.variant === 'RANGE' ||
        investmentCost.additionalContributionKrw.variant === 'RANGE' ||
        investmentCost.acquisitionTaxKrw.variant === 'RANGE' ||
        (investmentCost.financingCostKrw && investmentCost.financingCostKrw.variant === 'RANGE') ||
        (investmentCost.otherExpensesKrw && investmentCost.otherExpensesKrw.variant === 'RANGE');

      if (isAnyRange) {
        const getVal = (v: ScenarioValue<number | null> | undefined, slotName: 'low' | 'base' | 'high') => {
          if (!v) return 0;
          if (v.variant === 'SINGLE') return v.slot.value ?? 0;
          return v[slotName].value ?? 0;
        };

        const lowVal =
          getVal(investmentCost.purchasePriceKrw, 'low') +
          getVal(investmentCost.additionalContributionKrw, 'low') +
          getVal(investmentCost.acquisitionTaxKrw, 'low') +
          getVal(investmentCost.financingCostKrw, 'low') +
          getVal(investmentCost.otherExpensesKrw, 'low');

        const baseVal =
          getVal(investmentCost.purchasePriceKrw, 'base') +
          getVal(investmentCost.additionalContributionKrw, 'base') +
          getVal(investmentCost.acquisitionTaxKrw, 'base') +
          getVal(investmentCost.financingCostKrw, 'base') +
          getVal(investmentCost.otherExpensesKrw, 'base');

        const highVal =
          getVal(investmentCost.purchasePriceKrw, 'high') +
          getVal(investmentCost.additionalContributionKrw, 'high') +
          getVal(investmentCost.acquisitionTaxKrw, 'high') +
          getVal(investmentCost.financingCostKrw, 'high') +
          getVal(investmentCost.otherExpensesKrw, 'high');

        totalCostAmountKrw = {
          variant: 'RANGE',
          low: { value: lowVal, tier: totalCostTier, rationale: '보수적/원안 기준 총투입원가' },
          base: { value: baseVal, tier: totalCostTier, rationale: '기준/인가안 총투입원가' },
          high: { value: highVal, tier: totalCostTier, rationale: '증액/최대비용 총투입원가' },
          activeScenario:
            investmentCost.additionalContributionKrw.variant === 'RANGE'
              ? investmentCost.additionalContributionKrw.activeScenario
              : 'BASE',
        };
      } else {
        totalCostAmountKrw = {
          variant: 'SINGLE',
          slot: {
            value: activeTotalCost,
            tier: totalCostTier,
            rationale: '단일 확정 총투입원가',
          },
        };
      }
    }

    const totalCostResult: TotalCost59Result = {
      tier: totalCostTier,
      amountKrw: totalCostAmountKrw,
      activeAmountKrw: activeTotalCost,
      isCalculable,
      unavailabilityReason: !isCalculable ? '필수 원가 항목 부재로 총원가 산출 불가' : undefined,
      contributingTiers,
    };

    // 3. 면적 및 평당가 산출 (면적 규칙 엄격 준수)
    // ㎡ = 전용면적 기준
    const totalCostPerExclusiveSqm =
      activeTotalCost !== null && targetProperty.exclusiveAreaSqm > 0
        ? Math.round(activeTotalCost / targetProperty.exclusiveAreaSqm)
        : null;

    // 평 = 공급면적 ÷ 3.305785 기준 (supplyAreaSqm 부재 시 절대 추정 금지 -> DATA_NOT_AVAILABLE)
    const TOTAL_COST_PER_SUPPLY_PYEONG: number | null | 'DATA_NOT_AVAILABLE' =
      activeTotalCost !== null && targetProperty.supplyAreaSqm && targetProperty.supplyAreaSqm > 0
        ? Math.round(activeTotalCost / (targetProperty.supplyAreaSqm / 3.305785))
        : 'DATA_NOT_AVAILABLE';

    // 4. Benchmark 지표 산출
    const benchmarkPricePerExclusiveSqm = Math.round(
      benchmark.marketPriceKrw / benchmark.exclusiveAreaSqm
    );

    const MARKET_PRICE_PER_SUPPLY_PYEONG: number | null | 'DATA_NOT_AVAILABLE' =
      benchmark.supplyAreaSqm && benchmark.supplyAreaSqm > 0
        ? Math.round(benchmark.marketPriceKrw / (benchmark.supplyAreaSqm / 3.305785))
        : 'DATA_NOT_AVAILABLE';

    // 5. 상대 비교 KPI
    const costRatio59Pct =
      activeTotalCost !== null && benchmark.marketPriceKrw > 0
        ? Number(((activeTotalCost / benchmark.marketPriceKrw) * 100).toFixed(2))
        : null;

    const discountRate59Pct =
      activeTotalCost !== null && benchmark.marketPriceKrw > 0
        ? Number((((benchmark.marketPriceKrw - activeTotalCost) / benchmark.marketPriceKrw) * 100).toFixed(2))
        : null;

    const valueDelta59Krw =
      activeTotalCost !== null ? benchmark.marketPriceKrw - activeTotalCost : null;

    // 6. Timing 판정
    const { timing, notice } = this.evaluateComparisonTiming(
      targetProperty.costValuationDate,
      benchmark.valuationDate
    );

    return {
      schemaVersion: 1,
      isUserSimulation: Boolean(isUserSimulation),
      targetProperty,
      comparisonTiming: timing,
      timingNotice: notice,
      settlement,
      references,
      investmentCost,
      totalCost59: totalCostResult,
      benchmark,
      kpis: {
        totalCostPerExclusiveSqm,
        TOTAL_COST_PER_SUPPLY_PYEONG,
        benchmarkPricePerExclusiveSqm,
        MARKET_PRICE_PER_SUPPLY_PYEONG,
        costRatio59Pct,
        discountRate59Pct,
        valueDelta59Krw,
      },
      timeline: {
        durationYearsMonths: timeline?.durationYearsMonths ?? null,
        xirr: timeline?.xirr ?? 'NOT_CALCULABLE',
        xirrReason: timeline?.xirrReason ?? '현금흐름 일자(Cashflow Schedule) 데이터 부재로 XIRR 산출 불가',
      },
    };
  }
}

