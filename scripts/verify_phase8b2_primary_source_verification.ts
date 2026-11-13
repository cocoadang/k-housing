/**
 * Phase 8B-2 Primary-Source Verification Test Script
 *
 * Verifies that:
 * 1. All 15 sources in dunchon_source_manifest_v1.json are rigorously audited in dunchon_source_audit_v1.json.
 * 2. All 43 evidence items in dunchon_evidence_catalog_v1.json have claim-by-claim verification in dunchon_evidence_verification_v1.json.
 * 3. Verified candidates (39 items) and Pending/Rejected (4 items) strictly partition the 43 evidence catalog items.
 * 4. Verification rules are strictly enforced:
 *    - Unconfirmed statutory notices (e.g. transfer notice) are downgraded and isolated into pending.
 *    - Mapping examples are classified as APPLICATION_EXAMPLE, not ACTUAL_ALLOCATION.
 *    - Heuristic auto-mapping is rejected and not in verified candidates.
 *    - Unresolved disputes (9,764억원) are isolated into pending.
 *    - Analytical inferences (land share group equivalence) are isolated into pending.
 * 5. Data integrity: JSON schemas, non-empty fields, correct count aggregations.
 */

import fs from "fs";
import path from "path";
import {
  RedevelopmentSourceManifest,
  DunchonEvidenceCatalog,
  DunchonSourceAuditDataset,
  DunchonEvidenceVerificationDataset,
  DunchonVerifiedCandidatesDataset,
  DunchonEvidencePendingDataset,
} from "../src/types/redevelopmentEvidence";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
}

async function runVerification() {
  console.log("==================================================");
  console.log("PHASE 8B-2 PRIMARY-SOURCE VERIFICATION RUNNER");
  console.log("==================================================\n");

  const baseDir = process.cwd();
  const manifestPath = path.join(baseDir, "data/redevelopment/dunchon_source_manifest_v1.json");
  const catalogPath = path.join(baseDir, "data/redevelopment/dunchon_evidence_catalog_v1.json");
  const sourceAuditPath = path.join(baseDir, "data/redevelopment/dunchon_source_audit_v1.json");
  const verificationPath = path.join(baseDir, "data/redevelopment/dunchon_evidence_verification_v1.json");
  const candidatesPath = path.join(baseDir, "data/redevelopment/dunchon_verified_candidates_v1.json");
  const pendingPath = path.join(baseDir, "data/redevelopment/dunchon_evidence_pending_v1.json");

  // Step 1: File Existence
  console.log("1. Checking File Existence...");
  const files = [manifestPath, catalogPath, sourceAuditPath, verificationPath, candidatesPath, pendingPath];
  for (const f of files) {
    assert(fs.existsSync(f), `File does not exist: ${f}`);
    console.log(`  ✓ Found ${path.basename(f)}`);
  }

  // Load JSONs
  const manifest: RedevelopmentSourceManifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const catalog: DunchonEvidenceCatalog = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
  const sourceAudit: DunchonSourceAuditDataset = JSON.parse(fs.readFileSync(sourceAuditPath, "utf-8"));
  const verification: DunchonEvidenceVerificationDataset = JSON.parse(fs.readFileSync(verificationPath, "utf-8"));
  const candidates: DunchonVerifiedCandidatesDataset = JSON.parse(fs.readFileSync(candidatesPath, "utf-8"));
  const pending: DunchonEvidencePendingDataset = JSON.parse(fs.readFileSync(pendingPath, "utf-8"));

  // Step 2: Source Audit Verification
  console.log("\n2. Validating Source Audit Dataset...");
  assert(manifest.totalSources === 15, `Manifest source count must be 15, got ${manifest.totalSources}`);
  assert(sourceAudit.totalSources === 15, `Source audit totalSources must be 15, got ${sourceAudit.totalSources}`);
  assert(sourceAudit.items.length === 15, `Source audit items array length must be 15, got ${sourceAudit.items.length}`);

  const manifestSourceIds = new Set(manifest.sources.map((s) => s.sourceId));
  const auditSourceIds = new Set(sourceAudit.items.map((s) => s.sourceId));
  assert(manifestSourceIds.size === 15, "Manifest source IDs must be unique");
  assert(auditSourceIds.size === 15, "Audit source IDs must be unique");

  for (const id of manifestSourceIds) {
    assert(auditSourceIds.has(id), `Source ID ${id} in manifest missing in source audit`);
  }

  // Check access statuses
  let primaryCount = 0;
  let secondaryCount = 0;
  for (const item of sourceAudit.items) {
    assert(!!item.sourceId, "Source audit item must have sourceId");
    assert(!!item.publisher, `Source ${item.sourceId} must have publisher`);
    assert(!!item.title, `Source ${item.sourceId} must have title`);
    assert(item.tierNumber >= 1 && item.tierNumber <= 5, `Source ${item.sourceId} invalid tierNumber`);
    assert(!!item.auditFindings && item.auditFindings.length > 10, `Source ${item.sourceId} must have auditFindings`);
    assert(!!item.limitations && item.limitations.length > 5, `Source ${item.sourceId} must have limitations`);

    if (item.accessStatus === "ACCESSIBLE_PRIMARY") primaryCount++;
    if (item.accessStatus === "ACCESSIBLE_SECONDARY") secondaryCount++;

    // Specifically check src_gangdong_2026_transfer is identified as CONTENT_NOT_FOUND
    if (item.sourceId === "src_gangdong_2026_transfer") {
      assert(
        item.accessStatus === "CONTENT_NOT_FOUND",
        `src_gangdong_2026_transfer must be marked CONTENT_NOT_FOUND, got ${item.accessStatus}`
      );
    }
  }

  assert(sourceAudit.byAccessStatus.ACCESSIBLE_PRIMARY === 9, `ACCESSIBLE_PRIMARY count must be 9, got ${sourceAudit.byAccessStatus.ACCESSIBLE_PRIMARY}`);
  assert(sourceAudit.byAccessStatus.ACCESSIBLE_SECONDARY === 5, `ACCESSIBLE_SECONDARY count must be 5, got ${sourceAudit.byAccessStatus.ACCESSIBLE_SECONDARY}`);
  assert(sourceAudit.byAccessStatus.CONTENT_NOT_FOUND === 1, `CONTENT_NOT_FOUND count must be 1, got ${sourceAudit.byAccessStatus.CONTENT_NOT_FOUND}`);
  console.log(`  ✓ Source Audit Verified: 15 sources (9 Primary, 5 Secondary, 1 Not Found)`);

  // Step 3: Evidence Verification Dataset
  console.log("\n3. Validating Evidence Verification Dataset (Claim-by-Claim)...");
  const catalogTotal = catalog.metricsSummary?.totalItems ?? (catalog as any).totalEvidenceCount;
  assert(catalogTotal === 43, `Catalog count must be 43, got ${catalogTotal}`);
  assert(verification.totalItems === 43, `Verification totalItems must be 43, got ${verification.totalItems}`);
  assert(verification.items.length === 43, `Verification items length must be 43, got ${verification.items.length}`);

  const catalogItems: any[] = (catalog as any).items ?? (catalog as any).evidenceItems ?? [];
  const catalogEvidenceIds = new Set<string>(catalogItems.map((e: any) => String(e.evidenceId)));
  const verificationEvidenceIds = new Set<string>(verification.items.map((e) => e.evidenceId));
  assert(catalogEvidenceIds.size === 43, "Catalog evidence IDs must be 43 unique items");
  assert(verificationEvidenceIds.size === 43, "Verification evidence IDs must be 43 unique items");

  for (const id of catalogEvidenceIds) {
    assert(verificationEvidenceIds.has(id), `Evidence ID ${id} in catalog missing in verification`);
  }

  // Check specific verification items
  for (const item of verification.items) {
    assert(!!item.originalClaim, `Item ${item.evidenceId} missing originalClaim`);
    assert(!!item.verificationStatus, `Item ${item.evidenceId} missing verificationStatus`);
    assert(!!item.adjustedConfidence, `Item ${item.evidenceId} missing adjustedConfidence`);
    assert(!!item.claimClassification, `Item ${item.evidenceId} missing claimClassification`);
    assert(!!item.verificationNotes && item.verificationNotes.length > 10, `Item ${item.evidenceId} missing verificationNotes`);
  }

  // Check candidate & pending counts
  assert(verification.verifiedCandidateCount === 39, `verifiedCandidateCount must be 39, got ${verification.verifiedCandidateCount}`);
  assert(verification.pendingCount === 4, `pendingCount must be 4, got ${verification.pendingCount}`);
  assert(
    verification.verifiedCandidateCount + verification.pendingCount === 43,
    "Candidate count + pending count must equal 43"
  );
  console.log(`  ✓ Verification Dataset Verified: 43 items (39 Candidates, 4 Pending)`);

  // Step 4: Cross-Validation of Candidates & Pending Datasets
  console.log("\n4. Validating Candidates vs Pending Partitioning...");
  assert(candidates.candidateCount === 39, `candidates.candidateCount must be 39, got ${candidates.candidateCount}`);
  assert(candidates.candidates.length === 39, `candidates.candidates.length must be 39, got ${candidates.candidates.length}`);
  assert(pending.pendingCount === 4, `pending.pendingCount must be 4, got ${pending.pendingCount}`);
  assert(pending.items.length === 4, `pending.items.length must be 4, got ${pending.items.length}`);

  const candidateEvidenceIds = new Set<string>(candidates.candidates.map((c) => c.evidenceId));
  const pendingEvidenceIds = new Set<string>((pending.items as any[]).map((p: any) => String(p.evidenceId)));

  // Disjoint check
  for (const id of candidateEvidenceIds) {
    assert(!pendingEvidenceIds.has(id), `Evidence ID ${id} appears in BOTH candidates and pending datasets!`);
  }
  for (const id of pendingEvidenceIds) {
    assert(!candidateEvidenceIds.has(id), `Evidence ID ${id} appears in BOTH candidates and pending datasets!`);
  }

  // Union completeness check
  const allPartitionIds = new Set([...candidateEvidenceIds, ...pendingEvidenceIds]);
  assert(allPartitionIds.size === 43, `Union of candidates and pending must be 43, got ${allPartitionIds.size}`);
  for (const id of catalogEvidenceIds) {
    assert(allPartitionIds.has(id), `Evidence ID ${id} is neither in candidates nor pending!`);
  }
  console.log("  ✓ Partitioning is strictly disjoint and complete (39 + 4 = 43).");

  // Step 5: Strict Verification Rules Enforcement
  console.log("\n5. Checking Strict Business & Methodological Rules...");

  // Rule 5.1: Unconfirmed transfer date
  const transferVerification = verification.items.find((i) => i.evidenceId === "evi_milestone_transfer")!;
  assert(transferVerification.verificationStatus === "INSUFFICIENT", "evi_milestone_transfer must be INSUFFICIENT");
  assert(transferVerification.adjustedConfidence === "UNKNOWN", "evi_milestone_transfer confidence must be UNKNOWN");
  assert(transferVerification.isVerifiedCandidate === false, "evi_milestone_transfer must not be candidate");
  const transferPending = pending.items.find((p) => p.evidenceId === "evi_milestone_transfer");
  assert(!!transferPending, "evi_milestone_transfer must be in pending dataset");
  assert(transferPending!.rejectionReason === "UNCONFIRMED_DATE", "evi_milestone_transfer rejectionReason must be UNCONFIRMED_DATE");
  console.log("  ✓ Rule 5.1: Unconfirmed transfer milestone properly rejected to pending with UNCONFIRMED_DATE.");

  // Rule 5.2: Mapping cases classified as APPLICATION_EXAMPLE
  const mappingSample1 = verification.items.find((i) => i.evidenceId === "evi_mapping_sample_1")!;
  const mappingSample2 = verification.items.find((i) => i.evidenceId === "evi_mapping_sample_2")!;
  const mappingSample3 = verification.items.find((i) => i.evidenceId === "evi_mapping_sample_3")!;
  assert(mappingSample1.claimClassification === "APPLICATION_EXAMPLE", "evi_mapping_sample_1 must be APPLICATION_EXAMPLE");
  assert(mappingSample2.claimClassification === "APPLICATION_EXAMPLE", "evi_mapping_sample_2 must be APPLICATION_EXAMPLE");
  assert(mappingSample3.claimClassification === "APPLICATION_EXAMPLE", "evi_mapping_sample_3 must be APPLICATION_EXAMPLE");
  console.log("  ✓ Rule 5.2: Mapping cases correctly classified as APPLICATION_EXAMPLE (not actual allocation).");

  // Rule 5.3: Heuristic auto-mapping rejected
  const mappingUnknown = verification.items.find((i) => i.evidenceId === "evi_mapping_unknown_reject")!;
  assert(mappingUnknown.isVerifiedCandidate === false, "evi_mapping_unknown_reject must not be a candidate");
  const mappingUnknownPending = pending.items.find((p) => p.evidenceId === "evi_mapping_unknown_reject");
  assert(!!mappingUnknownPending, "evi_mapping_unknown_reject must be in pending dataset");
  assert(mappingUnknownPending!.rejectionReason === "REJECTED_HEURISTIC", "Rejection reason must be REJECTED_HEURISTIC");
  console.log("  ✓ Rule 5.3: Heuristic auto-mapping rejection sentinel properly quarantined in pending.");

  // Rule 5.4: Unresolvable REB dispute
  const rebUnverifiable = verification.items.find((i) => i.evidenceId === "evi_cost_reb_unverifiable")!;
  assert(rebUnverifiable.isVerifiedCandidate === false, "evi_cost_reb_unverifiable must not be a candidate");
  const rebPending = pending.items.find((p) => p.evidenceId === "evi_cost_reb_unverifiable");
  assert(!!rebPending, "evi_cost_reb_unverifiable must be in pending dataset");
  assert(rebPending!.rejectionReason === "INSUFFICIENT_SOURCE", "REB unverified dispute rejectionReason must be INSUFFICIENT_SOURCE");
  console.log("  ✓ Rule 5.4: 9,764억원 REB unverified dispute quarantined in pending dataset.");

  // Rule 5.5: Land share insight equivalence is inference, not statutory fact
  const landEquiv = verification.items.find((i) => i.evidenceId === "evi_land_insight_equivalence")!;
  assert(landEquiv.claimClassification === "ANALYTICAL_INFERENCE", "evi_land_insight_equivalence must be ANALYTICAL_INFERENCE");
  assert(landEquiv.isVerifiedCandidate === false, "evi_land_insight_equivalence must not be a candidate");
  const landEquivPending = pending.items.find((p) => p.evidenceId === "evi_land_insight_equivalence");
  assert(!!landEquivPending, "evi_land_insight_equivalence must be in pending dataset");
  assert(landEquivPending!.rejectionReason === "INFERENCE_NOT_FACT", "Rejection reason must be INFERENCE_NOT_FACT");
  console.log("  ✓ Rule 5.5: Land share insight equivalence isolated into pending as INFERENCE_NOT_FACT.");

  // Step 6: Candidate usableInAnalysis and analysisUsageNotes check
  console.log("\n6. Checking Candidate Usability Metadata...");
  for (const cand of candidates.candidates) {
    assert(cand.usableInAnalysis === true, `Candidate ${cand.candidateId} usableInAnalysis must be true`);
    assert(!!cand.analysisUsageNotes && cand.analysisUsageNotes.length > 10, `Candidate ${cand.candidateId} missing analysisUsageNotes`);
  }
  console.log("  ✓ All 39 candidates have usableInAnalysis: true and robust analysisUsageNotes.");

  console.log("\n==================================================");
  console.log("ALL PHASE 8B-2 VERIFICATION TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================");
}

runVerification().catch((err) => {
  console.error("Verification script failed:", err);
  process.exit(1);
});
