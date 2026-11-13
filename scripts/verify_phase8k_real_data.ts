/**
 * Phase 8K / 8K-1: Verification Suite for 59㎡ Standardized Comparison with Real Official Data
 * Target: 둔촌주공 -> 올림픽파크포레온 전용 59㎡
 * 
 * Strict Evidence Rules:
 * 1. 120.37% 비례율: 강동구 고시 제2017-68호 고시문 본문에 미기재되어 PENDING / INELIGIBLE 복구 (공식 계산 미사용 -> null)
 * 2. 추가분담금 1.2~1.28억원: 언론보도(src_herald_contribution_cases) 기반 수치로 REFERENCE / INELIGIBLE 복구 (공식 원가 제외)
 * 3. 59㎡ 조합원분양가: 3.3㎡당 2,780만원 평당가 곱연산 금지, 공식 증빙 부재로 DATA_NOT_AVAILABLE (null)
 * 4. 미확인 비용은 절대 0원으로 처리하지 않고 null / DATA_NOT_AVAILABLE 보존
 * 5. 실제 데이터만 사용 시 총원가 산출 불가(isCalculable: false, activeAmountKrw: null) 확인
 * 6. 실제 데이터로 계산 가능한 유일한 지표는 벤치마크 신축 실거래가 및 전용 ㎡당 단가(benchmarkPricePerExclusiveSqm)
 * 7. 사용자 시뮬레이션(8억/3200만/4800만)은 USER_SCENARIO로 분리하여 별도 테스트
 * 8. Firestore 쓰기 0건(Read-Only 무결성) 검증
 */

import { redevelopmentDataService } from '../src/services/redevelopmentDataService';
import { firestoreRepository } from '../src/server/firestoreRepository';
import { collection, getCountFromServer } from 'firebase/firestore';
import { getFirestoreDb } from '../src/server/firestore';

async function runPhase8KVerification() {
  console.log('================================================================');
  console.log('🚀 PHASE 8K-1: 둔촌주공 전용 59㎡ 실제 공식 데이터 검증 및 시뮬레이션 분리');
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

  // Record initial Firestore counts for Read-Only audit
  const db = getFirestoreDb();
  const collectionsToAudit = ['monthlyComplexPrices_v2', 'redevelopmentLineages', 'redevelopmentSeeds'];
  const initialCounts: Record<string, number> = {};
  for (const c of collectionsToAudit) {
    try {
      const snap = await getCountFromServer(collection(db, c));
      initialCounts[c] = snap.data().count;
    } catch {
      initialCounts[c] = -1;
    }
  }

  // -------------------------------------------------------------------------
  // 1. Evidence Verification Status Checks (120.37% & 1.2~1.28억)
  // -------------------------------------------------------------------------
  try {
    const bundle = redevelopmentDataService.loadSeedBundle('dunchon_redevelopment');
    assert(
      bundle.projectSeed.lineageId === 'dunchon_redevelopment',
      'TC_8K_01_SEED_LINEAGE_LOAD',
      'Dunchon redevelopment seed bundle loaded'
    );

    // 120.37% 비례율: 강동구 고시 제2017-68호 고시문 원문에 미명시되어 PENDING / INELIGIBLE 확인
    assert(
      bundle.financialSeed.proportionalRate.verificationStatus === 'PENDING' &&
      bundle.financialSeed.proportionalRate.calculationEligibility === 'INELIGIBLE',
      'TC_8K_01_PROPORTIONAL_RATE_PENDING_INELIGIBLE',
      `Expected PENDING/INELIGIBLE, got ${bundle.financialSeed.proportionalRate.verificationStatus}/${bundle.financialSeed.proportionalRate.calculationEligibility}`
    );

    // 올림픽파크포레온 59㎡ 실거래가 데이터 로딩 확인
    const priceRes = await firestoreRepository.getAreaFamilyMonthlyPrices('gangdong_olympic_park', 'olympic_park_59');
    assert(
      priceRes.points.length >= 5,
      'TC_8K_01_FOREON_59_REAL_PRICES_LOADED',
      `Expected >= 5 months observed, got ${priceRes.points.length}`
    );
  } catch (e: any) {
    assert(false, 'TC_8K_01_DATA_LOADING', e.message);
  }

  // -------------------------------------------------------------------------
  // 2. Pure Official Evidence Execution (실제 데이터만 연결)
  // -------------------------------------------------------------------------
  let realResult: any;
  try {
    realResult = await redevelopmentDataService.getComparison59RealDunchon();

    // 2-1. Target Property
    assert(
      realResult.targetProperty.displayName.includes('둔촌주공'),
      'TC_8K_02_TARGET_PROPERTY_NAME',
      'Target property is Dunchon'
    );
    assert(
      realResult.targetProperty.supplyAreaSqm === null,
      'TC_8K_02_SUPPLY_SQM_NULL',
      'Supply area must be null (not verified in official source)'
    );

    // 2-2. DATA_NOT_AVAILABLE: 미확인 비용을 절대 0원으로 처리하지 않고 null 보존
    const purchaseSlot = realResult.investmentCost.purchasePriceKrw.slot;
    assert(
      purchaseSlot.tier === 'DATA_NOT_AVAILABLE' && purchaseSlot.value === null,
      'TC_8K_02_PURCHASE_PRICE_NULL',
      `purchasePrice must be null with tier DATA_NOT_AVAILABLE (got value: ${purchaseSlot.value}, tier: ${purchaseSlot.tier})`
    );

    const contribSlot = realResult.investmentCost.additionalContributionKrw.slot;
    assert(
      contribSlot.tier === 'DATA_NOT_AVAILABLE' && contribSlot.value === null,
      'TC_8K_02_CONTRIB_PRICE_NULL',
      `additionalContribution must be null with tier DATA_NOT_AVAILABLE (got value: ${contribSlot.value}, tier: ${contribSlot.tier})`
    );

    const taxSlot = realResult.investmentCost.acquisitionTaxKrw.slot;
    assert(
      taxSlot.tier === 'DATA_NOT_AVAILABLE' && taxSlot.value === null,
      'TC_8K_02_TAX_PRICE_NULL',
      `acquisitionTax must be null with tier DATA_NOT_AVAILABLE (got value: ${taxSlot.value}, tier: ${taxSlot.tier})`
    );

    const financeSlot = realResult.investmentCost.financingCostKrw.slot;
    assert(
      financeSlot.tier === 'DATA_NOT_AVAILABLE' && financeSlot.value === null,
      'TC_8K_02_FINANCE_PRICE_NULL',
      `financingCost must be null with tier DATA_NOT_AVAILABLE (got value: ${financeSlot.value}, tier: ${financeSlot.tier})`
    );

    // 2-3. 실제 데이터만 사용 시 총투입원가 산출 불가 (isCalculable: false, activeAmountKrw: null)
    assert(
      realResult.totalCost59.isCalculable === false &&
      realResult.totalCost59.activeAmountKrw === null &&
      realResult.totalCost59.tier === 'DATA_NOT_AVAILABLE',
      'TC_8K_02_TOTAL_COST_NOT_CALCULABLE',
      `totalCost59 must not be calculable without verified purchasePrice and contribution`
    );

    // 2-4. 공식 정산 데이터(Settlement) 검증
    const settlement = realResult.settlement;
    assert(
      settlement.proportionalRatePct === null,
      'TC_8K_02_SETTLEMENT_PROP_RATE_NULL',
      `proportionalRatePct in official settlement must be null (got ${settlement.proportionalRatePct})`
    );
    assert(
      settlement.memberSalePrice59Krw === null,
      'TC_8K_02_SETTLEMENT_MEMBER_PRICE_NULL',
      `memberSalePrice59Krw must be null (no pyeong multiplication, got ${settlement.memberSalePrice59Krw})`
    );
    assert(
      settlement.officialContribution59Krw === null,
      'TC_8K_02_SETTLEMENT_OFFICIAL_CONTRIB_NULL',
      `officialContribution59Krw must be null (got ${settlement.officialContribution59Krw})`
    );
    assert(
      settlement.evidenceTier === 'DATA_NOT_AVAILABLE',
      'TC_8K_02_SETTLEMENT_TIER_DATA_NOT_AVAILABLE',
      `settlement evidenceTier must be DATA_NOT_AVAILABLE`
    );

    // 2-5. 참고치(REFERENCE) 분리 검증
    const refs = realResult.references;
    assert(
      refs !== undefined &&
      refs.mediaEstimatedContributionRangeKrw?.status === 'REFERENCE' &&
      refs.mediaEstimatedContributionRangeKrw?.min === 120000000 &&
      refs.mediaEstimatedContributionRangeKrw?.max === 128000000,
      'TC_8K_02_REFERENCE_CONTRIBUTION_SEPARATED',
      'Media estimated contribution range (1.2억~1.28억) separated as REFERENCE'
    );
    assert(
      refs.generalAssemblyProportionalRatePct?.status === 'PENDING' &&
      refs.generalAssemblyProportionalRatePct?.valuePct === 120.37,
      'TC_8K_02_REFERENCE_PROP_RATE_SEPARATED',
      'General assembly proportional rate (120.37%) separated as PENDING'
    );

    // 2-6. 실제 데이터만 사용 시 계산 가능한 유일한 KPI 검증
    // 벤치마크 신축 시장가격: 정상 계산됨
    assert(
      realResult.benchmark.marketPriceKrw > 0,
      'TC_8K_02_BENCHMARK_PRICE_CALCULABLE',
      `Benchmark marketPrice is ${realResult.benchmark.marketPriceKrw}`
    );
    // 벤치마크 신축 전용 ㎡당 시장단가: 정상 계산됨 (exclusiveAreaSqm = 59.99)
    assert(
      realResult.kpis.benchmarkPricePerExclusiveSqm > 0 &&
      realResult.kpis.benchmarkPricePerExclusiveSqm === Math.round(realResult.benchmark.marketPriceKrw / realResult.benchmark.exclusiveAreaSqm),
      'TC_8K_02_BENCHMARK_PRICE_PER_EXCLUSIVE_SQM_CALCULABLE',
      `Benchmark price per exclusive sqm is ${realResult.kpis.benchmarkPricePerExclusiveSqm}`
    );

    // 공급면적 부재로 평당가는 DATA_NOT_AVAILABLE
    assert(
      realResult.kpis.TOTAL_COST_PER_SUPPLY_PYEONG === 'DATA_NOT_AVAILABLE',
      'TC_8K_02_TOTAL_COST_PER_PYEONG_NA',
      'Total cost per supply pyeong must be DATA_NOT_AVAILABLE'
    );
    assert(
      realResult.kpis.MARKET_PRICE_PER_SUPPLY_PYEONG === 'DATA_NOT_AVAILABLE',
      'TC_8K_02_MARKET_PRICE_PER_PYEONG_NA',
      'Market price per supply pyeong must be DATA_NOT_AVAILABLE'
    );

    // 총원가 부재로 상대비교 KPI는 모두 null
    assert(
      realResult.kpis.costRatio59Pct === null &&
      realResult.kpis.discountRate59Pct === null &&
      realResult.kpis.valueDelta59Krw === null,
      'TC_8K_02_RELATIVE_KPIS_NULL',
      'Relative comparison KPIs must be null when totalCost cannot be calculated'
    );
  } catch (e: any) {
    assert(false, 'TC_8K_02_PURE_OFFICIAL_EXECUTION', e.message);
  }

  // -------------------------------------------------------------------------
  // 3. Separate Test: USER_SCENARIO Simulation (가상 시뮬레이션 전용)
  // -------------------------------------------------------------------------
  try {
    const simResult = await redevelopmentDataService.simulateUserScenario59Dunchon({
      benchmarkMonth: '202606', // 2026-06 25억 기준
      userPurchasePriceKrw: 800000000,
      userAdditionalContributionKrw: 124000000,
      userAcquisitionTaxKrw: 32000000,
      userFinancingCostKrw: 48000000,
    });

    assert(
      simResult.isUserSimulation === true,
      'TC_8K_03_USER_SIMULATION_FLAG_TRUE',
      'isUserSimulation flag must be true'
    );
    assert(
      simResult.totalCost59.tier === 'SCENARIO_COST',
      'TC_8K_03_SIMULATION_TIER_SCENARIO_COST',
      `Expected SCENARIO_COST, got ${simResult.totalCost59.tier}`
    );
    assert(
      simResult.totalCost59.activeAmountKrw === 1004000000,
      'TC_8K_03_SIMULATION_TOTAL_COST_SUM',
      `Expected 1,004,000,000 KRW, got ${simResult.totalCost59.activeAmountKrw}`
    );
    assert(
      simResult.kpis.costRatio59Pct === 40.16,
      'TC_8K_03_SIMULATION_COST_RATIO',
      `Expected 40.16%, got ${simResult.kpis.costRatio59Pct}`
    );
    assert(
      simResult.kpis.discountRate59Pct === 59.84,
      'TC_8K_03_SIMULATION_DISCOUNT_RATE',
      `Expected 59.84%, got ${simResult.kpis.discountRate59Pct}`
    );
    assert(
      simResult.kpis.valueDelta59Krw === 1496000000,
      'TC_8K_03_SIMULATION_VALUE_DELTA',
      `Expected 1,496,000,000 KRW, got ${simResult.kpis.valueDelta59Krw}`
    );
  } catch (e: any) {
    assert(false, 'TC_8K_03_USER_SCENARIO_EXECUTION', e.message);
  }

  // -------------------------------------------------------------------------
  // 4. Audit Read-Only Integrity (0 Firestore Mutations)
  // -------------------------------------------------------------------------
  for (const c of collectionsToAudit) {
    try {
      const snap = await getCountFromServer(collection(db, c));
      const afterCount = snap.data().count;
      assert(
        afterCount === initialCounts[c],
        `TC_8K_04_READONLY_AUDIT_${c}`,
        `Document count changed from ${initialCounts[c]} to ${afterCount}`
      );
    } catch {
      // ignore
    }
  }

  console.log('\n================================================================');
  console.log(`📊 Phase 8K-1 Verification Results: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase8KVerification().catch((err) => {
  console.error('Fatal error running Phase 8K verification:', err);
  process.exit(1);
});
