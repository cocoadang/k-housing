/**
 * Phase 8G Verification: Business Type & Timeline Semantic System
 * 
 * Verifies:
 * 1. Business types distinction (RECONSTRUCTION, REDEVELOPMENT, URBAN_PUBLIC_HOUSING_COMPLEX)
 * 2. Timeline categories separation (PROJECT_MILESTONE vs BACKGROUND_HISTORY)
 * 3. Preservation of existing official values (Dunchon & Jeungsan 4)
 * 4. UI differentiation between statutory milestones and prior history
 * 5. Zero Firestore mutations
 */

import fs from 'fs';
import path from 'path';
import { redevelopmentDataService } from '../src/services/redevelopmentDataService';
import { getRedevelopmentLineage, getRedevelopmentProject } from '../src/data/redevelopmentLineages';
import { collection, getCountFromServer } from 'firebase/firestore';
import { getFirestoreDb } from '../src/server/firestore';

async function verifyPhase8G() {
  console.log('================================================================');
  console.log('🚀 PHASE 8G: BUSINESS TYPE & TIMELINE SEMANTIC SYSTEM VERIFICATION');
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

  // Baseline Firestore check
  let countBefore = 0;
  const db = getFirestoreDb();
  if (db) {
    const colV2 = collection(db, 'monthlyComplexPrices_v2');
    const snapBefore = await getCountFromServer(colV2);
    countBefore = snapBefore.data().count;
    console.log(`[Baseline] monthlyComplexPrices_v2 initial document count: ${countBefore}`);
  }

  // 1. Types verification
  const typesPath = path.resolve(process.cwd(), 'src/types/redevelopment.ts');
  const typesCode = fs.readFileSync(typesPath, 'utf-8');
  assert(
    typesCode.includes("'URBAN_PUBLIC_HOUSING_COMPLEX'") &&
    typesCode.includes("'RECONSTRUCTION'") &&
    typesCode.includes("'REDEVELOPMENT'"),
    'TC_8G_01_PROJECT_TYPES_DEFINED',
    'RECONSTRUCTION, REDEVELOPMENT, and URBAN_PUBLIC_HOUSING_COMPLEX present in domain types'
  );
  assert(
    typesCode.includes('RedevelopmentMilestoneCategory') &&
    typesCode.includes("'PROJECT_MILESTONE'") &&
    typesCode.includes("'BACKGROUND_HISTORY'"),
    'TC_8G_02_MILESTONE_CATEGORIES_DEFINED',
    'PROJECT_MILESTONE and BACKGROUND_HISTORY defined in RedevelopmentMilestoneCategory'
  );

  // 2. Validation utility verification
  const valPath = path.resolve(process.cwd(), 'src/utils/redevelopmentValidation.ts');
  const valCode = fs.readFileSync(valPath, 'utf-8');
  assert(
    valCode.includes('URBAN_PUBLIC_HOUSING_COMPLEX') &&
    valCode.includes("['RECONSTRUCTION', 'REDEVELOPMENT', 'URBAN_PUBLIC_HOUSING_COMPLEX']"),
    'TC_8G_03_VALIDATION_ACCEPTS_URBAN_COMPLEX',
    'Validation explicitly allows URBAN_PUBLIC_HOUSING_COMPLEX'
  );

  // 3. Jeungsan 4 seed & registry audit
  const j4Detail = redevelopmentDataService.getLineageDetail('jeungsan4_redevelopment');
  assert(
    j4Detail.lineage.redevelopmentType === 'URBAN_PUBLIC_HOUSING_COMPLEX',
    'TC_8G_04_JEUNGSAN4_PROJECT_TYPE',
    `Jeungsan 4 project type is: ${j4Detail.lineage.redevelopmentType}`
  );
  assert(
    j4Detail.lineage.redevelopmentTypeLabel === '도심 공공주택 복합사업',
    'TC_8G_05_JEUNGSAN4_TYPE_LABEL',
    `Jeungsan 4 type label is: ${j4Detail.lineage.redevelopmentTypeLabel}`
  );

  // 4. Jeungsan 4 Timeline & Background separation audit
  const j4Former = j4Detail.lineage.timeline.find((m) => m.milestoneId === 'ms_former_district_release');
  const j4Desig = j4Detail.lineage.timeline.find((m) => m.milestoneId === 'ms_district_designation');
  const j4Plan = j4Detail.lineage.timeline.find((m) => m.milestoneId === 'ms_complex_plan_approval');

  assert(
    j4Former?.category === 'BACKGROUND_HISTORY',
    'TC_8G_06_JEUNGSAN4_FORMER_IS_BACKGROUND',
    `2019 Former district release correctly classified as: ${j4Former?.category}`
  );
  assert(
    j4Desig?.category === 'PROJECT_MILESTONE',
    'TC_8G_07_JEUNGSAN4_DESIGNATION_IS_MILESTONE',
    `2021 District designation classified as: ${j4Desig?.category}`
  );
  assert(
    j4Plan?.category === 'PROJECT_MILESTONE',
    'TC_8G_08_JEUNGSAN4_PLAN_IS_MILESTONE',
    `2024 Complex plan approval classified as: ${j4Plan?.category}`
  );

  // 5. Official data preservation check
  assert(
    j4Desig?.date === '2021-12-31' &&
    j4Plan?.date === '2024-12-30' &&
    j4Detail.lineage.units.after === 3509 &&
    j4Plan?.noticeNumber === '서울특별시 고시 제2024-678호',
    'TC_8G_09_JEUNGSAN4_OFFICIAL_VALUES_PRESERVED',
    '2021-12-31, 2024-12-30, 3509 units, and notice number intact'
  );

  // 6. Dunchon data protection check
  const dunchonDetail = redevelopmentDataService.getLineageDetail('dunchon_redevelopment');
  assert(
    dunchonDetail.lineage.redevelopmentType === 'RECONSTRUCTION' &&
    dunchonDetail.lineage.redevelopmentTypeLabel === '주택재건축정비사업',
    'TC_8G_10_DUNCHON_TYPE_PRESERVED',
    `Dunchon type: ${dunchonDetail.lineage.redevelopmentType} (${dunchonDetail.lineage.redevelopmentTypeLabel})`
  );
  assert(
    dunchonDetail.lineage.units.before === 5930 &&
    dunchonDetail.lineage.units.after === 12032,
    'TC_8G_11_DUNCHON_UNITS_PRESERVED',
    `Units: ${dunchonDetail.lineage.units.before} -> ${dunchonDetail.lineage.units.after}`
  );
  assert(
    dunchonDetail.lineage.timeline.every((m) => m.category === 'PROJECT_MILESTONE'),
    'TC_8G_12_DUNCHON_TIMELINE_ALL_PROJECT_MILESTONES',
    'All statutory Dunchon milestones mapped as PROJECT_MILESTONE'
  );

  // 7. UI distinction verification
  const timelineUiPath = path.resolve(process.cwd(), 'src/components/Redevelopment/ProjectTimelineSection.tsx');
  const timelineUi = fs.readFileSync(timelineUiPath, 'utf-8');
  assert(
    timelineUi.includes('BACKGROUND_HISTORY') &&
    timelineUi.includes('사전 배경 이력 (법정 절차 외)') &&
    timelineUi.includes('사업 법정 절차') &&
    timelineUi.includes('사전 배경이력:'),
    'TC_8G_13_UI_TIMELINE_DISTINCTION',
    'ProjectTimelineSection visibly separates BACKGROUND_HISTORY from PROJECT_MILESTONE'
  );

  const headerUiPath = path.resolve(process.cwd(), 'src/components/Redevelopment/ProjectHeader.tsx');
  const headerUi = fs.readFileSync(headerUiPath, 'utf-8');
  assert(
    headerUi.includes('URBAN_PUBLIC_HOUSING_COMPLEX') &&
    headerUi.includes('공공주택 특별법 근거') &&
    headerUi.includes('도시 및 주거환경정비법 근거'),
    'TC_8G_14_UI_GOVERNING_LAW_DISTINCTION',
    'ProjectHeader shows distinct legal framework badges'
  );

  // 8. Zero Firestore mutation check
  if (db) {
    const colV2 = collection(db, 'monthlyComplexPrices_v2');
    const snapAfter = await getCountFromServer(colV2);
    const countAfter = snapAfter.data().count;
    assert(
      countBefore === countAfter,
      'TC_8G_15_ZERO_FIRESTORE_MUTATIONS',
      `Firestore document count preserved: ${countBefore} === ${countAfter}`
    );
  }

  console.log('================================================================');
  console.log(`📊 PHASE 8G VERIFICATION SUMMARY: ${passed} / ${passed + failed} PASSED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

verifyPhase8G().catch((err) => {
  console.error('Fatal error during Phase 8G verification:', err);
  process.exit(1);
});
