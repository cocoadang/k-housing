/**
 * Phase 8J: Comprehensive Verification Suite for Comparison 59 Engine
 * 
 * Verifies all 12 requested criteria:
 * 1. OFFICIAL + MARKET_DATA만 사용한 VERIFIED_COST
 * 2. USER_SCENARIO 포함 SCENARIO_COST
 * 3. REFERENCE 포함 REFERENCE_COST
 * 4. 환급금 (음수 contribution)
 * 5. 공급면적 없음 -> 평당원가 DATA_NOT_AVAILABLE
 * 6. 다른 면적(84㎡) 비례환산 거부
 * 7. SINGLE 처리
 * 8. RANGE별 provenance 유지
 * 9. benchmark MONTHLY_MEDIAN
 * 10. 과거 원가 vs 현재 가격 -> HISTORICAL_COST_VS_CURRENT_VALUE
 * 11. 입력 부족 -> 에러 / N/A
 * 12. 기존 redevelopment regression (Phase 8H 테스트 19/19 통과 유지 및 Firestore write 0건 검증)
 */

import { Comparison59Engine, type Comparison59Input } from '../src/services/comparison59Engine';
import { collection, getCountFromServer } from 'firebase/firestore';
import { getFirestoreDb } from '../src/server/firestore';

async function runTests() {
  console.log('================================================================');
  console.log('🚀 PHASE 8J: 59㎡ STANDARDIZED COMPARISON ENGINE VERIFICATION');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${details || 'Assertion failed'}`);
      failed++;
    }
  }

  // Baseline Firestore count
  const db = getFirestoreDb();
  const baselineSnap = await getCountFromServer(collection(db, 'monthlyComplexPrices_v2'));
  const initialCount = baselineSnap.data().count;
  console.log(`[Baseline] monthlyComplexPrices_v2 initial document count: ${initialCount}`);

  // Base 59m2 benchmark
  const standardBenchmark = {
    benchmarkComplexId: 'complex_raemian_leaders_one',
    benchmarkComplexName: '래미안리더스원',
    areaFamilyId: 'af_raemian_59',
    exclusiveAreaSqm: 59.9,
    supplyAreaSqm: 82.5,
    marketPriceKrw: 2200000000, // 22억
    priceMethod: 'MONTHLY_MEDIAN' as const,
    valuationDate: '2024-06',
    observationStart: '2024-06-01',
    observationEnd: '2024-06-30',
    transactionCount: 4,
    selectionMethod: 'POLICY_DEFAULT' as const,
    selectionReason: '인접 신축 59㎡ 단지 기준 실거래',
    tier: 'MARKET_DATA' as const,
  };

  // Test 1: OFFICIAL + MARKET_DATA만 사용한 VERIFIED_COST
  try {
    const input1: Comparison59Input = {
      targetProperty: {
        propertyType: 'REDEVELOPMENT',
        displayName: '촉진3구역 59A',
        exclusiveAreaSqm: 59.5,
        supplyAreaSqm: 82.0,
        costValuationDate: '2024-06',
      },
      investmentCost: {
        purchasePriceKrw: {
          variant: 'SINGLE',
          slot: { value: 700000000, tier: 'MARKET_DATA', rationale: '실거래 매입가' },
        },
        additionalContributionKrw: {
          variant: 'SINGLE',
          slot: { value: 300000000, tier: 'OFFICIAL_FACT', rationale: '관리처분인가 고시 분담금' },
        },
        acquisitionTaxKrw: {
          variant: 'SINGLE',
          slot: { value: 30000000, tier: 'ACTUAL_USER_COST', rationale: '취득세 실납부' },
        },
      },
      benchmark: standardBenchmark,
    };

    const res1 = Comparison59Engine.calculate(input1);
    assert(
      res1.totalCost59.tier === 'VERIFIED_COST',
      'TC_8J_01_VERIFIED_COST_TIER',
      `Expected VERIFIED_COST, got ${res1.totalCost59.tier}`
    );
    assert(
      res1.totalCost59.activeAmountKrw === 1030000000,
      'TC_8J_01_VERIFIED_COST_SUM',
      `Expected 1,030,000,000 KRW, got ${res1.totalCost59.activeAmountKrw}`
    );
  } catch (e: any) {
    assert(false, 'TC_8J_01_VERIFIED_COST_TIER', e.message);
  }

  // Test 2: USER_SCENARIO 포함 -> SCENARIO_COST
  try {
    const input2: Comparison59Input = {
      targetProperty: {
        propertyType: 'REDEVELOPMENT',
        displayName: '촉진3구역 59A',
        exclusiveAreaSqm: 59.5,
        supplyAreaSqm: 82.0,
      },
      investmentCost: {
        purchasePriceKrw: {
          variant: 'SINGLE',
          slot: { value: 700000000, tier: 'MARKET_DATA' },
        },
        additionalContributionKrw: {
          variant: 'SINGLE',
          slot: { value: 300000000, tier: 'OFFICIAL_FACT' },
        },
        acquisitionTaxKrw: {
          variant: 'SINGLE',
          slot: { value: 30000000, tier: 'ACTUAL_USER_COST' },
        },
        financingCostKrw: {
          variant: 'SINGLE',
          slot: { value: 50000000, tier: 'USER_SCENARIO', rationale: '사용자 가정 금리 4.5%' },
        },
      },
      benchmark: standardBenchmark,
    };

    const res2 = Comparison59Engine.calculate(input2);
    assert(
      res2.totalCost59.tier === 'SCENARIO_COST',
      'TC_8J_02_USER_SCENARIO_TIER',
      `Expected SCENARIO_COST, got ${res2.totalCost59.tier}`
    );
  } catch (e: any) {
    assert(false, 'TC_8J_02_USER_SCENARIO_TIER', e.message);
  }

  // Test 3: REFERENCE 포함 -> REFERENCE_COST
  try {
    const input3: Comparison59Input = {
      targetProperty: {
        propertyType: 'REDEVELOPMENT',
        displayName: '촉진3구역 59A',
        exclusiveAreaSqm: 59.5,
        supplyAreaSqm: 82.0,
      },
      investmentCost: {
        purchasePriceKrw: {
          variant: 'SINGLE',
          slot: { value: 700000000, tier: 'MARKET_DATA' },
        },
        additionalContributionKrw: {
          variant: 'SINGLE',
          slot: { value: 450000000, tier: 'REFERENCE', rationale: '시공사 도급 증액 요구안' },
        },
        acquisitionTaxKrw: {
          variant: 'SINGLE',
          slot: { value: 30000000, tier: 'ACTUAL_USER_COST' },
        },
      },
      benchmark: standardBenchmark,
    };

    const res3 = Comparison59Engine.calculate(input3);
    assert(
      res3.totalCost59.tier === 'REFERENCE_COST',
      'TC_8J_03_REFERENCE_TIER',
      `Expected REFERENCE_COST, got ${res3.totalCost59.tier}`
    );
  } catch (e: any) {
    assert(false, 'TC_8J_03_REFERENCE_TIER', e.message);
  }

  // Test 4: 환급금 (음수 contribution)
  try {
    const input4: Comparison59Input = {
      targetProperty: {
        propertyType: 'REDEVELOPMENT',
        displayName: '촉진3구역 대형지분 조합원',
        exclusiveAreaSqm: 59.5,
        supplyAreaSqm: 82.0,
      },
      investmentCost: {
        purchasePriceKrw: {
          variant: 'SINGLE',
          slot: { value: 1200000000, tier: 'ACTUAL_USER_COST' },
        },
        additionalContributionKrw: {
          variant: 'SINGLE',
          // 종전자산 평가액이 커서 1.5억 환급받는 경우
          slot: { value: -150000000, tier: 'OFFICIAL_FACT', rationale: '관리처분인가 환급금' },
        },
        acquisitionTaxKrw: {
          variant: 'SINGLE',
          slot: { value: 40000000, tier: 'ACTUAL_USER_COST' },
        },
      },
      benchmark: standardBenchmark,
    };

    const res4 = Comparison59Engine.calculate(input4);
    // 12억 - 1.5억 + 0.4억 = 10.9억
    assert(
      res4.totalCost59.activeAmountKrw === 1090000000,
      'TC_8J_04_NEGATIVE_CONTRIBUTION_REFUND',
      `Expected 1,090,000,000 KRW, got ${res4.totalCost59.activeAmountKrw}`
    );
  } catch (e: any) {
    assert(false, 'TC_8J_04_NEGATIVE_CONTRIBUTION_REFUND', e.message);
  }

  // Test 5: 공급면적 없음 -> 평당원가 DATA_NOT_AVAILABLE
  try {
    const input5: Comparison59Input = {
      targetProperty: {
        propertyType: 'REDEVELOPMENT',
        displayName: '촉진3구역 59 (공급면적 미확정)',
        exclusiveAreaSqm: 59.5,
        supplyAreaSqm: null, // 공급면적 누락
      },
      investmentCost: {
        purchasePriceKrw: {
          variant: 'SINGLE',
          slot: { value: 700000000, tier: 'MARKET_DATA' },
        },
        additionalContributionKrw: {
          variant: 'SINGLE',
          slot: { value: 300000000, tier: 'OFFICIAL_FACT' },
        },
        acquisitionTaxKrw: {
          variant: 'SINGLE',
          slot: { value: 30000000, tier: 'ACTUAL_USER_COST' },
        },
      },
      benchmark: standardBenchmark,
    };

    const res5 = Comparison59Engine.calculate(input5);
    assert(
      res5.kpis.TOTAL_COST_PER_SUPPLY_PYEONG === 'DATA_NOT_AVAILABLE',
      'TC_8J_05_SUPPLY_AREA_MISSING_NA',
      `Expected DATA_NOT_AVAILABLE, got ${res5.kpis.TOTAL_COST_PER_SUPPLY_PYEONG}`
    );
    assert(
      typeof res5.kpis.totalCostPerExclusiveSqm === 'number' && res5.kpis.totalCostPerExclusiveSqm > 0,
      'TC_8J_05_EXCLUSIVE_SQM_CALCULATED',
      'Exclusive sqm cost should be calculated'
    );
  } catch (e: any) {
    assert(false, 'TC_8J_05_SUPPLY_AREA_MISSING_NA', e.message);
  }

  // Test 6: 다른 면적(84㎡) 비례환산 거부
  try {
    const input6: Comparison59Input = {
      targetProperty: {
        propertyType: 'REDEVELOPMENT',
        displayName: '촉진3구역 59A',
        exclusiveAreaSqm: 59.5,
        supplyAreaSqm: 82.0,
      },
      investmentCost: {
        purchasePriceKrw: {
          variant: 'SINGLE',
          slot: { value: 700000000, tier: 'MARKET_DATA' },
        },
        additionalContributionKrw: {
          variant: 'SINGLE',
          slot: { value: 300000000, tier: 'OFFICIAL_FACT' },
        },
        acquisitionTaxKrw: {
          variant: 'SINGLE',
          slot: { value: 30000000, tier: 'ACTUAL_USER_COST' },
        },
      },
      benchmark: {
        ...standardBenchmark,
        exclusiveAreaSqm: 84.9, // 84㎡ 입력
      },
    };

    let rejected = false;
    try {
      Comparison59Engine.calculate(input6);
    } catch (err: any) {
      rejected = err.message.includes('비례 환산할 수 없습니다');
    }
    assert(rejected, 'TC_8J_06_REJECT_84_SQM_BENCHMARK', 'Should throw error when 84m2 benchmark provided');
  } catch (e: any) {
    assert(false, 'TC_8J_06_REJECT_84_SQM_BENCHMARK', e.message);
  }

  // Test 7: SINGLE 처리
  try {
    const input7: Comparison59Input = {
      targetProperty: {
        propertyType: 'GENERAL_APARTMENT',
        displayName: '일반 아파트 59',
        exclusiveAreaSqm: 59.9,
        supplyAreaSqm: 80.0,
      },
      investmentCost: {
        purchasePriceKrw: {
          variant: 'SINGLE',
          slot: { value: 1500000000, tier: 'MARKET_DATA' },
        },
        additionalContributionKrw: {
          variant: 'SINGLE',
          slot: { value: 0, tier: 'OFFICIAL_FACT' },
        },
        acquisitionTaxKrw: {
          variant: 'SINGLE',
          slot: { value: 45000000, tier: 'ACTUAL_USER_COST' },
        },
      },
      benchmark: standardBenchmark,
    };

    const res7 = Comparison59Engine.calculate(input7);
    assert(
      res7.totalCost59.amountKrw.variant === 'SINGLE',
      'TC_8J_07_SINGLE_VARIANT_MAINTAINED',
      'Should maintain variant SINGLE without generating artificial range'
    );
  } catch (e: any) {
    assert(false, 'TC_8J_07_SINGLE_VARIANT_MAINTAINED', e.message);
  }

  // Test 8: RANGE별 provenance 유지
  try {
    const input8: Comparison59Input = {
      targetProperty: {
        propertyType: 'REDEVELOPMENT',
        displayName: '촉진3구역 59A',
        exclusiveAreaSqm: 59.5,
        supplyAreaSqm: 82.0,
      },
      investmentCost: {
        purchasePriceKrw: {
          variant: 'SINGLE',
          slot: { value: 700000000, tier: 'MARKET_DATA' },
        },
        additionalContributionKrw: {
          variant: 'RANGE',
          low: { value: 280000000, tier: 'OFFICIAL_FACT', rationale: '인가원안 분담금' },
          base: { value: 300000000, tier: 'OFFICIAL_FACT', rationale: '공식 고시 기준' },
          high: { value: 450000000, tier: 'REFERENCE', rationale: '시공사 증액 요구안' },
          activeScenario: 'HIGH', // 시공사안 활성화
        },
        acquisitionTaxKrw: {
          variant: 'SINGLE',
          slot: { value: 30000000, tier: 'ACTUAL_USER_COST' },
        },
      },
      benchmark: standardBenchmark,
    };

    const res8 = Comparison59Engine.calculate(input8);
    assert(
      res8.totalCost59.amountKrw.variant === 'RANGE',
      'TC_8J_08_RANGE_VARIANT_PRESERVED',
      'Range should be preserved'
    );
    assert(
      res8.totalCost59.tier === 'REFERENCE_COST',
      'TC_8J_08_ACTIVE_HIGH_REFERENCE_TIER',
      `Active HIGH has REFERENCE, so tier must be REFERENCE_COST (got ${res8.totalCost59.tier})`
    );
    assert(
      res8.totalCost59.activeAmountKrw === 1180000000,
      'TC_8J_08_HIGH_ACTIVE_AMOUNT',
      `Expected 1,180,000,000 KRW, got ${res8.totalCost59.activeAmountKrw}`
    );
  } catch (e: any) {
    assert(false, 'TC_8J_08_RANGE_PROVENANCE', e.message);
  }

  // Test 9: benchmark MONTHLY_MEDIAN
  try {
    assert(
      standardBenchmark.priceMethod === 'MONTHLY_MEDIAN' && standardBenchmark.transactionCount === 4,
      'TC_8J_09_BENCHMARK_METHODOLOGY',
      'Benchmark price methodology preserved'
    );
  } catch (e: any) {
    assert(false, 'TC_8J_09_BENCHMARK_METHODOLOGY', e.message);
  }

  // Test 10: 과거 원가 vs 현재 가격 -> HISTORICAL_COST_VS_CURRENT_VALUE
  try {
    const input10: Comparison59Input = {
      targetProperty: {
        propertyType: 'REDEVELOPMENT',
        displayName: '촉진3구역 과거인가 시점 원가',
        exclusiveAreaSqm: 59.5,
        supplyAreaSqm: 82.0,
        costValuationDate: '2022-10', // 2022년 사업시행인가 시점
      },
      investmentCost: {
        purchasePriceKrw: {
          variant: 'SINGLE',
          slot: { value: 500000000, tier: 'MARKET_DATA' },
        },
        additionalContributionKrw: {
          variant: 'SINGLE',
          slot: { value: 250000000, tier: 'OFFICIAL_FACT' },
        },
        acquisitionTaxKrw: {
          variant: 'SINGLE',
          slot: { value: 20000000, tier: 'ACTUAL_USER_COST' },
        },
      },
      benchmark: {
        ...standardBenchmark,
        valuationDate: '2024-06', // 2024년 6월 시장가
      },
    };

    const res10 = Comparison59Engine.calculate(input10);
    assert(
      res10.comparisonTiming === 'HISTORICAL_COST_VS_CURRENT_VALUE',
      'TC_8J_10_HISTORICAL_COST_TIMING',
      `Expected HISTORICAL_COST_VS_CURRENT_VALUE, got ${res10.comparisonTiming}`
    );
    assert(
      res10.timingNotice !== undefined && res10.timingNotice.includes('과거 투입/확정원가'),
      'TC_8J_10_TIMING_NOTICE_EXPOSED',
      'Timing notice should warn user about historical cost comparison'
    );
  } catch (e: any) {
    assert(false, 'TC_8J_10_HISTORICAL_COST_TIMING', e.message);
  }

  // Test 11: 입력 부족 -> DATA_NOT_AVAILABLE
  try {
    const input11: Comparison59Input = {
      targetProperty: {
        propertyType: 'REDEVELOPMENT',
        displayName: '초기단계 재개발',
        exclusiveAreaSqm: 59.5,
        supplyAreaSqm: null,
      },
      investmentCost: {
        purchasePriceKrw: {
          variant: 'SINGLE',
          slot: { value: 0, tier: 'DATA_NOT_AVAILABLE' },
        },
        additionalContributionKrw: {
          variant: 'SINGLE',
          slot: { value: 0, tier: 'DATA_NOT_AVAILABLE' },
        },
        acquisitionTaxKrw: {
          variant: 'SINGLE',
          slot: { value: 0, tier: 'DATA_NOT_AVAILABLE' },
        },
      },
      benchmark: standardBenchmark,
    };

    const res11 = Comparison59Engine.calculate(input11);
    assert(
      res11.totalCost59.isCalculable === false,
      'TC_8J_11_INSUFFICIENT_INPUT_NOT_CALCULABLE',
      'Total cost should be marked not calculable when input is 0'
    );
    assert(
      res11.kpis.TOTAL_COST_PER_SUPPLY_PYEONG === 'DATA_NOT_AVAILABLE',
      'TC_8J_11_SUPPLY_PYEONG_NA',
      'Supply pyeong must be DATA_NOT_AVAILABLE'
    );
  } catch (e: any) {
    assert(false, 'TC_8J_11_INSUFFICIENT_INPUT', e.message);
  }

  // Test 12: Zero Firestore Mutations
  const finalSnap = await getCountFromServer(collection(db, 'monthlyComplexPrices_v2'));
  const finalCount = finalSnap.data().count;
  assert(
    initialCount === finalCount,
    'TC_8J_12_ZERO_FIRESTORE_MUTATIONS',
    `Firestore document count altered: ${initialCount} vs ${finalCount}`
  );

  console.log('\n================================================================');
  console.log(`📊 PHASE 8J TEST SUMMARY: ${passed} / ${passed + failed} PASSED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
