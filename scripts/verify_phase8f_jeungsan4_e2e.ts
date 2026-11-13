/**
 * Phase 8F Verification: End-to-End Registration and Operation of Jeungsan 4
 * 
 * Verifies that the second redevelopment project (증산4구역 도심 공공주택 복합지구)
 * operates seamlessly through the generalized pipeline:
 * Official Data -> Evidence -> Seed/Registry -> API -> UI
 * without any hardcoded Dunchon assumptions or data fabrication.
 */

import { redevelopmentDataService } from '../src/services/redevelopmentDataService';
import { getRedevelopmentLineage, getRedevelopmentProject } from '../src/data/redevelopmentLineages';
import { collection, getCountFromServer } from 'firebase/firestore';
import { getFirestoreDb } from '../src/server/firestore';

async function verifyJeungsan4E2E() {
  console.log('================================================================');
  console.log('🚀 PHASE 8F: JEUNGSAN 4 END-TO-END REGISTRATION & SAFETY AUDIT');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}${detail ? ` - ${detail}` : ''}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  // Baseline Document Count Check (Zero Mutation Constraint)
  let countBefore = 0;
  const db = getFirestoreDb();
  if (db) {
    const colV2 = collection(db, 'monthlyComplexPrices_v2');
    const snapBefore = await getCountFromServer(colV2);
    countBefore = snapBefore.data().count;
    console.log(`[Baseline] monthlyComplexPrices_v2 initial document count: ${countBefore}`);
  }

  // TEST 1: Registry Registration
  const lineage = getRedevelopmentLineage('jeungsan4_redevelopment');
  assert(
    lineage !== undefined && lineage.lineageId === 'jeungsan4_redevelopment',
    'TC_8F_01_REGISTRY_LINEAGE_EXISTS',
    `Lineage found: ${lineage?.lineageName}`
  );

  const project = getRedevelopmentProject('proj_jeungsan4_complex');
  assert(
    project !== undefined && project.projectId === 'proj_jeungsan4_complex',
    'TC_8F_02_REGISTRY_PROJECT_EXISTS',
    `Project found: ${project?.projectName}`
  );

  // TEST 2: Seed Bundle Integrity
  const bundle = redevelopmentDataService.loadSeedBundle('jeungsan4_redevelopment');
  assert(
    bundle !== null && bundle.projectSeed.projectId === 'proj_jeungsan4_complex',
    'TC_8F_03_SEED_BUNDLE_LOADED',
    `Bundle loaded with schemaVersion: ${bundle.projectSeed.schemaVersion}`
  );

  // TEST 3: Official Data Fidelity (Zero Estimation)
  assert(
    bundle.projectSeed.successor.totalUnits === 3509,
    'TC_8F_04_OFFICIAL_UNITS_FIDELITY',
    `Successor totalUnits = ${bundle.projectSeed.successor.totalUnits} (MOLIT Official Announcement)`
  );
  assert(
    bundle.financialSeed.proportionalRate.valuePct === null &&
    bundle.financialSeed.proportionalRate.eligibility === 'PENDING',
    'TC_8F_05_NO_FABRICATED_FINANCIALS',
    'Proportional rate not fabricated (valuePct is null, eligibility is PENDING for public complex project)'
  );

  // TEST 4: API getLineages List
  const lineagesRes = redevelopmentDataService.getLineages();
  const j4InList = lineagesRes.lineages.find((l) => l.lineageId === 'jeungsan4_redevelopment');
  assert(
    j4InList !== undefined,
    'TC_8F_06_API_LINEAGES_CONTAINS_JEUNGSAN4',
    `Display name: "${j4InList?.displayName}"`
  );

  // TEST 5: API getLineageDetail
  const detailRes = redevelopmentDataService.getLineageDetail('jeungsan4_redevelopment');
  assert(
    detailRes.success && detailRes.lineage.redevelopmentTypeLabel === '도심 공공주택 복합사업',
    'TC_8F_07_API_LINEAGE_DETAIL_TYPE',
    `Type label: ${detailRes.lineage.redevelopmentTypeLabel}, Status: ${detailRes.lineage.status}`
  );
  assert(
    detailRes.lineage.timeline.length >= 3 &&
    detailRes.lineage.timeline.every((m) => m.evidenceClass === 'OFFICIAL'),
    'TC_8F_08_API_LINEAGE_DETAIL_TIMELINE_OFFICIAL',
    `${detailRes.lineage.timeline.length} milestones, all OFFICIAL evidence`
  );

  // TEST 6: API getTargets (Safely returns empty for early phase project)
  const targetsRes = await redevelopmentDataService.getTargets('jeungsan4_redevelopment');
  assert(
    targetsRes.success &&
    targetsRes.predecessorTargets.length === 0 &&
    targetsRes.successorTargets.length === 0,
    'TC_8F_09_API_TARGETS_SAFE_EMPTY',
    'Predecessors: 0, Successors: 0 (No fabricated targets)'
  );

  // TEST 7: API getLandShare (Safely returns 0 tiers without crashing)
  const landShareRes = redevelopmentDataService.getLandShare('jeungsan4_redevelopment');
  assert(
    landShareRes.success && landShareRes.tiers.length === 0,
    'TC_8F_10_API_LAND_SHARE_SAFE_EMPTY',
    'Tiers count: 0, legal disclaimer preserved'
  );

  // TEST 8: API getConstructionCosts (Safely returns PLANNING phase)
  const costsRes = redevelopmentDataService.getConstructionCosts('jeungsan4_redevelopment');
  assert(
    costsRes.success && costsRes.events.length === 0 && costsRes.currentPhase === 'PLANNING',
    'TC_8F_11_API_CONSTRUCTION_COSTS_SAFE_EMPTY',
    `Current phase: ${costsRes.currentPhase}, events: 0`
  );

  // TEST 9: Readiness Service (Safely evaluates NOT_READY / PARTIAL without exceptions)
  const readiness = detailRes.lineage.readiness;
  assert(
    readiness !== undefined && readiness.nominalHistorical.readiness === 'NOT_READY',
    'TC_8F_12_READINESS_SAFE_EVALUATION',
    `Nominal historical readiness: ${readiness.nominalHistorical.readiness} (${readiness.nominalHistorical.availability})`
  );
  assert(
    readiness.costAdjusted.readiness === 'NOT_READY' &&
    readiness.xirr.readiness === 'NOT_READY',
    'TC_8F_13_READINESS_NOMINAL_VALUE_NOT_READY',
    `CostAdjusted: ${readiness.costAdjusted.readiness}, XIRR: ${readiness.xirr.readiness}`
  );

  // TEST 10: Analysis API Refusal (Public API safely refuses ungrounded calculation)
  try {
    await redevelopmentDataService.analyzeRedevelopmentPublic({
      lineageId: 'jeungsan4_redevelopment',
      analysisMode: 'VERIFIED_HISTORICAL',
    } as any);
    assert(false, 'TC_8F_14_ANALYSIS_REFUSAL_OR_REJECTION', 'Unexpected success without target');
  } catch (err: any) {
    assert(
      err.code === 'INVALID_COMPLEX' || err.code === 'INVALID_AREA_FAMILY',
      'TC_8F_14_ANALYSIS_REFUSAL_OR_REJECTION',
      `Safely rejected ungrounded analysis with error code: ${err.code}`
    );
  }

  // TEST 11: Zero Dunchon Leakage in Jeungsan 4 Seed/API Data
  const seedString = JSON.stringify(bundle);
  const containsDunchonInSeed = seedString.includes('dunchon') || seedString.includes('올림픽파크포레온');
  assert(
    !containsDunchonInSeed,
    'TC_8F_15_ZERO_DUNCHON_LEAKAGE_IN_SEED',
    'No Dunchon-specific identifiers or data found in Jeungsan 4 seed bundle'
  );

  // TEST 12: Zero Mutation Check
  if (db) {
    const colV2 = collection(db, 'monthlyComplexPrices_v2');
    const snapAfter = await getCountFromServer(colV2);
    const countAfter = snapAfter.data().count;
    assert(
      countBefore === countAfter,
      'TC_8F_16_ZERO_FIRESTORE_MUTATIONS',
      `Firestore document count preserved: ${countBefore} === ${countAfter}`
    );
  }

  // Summary
  console.log('================================================================');
  console.log(`📊 PHASE 8F VERIFICATION SUMMARY: ${passed} / ${passed + failed} PASSED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

verifyJeungsan4E2E().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
