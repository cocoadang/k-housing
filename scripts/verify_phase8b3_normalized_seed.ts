import fs from 'fs';
import path from 'path';
import type {
  NormalizedProjectSeed,
  NormalizedMappingSeed,
  NormalizedFinancialSeed,
  NormalizedConstructionCostSeed,
  NormalizedLandShareSeed,
  NormalizedAnalysisSeed,
} from '../src/types/redevelopmentNormalizedSeed';
import type {
  RedevelopmentEvidenceVerificationFile,
  RedevelopmentVerifiedCandidatesFile,
  EvidencePendingItem,
} from '../src/types/redevelopmentEvidence';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function runPhase8B3Verification() {
  console.log("==================================================");
  console.log("PHASE 8B-3 NORMALIZED SEED VERIFICATION RUNNER");
  console.log("==================================================");

  const baseDir = process.cwd();
  const dataDir = path.join(baseDir, 'data', 'redevelopment');

  // 1. Check Read-Only Input Files (Phase 8B-2)
  console.log("\n1. Verifying Read-Only Input Files (Phase 8B-2)...");
  const inputFiles = [
    'dunchon_source_audit_v1.json',
    'dunchon_evidence_verification_v1.json',
    'dunchon_verified_candidates_v1.json',
    'dunchon_evidence_pending_v1.json',
  ];
  for (const f of inputFiles) {
    const p = path.join(dataDir, f);
    assert(fs.existsSync(p), `Required 8B-2 input file missing: ${f}`);
    console.log(`  ✓ Found 8B-2 input: ${f}`);
  }

  const verificationData: RedevelopmentEvidenceVerificationFile = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'dunchon_evidence_verification_v1.json'), 'utf-8')
  );
  const candidatesData: RedevelopmentVerifiedCandidatesFile = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'dunchon_verified_candidates_v1.json'), 'utf-8')
  );
  const pendingData: { items: EvidencePendingItem[] } = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'dunchon_evidence_pending_v1.json'), 'utf-8')
  );

  assert(verificationData.totalItems === 43, `8B-2 totalItems must be 43, got ${verificationData.totalItems}`);
  assert(candidatesData.candidateCount === 39, `8B-2 candidateCount must be 39, got ${candidatesData.candidateCount}`);
  assert(pendingData.items.length === 4, `8B-2 pendingCount must be 4, got ${pendingData.items.length}`);
  console.log("  ✓ 8B-2 Input files validated (43 total: 39 candidates + 4 pending).");

  // 2. Check Phase 8B-3 New Output Files
  console.log("\n2. Checking Existence of Normalized 8B-3 Output Files...");
  const expectedNewFiles = [
    'dunchon_project_seed_v1.json',
    'dunchon_mapping_seed_v1.json',
    'dunchon_financial_seed_v1.json',
    'dunchon_construction_cost_seed_v1.json',
    'dunchon_land_share_seed_v1.json',
    'dunchon_analysis_seed_v1.json',
  ];
  for (const f of expectedNewFiles) {
    const p = path.join(dataDir, f);
    assert(fs.existsSync(p), `Missing Phase 8B-3 seed file: ${f}`);
    console.log(`  ✓ Found Phase 8B-3 seed: ${f}`);
  }

  const reportPath = path.join(baseDir, 'data', 'phase8b3_normalized_seed_report.json');
  assert(fs.existsSync(reportPath), 'Missing data/phase8b3_normalized_seed_report.json');
  console.log("  ✓ Found report: data/phase8b3_normalized_seed_report.json");

  // Load 8B-3 Datasets
  const projectSeed: NormalizedProjectSeed = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'dunchon_project_seed_v1.json'), 'utf-8')
  );
  const mappingSeed: NormalizedMappingSeed = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'dunchon_mapping_seed_v1.json'), 'utf-8')
  );
  const financialSeed: NormalizedFinancialSeed = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'dunchon_financial_seed_v1.json'), 'utf-8')
  );
  const costSeed: NormalizedConstructionCostSeed = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'dunchon_construction_cost_seed_v1.json'), 'utf-8')
  );
  const landSeed: NormalizedLandShareSeed = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'dunchon_land_share_seed_v1.json'), 'utf-8')
  );
  const analysisSeed: NormalizedAnalysisSeed = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'dunchon_analysis_seed_v1.json'), 'utf-8')
  );
  const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

  // 3. Validate Production Eligibility Classification
  console.log("\n3. Validating Production Eligibility Classification...");
  const dist = analysisSeed.productionEligibilityDistribution;
  assert(dist.VERIFIED === 22, `VERIFIED count must be 22, got ${dist.VERIFIED}`);
  assert(dist.SUPPORTED === 14, `SUPPORTED count must be 14, got ${dist.SUPPORTED}`);
  assert(dist.RESEARCH_ONLY === 3, `RESEARCH_ONLY count must be 3, got ${dist.RESEARCH_ONLY}`);
  assert(dist.PENDING === 4, `PENDING count must be 4, got ${dist.PENDING}`);
  assert(dist.total === 43, `Total distribution must be 43, got ${dist.total}`);
  assert(dist.VERIFIED + dist.SUPPORTED + dist.RESEARCH_ONLY + dist.PENDING === 43, "Sum must be 43");
  console.log(`  ✓ Production Eligibility: VERIFIED=${dist.VERIFIED}, SUPPORTED=${dist.SUPPORTED}, RESEARCH_ONLY=${dist.RESEARCH_ONLY}, PENDING=${dist.PENDING} (Total 43)`);

  // Verify the 3 application examples are strictly RESEARCH_ONLY
  assert(mappingSeed.applicationExamples.length === 3, "Must have exactly 3 application examples");
  for (const ex of mappingSeed.applicationExamples) {
    assert(ex.eligibility === 'RESEARCH_ONLY', `Application example ${ex.exampleId} must be RESEARCH_ONLY`);
    assert(['evi_mapping_sample_1', 'evi_mapping_sample_2', 'evi_mapping_sample_3'].includes(ex.evidenceId), `Unknown example evidence ID: ${ex.evidenceId}`);
  }
  console.log("  ✓ 3 Application Examples strictly quarantined as RESEARCH_ONLY (no promotion to verified mapping).");

  // 4. Validate Area Mapping Seed
  console.log("\n4. Validating Area Mapping Coverage Seed...");
  assert(mappingSeed.summary.predecessorFamilies === 16, `Predecessor families must be 16, got ${mappingSeed.summary.predecessorFamilies}`);
  assert(mappingSeed.summary.verifiedActual === 0, `verifiedActual must be 0, got ${mappingSeed.summary.verifiedActual}`);
  assert(mappingSeed.summary.verifiedOption === 0, `verifiedOption must be 0, got ${mappingSeed.summary.verifiedOption}`);
  assert(mappingSeed.summary.partial === 0, `partial must be 0, got ${mappingSeed.summary.partial}`);
  assert(mappingSeed.summary.unknown === 16, `unknown must be 16, got ${mappingSeed.summary.unknown}`);
  assert(mappingSeed.summary.applicationExamples === 3, `applicationExamples must be 3, got ${mappingSeed.summary.applicationExamples}`);
  assert(mappingSeed.summary.automatic === 0, `automatic mapping must be 0, got ${mappingSeed.summary.automatic}`);
  assert(mappingSeed.coverageRecords.length === 16, `coverageRecords length must be 16, got ${mappingSeed.coverageRecords.length}`);

  for (const rec of mappingSeed.coverageRecords) {
    assert(rec.coverageStatus === 'UNKNOWN', `Coverage status for ${rec.familyId} must be UNKNOWN`);
    assert(rec.actualAllocationCount === 0, `actualAllocationCount must be 0`);
  }
  console.log("  ✓ Area Mapping Coverage verified: 16 Predecessors, 0 Verified Actual, 16 Unknown, 0 Automatic.");

  // 5. Validate Financial Semantics Seed
  console.log("\n5. Validating Financial Semantics Seed...");
  assert(financialSeed.proportionalRate.valuePct === 120.37, `Proportional rate must be 120.37%`);
  assert(financialSeed.proportionalRate.eligibility === 'PENDING' || financialSeed.proportionalRate.eligibility === 'VERIFIED', `Proportional rate must be PENDING or VERIFIED per 8D-1 audit`);
  assert(financialSeed.generalSalePrice.pricePerPyeong === 38290000, `General sale price must be 38,290,000`);
  assert(financialSeed.generalSalePrice.eligibility === 'VERIFIED', `General sale price must be VERIFIED`);

  const metrics = financialSeed.metricsBySemanticType;
  assert(metrics.PREDECESSOR_APPRAISAL_VALUE.semanticType === 'PREDECESSOR_APPRAISAL_VALUE', "PREDECESSOR_APPRAISAL_VALUE semantic separation");
  assert(metrics.PREDECESSOR_APPRAISAL_VALUE.individualValues === null, "Individual appraisal values must be null (not 0)");
  assert(metrics.RIGHTS_VALUE.semanticType === 'RIGHTS_VALUE', "RIGHTS_VALUE semantic separation");
  assert(metrics.MEMBER_SALE_PRICE.semanticType === 'MEMBER_SALE_PRICE', "MEMBER_SALE_PRICE semantic separation");
  assert(metrics.ADDITIONAL_CONTRIBUTION.semanticType === 'ADDITIONAL_CONTRIBUTION', "ADDITIONAL_CONTRIBUTION semantic separation");
  assert(metrics.ADDITIONAL_CHARGE.semanticType === 'ADDITIONAL_CHARGE', "ADDITIONAL_CHARGE semantic separation");
  assert(metrics.ADDITIONAL_CHARGE.value === null, "ADDITIONAL_CHARGE must be null (not 0)");
  assert(metrics.REFUND.semanticType === 'REFUND', "REFUND semantic separation");
  assert(metrics.REFUND.value === null, "REFUND must be null (not 0)");
  assert(financialSeed.applicationExampleProhibition.enforced === true, "Application example prohibition must be enforced");
  console.log("  ✓ Financial semantics validated: strict separation of 6 types, no 0-padding, prohibition enforced.");

  // 6. Validate Construction Cost Seed
  console.log("\n6. Validating Construction Cost Seed...");
  assert(costSeed.isFinal === false, "Cost must not be FINAL");
  assert(costSeed.finalTotalCostKrw === null, "finalTotalCostKrw must be null");

  const statuses = new Set(costSeed.costEvents.map(e => e.status));
  assert(statuses.has('SIGNED_CONTRACT'), "Must have SIGNED_CONTRACT");
  assert(statuses.has('REQUESTED'), "Must have REQUESTED");
  assert(statuses.has('VERIFIED'), "Must have VERIFIED");
  assert(statuses.has('AGREED'), "Must have AGREED");
  assert(!statuses.has('FINAL'), "Must NOT have FINAL in completed events");

  const demandedEvent = costSeed.costEvents.find(e => e.eventId === 'cost_event_2022_builder_demand');
  assert(demandedEvent !== undefined, "2022 builder demand event must exist");
  assert((demandedEvent.status as string) !== 'FINAL', "2022 demand status must NOT be FINAL");
  assert(demandedEvent.status === 'REQUESTED', `2022 demand status must be REQUESTED, got ${demandedEvent.status}`);

  // REB breakdown
  assert(costSeed.rebAuditBreakdown.targetAmountKrw === 162100000000, "REB target must be 162.1B");
  assert(costSeed.rebAuditBreakdown.reducedAmountKrw === 37700000000, "REB reduction must be 37.7B");
  assert(costSeed.rebAuditBreakdown.recognizedAmountKrw === 124400000000, "REB recognized must be 124.4B");
  assert(costSeed.rebAuditBreakdown.unverifiableAmountKrw === 976400000000, "REB unverifiable must be 976.4B");
  console.log("  ✓ Construction Cost validated: SIGNED_CONTRACT, REQUESTED, VERIFIED, AGREED, NOT_FINAL.");

  // 7. Validate Land Share Seed
  console.log("\n7. Validating Land Share Seed...");
  assert(landSeed.canonicalUnit === 'SQM', "Canonical unit must be SQM");
  assert(landSeed.totalDistinctTiers === 15, `Total distinct tiers must be 15, got ${landSeed.totalDistinctTiers}`);
  assert(landSeed.tiers.length >= 15, `Tiers count must be at least 15, got ${landSeed.tiers.length}`);
  assert(landSeed.inferenceProhibition.enforced === true, "Land share inference prohibition must be enforced");

  for (const t of landSeed.tiers) {
    assert(t.sourceOriginalUnit === 'PYEONG', "Original unit must be PYEONG");
    assert(t.sourceOriginalValue > 0, "Original value must be > 0");
    assert(t.canonicalValueSqm > 0, "Canonical value must be > 0");
    assert(t.isDerived === true, "isDerived must be true");
    assert(t.derivationMethod === 'PYEONG_TO_SQM_400_DIV_121', "derivationMethod must be PYEONG_TO_SQM_400_DIV_121");
  }
  console.log("  ✓ Land Share validated: 15 distinct tiers, canonical SQM derived from original PYEONG.");

  // 8. Validate Calculation Readiness Seed
  console.log("\n8. Validating Calculation Readiness Seed...");
  const cr = analysisSeed.readinessSummary;
  assert(cr.nominalAssetValue === 'PARTIAL', `Nominal Asset Value must be PARTIAL, got ${cr.nominalAssetValue}`);
  assert(cr.costAdjustedValue === 'PARTIAL', `Cost Adjusted Value must be PARTIAL, got ${cr.costAdjustedValue}`);
  assert(cr.xirr === 'NOT_READY', `XIRR must be NOT_READY, got ${cr.xirr}`);
  assert(cr.landShare === 'READY', `Land Share must be READY, got ${cr.landShare}`);
  assert(cr.constructionCostTimeline === 'READY', `Construction Cost Timeline must be READY, got ${cr.constructionCostTimeline}`);
  console.log("  ✓ Calculation Readiness validated: Nominal=PARTIAL, Cost=PARTIAL, XIRR=NOT_READY, Land=READY, CostTimeline=READY.");

  // 9. Validate Report Consistency & Firestore Safety
  console.log("\n9. Validating Report Consistency & Firestore Safety...");
  assert(reportData.verificationVerdict === 'DUNCHON_NORMALIZED_SEED_SUCCESS', "Report verdict must be DUNCHON_NORMALIZED_SEED_SUCCESS");
  assert(reportData.firestore.actualWrites === 0, "Firestore actualWrites must be 0");
  assert(reportData.firestore.actualUpdates === 0, "Firestore actualUpdates must be 0");
  assert(reportData.firestore.actualDeletes === 0, "Firestore actualDeletes must be 0");
  assert(reportData.filesCreated.length === 8, "Report must list 8 created files");
  console.log("  ✓ Report confirmed: Verdict=DUNCHON_NORMALIZED_SEED_SUCCESS, Firestore Writes=0.");

  console.log("\n==================================================");
  console.log("ALL PHASE 8B-3 NORMALIZATION TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================");
}

runPhase8B3Verification().catch((err) => {
  console.error("\n❌ Phase 8B-3 Verification Failed:", err);
  process.exit(1);
});
