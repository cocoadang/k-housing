import { redevelopmentDataService } from '../src/services/redevelopmentDataService';
import {
  getRedevelopmentLineage,
  getRedevelopmentProject,
  REDEVELOPMENT_LINEAGES_REGISTRY,
  REDEVELOPMENT_PROJECTS_REGISTRY,
} from '../src/data/redevelopmentLineages';
import { collection, getCountFromServer } from 'firebase/firestore';
import { getFirestoreDb } from '../src/server/firestore';

async function runPhase8HVerification() {
  console.log('================================================================');
  console.log('🚀 PHASE 8H: CHOKJIN 3 REDEVELOPMENT DATA INTEGRATION VERIFICATION');
  console.log('================================================================');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testId: string, message: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testId} - ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testId} - ${message}`);
    }
  }

  // Baseline Firestore count check (Zero Firestore Mutation Rule)
  const db = getFirestoreDb();
  const baselineSnap = await getCountFromServer(collection(db, 'monthlyComplexPrices_v2'));
  const initialCount = baselineSnap.data().count;
  console.log(`[Baseline] monthlyComplexPrices_v2 initial document count: ${initialCount}`);

  const service = redevelopmentDataService;

  // 1. Registry verification
  const chokjinLineage = getRedevelopmentLineage('chokjin3_redevelopment');
  assert(
    !!chokjinLineage,
    'TC_8H_01_LINEAGE_REGISTERED',
    'chokjin3_redevelopment is registered in REDEVELOPMENT_LINEAGES_REGISTRY'
  );

  assert(
    chokjinLineage?.projectType === 'REDEVELOPMENT',
    'TC_8H_02_PROJECT_TYPE_REDEVELOPMENT',
    `Project type is REDEVELOPMENT (actual: ${chokjinLineage?.projectType})`
  );

  assert(
    chokjinLineage?.redevelopmentTypeLabel === '주택재개발정비사업',
    'TC_8H_03_TYPE_LABEL_MATCH',
    `Redevelopment type label is 주택재개발정비사업 (actual: ${chokjinLineage?.redevelopmentTypeLabel})`
  );

  const chokjinProj = getRedevelopmentProject('proj_chokjin3_redevelopment');
  assert(
    !!chokjinProj,
    'TC_8H_04_PROJECT_REGISTERED',
    'proj_chokjin3_redevelopment is registered in REDEVELOPMENT_PROJECTS_REGISTRY'
  );

  // 2. Service Seed Bundle Loading
  const bundle = service.loadSeedBundle('chokjin3_redevelopment');
  assert(
    bundle.projectSeed.name.includes('촉진3구역'),
    'TC_8H_05_SEED_BUNDLE_NAME',
    `Project seed name matches: ${bundle.projectSeed.name}`
  );

  assert(
    bundle.projectSeed.successor.totalUnits === 3545,
    'TC_8H_06_SUCCESSOR_UNITS',
    `Successor planned units are verified: 3,545 (actual: ${bundle.projectSeed.successor.totalUnits})`
  );

  assert(
    bundle.projectSeed.successor.maxFloors === 60,
    'TC_8H_07_SUCCESSOR_MAX_FLOORS',
    `Successor max floors verified: 60 (actual: ${bundle.projectSeed.successor.maxFloors})`
  );

  assert(
    bundle.projectSeed.successor.buildingCount === 18,
    'TC_8H_08_SUCCESSOR_BUILDING_COUNT',
    `Successor building count verified: 18 (actual: ${bundle.projectSeed.successor.buildingCount})`
  );

  // 3. Statutory Milestones & Timeline Category Split
  const milestones = bundle.projectSeed.milestones || [];
  const projectMilestones = milestones.filter((m) => m.category === 'PROJECT_MILESTONE');
  const backgroundHistory = milestones.filter((m) => m.category === 'BACKGROUND_HISTORY');

  assert(
    projectMilestones.length >= 6,
    'TC_8H_09_PROJECT_MILESTONES_COUNT',
    `At least 6 official project milestones registered (actual: ${projectMilestones.length})`
  );

  assert(
    backgroundHistory.length >= 2,
    'TC_8H_10_BACKGROUND_HISTORY_COUNT',
    `At least 2 background history milestones registered (actual: ${backgroundHistory.length})`
  );

  // Check management disposition notice
  const mgmtDisp = milestones.find((m) => m.milestoneId === 'ms_management_disposition');
  assert(
    mgmtDisp?.noticeNumber === '부산광역시 부산진구 고시 제2024-95호' &&
      mgmtDisp?.date === '2024-06-05' &&
      mgmtDisp?.approvalDate === '2024-05-23' &&
      mgmtDisp?.evidenceClass === 'OFFICIAL' &&
      mgmtDisp?.verificationStatus === 'VERIFIED' &&
      mgmtDisp?.calculationEligibility === 'ELIGIBLE',
    'TC_8H_11_MANAGEMENT_DISPOSITION_VERIFIED',
    'Management disposition approval (2024-05-23) and notice (2024-06-05, 부산진구 고시 제2024-95호) verified'
  );

  // Check project approval notice
  const projAppr = milestones.find((m) => m.milestoneId === 'ms_project_approval');
  assert(
    projAppr?.noticeNumber === '부산광역시 부산진구 고시 제2022-147호' &&
      projAppr?.date === '2022-10-19' &&
      projAppr?.approvalDate === '2022-10-13' &&
      projAppr?.evidenceClass === 'OFFICIAL',
    'TC_8H_12_PROJECT_APPROVAL_VERIFIED',
    'Project approval notice (2022-10-19, 부산진구 고시 제2022-147호) verified'
  );

  // 4. Financial & Construction Cost Rigor
  assert(
    bundle.financialSeed.proportionalRate.valuePct === null &&
      bundle.financialSeed.proportionalRate.calculationEligibility === 'INELIGIBLE',
    'TC_8H_13_PROPORTIONAL_RATE_NULL_ISOLATED',
    'Proportional rate is strictly null and INELIGIBLE (no unverified speculation)'
  );

  assert(
    bundle.financialSeed.generalSalePrice.pricePerPyeong === null &&
      bundle.financialSeed.memberSalePrice.averagePricePerPyeong === null,
    'TC_8H_14_SALE_PRICES_NULL_ISOLATED',
    'General and member sale prices are null (unreleased prior to construction)'
  );

  const contractorEvent = bundle.costSeed.costEvents?.find(
    (e) => e.eventId === 'cost_event_chokjin3_bid_contract'
  );
  assert(
    contractorEvent?.amountKrw === 1607300000000 &&
      contractorEvent?.status === 'SIGNED_CONTRACT' &&
      bundle.costSeed.isFinal === false,
    'TC_8H_15_CONSTRUCTION_COST_ISOLATED',
    'Construction cost bid of ~1.6073T KRW registered as REFERENCE/non-final'
  );

  // 5. Lineage Detail API endpoint
  const detailRes = service.getLineageDetail('chokjin3_redevelopment');
  assert(
    detailRes.success &&
      detailRes.lineage.redevelopmentType === 'REDEVELOPMENT' &&
      detailRes.lineage.units.after === 3545 &&
      detailRes.lineage.units.before === null,
    'TC_8H_16_DETAIL_API_SUCCESS',
    'getLineageDetail returns valid structure with null before-units'
  );

  // 6. Predecessors & Successors Safety
  const targetsRes = await service.getTargets('chokjin3_redevelopment');
  assert(
    targetsRes.predecessorTargets.length === 0 && targetsRes.successorTargets.length === 0,
    'TC_8H_17_TARGETS_SAFE_EMPTY',
    'getTargets safely handles low-rise residential area with empty targets'
  );

  // 7. Get Lineages List
  const lineagesRes = service.getLineages();
  assert(
    lineagesRes.lineages.length >= 3 &&
      lineagesRes.lineages.some((l) => l.lineageId === 'chokjin3_redevelopment'),
    'TC_8H_18_LINEAGES_LIST_CONTAINS_CHOKJIN3',
    `Lineages list contains chokjin3_redevelopment (total: ${lineagesRes.lineages.length})`
  );

  // 8. Zero Firestore Mutations
  const finalSnap = await getCountFromServer(collection(db, 'monthlyComplexPrices_v2'));
  const finalCount = finalSnap.data().count;
  assert(
    finalCount === initialCount,
    'TC_8H_19_ZERO_FIRESTORE_MUTATIONS',
    `Firestore document count unchanged: ${initialCount} === ${finalCount}`
  );

  console.log('================================================================');
  console.log(`📊 PHASE 8H VERIFICATION SUMMARY: ${passed} / ${total} PASSED`);
  console.log('================================================================');

  if (passed < total) {
    process.exit(1);
  }
}

runPhase8HVerification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
