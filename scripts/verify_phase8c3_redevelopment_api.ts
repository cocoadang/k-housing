/**
 * Phase 8C-3 Verification Script: Redevelopment Analysis API & Public Contract Layer
 * 
 * Verifies the 24 mandatory API test cases:
 * 1. TC_8C3_01_LINEAGES_LIST
 * 2. TC_8C3_02_LINEAGE_DETAIL_SUCCESS
 * 3. TC_8C3_03_LINEAGE_DETAIL_INVALID
 * 4. TC_8C3_04_TARGETS_PREDECESSORS
 * 5. TC_8C3_05_TARGETS_SUCCESSORS
 * 6. TC_8C3_06_TARGETS_RESEARCH_EXAMPLES
 * 7. TC_8C3_07_PRICE_AVAILABILITY_VALID
 * 8. TC_8C3_08_PRICE_AVAILABILITY_INVALID_COMPLEX
 * 9. TC_8C3_09_PRICE_AVAILABILITY_INVALID_FAMILY
 * 10. TC_8C3_10_ANALYSIS_HISTORICAL_REFUSAL
 * 11. TC_8C3_11_ANALYSIS_SCENARIO_SUCCESS
 * 12. TC_8C3_12_ANALYSIS_MEDIAN_VS_AVERAGE
 * 13. TC_8C3_13_ANALYSIS_PRICE_SELECTION_LATEST
 * 14. TC_8C3_14_ANALYSIS_PRICE_DATA_NOT_FOUND
 * 15. TC_8C3_15_ANALYSIS_INVALID_COMPLEX
 * 16. TC_8C3_16_ANALYSIS_INVALID_FAMILY
 * 17. TC_8C3_17_ANALYSIS_INVALID_MONTH
 * 18. TC_8C3_18_ANALYSIS_PROVENANCE
 * 19. TC_8C3_19_LAND_SHARE_SUCCESS
 * 20. TC_8C3_20_LAND_SHARE_DISCLAIMER
 * 21. TC_8C3_21_CONSTRUCTION_COSTS_SUCCESS
 * 22. TC_8C3_22_CONSTRUCTION_COSTS_DISCLAIMER
 * 23. TC_8C3_23_SECURITY_NO_SECRETS
 * 24. TC_8C3_24_ZERO_FIRESTORE_MUTATIONS
 */

import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { collection, getCountFromServer } from 'firebase/firestore';
import { getFirestoreDb } from '../src/server/firestore';
import { redevelopmentRouter } from '../src/server/redevelopmentRouter';

interface TestResult {
  caseId: string;
  name: string;
  passed: boolean;
  details: string;
}

async function runPhase8C3Verification() {
  console.log('================================================================');
  console.log('🚀 PHASE 8C-3: REDEVELOPMENT ANALYSIS API CONTRACT VERIFICATION');
  console.log('================================================================\n');

  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Failed to initialize Firestore client');
  }

  // 1. Initial Firestore Baseline
  const colV2 = collection(db, 'monthlyComplexPrices_v2');
  const snapBefore = await getCountFromServer(colV2);
  const countBefore = snapBefore.data().count;
  console.log(`[Baseline] monthlyComplexPrices_v2 initial document count: ${countBefore}`);

  // 2. Start Ephemeral Test Server with redevelopmentRouter
  const testApp = express();
  testApp.use(express.json());
  testApp.use('/api/redevelopment', redevelopmentRouter);

  const server = http.createServer(testApp);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}/api/redevelopment`;
  console.log(`[Test Server] Running on ${baseUrl}\n`);

  const testResults: TestResult[] = [];
  function recordTest(caseId: string, name: string, condition: boolean, details: string) {
    testResults.push({ caseId, name, passed: condition, details });
    if (condition) {
      console.log(`✅ [PASS] ${caseId}: ${name} - ${details}`);
    } else {
      console.error(`❌ [FAIL] ${caseId}: ${name} - ${details}`);
    }
  }

  try {
    // ------------------------------------------------------------------------
    // TC_8C3_01_LINEAGES_LIST
    // ------------------------------------------------------------------------
    const res01 = await fetch(`${baseUrl}/lineages`);
    const data01 = await res01.json();
    const cond01 =
      res01.status === 200 &&
      data01.success === true &&
      Array.isArray(data01.lineages) &&
      data01.lineages.length >= 1 &&
      data01.lineages[0].lineageId === 'dunchon_redevelopment' &&
      data01.lineages[0].predecessors.length === 4 &&
      data01.lineages[0].successors.length === 1 &&
      data01.lineages[0].sourceSummary.verifiedActualMappingCount === 0;
    recordTest(
      'TC_8C3_01_LINEAGES_LIST',
      'GET /api/redevelopment/lineages returns lineage metadata',
      cond01,
      `status: ${res01.status}, lineages: ${data01.lineages?.length}, verifiedActual: ${data01.lineages?.[0]?.sourceSummary?.verifiedActualMappingCount}`
    );

    // ------------------------------------------------------------------------
    // TC_8C3_02_LINEAGE_DETAIL_SUCCESS
    // ------------------------------------------------------------------------
    const res02 = await fetch(`${baseUrl}/lineages/dunchon_redevelopment`);
    const data02 = await res02.json();
    const cond02 =
      res02.status === 200 &&
      data02.success === true &&
      data02.lineage?.lineageId === 'dunchon_redevelopment' &&
      data02.lineage?.units?.before === 5930 &&
      data02.lineage?.units?.after === 12032 &&
      data02.lineage?.milestones?.moveInDate === '2024-11-27' &&
      data02.lineage?.readiness?.nominalHistorical?.readiness === 'NOT_READY' &&
      data02.lineage?.mappingCoverage?.verifiedActual === 0;
    recordTest(
      'TC_8C3_02_LINEAGE_DETAIL_SUCCESS',
      'GET /api/redevelopment/lineages/:id returns detailed milestones & readiness',
      cond02,
      `status: ${res02.status}, beforeUnits: ${data02.lineage?.units?.before}, afterUnits: ${data02.lineage?.units?.after}, readiness: ${data02.lineage?.readiness?.nominalHistorical?.readiness}`
    );

    // ------------------------------------------------------------------------
    // TC_8C3_03_LINEAGE_DETAIL_INVALID
    // ------------------------------------------------------------------------
    const res03 = await fetch(`${baseUrl}/lineages/invalid_lineage_999`);
    const data03 = await res03.json();
    const cond03 =
      res03.status === 400 &&
      data03.success === false &&
      data03.error?.code === 'INVALID_LINEAGE';
    recordTest(
      'TC_8C3_03_LINEAGE_DETAIL_INVALID',
      'GET /api/redevelopment/lineages/:invalid returns 400 INVALID_LINEAGE',
      cond03,
      `status: ${res03.status}, error.code: ${data03.error?.code}`
    );

    // ------------------------------------------------------------------------
    // TC_8C3_04_TARGETS_PREDECESSORS
    // ------------------------------------------------------------------------
    const res04 = await fetch(`${baseUrl}/lineages/dunchon_redevelopment/targets`);
    const data04 = await res04.json();
    const preds = data04.predecessorTargets || [];
    const cond04 =
      res04.status === 200 &&
      preds.length === 16 &&
      preds.every((p: any) => p.historicalOnly === true && p.hasPriceData === true);
    recordTest(
      'TC_8C3_04_TARGETS_PREDECESSORS',
      'GET /api/redevelopment/lineages/:id/targets returns 16 historical predecessor targets',
      cond04,
      `status: ${res04.status}, count: ${preds.length}, allHistorical: ${preds.every((p: any) => p.historicalOnly)}`
    );

    // ------------------------------------------------------------------------
    // TC_8C3_05_TARGETS_SUCCESSORS
    // ------------------------------------------------------------------------
    const succs = data04.successorTargets || [];
    const cond05 =
      res04.status === 200 &&
      succs.length === 8 &&
      succs.every((s: any) => s.historicalOnly === false && s.hasPriceData === true);
    recordTest(
      'TC_8C3_05_TARGETS_SUCCESSORS',
      'GET /api/redevelopment/lineages/:id/targets returns 8 successor targets',
      cond05,
      `status: ${res04.status}, count: ${succs.length}, allSuccessorActive: ${succs.every((s: any) => !s.historicalOnly)}`
    );

    // ------------------------------------------------------------------------
    // TC_8C3_06_TARGETS_RESEARCH_EXAMPLES
    // ------------------------------------------------------------------------
    const examples = data04.researchExamples || [];
    const cond06 =
      res04.status === 200 &&
      examples.length === 3 &&
      examples.every((ex: any) => ex.productionEligibility === 'RESEARCH_ONLY' && ex.exampleType === 'APPLICATION_EXAMPLE');
    recordTest(
      'TC_8C3_06_TARGETS_RESEARCH_EXAMPLES',
      'Targets endpoint isolates application examples as RESEARCH_ONLY',
      cond06,
      `status: ${res04.status}, count: ${examples.length}, allResearchOnly: ${examples.every((ex: any) => ex.productionEligibility === 'RESEARCH_ONLY')}`
    );

    // ------------------------------------------------------------------------
    // TC_8C3_07_PRICE_AVAILABILITY_VALID
    // ------------------------------------------------------------------------
    const res07 = await fetch(
      `${baseUrl}/price-availability?complexId=dunchon_jugong_1&areaFamilyId=dunchon_1_25`
    );
    const data07 = await res07.json();
    const cond07 =
      res07.status === 200 &&
      data07.success === true &&
      data07.hasPriceData === true &&
      data07.observedMonthCount > 0 &&
      Array.isArray(data07.compactRanges) &&
      data07.compactRanges.length > 0;
    recordTest(
      'TC_8C3_07_PRICE_AVAILABILITY_VALID',
      'GET /api/redevelopment/price-availability returns observed months and compact ranges',
      cond07,
      `status: ${res07.status}, points: ${data07.observedMonthCount}, ranges: ${JSON.stringify(data07.compactRanges)}`
    );

    // ------------------------------------------------------------------------
    // TC_8C3_08_PRICE_AVAILABILITY_INVALID_COMPLEX
    // ------------------------------------------------------------------------
    const res08 = await fetch(
      `${baseUrl}/price-availability?complexId=unknown_complex_abc&areaFamilyId=abc_10p`
    );
    const data08 = await res08.json();
    const cond08 =
      res08.status === 400 &&
      data08.success === false &&
      data08.error?.code === 'INVALID_COMPLEX';
    recordTest(
      'TC_8C3_08_PRICE_AVAILABILITY_INVALID_COMPLEX',
      'GET /api/redevelopment/price-availability rejects invalid complexId with 400',
      cond08,
      `status: ${res08.status}, error.code: ${data08.error?.code}`
    );

    // ------------------------------------------------------------------------
    // TC_8C3_09_PRICE_AVAILABILITY_INVALID_FAMILY
    // ------------------------------------------------------------------------
    const res09 = await fetch(
      `${baseUrl}/price-availability?complexId=dunchon_jugong_1&areaFamilyId=unknown_family_xyz`
    );
    const data09 = await res09.json();
    const cond09 =
      res09.status === 400 &&
      data09.success === false &&
      data09.error?.code === 'INVALID_AREA_FAMILY';
    recordTest(
      'TC_8C3_09_PRICE_AVAILABILITY_INVALID_FAMILY',
      'GET /api/redevelopment/price-availability rejects invalid areaFamilyId with 400',
      cond09,
      `status: ${res09.status}, error.code: ${data09.error?.code}`
    );

    // ------------------------------------------------------------------------
    // TC_8C3_10_ANALYSIS_HISTORICAL_REFUSAL
    // ------------------------------------------------------------------------
    const req10 = {
      lineageId: 'dunchon_redevelopment',
      analysisMode: 'VERIFIED_HISTORICAL',
      predecessorTarget: { complexId: 'dunchon_jugong_1', areaFamilyId: 'dunchon_1_80' },
      successorTarget: { complexId: 'gangdong_olympic_park', areaFamilyId: 'olympic_park_84' },
      predecessorMonth: '201705',
      successorMonth: '202412',
    };
    const res10 = await fetch(`${baseUrl}/analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req10),
    });
    const data10 = await res10.json();
    const cond10 =
      res10.status === 200 &&
      data10.success === true &&
      data10.historicalMappingVerified === false &&
      data10.analysis?.ownerEconomics?.nominalValue?.availability === 'UNVERIFIED_MAPPING' &&
      data10.analysis?.ownerEconomics?.nominalValue?.readiness === 'NOT_READY' &&
      data10.readiness?.overall === 'NOT_READY';
    recordTest(
      'TC_8C3_10_ANALYSIS_HISTORICAL_REFUSAL',
      'POST /api/redevelopment/analysis refuses calculation in VERIFIED_HISTORICAL mode (0 verified mappings)',
      cond10,
      `status: ${res10.status}, nominalAvailability: ${data10.analysis?.ownerEconomics?.nominalValue?.availability}, overall: ${data10.readiness?.overall}`
    );

    // ------------------------------------------------------------------------
    // TC_8C3_11_ANALYSIS_SCENARIO_SUCCESS
    // ------------------------------------------------------------------------
    const req11 = {
      lineageId: 'dunchon_redevelopment',
      analysisMode: 'USER_SCENARIO',
      predecessorTarget: { complexId: 'dunchon_jugong_1', areaFamilyId: 'dunchon_1_80' },
      successorTarget: { complexId: 'gangdong_olympic_park', areaFamilyId: 'olympic_park_84' },
      predecessorMonth: '201705',
      successorMonth: '202412',
      priceSelectionPolicy: 'EXACT_MONTH',
      priceMetric: 'MEDIAN_PRICE',
    };
    const res11 = await fetch(`${baseUrl}/analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req11),
    });
    const data11 = await res11.json();
    const nomVal = data11.analysis?.ownerEconomics?.nominalValue;
    const cond11 =
      res11.status === 200 &&
      data11.scenario === true &&
      nomVal?.availability === 'AVAILABLE' &&
      nomVal?.readiness === 'READY' &&
      typeof nomVal?.value === 'number' &&
      nomVal?.displayLabel === '시나리오 명목 자산가치 변화' &&
      !nomVal?.displayLabel.includes('수익률');
    recordTest(
      'TC_8C3_11_ANALYSIS_SCENARIO_SUCCESS',
      'POST /api/redevelopment/analysis executes USER_SCENARIO calculation with neutral terminology',
      cond11,
      `status: ${res11.status}, changeAmount: ${nomVal?.value} 만원, label: "${nomVal?.displayLabel}"`
    );

    // ------------------------------------------------------------------------
    // TC_8C3_12_ANALYSIS_MEDIAN_VS_AVERAGE
    // ------------------------------------------------------------------------
    const req12 = {
      ...req11,
      priceMetric: 'AVERAGE_PRICE',
    };
    const res12 = await fetch(`${baseUrl}/analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req12),
    });
    const data12 = await res12.json();
    const cond12 =
      res12.status === 200 &&
      data12.predecessorObservation?.priceMetric === 'AVERAGE_PRICE' &&
      data12.successorObservation?.priceMetric === 'AVERAGE_PRICE';
    recordTest(
      'TC_8C3_12_ANALYSIS_MEDIAN_VS_AVERAGE',
      'POST /api/redevelopment/analysis supports AVERAGE_PRICE metric selection',
      cond12,
      `status: ${res12.status}, predMetric: ${data12.predecessorObservation?.priceMetric}, succMetric: ${data12.successorObservation?.priceMetric}`
    );

    // ------------------------------------------------------------------------
    // TC_8C3_13_ANALYSIS_PRICE_SELECTION_LATEST
    // ------------------------------------------------------------------------
    const req13 = {
      ...req11,
      predecessorMonth: '201706',
      priceSelectionPolicy: 'LATEST_OBSERVED_ON_OR_BEFORE',
    };
    const res13 = await fetch(`${baseUrl}/analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req13),
    });
    const data13 = await res13.json();
    const cond13 =
      res13.status === 200 &&
      data13.request?.priceSelectionPolicy === 'LATEST_OBSERVED_ON_OR_BEFORE' &&
      data13.predecessorObservation?.actualObservationMonth !== null;
    recordTest(
      'TC_8C3_13_ANALYSIS_PRICE_SELECTION_LATEST',
      'POST /api/redevelopment/analysis respects LATEST_OBSERVED_ON_OR_BEFORE selection policy',
      cond13,
      `status: ${res13.status}, requested: ${data13.request?.predecessorMonth}, resolved: ${data13.predecessorObservation?.actualObservationMonth}`
    );

    // ------------------------------------------------------------------------
    // TC_8C3_14_ANALYSIS_PRICE_DATA_NOT_FOUND
    // ------------------------------------------------------------------------
    const req14 = {
      ...req11,
      predecessorMonth: '201001',
      priceSelectionPolicy: 'EXACT_MONTH',
    };
    const res14 = await fetch(`${baseUrl}/analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req14),
    });
    const data14 = await res14.json();
    const cond14 =
      res14.status === 200 &&
      data14.analysis?.ownerEconomics?.nominalValue?.availability === 'DATA_NOT_AVAILABLE' &&
      data14.missingRequirements?.some((m: string) => m.includes('가격') || m.includes('PRICE') || m.includes('MISSING'));
    recordTest(
      'TC_8C3_14_ANALYSIS_PRICE_DATA_NOT_FOUND',
      'POST /api/redevelopment/analysis returns 200 with DATA_NOT_AVAILABLE on unobserved month',
      cond14,
      `status: ${res14.status}, nominalAvailability: ${data14.analysis?.ownerEconomics?.nominalValue?.availability}, missing: ${data14.missingRequirements?.join(', ')}`
    );

    // ------------------------------------------------------------------------
    // TC_8C3_15_ANALYSIS_INVALID_COMPLEX
    // ------------------------------------------------------------------------
    const req15 = {
      ...req11,
      predecessorTarget: { complexId: 'fake_complex_id', areaFamilyId: 'fake_family' },
    };
    const res15 = await fetch(`${baseUrl}/analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req15),
    });
    const data15 = await res15.json();
    const cond15 =
      res15.status === 400 &&
      data15.success === false &&
      data15.error?.code === 'INVALID_COMPLEX';
    recordTest(
      'TC_8C3_15_ANALYSIS_INVALID_COMPLEX',
      'POST /api/redevelopment/analysis rejects invalid predecessor complex with 400 INVALID_COMPLEX',
      cond15,
      `status: ${res15.status}, error.code: ${data15.error?.code}`
    );

    // ------------------------------------------------------------------------
    // TC_8C3_16_ANALYSIS_INVALID_FAMILY
    // ------------------------------------------------------------------------
    const req16 = {
      ...req11,
      predecessorTarget: { complexId: 'dunchon_jugong_1', areaFamilyId: 'non_existent_family_xyz' },
    };
    const res16 = await fetch(`${baseUrl}/analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req16),
    });
    const data16 = await res16.json();
    const cond16 =
      res16.status === 400 &&
      data16.success === false &&
      data16.error?.code === 'INVALID_AREA_FAMILY';
    recordTest(
      'TC_8C3_16_ANALYSIS_INVALID_FAMILY',
      'POST /api/redevelopment/analysis rejects invalid area family with 400 INVALID_AREA_FAMILY',
      cond16,
      `status: ${res16.status}, error.code: ${data16.error?.code}`
    );

    // ------------------------------------------------------------------------
    // TC_8C3_17_ANALYSIS_INVALID_MONTH
    // ------------------------------------------------------------------------
    const req17 = {
      ...req11,
      predecessorMonth: '202413',
    };
    const res17 = await fetch(`${baseUrl}/analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req17),
    });
    const data17 = await res17.json();
    const cond17 =
      res17.status === 400 &&
      data17.success === false &&
      data17.error?.code === 'INVALID_MONTH';
    recordTest(
      'TC_8C3_17_ANALYSIS_INVALID_MONTH',
      'POST /api/redevelopment/analysis rejects invalid month string with 400 INVALID_MONTH',
      cond17,
      `status: ${res17.status}, error.code: ${data17.error?.code}`
    );

    // ------------------------------------------------------------------------
    // TC_8C3_18_ANALYSIS_PROVENANCE
    // ------------------------------------------------------------------------
    const res18 = await fetch(`${baseUrl}/analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req11),
    });
    const data18 = await res18.json();
    const pSources = data18.provenance?.priceSources || [];
    const eSources = data18.provenance?.evidenceSources || [];
    const cond18 =
      res18.status === 200 &&
      pSources.length === 2 &&
      pSources.every((p: any) => p.collection === 'monthlyComplexPrices_v2' && p.documentId) &&
      eSources.length >= 2;
    recordTest(
      'TC_8C3_18_ANALYSIS_PROVENANCE',
      'POST /api/redevelopment/analysis outputs full Price & Evidence provenance metadata',
      cond18,
      `status: ${res18.status}, priceSources: ${pSources.length}, evidenceSources: ${eSources.length}, coll: ${pSources[0]?.collection}`
    );

    // ------------------------------------------------------------------------
    // TC_8C3_19_LAND_SHARE_SUCCESS
    // ------------------------------------------------------------------------
    const res19 = await fetch(`${baseUrl}/lineages/dunchon_redevelopment/land-share`);
    const data19 = await res19.json();
    const cond19 =
      res19.status === 200 &&
      data19.success === true &&
      data19.metadata?.recordCount === 17 &&
      data19.metadata?.nominalCategoryCount === 15 &&
      data19.metadata?.uniqueLandShareValueCount === 12 &&
      data19.metadata?.uniqueAreaFamilyCount === 16 &&
      data19.tiers?.length === 17 &&
      data19.predecessorRatios?.length === 16;
    recordTest(
      'TC_8C3_19_LAND_SHARE_SUCCESS',
      'GET /api/redevelopment/lineages/:id/land-share returns 17 tiers, 16 ratios, 12 distinct values',
      cond19,
      `status: ${res19.status}, tiers: ${data19.tiers?.length}, ratios: ${data19.predecessorRatios?.length}, distinct: ${data19.metadata?.uniqueLandShareValueCount}`
    );

    // ------------------------------------------------------------------------
    // TC_8C3_20_LAND_SHARE_DISCLAIMER
    // ------------------------------------------------------------------------
    const warnings20 = data19.warnings || [];
    const cond20 =
      warnings20.length >= 1 &&
      warnings20.some((w: string) => w.includes('추론하거나 결정하지 않습니다'));
    recordTest(
      'TC_8C3_20_LAND_SHARE_DISCLAIMER',
      'Land share response includes mandatory legal/methodology disclaimer against return inference',
      cond20,
      `disclaimer: "${warnings20[0]}"`
    );

    // ------------------------------------------------------------------------
    // TC_8C3_21_CONSTRUCTION_COSTS_SUCCESS
    // ------------------------------------------------------------------------
    const res21 = await fetch(`${baseUrl}/lineages/dunchon_redevelopment/construction-costs`);
    const data21 = await res21.json();
    const events21 = data21.events || [];
    const reb = data21.rebAuditSummary;
    const cond21 =
      res21.status === 200 &&
      data21.success === true &&
      events21.length === 6 &&
      data21.isFinal === false &&
      reb?.targetAmountKrw === 162100000000 &&
      reb?.recognizedAmountKrw === 124400000000 &&
      reb?.reducedAmountKrw === 37700000000;
    recordTest(
      'TC_8C3_21_CONSTRUCTION_COSTS_SUCCESS',
      'GET /api/redevelopment/lineages/:id/construction-costs returns 6 events & REB audit breakdown',
      cond21,
      `status: ${res21.status}, events: ${events21.length}, target: ${reb?.targetAmountKrw}, recognized: ${reb?.recognizedAmountKrw}`
    );

    // ------------------------------------------------------------------------
    // TC_8C3_22_CONSTRUCTION_COSTS_DISCLAIMER
    // ------------------------------------------------------------------------
    const notes22 = data21.notes || [];
    const cond22 =
      notes22.length >= 2 &&
      notes22.some((n: string) => n.includes('일방 청구액이며 확정 계약금액')) &&
      notes22.some((n: string) => n.includes('직접 비례하지 않으며'));
    recordTest(
      'TC_8C3_22_CONSTRUCTION_COSTS_DISCLAIMER',
      'Construction costs response contains disclaimers on non-final contractor claims and distribution',
      cond22,
      `notes count: ${notes22.length}, note1: "${notes22[0]}"`
    );

    // ------------------------------------------------------------------------
    // TC_8C3_23_SECURITY_NO_SECRETS
    // ------------------------------------------------------------------------
    const rawResponses = [
      JSON.stringify(data01),
      JSON.stringify(data03),
      JSON.stringify(data08),
      JSON.stringify(data15),
      JSON.stringify(data17),
    ];
    const containsSecrets = rawResponses.some(
      (r) =>
        r.includes('src/server') ||
        r.includes('node_modules') ||
        r.includes('Stack:') ||
        r.includes('Error: at ') ||
        r.includes('FIREBASE') ||
        r.includes('process.env')
    );
    const cond23 = !containsSecrets;
    recordTest(
      'TC_8C3_23_SECURITY_NO_SECRETS',
      'API errors and payloads never expose file paths, stack traces, or server secrets',
      cond23,
      `containsSensitiveInternalStrings: ${containsSecrets}`
    );

    // ------------------------------------------------------------------------
    // TC_8C3_24_ZERO_FIRESTORE_MUTATIONS
    // ------------------------------------------------------------------------
    const snapAfter = await getCountFromServer(colV2);
    const countAfter = snapAfter.data().count;
    const cond24 = countAfter === countBefore;
    recordTest(
      'TC_8C3_24_ZERO_FIRESTORE_MUTATIONS',
      'Firestore document baseline is strictly preserved across all test operations (0 mutations)',
      cond24,
      `before: ${countBefore}, after: ${countAfter}, delta: ${countAfter - countBefore}`
    );

    // ------------------------------------------------------------------------
    // Summary & Output Report
    // ------------------------------------------------------------------------
    const allPassed = testResults.every((t) => t.passed);
    const passedCount = testResults.filter((t) => t.passed).length;
    console.log('\n================================================================');
    console.log(`📊 PHASE 8C-3 VERIFICATION SUMMARY: ${passedCount} / ${testResults.length} PASSED`);
    console.log('================================================================\n');

    const reportPath = path.join(process.cwd(), 'data', 'phase8c3_redevelopment_api_report.json');
    const reportData = {
      verifiedAt: new Date().toISOString(),
      phase: 'PHASE_8C_3',
      totalTests: testResults.length,
      passedCount,
      allPassed,
      testResults,
      baselinePreservation: {
        collection: 'monthlyComplexPrices_v2',
        countBefore,
        countAfter,
        mutations: countAfter - countBefore,
      },
    };
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), 'utf-8');
    console.log(`[Report Generated] Saved report to ${reportPath}\n`);

    if (!allPassed) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } finally {
    server.close();
  }
}

runPhase8C3Verification().catch((err) => {
  console.error('Phase 8C-3 Verification Fatal Error:', err);
  process.exit(1);
});
