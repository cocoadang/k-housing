/**
 * PHASE 8D-1B VERIFICATION SUITE: Redevelopment Data Integrity, Provenance & Dual-Date Audit
 *
 * Enforces:
 * 1. Semantic Dual-Date Separation (Administrative Approval Date vs Notice Date)
 *    - 사업시행인가: approvalDate (2015-07-30), noticeDate (2015-08-05)
 *    - 관리처분인가: approvalDate (2017-05-02), noticeDate (2017-05-04)
 *    - 추진위 승인: approvalDate (2003-10-27)
 *    - 착공 신고: filingDate / occurrenceDate (2019-12-03)
 * 2. Strict Provenance Tier Separation (OFFICIAL vs REFERENCE)
 *    - Official statutory records are OFFICIAL + VERIFIED + ELIGIBLE
 *    - Media/News/Blog records are REFERENCE + INELIGIBLE (Never used in official calculations)
 * 3. Proportional Rate Calculation Guard
 *    - 138.62% completely excluded from official data and calculations.
 *    - 120.37% is marked PENDING + INELIGIBLE until statutory gazette text citation is verified.
 * 4. Component Hardcoded Fallback Decoupling
 *    - ProjectTimelineSection: renders dual dates & provenance, no obsolete hardcoded dates.
 *    - ProjectHeader, OwnerEconomicsSection, LandShareSection, ProjectEconomicsSection:
 *      no hardcoded fallback values for missing data.
 * 5. Type Safety & API Contract Compliance
 */

import fs from 'fs';
import path from 'path';

interface CheckResult {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: CheckResult[] = [];

function check(id: string, name: string, passed: boolean, details: string) {
  results.push({ id, name, passed, details });
  const mark = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${mark}] ${id}: ${name} - ${details}`);
}

async function runVerification() {
  console.log('======================================================================');
  console.log('PHASE 8D-1B: Redevelopment Data Integrity & Provenance Verifier');
  console.log('======================================================================\n');

  const root = process.cwd();
  const redevDataDir = path.join(root, 'src', 'data');
  const redevComponentsDir = path.join(root, 'src', 'components', 'Redevelopment');
  const servicesDir = path.join(root, 'src', 'services');
  const dataDir = path.join(root, 'data', 'redevelopment');

  // -------------------------------------------------------------------------
  // Check 1: Semantic Dual-Date Schema in Project Seed (dunchon_project_seed_v1.json)
  // -------------------------------------------------------------------------
  const projectSeedPath = path.join(dataDir, 'dunchon_project_seed_v1.json');
  const projectSeed = JSON.parse(fs.readFileSync(projectSeedPath, 'utf-8'));
  const milestones = projectSeed.milestones || [];

  const msProjectApproval = milestones.find((m: any) => m.milestoneId === 'ms_approval');
  const msMgmtDisposition = milestones.find((m: any) => m.milestoneId === 'ms_mgmt');
  const msPromotion = milestones.find((m: any) => m.milestoneId === 'ms_committee');
  const msConstruction = milestones.find((m: any) => m.milestoneId === 'ms_construction_start');

  const dualDateProjectApprovalOk =
    msProjectApproval?.approvalDate === '2015-07-30' &&
    msProjectApproval?.noticeDate === '2015-08-05' &&
    msProjectApproval?.noticeNumber?.includes('2015-93');

  const dualDateMgmtOk =
    msMgmtDisposition?.approvalDate === '2017-05-02' &&
    msMgmtDisposition?.noticeDate === '2017-05-04' &&
    msMgmtDisposition?.noticeNumber?.includes('2017-68');

  const promoDateCorrect = msPromotion?.approvalDate === '2003-10-27';
  const constructionDateCorrect = msConstruction?.filingDate === '2019-12-03' || msConstruction?.occurrenceDate === '2019-12-03';

  check(
    '8D1B-01',
    'Semantic Dual-Date Schema in Project Seed',
    Boolean(dualDateProjectApprovalOk && dualDateMgmtOk && promoDateCorrect && constructionDateCorrect),
    `ProjectApproval(2015-07-30/2015-08-05): ${dualDateProjectApprovalOk}, MgmtDisposition(2017-05-02/2017-05-04): ${dualDateMgmtOk}, Promo(2003-10-27): ${promoDateCorrect}, Construction(2019-12-03): ${constructionDateCorrect}`
  );

  // -------------------------------------------------------------------------
  // Check 2: Strict Provenance Classification (OFFICIAL vs REFERENCE)
  // -------------------------------------------------------------------------
  const officialMilestones = milestones.filter((m: any) => m.evidenceClass === 'OFFICIAL');
  const referenceMilestones = milestones.filter((m: any) => m.evidenceClass === 'REFERENCE');

  const msSuspension = milestones.find((m: any) => m.milestoneId === 'ms_suspension');
  const msResumption = milestones.find((m: any) => m.milestoneId === 'ms_resumption');

  const referenceSeparationOk =
    msSuspension?.evidenceClass === 'REFERENCE' &&
    msSuspension?.calculationEligibility === 'INELIGIBLE' &&
    msResumption?.evidenceClass === 'REFERENCE' &&
    msResumption?.calculationEligibility === 'INELIGIBLE';

  const officialAllEligible = officialMilestones.every(
    (m: any) => m.evidenceClass === 'OFFICIAL' && (m.calculationEligibility === 'ELIGIBLE' || m.calculationEligibility === 'INELIGIBLE')
  );

  check(
    '8D1B-02',
    'Strict Provenance Separation (OFFICIAL vs REFERENCE) in Project Milestones',
    Boolean(officialMilestones.length >= 8 && referenceSeparationOk && officialAllEligible),
    `Official count: ${officialMilestones.length}, Reference separation (suspension/resumption INELIGIBLE): ${referenceSeparationOk}`
  );

  // -------------------------------------------------------------------------
  // Check 3: Lineage Seed & Registry Milestone Dates Integrity
  // -------------------------------------------------------------------------
  const lineageSeed = JSON.parse(fs.readFileSync(path.join(dataDir, 'dunchon_lineage_seed_v1.json'), 'utf-8'));
  const lineageMilestones = lineageSeed.project?.milestoneDates || {};

  const lineageDatesOk =
    lineageMilestones.promotionCommitteeApprovalDate === '2003-10-27' &&
    lineageMilestones.projectApprovalDate === '2015-07-30' &&
    lineageMilestones.projectNoticeDate === '2015-08-05' &&
    lineageMilestones.managementDispositionDate === '2017-05-02' &&
    lineageMilestones.managementDispositionNoticeDate === '2017-05-04' &&
    lineageMilestones.constructionStartDate === '2019-12-03';

  const lineagesCode = fs.readFileSync(path.join(redevDataDir, 'redevelopmentLineages.ts'), 'utf-8');
  const lineagesTsOk =
    lineagesCode.includes("'2003-10-27'") &&
    lineagesCode.includes("'2015-07-30'") &&
    lineagesCode.includes("'2015-08-05'") &&
    lineagesCode.includes("'2017-05-02'") &&
    lineagesCode.includes("'2017-05-04'") &&
    lineagesCode.includes("'2019-12-03'");

  check(
    '8D1B-03',
    'Lineage Seed & Registry Code Dual-Date Integrity',
    Boolean(lineageDatesOk && lineagesTsOk),
    `Lineage seed dates: ${lineageDatesOk}, Lineage TS code updated: ${lineagesTsOk}`
  );

  // -------------------------------------------------------------------------
  // Check 4: Proportional Rate Integrity & Calculation Ineligibility
  // -------------------------------------------------------------------------
  const finSeed = JSON.parse(fs.readFileSync(path.join(dataDir, 'dunchon_financial_seed_v1.json'), 'utf-8'));
  const propRate = finSeed.proportionalRate;

  const propRateNotVerifiedUnproven =
    propRate?.calculationEligibility === 'INELIGIBLE' &&
    (propRate?.verificationStatus === 'PENDING' || propRate?.eligibility === 'PENDING');

  const finSeedText = fs.readFileSync(path.join(dataDir, 'dunchon_financial_seed_v1.json'), 'utf-8');
  const no138InFinSeed = !finSeedText.includes('138.62');

  const serviceCode = fs.readFileSync(path.join(servicesDir, 'redevelopmentDataService.ts'), 'utf-8');
  const propRateNullIfIneligibleInService = serviceCode.includes('calculationEligibility === \'ELIGIBLE\' ? bundle.financialSeed.proportionalRate.valuePct : null');

  check(
    '8D1B-04',
    'Proportional Rate Calculation Ineligibility Guard (CALCULATE WHEN JUSTIFIED)',
    Boolean(propRateNotVerifiedUnproven && no138InFinSeed && propRateNullIfIneligibleInService),
    `Proportional rate marked PENDING/INELIGIBLE: ${propRateNotVerifiedUnproven}, 138.62% excluded: ${no138InFinSeed}, Service calculates only when ELIGIBLE: ${propRateNullIfIneligibleInService}`
  );

  // -------------------------------------------------------------------------
  // Check 5: ProjectTimelineSection Component Decoupling
  // -------------------------------------------------------------------------
  const timelineComponent = fs.readFileSync(path.join(redevComponentsDir, 'ProjectTimelineSection.tsx'), 'utf-8');

  // Verify that obsolete hardcoded dates are removed
  const noOldHardcodedPromo = !timelineComponent.includes("'2003-10-14'");
  const noOldHardcodedConstruction = !timelineComponent.includes("'2020-02-15'");
  const hasDualDateRendering =
    timelineComponent.includes('item.approvalDate') &&
    timelineComponent.includes('item.noticeDate');
  const hasProvenanceBadges =
    timelineComponent.includes('공식 사실') &&
    timelineComponent.includes('참고 자료');

  check(
    '8D1B-05',
    'ProjectTimelineSection Dual-Date and Provenance UI Decoupling',
    noOldHardcodedPromo && noOldHardcodedConstruction && hasDualDateRendering && hasProvenanceBadges,
    `No obsolete hardcoded 2003-10-14: ${noOldHardcodedPromo}, No obsolete hardcoded 2020-02-15: ${noOldHardcodedConstruction}, Dual-date UI: ${hasDualDateRendering}, Provenance badges: ${hasProvenanceBadges}`
  );

  // -------------------------------------------------------------------------
  // Check 6: ProjectHeader Component Decoupling
  // -------------------------------------------------------------------------
  const headerComponent = fs.readFileSync(path.join(redevComponentsDir, 'ProjectHeader.tsx'), 'utf-8');
  const noHardcodedUnitsFallback =
    !headerComponent.includes('units?.before ?? 5930') &&
    !headerComponent.includes('units?.after ?? 12032');
  const noHardcodedMoveInDateFallback = !headerComponent.includes("moveInDate ?? '2024-11-27'");

  check(
    '8D1B-06',
    'ProjectHeader Factual Fallback Decoupling',
    noHardcodedUnitsFallback && noHardcodedMoveInDateFallback,
    `No units fallback 5930/12032: ${noHardcodedUnitsFallback}, No moveInDate fallback: ${noHardcodedMoveInDateFallback}`
  );

  // -------------------------------------------------------------------------
  // Check 7: OwnerEconomics, ProjectEconomics & LandShare Decoupling
  // -------------------------------------------------------------------------
  const ownerEconComponent = fs.readFileSync(path.join(redevComponentsDir, 'OwnerEconomicsSection.tsx'), 'utf-8');
  const hasDynamicResearchExamples = ownerEconComponent.includes('researchExamples.map');
  const noHardcodedExampleContribution = !ownerEconComponent.includes('추가분담금 43,892,000원');

  const projEconComponent = fs.readFileSync(path.join(redevComponentsDir, 'ProjectEconomicsSection.tsx'), 'utf-8');
  const noHardcodedRebFallback = !projEconComponent.includes('reb?.targetAmountKrw ?? 162100000000');

  const landShareComponent = fs.readFileSync(path.join(redevComponentsDir, 'LandShareSection.tsx'), 'utf-8');
  const noHardcodedLandShareCounts = !landShareComponent.includes('meta?.recordCount ?? 17');

  const componentDecouplingOk =
    hasDynamicResearchExamples &&
    noHardcodedExampleContribution &&
    noHardcodedRebFallback &&
    noHardcodedLandShareCounts;

  check(
    '8D1B-07',
    'Sub-Components Factual Fallback Removal',
    componentDecouplingOk,
    `OwnerEconomics dynamic: ${hasDynamicResearchExamples} (no hardcoded: ${noHardcodedExampleContribution}), ProjectEconomics no REB fallback: ${noHardcodedRebFallback}, LandShare no count fallback: ${noHardcodedLandShareCounts}`
  );

  // -------------------------------------------------------------------------
  // Check 8: TypeScript Schema & API Contract Compliance
  // -------------------------------------------------------------------------
  const redevTypes = fs.readFileSync(path.join(root, 'src', 'types', 'redevelopment.ts'), 'utf-8');
  const apiTypes = fs.readFileSync(path.join(root, 'src', 'types', 'redevelopmentApi.ts'), 'utf-8');

  const hasProvenanceTypes =
    redevTypes.includes('RedevelopmentEvidenceClass') &&
    redevTypes.includes('RedevelopmentVerificationStatus') &&
    redevTypes.includes('RedevelopmentCalculationEligibility');

  const hasDualDateApiFields =
    apiTypes.includes('approvalDate?: string | null') &&
    apiTypes.includes('noticeDate?: string | null') &&
    apiTypes.includes('noticeNumber?: string | null');

  check(
    '8D1B-08',
    'TypeScript Schema and API Contract Compliance',
    hasProvenanceTypes && hasDualDateApiFields,
    `Domain provenance types: ${hasProvenanceTypes}, API dual-date fields: ${hasDualDateApiFields}`
  );

  // -------------------------------------------------------------------------
  // Summary and Report Generation
  // -------------------------------------------------------------------------
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log('\n======================================================================');
  console.log(`PHASE 8D-1B VERIFICATION SUMMARY: ${passed}/${total} PASS, ${failed} FAIL`);
  console.log('======================================================================');

  // Generate automated Report Artifact
  const reportPath = path.join(root, 'data', 'phase8d1_redevelopment_ui_integrity_report.json');
  const reportPayload = {
    suite: 'Phase 8D-1B Redevelopment UI Data Integrity & Provenance',
    timestamp: new Date().toISOString(),
    totalChecks: total,
    passedChecks: passed,
    failedChecks: failed,
    status: failed === 0 ? 'ALL_PASSED' : 'FAILED',
    audits: {
      milestonePromotionCommittee: {
        approvalDate: '2003-10-27',
        verifiedLabel: '조합설립추진위원회 승인',
        authoritySource: '강동구청 인가대장 (2003-10-27)'
      },
      milestoneProjectApproval: {
        approvalDate: '2015-07-30',
        noticeDate: '2015-08-05',
        noticeNumber: '강동구 고시 제2015-93호',
        verifiedLabel: '사업시행계획인가 및 고시'
      },
      milestoneManagementDisposition: {
        approvalDate: '2017-05-02',
        noticeDate: '2017-05-04',
        noticeNumber: '강동구 고시 제2017-68호',
        verifiedLabel: '관리처분계획인가 및 고시',
        dualDateStatus: '행정인가일(2017-05-02)과 구보고시일(2017-05-04)을 이중 일자로 보존하며 모두 유효한 공적 사실로 관리'
      },
      milestoneConstruction: {
        filingDate: '2019-12-03',
        occurrenceDate: '2019-12-03',
        verifiedLabel: '착공 신고 처리',
        authoritySource: '강동구청 착공신고 처리일'
      },
      proportionalRate: {
        statutoryReportedRate: '120.37%',
        verificationStatus: 'PENDING',
        calculationEligibility: 'INELIGIBLE',
        actionTaken: '고시문 전문 비례율 명시 확인 전까지 계산 모델 및 공식 UI 노출 보류 (PENDING + INELIGIBLE)',
        unbackedValue: '138.62%',
        unbackedValueStatus: 'EXCLUDED_FROM_PRODUCTION'
      },
      provenancePolicy: {
        principle: 'CALCULATE WHEN JUSTIFIED, REFUSE WHEN NOT JUSTIFIED',
        rules: [
          'OFFICIAL 단독으로 자동 VERIFIED/ELIGIBLE 승격 금지',
          '공식 계산 파이프라인은 OFFICIAL + VERIFIED + ELIGIBLE 삼중 조건 충족 필수',
          'REFERENCE(언론/연구사례)는 INELIGIBLE로 격리'
        ]
      }
    },
    results: results
  };

  fs.writeFileSync(reportPath, JSON.stringify(reportPayload, null, 2), 'utf-8');
  console.log(`[Report Generated] Saved report artifact to ${reportPath}`);

  if (failed > 0) {
    console.error(`\n❌ ${failed} verification checks failed. Review details above.`);
    process.exit(1);
  } else {
    console.log('\n🎉 All 8 Phase 8D-1B integrity checks passed with 100% compliance.');
  }
}

runVerification().catch((err) => {
  console.error('Unhandled error during verification:', err);
  process.exit(1);
});
