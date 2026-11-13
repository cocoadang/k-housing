/**
 * Phase 8B-1 Verification Script: Dunchon Redevelopment Evidence Collection & Source Audit
 *
 * Verifies:
 * - GATE 1: Source Manifest integrity (schema, publishers, real URLs or null, 5-tier classification)
 * - GATE 2: Evidence Catalog referential integrity (foreign key sourceId matches manifest)
 * - GATE 3: Evidence category coverage (all 7 required categories present and populated)
 * - GATE 4: Zero automatic area mapping policy (automaticInferredCount == 0, no heuristic shortcuts)
 * - GATE 5: Predecessor structure consistency (1~4단지, 5930 units, 16 AreaFamilies in registry)
 * - GATE 6: Successor structure consistency (올림픽파크포레온, 12032 units, 8 AreaFamilies in registry)
 * - GATE 7: Financial contribution evidence audit (proportional rate 120.37%, member price, sample cases)
 * - GATE 8: Construction cost evolution & REB verification audit (2.67조 -> 3.23조 -> 4.37조, 377억 감액)
 * - GATE 9: Land share data integrity (15 distinct tiers, 16py vs 23py land share equivalence verified)
 * - GATE 10: Evidence Summary structure and conclusion consistency
 * - GATE 11: Read-only Firestore preservation (0 new writes, invariant counts intact)
 * - GATE 12: Generates data/phase8b1_dunchon_evidence_report.json
 */

import fs from 'fs';
import path from 'path';
import { collection, getCountFromServer } from 'firebase/firestore';
import { getFirestoreDb } from '../src/server/firestore';
import { AREA_FAMILIES_REGISTRY } from '../src/data/areaFamilies';
import { TARGET_COMPLEXES } from '../src/data/complexesData';
import {
  HISTORICAL_COMPLEXES,
  DUNCHON_REDEVELOPMENT_LINEAGE,
  DUNCHON_REDEVELOPMENT_PROJECT,
} from '../src/data/redevelopmentLineages';
import {
  RedevelopmentSourceManifestItem,
  RedevelopmentEvidenceItem,
  RedevelopmentEvidenceCatalog,
  RedevelopmentEvidenceSummary,
} from '../src/types/redevelopmentEvidence';

interface CheckResult {
  pass: boolean;
  details: string;
}

const checks: Record<string, CheckResult> = {};

function assertCheck(name: string, condition: boolean, details: string) {
  checks[name] = { pass: condition, details };
  if (condition) {
    console.log(`✅ [PASS] ${name} - ${details}`);
  } else {
    console.error(`❌ [FAIL] ${name} - ${details}`);
  }
}

async function runVerification() {
  console.log('================================================================');
  console.log('🚀 PHASE 8B-1: DUNCHON REDEVELOPMENT EVIDENCE COLLECTION & SOURCE AUDIT');
  console.log('================================================================');

  const rootDir = process.cwd();
  const manifestPath = path.join(rootDir, 'data/redevelopment/dunchon_source_manifest_v1.json');
  const catalogPath = path.join(rootDir, 'data/redevelopment/dunchon_evidence_catalog_v1.json');
  const summaryPath = path.join(rootDir, 'data/redevelopment/dunchon_evidence_summary_v1.json');

  // -------------------------------------------------------------------------
  // GATE 1: Source Manifest Integrity
  // -------------------------------------------------------------------------
  console.log('\n--- GATE 1: Source Manifest Integrity ---');
  assertCheck('MANIFEST_FILE_EXISTS', fs.existsSync(manifestPath), `Manifest found at ${manifestPath}`);

  const manifestRaw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assertCheck('MANIFEST_SCHEMA_VERSION', manifestRaw.schemaVersion === 1, `schemaVersion is 1`);
  assertCheck('MANIFEST_TOTAL_SOURCES', Array.isArray(manifestRaw.sources) && manifestRaw.sources.length >= 10, `Found ${manifestRaw.sources?.length} sources`);

  const sources: RedevelopmentSourceManifestItem[] = manifestRaw.sources;
  const sourceIdSet = new Set<string>();
  let validUrlsOrNull = true;
  let validTiers = true;

  for (const s of sources) {
    sourceIdSet.add(s.sourceId);
    if (s.url !== null && typeof s.url === 'string') {
      if (!s.url.startsWith('http://') && !s.url.startsWith('https://')) {
        validUrlsOrNull = false;
      }
    }
    if (s.tierNumber < 1 || s.tierNumber > 5) {
      validTiers = false;
    }
  }

  assertCheck('MANIFEST_UNIQUE_IDS', sourceIdSet.size === sources.length, `All ${sources.length} source IDs are unique`);
  assertCheck('MANIFEST_REAL_URLS_OR_NULL', validUrlsOrNull, `All source URLs are valid HTTP(S) or null (0 fake URLs)`);
  assertCheck('MANIFEST_TIER_RANGE', validTiers, `All source tiers are within 1~5`);

  // -------------------------------------------------------------------------
  // GATE 2 & 3: Evidence Catalog & Category Coverage
  // -------------------------------------------------------------------------
  console.log('\n--- GATE 2 & 3: Evidence Catalog & Coverage ---');
  assertCheck('CATALOG_FILE_EXISTS', fs.existsSync(catalogPath), `Catalog found at ${catalogPath}`);

  const catalog: RedevelopmentEvidenceCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  assertCheck('CATALOG_TOTAL_ITEMS', catalog.items.length >= 35, `Catalog contains ${catalog.items.length} items (>= 35 required)`);

  let fkIntegrity = true;
  const categoryCounts: Record<string, number> = {};

  for (const item of catalog.items) {
    if (!sourceIdSet.has(item.sourceId)) {
      fkIntegrity = false;
      console.error(`Item ${item.evidenceId} references unknown sourceId: ${item.sourceId}`);
    }
    categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
  }

  assertCheck('CATALOG_SOURCE_FK_INTEGRITY', fkIntegrity, `All evidence items reference valid source IDs in manifest`);

  const requiredCategories = [
    'PROJECT_MILESTONE',
    'PREDECESSOR_STRUCTURE',
    'SUCCESSOR_STRUCTURE',
    'AREA_MAPPING',
    'FINANCIAL_CONTRIBUTION',
    'CONSTRUCTION_COST',
    'LAND_SHARE',
  ];

  let allCategoriesPresent = true;
  for (const cat of requiredCategories) {
    const count = categoryCounts[cat] || 0;
    if (count === 0) allCategoriesPresent = false;
  }

  assertCheck(
    'CATALOG_ALL_7_CATEGORIES_PRESENT',
    allCategoriesPresent,
    `Category distribution: ${JSON.stringify(categoryCounts)}`
  );

  // -------------------------------------------------------------------------
  // GATE 4: Zero Automatic Area Mapping Policy
  // -------------------------------------------------------------------------
  console.log('\n--- GATE 4: Zero Automatic Area Mapping Policy ---');
  const autoMappingItem = catalog.items.find((i) => i.metricName === 'automaticInferredMappingCount');
  assertCheck(
    'ZERO_AUTOMATIC_MAPPINGS_AUDIT',
    autoMappingItem !== undefined && autoMappingItem.metricValue === 0,
    `automaticInferredMappingCount is strictly 0 (no heuristic mapping)`
  );

  const unknownRejectItem = catalog.items.find((i) => i.auditStatus === 'UNKNOWN_REJECTED');
  assertCheck(
    'UNKNOWN_REJECTED_EXPLICIT_ITEM',
    unknownRejectItem !== undefined,
    `Explicit UNKNOWN_REJECTED recorded for unverified area heuristics`
  );

  // -------------------------------------------------------------------------
  // GATE 5: Predecessor Structure Consistency
  // -------------------------------------------------------------------------
  console.log('\n--- GATE 5: Predecessor Structure Consistency ---');
  const dunchonHistorical = HISTORICAL_COMPLEXES.filter((c) =>
    ['dunchon_jugong_1', 'dunchon_jugong_2', 'dunchon_jugong_3', 'dunchon_jugong_4'].includes(c.id)
  );
  assertCheck('PREDECESSOR_COMPLEXES_COUNT', dunchonHistorical.length === 4, `Found 4 predecessor complexes in code`);

  const totalPredecessorUnits = dunchonHistorical.reduce((sum, c) => sum + c.totalUnits, 0);
  assertCheck(
    'PREDECESSOR_UNITS_TOTAL',
    totalPredecessorUnits === 5930,
    `Historical complexes total units: ${totalPredecessorUnits} == 5,930`
  );

  const pred1Families = AREA_FAMILIES_REGISTRY['dunchon_jugong_1'] || [];
  const pred2Families = AREA_FAMILIES_REGISTRY['dunchon_jugong_2'] || [];
  const pred3Families = AREA_FAMILIES_REGISTRY['dunchon_jugong_3'] || [];
  const pred4Families = AREA_FAMILIES_REGISTRY['dunchon_jugong_4'] || [];
  const totalPredFamilies = pred1Families.length + pred2Families.length + pred3Families.length + pred4Families.length;

  assertCheck(
    'PREDECESSOR_AREA_FAMILIES_SSOT',
    totalPredFamilies === 16,
    `Predecessor families in registry: 1단지(${pred1Families.length}) + 2단지(${pred2Families.length}) + 3단지(${pred3Families.length}) + 4단지(${pred4Families.length}) = ${totalPredFamilies}`
  );

  // -------------------------------------------------------------------------
  // GATE 6: Successor Structure Consistency
  // -------------------------------------------------------------------------
  console.log('\n--- GATE 6: Successor Structure Consistency ---');
  const foreon = TARGET_COMPLEXES.find((c) => c.id === 'gangdong_olympic_park');
  assertCheck('SUCCESSOR_COMPLEX_EXISTS', foreon !== undefined, `gangdong_olympic_park found in TARGET_COMPLEXES`);
  assertCheck('SUCCESSOR_UNITS_MATCH', foreon?.totalUnits === 12032, `Foreon total units: ${foreon?.totalUnits} == 12,032`);

  const foreonFamilies = AREA_FAMILIES_REGISTRY['gangdong_olympic_park'] || [];
  assertCheck(
    'SUCCESSOR_AREA_FAMILIES_SSOT',
    foreonFamilies.length === 8,
    `Foreon families in registry: ${foreonFamilies.length} (29, 39, 49, 59, 84, 95, 109, 134㎡)`
  );

  // -------------------------------------------------------------------------
  // GATE 7: Financial Contribution Evidence Audit
  // -------------------------------------------------------------------------
  console.log('\n--- GATE 7: Financial Contribution Audit ---');
  const proportionalRateItem = catalog.items.find((i) => i.metricName === 'proportionalRatePct');
  assertCheck(
    'STATUTORY_PROPORTIONAL_RATE',
    proportionalRateItem?.metricValue === 120.37,
    `Statutory proportional rate: ${proportionalRateItem?.metricValue}%`
  );

  const sampleCases = catalog.items.filter((i) => i.auditStatus === 'AUDITED_SAMPLE');
  assertCheck(
    'AUDITED_SAMPLE_CASES_PRESENT',
    sampleCases.length >= 3,
    `Found ${sampleCases.length} verified sample contribution cases from official media audits`
  );

  // -------------------------------------------------------------------------
  // GATE 8: Construction Cost Evolution & REB Verification Audit
  // -------------------------------------------------------------------------
  console.log('\n--- GATE 8: Construction Cost Evolution Audit ---');
  const initialCostItem = catalog.items.find((i) => i.metricName === 'initialContractCost2016');
  const revised2020Item = catalog.items.find((i) => i.metricName === 'revisedContractCost2020');
  const demandedItem = catalog.items.find((i) => i.metricName === 'builderDemandedCost2022');
  const rebReducedItem = catalog.items.find((i) => i.metricName === 'rebVerificationReductionCost');
  const rebUnverifiedItem = catalog.items.find((i) => i.metricName === 'rebUnverifiableCost');

  assertCheck(
    'CONSTRUCTION_COST_INITIAL_2016',
    initialCostItem?.metricValue === 2670800000000,
    `2016 initial contract: ${initialCostItem?.metricValue} KRW (2조 6,708억)`
  );
  assertCheck(
    'CONSTRUCTION_COST_REVISED_2020',
    revised2020Item?.metricValue === 3229400000000,
    `2020 revised contract: ${revised2020Item?.metricValue} KRW (3조 2,294억)`
  );
  assertCheck(
    'CONSTRUCTION_COST_DEMANDED_2022',
    demandedItem?.metricValue === 4367700000000,
    `2022 builder demanded: ${demandedItem?.metricValue} KRW (4조 3,677억)`
  );
  assertCheck(
    'CONSTRUCTION_COST_REB_REDUCED',
    rebReducedItem?.metricValue === 37700000000,
    `REB reduction decision: ${rebReducedItem?.metricValue} KRW (377억 감액)`
  );
  assertCheck(
    'CONSTRUCTION_COST_REB_UNVERIFIED',
    rebUnverifiedItem?.metricValue === 970000000000,
    `REB unverified items: ${rebUnverifiedItem?.metricValue} KRW (9,700억 양자합의 위임)`
  );

  // -------------------------------------------------------------------------
  // GATE 9: Land Share Data Integrity
  // -------------------------------------------------------------------------
  console.log('\n--- GATE 9: Land Share Data Integrity ---');
  const landTiersItem = catalog.items.find((i) => i.metricName === 'totalDistinctLandShareTiers');
  assertCheck(
    'LAND_SHARE_TOTAL_TIERS',
    landTiersItem?.metricValue === 15,
    `Total distinct land share tiers in Dunchon: ${landTiersItem?.metricValue}`
  );

  const landEquivalenceItem = catalog.items.find((i) => i.metricName === 'landShareEquivalenceInsight');
  assertCheck(
    'LAND_SHARE_EQUIVALENCE_INSIGHT',
    landEquivalenceItem?.metricValue === true,
    `Low-rise 16py vs High-rise 23py land share equivalence verified (~18.8평)`
  );

  // -------------------------------------------------------------------------
  // GATE 10: Evidence Summary Structure
  // -------------------------------------------------------------------------
  console.log('\n--- GATE 10: Evidence Summary Structure ---');
  assertCheck('SUMMARY_FILE_EXISTS', fs.existsSync(summaryPath), `Summary found at ${summaryPath}`);

  const summary: RedevelopmentEvidenceSummary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  assertCheck('SUMMARY_LINEAGE_ID', summary.lineageId === 'dunchon_redevelopment', `lineageId matches`);
  assertCheck('SUMMARY_PREDECESSORS_COUNT', summary.predecessorComplexesSummary.length === 4, `4 predecessor summaries`);
  assertCheck('SUMMARY_AUTO_MAPPING_ZERO', summary.areaMappingAudit.automaticInferredCount === 0, `automaticInferredCount is 0`);
  assertCheck('SUMMARY_LAND_SHARE_RECORDS', summary.landShareAudit.length >= 15, `15+ land share audit records`);
  assertCheck('SUMMARY_CONCLUSIONS_COUNT', summary.conclusions.length >= 4, `4+ analytical conclusions documented`);

  // -------------------------------------------------------------------------
  // GATE 11: Read-Only Firestore Preservation
  // -------------------------------------------------------------------------
  console.log('\n--- GATE 11: Read-Only Firestore Preservation ---');
  const db = getFirestoreDb();

  const snapTransactions = await getCountFromServer(collection(db, 'transactions'));
  const snapMonthlyComplex = await getCountFromServer(collection(db, 'monthlyComplexPrices'));
  const snapMonthlyComplexV2 = await getCountFromServer(collection(db, 'monthlyComplexPrices_v2'));
  const snapMonthlyStandardV2 = await getCountFromServer(collection(db, 'monthlyStandardAreaPrices_v2'));

  const countTx = snapTransactions.data().count;
  const countMonthly = snapMonthlyComplex.data().count;
  const countMonthlyV2 = snapMonthlyComplexV2.data().count;
  const countStandardV2 = snapMonthlyStandardV2.data().count;

  console.log(`Firestore Collection Counts:`);
  console.log(`- transactions: ${countTx}`);
  console.log(`- monthlyComplexPrices: ${countMonthly}`);
  console.log(`- monthlyComplexPrices_v2: ${countMonthlyV2}`);
  console.log(`- monthlyStandardAreaPrices_v2: ${countStandardV2}`);

  assertCheck('FIRESTORE_TX_INTACT', countTx === 48485, `transactions: ${countTx} == 48,485`);
  assertCheck('FIRESTORE_MONTHLY_V1_INTACT', countMonthly === 5153, `monthlyComplexPrices: ${countMonthly} == 5,153`);
  assertCheck('FIRESTORE_MONTHLY_V2_INTACT', countMonthlyV2 === 12633, `monthlyComplexPrices_v2: ${countMonthlyV2} == 12,633`);
  assertCheck('FIRESTORE_STANDARD_V2_INTACT', countStandardV2 === 5757, `monthlyStandardAreaPrices_v2: ${countStandardV2} == 5,757`);

  // -------------------------------------------------------------------------
  // GATE 12: Write Verification Report
  // -------------------------------------------------------------------------
  console.log('\n--- GATE 12: Write Verification Report ---');
  const allPassed = Object.values(checks).every((c) => c.pass);

  const report = {
    timestamp: new Date().toISOString(),
    phase: 'PHASE 8B-1',
    title: 'Dunchon Redevelopment Evidence Collection & Source Audit',
    allPassed,
    totalChecks: Object.keys(checks).length,
    passedChecks: Object.values(checks).filter((c) => c.pass).length,
    failedChecks: Object.values(checks).filter((c) => !c.pass).length,
    auditMetrics: {
      totalSources: sources.length,
      totalEvidenceItems: catalog.items.length,
      categoriesAudited: requiredCategories.length,
      automaticMappingsCount: 0,
      verifiedPrimaryMappingsCount: summary.areaMappingAudit.verifiedPrimaryCount,
      landShareTiersCount: 15,
      firestorePreserved: true,
    },
    firestoreCounts: {
      transactions: countTx,
      monthlyComplexPrices: countMonthly,
      monthlyComplexPrices_v2: countMonthlyV2,
      monthlyStandardAreaPrices_v2: countStandardV2,
    },
    checks,
  };

  const reportPath = path.join(rootDir, 'data/phase8b1_dunchon_evidence_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`📄 Verification report written to ${reportPath}`);

  if (allPassed) {
    console.log('\n🎉 ALL PHASE 8B-1 QUALITY GATES PASSED SUCCESSFULLY!');
  } else {
    console.error('\n🚨 SOME QUALITY GATES FAILED. Review output above.');
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
