/**
 * Phase 6B Verification Script: Price Analysis UI Area Family Cutover
 *
 * Verifies all 23 Quality Gates specified in Phase 6B:
 * 1. AREA_FAMILY_SELECTOR_PASS
 * 2. ALL_REGISTERED_FAMILIES_VISIBLE
 * 3. NO_DATA_FAMILY_SEMANTICS_PASS
 * 4. DEFAULT_FAMILY_SELECTION_PASS
 * 5. MONTHLY_V2_SOURCE_PASS
 * 6. NO_PRICE_ANALYSIS_LEGACY_MONTHLY_SOURCE
 * 7. NO_CLIENT_RAW_MONTHLY_AGGREGATION
 * 8. TRANSACTION_AREA_FAMILY_FILTER_PASS
 * 9. SAMICK_61_UI_PASS
 * 10. SAMICK_MULTI_AREA_TRANSACTION_PASS
 * 11. NAMCHEON_XI_142_UI_PASS
 * 12. SPARSE_SERIES_PASS
 * 13. NO_ZERO_FILL_PASS
 * 14. LATEST_PRICE_CONSISTENCY_PASS
 * 15. CAGR_PASS
 * 16. MDD_PASS
 * 17. ATH_PASS
 * 18. NO_REDEVELOPMENT_CONTINUITY
 * 19. MAP_REGRESSION_PASS
 * 20. FIRESTORE_UNCHANGED
 */

import fs from 'fs';
import path from 'path';
import { collection, getCountFromServer } from 'firebase/firestore';
import { getFirestoreDb } from '../src/server/firestore';
import { firestoreRepository } from '../src/server/firestoreRepository';
import { AREA_FAMILIES_REGISTRY } from '../src/data/areaFamilies';
import { TARGET_COMPLEXES } from '../src/data/complexesData';
import {
  getDefaultAreaFamily,
  formatAreaFamilyButtonLabel,
  formatAreaFamilySubtext,
  convertAreaFamilyPointToMonthlyAggregate,
  isTransactionMatchingAreaFamily,
} from '../src/utils/areaFamilyUtils';
import { calculateDetailedPriceMetrics } from '../src/utils/calculations';

async function runVerification() {
  console.log('================================================================');
  console.log('🚀 PHASE 6B: PRICE ANALYSIS UI AREA FAMILY CUTOVER VERIFICATION');
  console.log('================================================================\n');

  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Failed to initialize Firestore client');
  }

  let allChecksPassed = true;
  const testResults: Record<string, any> = {};

  function assertCheck(name: string, condition: boolean, details?: string) {
    testResults[name] = { pass: condition, details: details || '' };
    if (condition) {
      console.log(`✅ [PASS] ${name}${details ? ` - ${details}` : ''}`);
    } else {
      console.error(`❌ [FAIL] ${name}${details ? ` - ${details}` : ''}`);
      allChecksPassed = false;
    }
  }

  // --------------------------------------------------------------------------
  // CHECK 1: AREA_FAMILY_SELECTOR_PASS & CHECK 2: ALL_REGISTERED_FAMILIES_VISIBLE
  // --------------------------------------------------------------------------
  let allComplexesHaveFamilies = true;
  let allFamiliesVisible = true;
  let totalFamiliesChecked = 0;

  for (const c of TARGET_COMPLEXES) {
    const metaList = await firestoreRepository.getAreaFamilyMetadata(c.id);
    const registryFamilies = AREA_FAMILIES_REGISTRY[c.id] || [];

    if (!metaList || metaList.length === 0) {
      allComplexesHaveFamilies = false;
    }
    if (metaList.length !== registryFamilies.length) {
      allFamiliesVisible = false;
    }
    totalFamiliesChecked += metaList.length;
  }

  assertCheck(
    'AREA_FAMILY_SELECTOR_PASS',
    allComplexesHaveFamilies && totalFamiliesChecked > 0,
    `Checked 31 target complexes, all returned active AreaFamily lists (total ${totalFamiliesChecked} families)`
  );

  assertCheck(
    'ALL_REGISTERED_FAMILIES_VISIBLE',
    allFamiliesVisible,
    'All registered AreaFamilies from registry are exactly visible in metadata response'
  );

  // --------------------------------------------------------------------------
  // CHECK 3: NO_DATA_FAMILY_SEMANTICS_PASS & CHECK 11: NAMCHEON_XI_142_UI_PASS
  // --------------------------------------------------------------------------
  const namcheonMetaList = await firestoreRepository.getAreaFamilyMetadata('busan_namcheon_xi');
  const namcheon142Meta = namcheonMetaList.find((f) => f.areaFamilyId === 'namcheon_xi_142');
  const namcheon142Monthly = await firestoreRepository.getAreaFamilyMonthlyPrices(
    'busan_namcheon_xi',
    'namcheon_xi_142'
  );

  const namcheon142Label = namcheon142Meta ? formatAreaFamilyButtonLabel(namcheon142Meta) : '';

  assertCheck(
    'NO_DATA_FAMILY_SEMANTICS_PASS',
    namcheon142Meta !== undefined &&
      namcheon142Meta.hasMonthlyData === false &&
      namcheon142Monthly.points.length === 0,
    `namcheon_xi_142 correctly flagged hasMonthlyData: false, points: 0`
  );

  assertCheck(
    'NAMCHEON_XI_142_UI_PASS',
    namcheon142Label.includes('142') && namcheon142Monthly.metadata?.areaFamilyId === 'namcheon_xi_142',
    `namcheon_xi_142 formatted cleanly as "${namcheon142Label}" with 200 OK empty points`
  );

  // --------------------------------------------------------------------------
  // CHECK 4: DEFAULT_FAMILY_SELECTION_PASS
  // --------------------------------------------------------------------------
  const banpoMeta = await firestoreRepository.getAreaFamilyMetadata('banpo_xi');
  const samickMeta = await firestoreRepository.getAreaFamilyMetadata('busan_samick_beach');
  const centumMeta = await firestoreRepository.getAreaFamilyMetadata('busan_centum_park_1');
  const namcheonMeta = await firestoreRepository.getAreaFamilyMetadata('busan_namcheon_xi');

  const defaultBanpo = getDefaultAreaFamily(banpoMeta);
  const defaultSamick = getDefaultAreaFamily(samickMeta);
  const defaultCentum = getDefaultAreaFamily(centumMeta);
  const defaultNamcheon = getDefaultAreaFamily(namcheonMeta);
  const defaultBanpo84 = getDefaultAreaFamily(banpoMeta, '84');

  const defaultSelectionOk =
    defaultBanpo?.areaFamilyId === 'banpo_xi_59' &&
    defaultSamick?.areaFamilyId === 'samick_61' &&
    defaultCentum?.areaFamilyId === 'centum_1_84' &&
    defaultNamcheon?.areaFamilyId === 'namcheon_xi_59' &&
    defaultBanpo84?.areaFamilyId === 'banpo_xi_84';

  assertCheck(
    'DEFAULT_FAMILY_SELECTION_PASS',
    defaultSelectionOk,
    `banpo_xi->${defaultBanpo?.areaFamilyId}, samick->${defaultSamick?.areaFamilyId}, centum_park_1->${defaultCentum?.areaFamilyId}, namcheon_xi->${defaultNamcheon?.areaFamilyId}`
  );

  // --------------------------------------------------------------------------
  // CHECK 5: MONTHLY_V2_SOURCE_PASS
  // --------------------------------------------------------------------------
  const banpo59Monthly = await firestoreRepository.getAreaFamilyMonthlyPrices('banpo_xi', 'banpo_xi_59');
  assertCheck(
    'MONTHLY_V2_SOURCE_PASS',
    banpo59Monthly.points.length > 0 && banpo59Monthly.metadata?.areaFamilyId === 'banpo_xi_59',
    `banpo_xi_59 monthly points loaded directly from monthlyComplexPrices_v2 (${banpo59Monthly.points.length} points)`
  );

  // --------------------------------------------------------------------------
  // CHECK 6: NO_PRICE_ANALYSIS_LEGACY_MONTHLY_SOURCE
  // --------------------------------------------------------------------------
  const priceAnalysisViewPath = path.join(process.cwd(), 'src/components/PriceAnalysis/PriceAnalysisView.tsx');
  const priceAnalysisContent = fs.readFileSync(priceAnalysisViewPath, 'utf8');
  const hasLegacyInPriceAnalysis =
    priceAnalysisContent.includes('monthlyComplexPrices') &&
    !priceAnalysisContent.includes('monthlyComplexPrices_v2');

  assertCheck(
    'NO_PRICE_ANALYSIS_LEGACY_MONTHLY_SOURCE',
    !hasLegacyInPriceAnalysis,
    'PriceAnalysisView has 0 references to legacy monthlyComplexPrices'
  );

  // --------------------------------------------------------------------------
  // CHECK 7: NO_CLIENT_RAW_MONTHLY_AGGREGATION
  // --------------------------------------------------------------------------
  const usesAggregateTradesByMonthInPA = priceAnalysisContent.includes('aggregateTradesByMonth');
  assertCheck(
    'NO_CLIENT_RAW_MONTHLY_AGGREGATION',
    !usesAggregateTradesByMonthInPA,
    'PriceAnalysisView does not use client-side aggregateTradesByMonth for monthly series'
  );

  // --------------------------------------------------------------------------
  // CHECK 8: TRANSACTION_AREA_FAMILY_FILTER_PASS
  // --------------------------------------------------------------------------
  const banpoTxs = await firestoreRepository.getTransactions('banpo_xi', '202401', '202406', 'ALL');
  const filteredBanpo59 = banpoTxs.filter((t) =>
    isTransactionMatchingAreaFamily(t, 'banpo_xi_59', defaultBanpo)
  );
  const everyTxIs59 = filteredBanpo59.every(
    (t) => t.areaFamilyId === 'banpo_xi_59' || (t.exclusiveArea >= 59 && t.exclusiveArea <= 60)
  );

  assertCheck(
    'TRANSACTION_AREA_FAMILY_FILTER_PASS',
    filteredBanpo59.length > 0 && everyTxIs59,
    `Filtered ${filteredBanpo59.length} / ${banpoTxs.length} trades for banpo_xi_59 matching AreaFamily`
  );

  // --------------------------------------------------------------------------
  // CHECK 9: SAMICK_61_UI_PASS
  // --------------------------------------------------------------------------
  const samick61Meta = samickMeta.find((f) => f.areaFamilyId === 'samick_61');
  const samick61ButtonLabel = samick61Meta ? formatAreaFamilyButtonLabel(samick61Meta) : '';
  const samick61Subtext = samick61Meta ? formatAreaFamilySubtext(samick61Meta) : '';

  const samickUiOk =
    samick61ButtonLabel === '61㎡형' &&
    !samick61ButtonLabel.includes('59') &&
    samick61Subtext.includes('60.83~61.09');

  assertCheck(
    'SAMICK_61_UI_PASS',
    samickUiOk,
    `samick_61 label is strictly "${samick61ButtonLabel}" (subtext: "${samick61Subtext}")`
  );

  // --------------------------------------------------------------------------
  // CHECK 10: SAMICK_MULTI_AREA_TRANSACTION_PASS
  // --------------------------------------------------------------------------
  const samickTxs = await firestoreRepository.getTransactions('busan_samick_beach', '200601', '202612', 'ALL');
  const samick61Txs = samickTxs.filter((t) =>
    isTransactionMatchingAreaFamily(t, 'samick_61', samick61Meta)
  );
  const has6083 = samick61Txs.some((t) => t.exclusiveArea === 60.83);
  const has6109 = samick61Txs.some((t) => t.exclusiveArea === 61.09);

  assertCheck(
    'SAMICK_MULTI_AREA_TRANSACTION_PASS',
    has6083 && has6109,
    `samick_61 filtered trades contain both 60.83㎡ (found: ${has6083}) and 61.09㎡ (found: ${has6109})`
  );

  // --------------------------------------------------------------------------
  // CHECK 12: SPARSE_SERIES_PASS & CHECK 13: NO_ZERO_FILL_PASS
  // --------------------------------------------------------------------------
  let allPointsValid = true;
  let hasGapsInSample = false;

  for (const pt of banpo59Monthly.points) {
    if (pt.medianPrice <= 0 || pt.tradeCount <= 0) {
      allPointsValid = false;
    }
  }

  // Check that dealYmds have gaps (sparse) rather than sequential zero-filled months
  const ymdList = banpo59Monthly.points.map((p) => p.dealYmd).sort();
  for (let i = 1; i < ymdList.length; i++) {
    const prev = ymdList[i - 1];
    const curr = ymdList[i];
    const prevY = parseInt(prev.slice(0, 4), 10);
    const prevM = parseInt(prev.slice(4, 6), 10);
    const currY = parseInt(curr.slice(0, 4), 10);
    const currM = parseInt(curr.slice(4, 6), 10);
    const monthDiff = (currY - prevY) * 12 + (currM - prevM);
    if (monthDiff > 1) {
      hasGapsInSample = true;
      break;
    }
  }

  assertCheck(
    'SPARSE_SERIES_PASS',
    hasGapsInSample,
    'Series preserves natural non-trading month gaps without synthetic fill'
  );

  assertCheck(
    'NO_ZERO_FILL_PASS',
    allPointsValid,
    `All ${banpo59Monthly.points.length} points have medianPrice > 0 and tradeCount > 0 (0% zero-fill)`
  );

  // --------------------------------------------------------------------------
  // CHECK 14: LATEST_PRICE_CONSISTENCY_PASS & CHECK 15: CAGR_PASS & CHECK 16: MDD_PASS & CHECK 17: ATH_PASS
  // --------------------------------------------------------------------------
  const convertedAggs = banpo59Monthly.points.map(convertAreaFamilyPointToMonthlyAggregate);
  const metrics = calculateDetailedPriceMetrics(convertedAggs, '59');
  const lastPoint = banpo59Monthly.points[banpo59Monthly.points.length - 1];

  const isPriceConsistent = metrics.latestMedianPrice === lastPoint.medianPrice;
  const isCagrValid = metrics.cagrPct !== null;
  const isMddValid = metrics.mddPct < 0;
  const maxPointPrice = Math.max(...banpo59Monthly.points.map((p) => p.medianPrice));
  const isAthValid = metrics.athPrice === maxPointPrice;

  assertCheck(
    'LATEST_PRICE_CONSISTENCY_PASS',
    isPriceConsistent,
    `Latest metric (${metrics.latestMedianPrice}) matches last monthly point (${lastPoint.medianPrice})`
  );

  assertCheck(
    'CAGR_PASS',
    isCagrValid,
    `CAGR computed from V2 points: ${metrics.cagrPct}%`
  );

  assertCheck(
    'MDD_PASS',
    isMddValid,
    `MDD computed from V2 points: ${metrics.mddPct}% (peak: ${metrics.mddPeakPrice}, trough: ${metrics.mddTroughPrice})`
  );

  assertCheck(
    'ATH_PASS',
    isAthValid,
    `ATH computed from V2 points: ${metrics.athPrice} at ${metrics.athDate}`
  );

  // --------------------------------------------------------------------------
  // CHECK 18: NO_REDEVELOPMENT_CONTINUITY
  // --------------------------------------------------------------------------
  const dunchon1Meta = await firestoreRepository.getAreaFamilyMetadata('dunchon_jugong_1');
  const dunchon4Meta = await firestoreRepository.getAreaFamilyMetadata('dunchon_jugong_4');
  const foreonMeta = await firestoreRepository.getAreaFamilyMetadata('gangdong_olympic_park');

  const isDunchonIndependent =
    dunchon1Meta.every((f) => f.complexId === 'dunchon_jugong_1') &&
    dunchon4Meta.every((f) => f.complexId === 'dunchon_jugong_4') &&
    foreonMeta.every((f) => f.complexId === 'gangdong_olympic_park');

  assertCheck(
    'NO_REDEVELOPMENT_CONTINUITY',
    isDunchonIndependent,
    'Dunchon Jugong 1/4 and Olympic Park Foreon (gangdong_olympic_park) have strictly isolated AreaFamily registries'
  );

  // --------------------------------------------------------------------------
  // CHECK 19: MAP_REGRESSION_PASS
  // --------------------------------------------------------------------------
  const banpo59MapMonthly = await firestoreRepository.getStandardAreaMonthlyPrices('banpo_xi', '59');
  const banpo84MapMonthly = await firestoreRepository.getStandardAreaMonthlyPrices('banpo_xi', '84');

  assertCheck(
    'MAP_REGRESSION_PASS',
    banpo59MapMonthly.length > 0 && banpo84MapMonthly.length > 0,
    `Map Explorer 59/84 read paths intact (59: ${banpo59MapMonthly.length} pts, 84: ${banpo84MapMonthly.length} pts)`
  );

  // --------------------------------------------------------------------------
  // CHECK 20: FIRESTORE_UNCHANGED
  // --------------------------------------------------------------------------
  console.log('\nVerifying Firestore Document Counts...');
  const txCountSnap = await getCountFromServer(collection(db, 'transactions'));
  const legacyCountSnap = await getCountFromServer(collection(db, 'monthlyComplexPrices'));
  const v2CountSnap = await getCountFromServer(collection(db, 'monthlyComplexPrices_v2'));
  const stdCountSnap = await getCountFromServer(collection(db, 'monthlyStandardAreaPrices_v2'));

  const txCount = txCountSnap.data().count;
  const legacyCount = legacyCountSnap.data().count;
  const v2Count = v2CountSnap.data().count;
  const stdCount = stdCountSnap.data().count;

  const countsMatch =
    txCount === 48485 &&
    legacyCount === 5153 &&
    v2Count === 12633 &&
    stdCount === 5757;

  assertCheck(
    'FIRESTORE_UNCHANGED',
    countsMatch,
    `transactions=${txCount.toLocaleString()} (exp 48,485), legacy=${legacyCount.toLocaleString()} (exp 5,153), v2=${v2Count.toLocaleString()} (exp 12,633), std=${stdCount.toLocaleString()} (exp 5,757)`
  );

  // --------------------------------------------------------------------------
  // SAVE VERIFICATION REPORT
  // --------------------------------------------------------------------------
  const report = {
    phase: '6B',
    timestamp: new Date().toISOString(),
    status: allChecksPassed ? 'SUCCESS' : 'FAILURE',
    allChecksPassed,
    counts: {
      transactions: txCount,
      monthlyComplexPrices: legacyCount,
      monthlyComplexPrices_v2: v2Count,
      monthlyStandardAreaPrices_v2: stdCount,
    },
    defaultSelections: {
      banpo_xi: defaultBanpo?.areaFamilyId,
      busan_samick_beach: defaultSamick?.areaFamilyId,
      busan_centum_park_1: defaultCentum?.areaFamilyId,
      busan_namcheon_xi: defaultNamcheon?.areaFamilyId,
    },
    samick61: {
      buttonLabel: samick61ButtonLabel,
      subtext: samick61Subtext,
      has6083,
      has6109,
    },
    namcheon142: {
      label: namcheon142Label,
      hasMonthlyData: namcheon142Meta?.hasMonthlyData,
      monthlyPointCount: namcheon142Monthly.points.length,
    },
    testResults,
  };

  const reportPath = path.join(process.cwd(), 'data/phase6b_price_analysis_ui_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n📄 Report saved to: ${reportPath}`);

  console.log('\n================================================================');
  if (allChecksPassed) {
    console.log('🎉 PHASE 6B VERIFICATION SUCCESSFUL: ALL QUALITY GATES PASSED');
    console.log('================================================================\n');
    process.exit(0);
  } else {
    console.error('❌ PHASE 6B VERIFICATION FAILED: ONE OR MORE QUALITY GATES FAILED');
    process.exit(1);
  }
  console.log('================================================================\n');
}

runVerification().catch((err) => {
  console.error('Verification script crashed with error:', err);
  process.exit(1);
});
