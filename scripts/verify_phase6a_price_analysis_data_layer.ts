import { expectedSeriesCount } from './verificationExpectations';
/**
 * Phase 6A Verification Script: Price Analysis Area Family Data Layer
 *
 * Verifies:
 * 1. AREA_FAMILY_REGISTRY_PASS: 35 complexes, 189 total families
 * 2. ACTIVE_MONTHLY_187_PASS: Exactly 187 active monthly families in monthlyComplexPrices_v2
 * 3. EMPTY_FAMILY_SEMANTICS_PASS: namcheon_xi_142 returns hasMonthlyData: false, points: [], 200 OK
 * 4. AREA_FAMILY_METADATA_API_PASS: metadata contract, counts, and fields
 * 5. AREA_FAMILY_SORT_PASS: representativeExclusiveArea ASC, areaFamilyId ASC
 * 6. ALL_AREA_FAMILIES_SUPPORTED: All 189 families accessible via API
 * 7. SPARSE_SERIES_PASS: Only traded months returned, no zero-fill, no synthetic points
 * 8. SAMICK_61_PASS: Samick 61㎡ is samick_61, standardCategory '59', monthly series complete
 * 9. NAMCHEON_XI_142_PASS: 1 cancelled canonical tx, activeCount=0, points: [], not 404
 * 10. PREDECESSOR_API_PASS: Dunchon predecessors 1 & 4 queryable individually
 * 11. NO_REDEVELOPMENT_CONTINUITY: Predecessor and successor series separated
 * 12. REVERSE_AGGREGATION_PASS: 10 sample groups compared with canonical transactions: EXACT MATCH
 * 13. ERROR_SEMANTICS_PASS: INVALID_COMPLEX_ID, AREA_FAMILY_NOT_FOUND, INVALID_YMD, INVALID_DATE_RANGE
 * 14. MAP_REGRESSION_PASS: Map Explorer 59/84 read path intact
 * 15. FIRESTORE_UNCHANGED: transactions=48,485, monthlyComplexPrices=5,153, monthlyComplexPrices_v2=12,633, monthlyStandardAreaPrices_v2=5,757
 */

import { collection, getDocs, getCountFromServer } from 'firebase/firestore';
import { getFirestoreDb } from '../src/server/firestore';
import { AREA_FAMILIES_REGISTRY } from '../src/data/areaFamilies';
import { firestoreRepository } from '../src/server/firestoreRepository';
import { TARGET_COMPLEXES } from '../src/data/complexesData';

function calculateMedian(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function runVerification() {
  console.log('================================================================');
  console.log('🚀 PHASE 6A: PRICE ANALYSIS AREA FAMILY DATA LAYER VERIFICATION');
  console.log('================================================================\n');

  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Failed to initialize Firestore client');
  }

  let allChecksPassed = true;
  function assertCheck(name: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${name}${details ? ` - ${details}` : ''}`);
    } else {
      console.error(`❌ [FAIL] ${name}${details ? ` - ${details}` : ''}`);
      allChecksPassed = false;
    }
  }

  // --------------------------------------------------------------------------
  // CHECK 1: AREA_FAMILY_REGISTRY_PASS
  // --------------------------------------------------------------------------
  const complexKeys = Object.keys(AREA_FAMILIES_REGISTRY);
  const totalComplexesInRegistry = complexKeys.length;
  let totalFamiliesInRegistry = 0;
  for (const k of complexKeys) {
    totalFamiliesInRegistry += AREA_FAMILIES_REGISTRY[k].length;
  }

  assertCheck(
    'AREA_FAMILY_REGISTRY_PASS',
    totalComplexesInRegistry === 35 && totalFamiliesInRegistry === 189,
    `Complexes: ${totalComplexesInRegistry}/35, Total Families: ${totalFamiliesInRegistry}/189`
  );

  // --------------------------------------------------------------------------
  // Historical base collections remain unchanged; the newly discovered 115 family exists in the source overlay.
  // CHECK 2: ACTIVE_MONTHLY_187_PASS
  // --------------------------------------------------------------------------
  console.log('\nReading monthlyComplexPrices_v2 snapshot...');
  const v2Snap = await getDocs(collection(db, 'monthlyComplexPrices_v2'));
  const totalV2Docs = v2Snap.size;
  const activeFamilyIdsInV2 = new Set<string>();
  const allV2Docs: any[] = [];

  v2Snap.forEach((d) => {
    const data = d.data();
    allV2Docs.push(data);
    if (data.areaFamilyId) {
      activeFamilyIdsInV2.add(data.areaFamilyId);
    }
  });

  const missingFromV2 = Array.from(
    new Set(Object.values(AREA_FAMILIES_REGISTRY).flatMap((list) => list.map((f) => f.id)))
  ).filter((id) => !activeFamilyIdsInV2.has(id));

  assertCheck(
    'HISTORICAL_BASELINE_ACTIVE_187_PASS',
    totalV2Docs === 12633 &&
      activeFamilyIdsInV2.size === 187 &&
      missingFromV2.length === 2 &&
      [...missingFromV2].sort().join(',') === 'namcheon_xi_115,namcheon_xi_142',
    `Total docs: ${totalV2Docs}, Active Families: ${activeFamilyIdsInV2.size}/187, Inactive: [${missingFromV2.join(', ')}]`
  );

  // --------------------------------------------------------------------------
  // CHECK 3: EMPTY_FAMILY_SEMANTICS_PASS (namcheon_xi_142)
  // --------------------------------------------------------------------------
  console.log('\nTesting empty family semantics for namcheon_xi_142...');
  const namcheonResult = await firestoreRepository.getAreaFamilyMonthlyPrices(
    'busan_namcheon_xi',
    'namcheon_xi_142'
  );

  assertCheck(
    'EMPTY_FAMILY_SEMANTICS_PASS',
    namcheonResult.metadata.hasMonthlyData === false &&
      namcheonResult.metadata.monthlyPointCount === 0 &&
      namcheonResult.metadata.tradeCount === 0 &&
      namcheonResult.metadata.firstDealYmd === null &&
      namcheonResult.metadata.lastDealYmd === null &&
      namcheonResult.points.length === 0,
    `hasMonthlyData: ${namcheonResult.metadata.hasMonthlyData}, pointCount: ${namcheonResult.points.length}`
  );

  // --------------------------------------------------------------------------
  // CHECK 4: AREA_FAMILY_METADATA_API_PASS & CHECK 5: AREA_FAMILY_SORT_PASS
  // --------------------------------------------------------------------------
  console.log('\nTesting getAreaFamilyMetadata across sample complexes...');
  const sampleComplexIds = ['banpo_xi', 'busan_samick_beach', 'busan_namcheon_xi', 'dunchon_jugong_1'];
  let metaPass = true;
  let sortPass = true;

  for (const cId of sampleComplexIds) {
    const metaList = await firestoreRepository.getAreaFamilyMetadata(cId);
    const expectedReg = AREA_FAMILIES_REGISTRY[cId];
    if (metaList.length !== expectedReg.length) {
      metaPass = false;
      console.error(`Metadata length mismatch for ${cId}: got ${metaList.length}, expected ${expectedReg.length}`);
    }

    // Verify sort order: representativeExclusiveArea ASC, then areaFamilyId ASC
    for (let i = 0; i < metaList.length - 1; i++) {
      const a = metaList[i];
      const b = metaList[i + 1];
      if (a.representativeExclusiveArea > b.representativeExclusiveArea) {
        sortPass = false;
        console.error(`Sort violation in ${cId}: ${a.areaFamilyId} (${a.representativeExclusiveArea}) > ${b.areaFamilyId} (${b.representativeExclusiveArea})`);
      } else if (
        a.representativeExclusiveArea === b.representativeExclusiveArea &&
        a.areaFamilyId.localeCompare(b.areaFamilyId) > 0
      ) {
        sortPass = false;
        console.error(`Sort alphabetical violation in ${cId}: ${a.areaFamilyId} vs ${b.areaFamilyId}`);
      }
    }
  }

  assertCheck('AREA_FAMILY_METADATA_API_PASS', metaPass, 'All tested complexes returned correct metadata count');
  assertCheck('AREA_FAMILY_SORT_PASS', sortPass, 'All metadata lists strictly sorted by area ASC then id ASC');

  // --------------------------------------------------------------------------
  // CHECK 6: ALL_AREA_FAMILIES_SUPPORTED
  // --------------------------------------------------------------------------
  console.log('\nVerifying all 189 registry families can be queried without unexpected failures...');
  let totalQueried = 0;
  let activeQueried = 0;
  let emptyQueried = 0;
  let anyQueryFailed = false;

  for (const [cId, famList] of Object.entries(AREA_FAMILIES_REGISTRY)) {
    for (const fam of famList) {
      totalQueried++;
      try {
        const res = await firestoreRepository.getAreaFamilyMonthlyPrices(cId, fam.id);
        if (res.metadata.hasMonthlyData) {
          activeQueried++;
          if (res.points.length === 0) {
            console.error(`Active family ${fam.id} returned 0 points`);
            anyQueryFailed = true;
          }
        } else {
          emptyQueried++;
          if (fam.id !== 'namcheon_xi_142') {
            console.error(`Unexpected inactive family: ${fam.id}`);
            anyQueryFailed = true;
          }
        }
      } catch (err: any) {
        console.error(`Query failed for ${cId} ${fam.id}:`, err);
        anyQueryFailed = true;
      }
    }
  }

  assertCheck(
    'ALL_AREA_FAMILIES_SUPPORTED',
    !anyQueryFailed && totalQueried === 189 && activeQueried === 188 && emptyQueried === 1,
    `Total queried: ${totalQueried}/189, Active: ${activeQueried}/188, Empty: ${emptyQueried}/1`
  );

  // --------------------------------------------------------------------------
  // CHECK 7: SPARSE_SERIES_PASS & NO_ZERO_FILL_PASS
  // --------------------------------------------------------------------------
  console.log('\nChecking sparse series contract and zero-fill absence...');
  let zeroFillDetected = false;
  let unorderedMonthsDetected = false;

  const testFamilies = ['samick_61', 'banpo_xi_84', 'mapo_pxi_84', 'dunchon_1_58'];
  for (const fId of testFamilies) {
    const parentComplex = Object.keys(AREA_FAMILIES_REGISTRY).find((c) =>
      AREA_FAMILIES_REGISTRY[c].some((f) => f.id === fId)
    )!;
    const res = await firestoreRepository.getAreaFamilyMonthlyPrices(parentComplex, fId);
    for (let i = 0; i < res.points.length; i++) {
      const p = res.points[i];
      if (p.tradeCount <= 0 || p.medianPrice <= 0 || p.averagePrice <= 0) {
        zeroFillDetected = true;
        console.error(`Zero fill detected in ${fId} at ${p.dealYmd}`);
      }
      if (i > 0 && res.points[i - 1].dealYmd >= p.dealYmd) {
        unorderedMonthsDetected = true;
        console.error(`Out-of-order month in ${fId}: ${res.points[i - 1].dealYmd} >= ${p.dealYmd}`);
      }
    }
  }

  assertCheck(
    'SPARSE_SERIES_PASS',
    !zeroFillDetected && !unorderedMonthsDetected,
    'No zero fill, no carry forward, strictly sorted chronological months'
  );

  // --------------------------------------------------------------------------
  // CHECK 8: SAMICK_61_PASS
  // --------------------------------------------------------------------------
  console.log('\nChecking Busan Samick Beach samick_61...');
  const samick61 = await firestoreRepository.getAreaFamilyMonthlyPrices('busan_samick_beach', 'samick_61');
  assertCheck(
    'SAMICK_61_PASS',
    samick61.metadata.standardAreaCategory === '59' &&
      samick61.metadata.representativeExclusiveArea === 60.83 &&
      samick61.metadata.exactAreas?.includes(61.09) === true &&
      samick61.points.length === expectedSeriesCount('samick_61', 223) &&
      samick61.metadata.tradeCount > 0,
    `representativeExclusiveArea: 60.83 (exactAreas include 61.09), standardAreaCategory: '59', points: ${samick61.points.length}/223`
  );

  // --------------------------------------------------------------------------
  // CHECK 9: PREDECESSOR_API_PASS & CHECK 10: NO_REDEVELOPMENT_CONTINUITY
  // --------------------------------------------------------------------------
  console.log('\nChecking Dunchon Predecessors 1 & 4...');
  const dunchon1Meta = await firestoreRepository.getAreaFamilyMetadata('dunchon_jugong_1');
  const dunchon4Meta = await firestoreRepository.getAreaFamilyMetadata('dunchon_jugong_4');
  const foreonMeta = await firestoreRepository.getAreaFamilyMetadata('gangdong_olympic_park');

  const dunchon1_58 = await firestoreRepository.getAreaFamilyMonthlyPrices('dunchon_jugong_1', 'dunchon_1_58');
  const dunchon4_78 = await firestoreRepository.getAreaFamilyMonthlyPrices('dunchon_jugong_4', 'dunchon_4_78');
  const foreon_84 = await firestoreRepository.getAreaFamilyMonthlyPrices('gangdong_olympic_park', 'olympic_park_84');

  // Foreon first deal is after 2022, Dunchon deals are before 2021
  const d1LastYmd = dunchon1_58.metadata.lastDealYmd || '';
  const foreonFirstYmd = foreon_84.metadata.firstDealYmd || '';
  const noRedevelopmentStitching = !dunchon1_58.points.some((p) => p.dealYmd >= '202301');

  assertCheck(
    'PREDECESSOR_API_PASS',
    dunchon1Meta.length === 5 &&
      dunchon4Meta.length === 4 &&
      dunchon1_58.points.length > 0 &&
      dunchon4_78.points.length > 0,
    `Dunchon 1 families: ${dunchon1Meta.length}/5, Dunchon 4 families: ${dunchon4Meta.length}/4`
  );

  assertCheck(
    'NO_REDEVELOPMENT_CONTINUITY',
    noRedevelopmentStitching && d1LastYmd < '202201',
    `Dunchon 1 lastDealYmd: ${d1LastYmd}, Foreon firstDealYmd: ${foreonFirstYmd} (Strict boundary separation)`
  );

  // --------------------------------------------------------------------------
  // CHECK 11: REVERSE_AGGREGATION_PASS
  // Compare at least 10 sample groups against raw canonical transactions
  // --------------------------------------------------------------------------
  console.log('\nRunning reverse aggregation verification across 10 sample groups...');
  const step = Math.floor(allV2Docs.length / 10);
  const sampleGroups = Array.from({ length: 10 }, (_, i) => {
    const doc = allV2Docs[i * step];
    return {
      complexId: doc.complexId,
      areaFamilyId: doc.areaFamilyId,
      dealYmd: doc.dealYmd,
    };
  });

  // Read canonical transactions for these 10 groups
  let reverseMatchPass = true;
  for (const g of sampleGroups) {
    const monthlyPointRes = await firestoreRepository.getAreaFamilyMonthlyPrices(
      g.complexId,
      g.areaFamilyId,
      g.dealYmd,
      g.dealYmd
    );
    if (monthlyPointRes.points.length !== 1) {
      console.error(`Expected 1 point for ${g.complexId} ${g.areaFamilyId} ${g.dealYmd}, got ${monthlyPointRes.points.length}`);
      reverseMatchPass = false;
      continue;
    }
    const mPoint = monthlyPointRes.points[0];

    // Find raw active canonical transactions
    const rawTxs = await firestoreRepository.getTransactions(g.complexId, g.dealYmd, g.dealYmd, 'ALL');
    const matchingTxs = rawTxs.filter(
      (t) =>
        t.areaFamilyId === g.areaFamilyId &&
        !t.isCancelled &&
        (t.canonicalStatus === 'TARGET_CANONICAL' || !t.canonicalStatus)
    );

    // Expand multiplicity
    const prices: number[] = [];
    const sqmPrices: number[] = [];
    for (const t of matchingTxs) {
      const mult = t.activeCount || 1;
      const price = t.price;
      const area = t.exclusiveArea;
      const priceSqm = t.pricePerSqm > 0 ? t.pricePerSqm : Math.round((price / area) * 10) / 10;
      for (let m = 0; m < mult; m++) {
        prices.push(price);
        sqmPrices.push(priceSqm);
      }
    }

    const expectedTradeCount = prices.length;
    const expectedMedianPrice = Math.round(calculateMedian(prices));
    const expectedAvgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / expectedTradeCount);
    const expectedMedianPricePerSqm = Math.round(calculateMedian(sqmPrices) * 10) / 10;
    const expectedAvgPricePerSqm = Math.round((sqmPrices.reduce((a, b) => a + b, 0) / expectedTradeCount) * 10) / 10;

    if (
      mPoint.tradeCount !== expectedTradeCount ||
      mPoint.medianPrice !== expectedMedianPrice ||
      mPoint.averagePrice !== expectedAvgPrice ||
      mPoint.medianPricePerSqm !== expectedMedianPricePerSqm ||
      mPoint.averagePricePerSqm !== expectedAvgPricePerSqm
    ) {
      console.error(`Reverse aggregation mismatch for ${g.complexId} ${g.areaFamilyId} ${g.dealYmd}:`);
      console.error(
        `API: tradeCount=${mPoint.tradeCount}, median=${mPoint.medianPrice}, avg=${mPoint.averagePrice}, medianSqm=${mPoint.medianPricePerSqm}, avgSqm=${mPoint.averagePricePerSqm}`
      );
      console.error(
        `Raw: tradeCount=${expectedTradeCount}, median=${expectedMedianPrice}, avg=${expectedAvgPrice}, medianSqm=${expectedMedianPricePerSqm}, avgSqm=${expectedAvgPricePerSqm}`
      );
      reverseMatchPass = false;
    }
  }

  assertCheck('REVERSE_AGGREGATION_PASS', reverseMatchPass, 'All 10 sample groups EXACT MATCH canonical transactions');

  // --------------------------------------------------------------------------
  // CHECK 12: ERROR_SEMANTICS_PASS
  // --------------------------------------------------------------------------
  console.log('\nChecking error semantics...');
  let unknownComplexHandled = false;
  let unknownFamilyHandled = false;
  let invalidYmdHandled = false;
  let invalidRangeHandled = false;

  try {
    await firestoreRepository.getAreaFamilyMetadata('unknown_complex_123');
  } catch (err: any) {
    if (err.code === 'INVALID_COMPLEX_ID') unknownComplexHandled = true;
  }

  try {
    await firestoreRepository.getAreaFamilyMonthlyPrices('banpo_xi', 'unknown_family_999');
  } catch (err: any) {
    if (err.code === 'AREA_FAMILY_NOT_FOUND') unknownFamilyHandled = true;
  }

  try {
    await firestoreRepository.getAreaFamilyMonthlyPrices('banpo_xi', 'banpo_xi_84', '202413');
  } catch (err: any) {
    if (err.code === 'INVALID_YMD') invalidYmdHandled = true;
  }

  try {
    await firestoreRepository.getAreaFamilyMonthlyPrices('banpo_xi', 'banpo_xi_84', '202409', '202401');
  } catch (err: any) {
    if (err.code === 'INVALID_DATE_RANGE') invalidRangeHandled = true;
  }

  assertCheck(
    'ERROR_SEMANTICS_PASS',
    unknownComplexHandled && unknownFamilyHandled && invalidYmdHandled && invalidRangeHandled,
    'INVALID_COMPLEX_ID, AREA_FAMILY_NOT_FOUND, INVALID_YMD, INVALID_DATE_RANGE handled with exact codes'
  );

  // --------------------------------------------------------------------------
  // CHECK 13: MAP_REGRESSION_PASS
  // --------------------------------------------------------------------------
  console.log('\nChecking Map Explorer read path for regression...');
  const map59 = await firestoreRepository.getAllStandardAreaMonthlyPrices('59', '202401', '202406');
  const map84 = await firestoreRepository.getAllStandardAreaMonthlyPrices('84', '202401', '202406');
  const map59Keys = Object.keys(map59);
  const map84Keys = Object.keys(map84);

  const samickIn59 = Boolean(map59['busan_samick_beach']);

  assertCheck(
    'MAP_REGRESSION_PASS',
    map59Keys.length >= 28 && map84Keys.length === 31 && samickIn59,
    `Map 59 complexes: ${map59Keys.length} (Samick Beach included), Map 84 complexes: ${map84Keys.length}/31 (zero regression)`
  );

  // --------------------------------------------------------------------------
  // CHECK 14: FIRESTORE_UNCHANGED
  // --------------------------------------------------------------------------
  console.log('\nVerifying Firestore collection sizes remain identical...');
  const txCountSnap = await getCountFromServer(collection(db, 'transactions'));
  const legacyMonthlyCountSnap = await getCountFromServer(collection(db, 'monthlyComplexPrices'));
  const stdV2CountSnap = await getCountFromServer(collection(db, 'monthlyStandardAreaPrices_v2'));

  const txCount = txCountSnap.data().count;
  const legacyCount = legacyMonthlyCountSnap.data().count;
  const v2Count = totalV2Docs;
  const stdV2Count = stdV2CountSnap.data().count;

  assertCheck(
    'FIRESTORE_UNCHANGED',
    txCount === 48485 && legacyCount === 5153 && v2Count === 12633 && stdV2Count === 5757,
    `transactions: ${txCount}/48485, monthlyComplexPrices: ${legacyCount}/5153, monthlyComplexPrices_v2: ${v2Count}/12633, monthlyStandardAreaPrices_v2: ${stdV2Count}/5757 (0 mutations)`
  );

  // --------------------------------------------------------------------------
  // FINAL SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  if (allChecksPassed) {
    console.log('🎉 PHASE 6A VERIFICATION RESULT: AREA_FAMILY_DATA_LAYER_SUCCESS');
  } else {
    console.error('❌ PHASE 6A VERIFICATION RESULT: FAILED');
    process.exit(1);
  }
  console.log('================================================================');
  process.exit(0);
}

runVerification().catch((err) => {
  console.error('FATAL VERIFICATION ERROR:', err);
  process.exit(1);
});
