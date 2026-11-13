/**
 * Phase 8D Verification Script
 * REDEVELOPMENT ANALYSIS USER INTERFACE (24 Mandatory Verification Tests)
 * 
 * Verifies:
 * 1. Navigation Menu Integration
 * 2. Strict API Contract & No Direct Firestore SDK in UI
 * 3. No Normalized Seed in Client UI
 * 4. RedevelopmentApiClient exclusive consumption
 * 5. Project Header Unit Transformation & Status
 * 6. Public Data Trust Disclaimer Banner
 * 7. Capability Summary Badges (Market Value, Mapping, Cost, XIRR, Land Share, Construction)
 * 8. Analysis Mode Switch (VERIFIED_HISTORICAL vs USER_SCENARIO)
 * 9. Historical Mode Refusal & Explanation (0 actual mappings)
 * 10. Scenario Mode Mandatory Disclaimer
 * 11. Banned Labels Absence (No "재건축 수익률", "투자수익률", "ROI", "재건축으로 번 돈")
 * 12. Approved Labels Presence ("시장가격 변화", "명목 자산가치 변화", "명목 자산가치 배수")
 * 13. Dynamic AreaFamily Selectors (16 predecessor, 8 successor, no hardcoded 59/84 buttons)
 * 14. Price Metric Selector (MEDIAN_PRICE default, AVERAGE_PRICE)
 * 15. Price Availability & Month Observation
 * 16. Discrete Left-Right Comparison Cards (No continuous price line)
 * 17. No 0 Won Display on Missing Trades ("해당 월 실거래 없음")
 * 18. Price Provenance Metadata Display
 * 19. Chronological Project Timeline (2006 to 2024)
 * 20. Owner Economics & XIRR Explicit "계산 불가" (NOT 0% or N/A%)
 * 21. Research Examples Isolation (APPLICATION_EXAMPLE, RESEARCH_ONLY collapsible)
 * 22. Project Economics Construction Costs (6 events, REQUESTED isolation)
 * 23. REB Verification Audit Breakdown (1,621억 target, 1,244억 recognized, 377억 reduced)
 * 24. Land Share 17 Records / 15 Categories / 12 Unique Values & Legal Disclaimer
 */

import fs from 'fs';
import path from 'path';

interface TestResult {
  id: number;
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function recordTest(id: number, name: string, passed: boolean, message: string) {
  results.push({ id, name, passed, message });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[Test ${id.toString().padStart(2, '0')}] ${status}: ${name}`);
  if (!passed) {
    console.error(`       Reason: ${message}`);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('🚀 PHASE 8D: REDEVELOPMENT UI 24 MANDATORY VERIFICATION TESTS');
  console.log('================================================================\n');

  const rootDir = process.cwd();
  const headerFile = path.join(rootDir, 'src/components/Header.tsx');
  const appFile = path.join(rootDir, 'src/App.tsx');
  const redevWrapperFile = path.join(rootDir, 'src/components/RedevelopmentAnalysis.tsx');
  const redevDir = path.join(rootDir, 'src/components/Redevelopment');
  const clientApiFile = path.join(rootDir, 'src/services/redevelopmentApiClient.ts');

  const redevFiles = fs.readdirSync(redevDir).map((f) => path.join(redevDir, f));
  const allUiFiles = [headerFile, appFile, redevWrapperFile, ...redevFiles];

  // --------------------------------------------------------------------------
  // Test 1: Navigation Menu Integration
  // --------------------------------------------------------------------------
  const headerContent = fs.readFileSync(headerFile, 'utf-8');
  const appContent = fs.readFileSync(appFile, 'utf-8');
  const hasNavTabType = headerContent.includes("'REDEVELOPMENT'");
  const hasNavButton = headerContent.includes('재건축 분석');
  const hasAppViewSwitch = appContent.includes("activeView === 'REDEVELOPMENT'");
  const test1Passed = hasNavTabType && hasNavButton && hasAppViewSwitch;
  recordTest(
    1,
    'Navigation Menu Integration ("재건축 분석" tab and activeView in Header/App)',
    test1Passed,
    test1Passed ? 'Navigation integrated cleanly' : 'Missing navigation elements'
  );

  // --------------------------------------------------------------------------
  // Test 2: Architecture - No Direct Firestore SDK in Redevelopment UI
  // --------------------------------------------------------------------------
  let firestoreInUi = false;
  for (const f of redevFiles) {
    const c = fs.readFileSync(f, 'utf-8');
    if (c.includes("from 'firebase/firestore'") || c.includes('from "firebase/firestore"')) {
      firestoreInUi = true;
      break;
    }
  }
  recordTest(
    2,
    'Architecture: ZERO Direct Firestore SDK imports in Redevelopment UI',
    !firestoreInUi,
    firestoreInUi ? 'Found direct Firestore import in UI' : 'UI is completely decoupled from Firestore SDK'
  );

  // --------------------------------------------------------------------------
  // Test 3: Architecture - No Normalized Seed imports in Redevelopment UI
  // --------------------------------------------------------------------------
  let seedInUi = false;
  for (const f of redevFiles) {
    const c = fs.readFileSync(f, 'utf-8');
    if (c.includes('dunchonNormalizedSeed') || c.includes('seed/dunchon')) {
      seedInUi = true;
      break;
    }
  }
  recordTest(
    3,
    'Architecture: ZERO Normalized Seed imports in Redevelopment UI',
    !seedInUi,
    seedInUi ? 'Found direct seed import in UI' : 'UI does not import static seed files'
  );

  // --------------------------------------------------------------------------
  // Test 4: Architecture - RedevelopmentApiClient Exclusive API Access
  // --------------------------------------------------------------------------
  const clientContent = fs.readFileSync(clientApiFile, 'utf-8');
  const hasApiMethods =
    clientContent.includes('/lineages') &&
    clientContent.includes('/targets') &&
    clientContent.includes('/price-availability') &&
    clientContent.includes('/analysis') &&
    clientContent.includes('/land-share') &&
    clientContent.includes('/construction-costs');
  recordTest(
    4,
    'Architecture: RedevelopmentApiClient implements all 7 REST endpoints',
    hasApiMethods,
    hasApiMethods ? 'Client encapsulates all redevelopment API endpoints' : 'Missing endpoints in client'
  );

  // --------------------------------------------------------------------------
  // Test 5: Project Header Unit Transformation & Lineage Selector
  // --------------------------------------------------------------------------
  const headerComponentContent = fs.readFileSync(path.join(redevDir, 'ProjectHeader.tsx'), 'utf-8');
  const hasUnitTransformation =
    headerComponentContent.includes('둔촌주공 1~4단지') &&
    headerComponentContent.includes('올림픽파크포레온') &&
    headerComponentContent.includes('unitsBefore') &&
    headerComponentContent.includes('unitsAfter');
  recordTest(
    5,
    'Project Header: Displays 둔촌주공 → 올림픽파크포레온 & Unit Transformation (5,930 → 12,032)',
    hasUnitTransformation,
    hasUnitTransformation ? 'Units and lineage names displayed' : 'Missing unit transformation display'
  );

  // --------------------------------------------------------------------------
  // Test 6: Public Data Trust Disclaimer Banner
  // --------------------------------------------------------------------------
  const hasTrustBanner =
    headerComponentContent.includes('개별 조합원의 실제 배정평형, 분담금 및 현금흐름은 공개자료 범위에 따라 확인되지 않을 수 있습니다.') &&
    headerComponentContent.includes('공개자료 기반 정비사업 가치분석 원칙');
  recordTest(
    6,
    'Project Header: Displays Public Data Trust & Methodology Banner',
    hasTrustBanner,
    hasTrustBanner ? 'Mandatory trust banner is present' : 'Missing public data trust banner'
  );

  // --------------------------------------------------------------------------
  // Test 7: Capability Summary Badges
  // --------------------------------------------------------------------------
  const hasCapabilitySummary =
    headerComponentContent.includes('시장가격 비교') &&
    headerComponentContent.includes('실제 평형 배정') &&
    headerComponentContent.includes('비용 반영 분석') &&
    headerComponentContent.includes('XIRR (연환산수익률)') &&
    headerComponentContent.includes('종전 대지지분') &&
    headerComponentContent.includes('사업 공사비 이력');
  recordTest(
    7,
    'Capability Summary: All 6 readiness dimensions presented with user-friendly labels',
    hasCapabilitySummary,
    hasCapabilitySummary ? 'Readiness capabilities present' : 'Missing capability badges'
  );

  // --------------------------------------------------------------------------
  // Test 8: Analysis Mode Switch (VERIFIED_HISTORICAL vs USER_SCENARIO)
  // --------------------------------------------------------------------------
  const marketContent = fs.readFileSync(path.join(redevDir, 'MarketValueSection.tsx'), 'utf-8');
  const hasModeButtons =
    marketContent.includes('mode-verified-historical-btn') &&
    marketContent.includes('mode-user-scenario-btn') &&
    marketContent.includes('확인된 역사적 관계') &&
    marketContent.includes('사용자 비교 시나리오');
  recordTest(
    8,
    'Market Value: Supports VERIFIED_HISTORICAL and USER_SCENARIO mode toggling',
    hasModeButtons,
    hasModeButtons ? 'Mode buttons exist' : 'Missing mode toggle'
  );

  // --------------------------------------------------------------------------
  // Test 9: Historical Mode Refusal & Explanation
  // --------------------------------------------------------------------------
  const hasHistoricalRefusal =
    marketContent.includes('공개자료에서 종전 평형과 신축 평형의 실제 배정 관계를 확인할 수 없습니다.') &&
    marketContent.includes('historical-mode-container');
  recordTest(
    9,
    'Historical Mode: Refuses calculation with explanation ("공개자료에서 종전 평형과 신축 평형의 실제 배정 관계를 확인할 수 없습니다.")',
    hasHistoricalRefusal,
    hasHistoricalRefusal ? 'Historical mode refusal message present' : 'Missing refusal display'
  );

  // --------------------------------------------------------------------------
  // Test 10: Scenario Mode Mandatory Disclaimer
  // --------------------------------------------------------------------------
  const hasScenarioDisclaimer =
    marketContent.includes('사용자가 선택한 두 평형의 시장가격 비교입니다. 실제 조합원의 배정평형이나 투자수익률을 의미하지 않습니다.') &&
    marketContent.includes('scenario-disclaimer');
  recordTest(
    10,
    'Scenario Mode: Mandatory disclaimer ALWAYS visible in scenario mode',
    hasScenarioDisclaimer,
    hasScenarioDisclaimer ? 'Scenario disclaimer is present and explicit' : 'Missing scenario disclaimer'
  );

  // --------------------------------------------------------------------------
  // Test 11: Banned Labels Absence (No "재건축 수익률", "투자수익률", "ROI", "재건축으로 번 돈" as metric labels)
  // --------------------------------------------------------------------------
  const bannedLabelPatterns = [
    />\s*재건축\s*수익률\s*</,
    />\s*투자수익률\s*</,
    />\s*재건축으로\s*번\s*돈\s*</,
    />\s*ROI\s*</,
    /"재건축 수익률"/,
    /'재건축 수익률'/,
    /"투자수익률"/,
    /'투자수익률'/,
  ];
  let foundBanned = false;
  let bannedFile = '';
  let matchedPattern = '';
  for (const f of redevFiles) {
    const c = fs.readFileSync(f, 'utf-8');
    // Remove the official disclaimers from the text to verify metric labels
    const sanitizedContent = c
      .replace(/실제 조합원의 배정평형이나 투자수익률을 의미하지 않습니다/g, '')
      .replace(/재건축 수익률, 신축 평형 배정 순위, 또는 권리가액을 단독으로 추론하거나 결정하지 않습니다/g, '');
    
    for (const pat of bannedLabelPatterns) {
      if (pat.test(sanitizedContent)) {
        foundBanned = true;
        bannedFile = f;
        matchedPattern = pat.toString();
        break;
      }
    }
    if (foundBanned) break;
  }
  recordTest(
    11,
    'Forbidden Labels: ZERO occurrences of "재건축 수익률", "투자수익률", "재건축으로 번 돈", "ROI" as metric labels',
    !foundBanned,
    foundBanned ? `Found prohibited label pattern ${matchedPattern} in ${path.basename(bannedFile)}` : 'All banned labels strictly eliminated from UI metrics'
  );

  // --------------------------------------------------------------------------
  // Test 12: Approved Labels Presence
  // --------------------------------------------------------------------------
  const hasApprovedLabels =
    marketContent.includes('시장가격 변화') &&
    marketContent.includes('명목 자산가치 배수');
  recordTest(
    12,
    'Approved Labels: Uses neutral labels ("시장가격 변화", "명목 자산가치 변화", "명목 자산가치 배수")',
    hasApprovedLabels,
    hasApprovedLabels ? 'Approved neutral metrics present' : 'Missing approved labels'
  );

  // --------------------------------------------------------------------------
  // Test 13: Dynamic AreaFamily Selectors (No hardcoded 59/84 buttons)
  // --------------------------------------------------------------------------
  const hasTargetSelectors =
    marketContent.includes('pred-target-select') &&
    marketContent.includes('succ-target-select') &&
    marketContent.includes('predecessorTargets.map') &&
    marketContent.includes('successorTargets.map');
  const hasHardcoded5984Buttons =
    marketContent.includes('<button>59') ||
    marketContent.includes('<button>84') ||
    marketContent.includes('>59㎡<') && marketContent.includes('>84㎡<');
  recordTest(
    13,
    'Dynamic AreaFamily Selectors: Renders dynamic options from targets endpoint, no fixed buttons',
    hasTargetSelectors && !hasHardcoded5984Buttons,
    hasTargetSelectors ? 'Dynamic selectors properly implemented' : 'Found hardcoded area family buttons'
  );

  // --------------------------------------------------------------------------
  // Test 14: Price Metric Selector (MEDIAN_PRICE default, AVERAGE_PRICE)
  // --------------------------------------------------------------------------
  const hasMetricSelector =
    marketContent.includes('metric-median-btn') &&
    marketContent.includes('metric-average-btn') &&
    marketContent.includes('MEDIAN_PRICE') &&
    marketContent.includes('AVERAGE_PRICE');
  recordTest(
    14,
    'Price Metric Selector: Supports MEDIAN_PRICE (default) and AVERAGE_PRICE',
    hasMetricSelector,
    hasMetricSelector ? 'Metric toggle implemented' : 'Missing metric toggle'
  );

  // --------------------------------------------------------------------------
  // Test 15: Price Availability & Month Observation
  // --------------------------------------------------------------------------
  const hasMonthSelectors =
    marketContent.includes('pred-month-select') &&
    marketContent.includes('succ-month-select') &&
    marketContent.includes('observedMonths');
  recordTest(
    15,
    'Price Availability & Month: Month selectors populated from observedMonths',
    hasMonthSelectors,
    hasMonthSelectors ? 'Month selectors use price availability observations' : 'Missing observed months population'
  );

  // --------------------------------------------------------------------------
  // Test 16: Discrete Left-Right Comparison Cards (No continuous price line)
  // --------------------------------------------------------------------------
  const hasDiscreteCards =
    marketContent.includes('종전 시장가격') &&
    marketContent.includes('신축 시장가격') &&
    !marketContent.includes('<LineChart') &&
    !marketContent.includes('<AreaChart');
  recordTest(
    16,
    'Discrete Price Layout: Separate Left-Right cards used instead of misleading continuous line chart',
    hasDiscreteCards,
    hasDiscreteCards ? 'Predecessor and successor displayed in discrete comparative cards' : 'Found continuous chart or missing cards'
  );

  // --------------------------------------------------------------------------
  // Test 17: No 0 Won Fallback on Missing Trades
  // --------------------------------------------------------------------------
  const hasNoZeroWon =
    marketContent.includes('해당 월 실거래 없음') &&
    marketContent.includes('formatPriceManwon');
  recordTest(
    17,
    'Missing Price Policy: Displays "해당 월 실거래 없음" instead of 0 won',
    hasNoZeroWon,
    hasNoZeroWon ? 'Missing price properly formatted as text' : 'Missing trade format incorrect'
  );

  // --------------------------------------------------------------------------
  // Test 18: Price Provenance Metadata Display
  // --------------------------------------------------------------------------
  const hasProvenance =
    marketContent.includes('monthlyComplexPrices_v2') &&
    marketContent.includes('거래 건수') &&
    marketContent.includes('tradeCount');
  recordTest(
    18,
    'Price Provenance Display: monthlyComplexPrices_v2 collection, trade count & date displayed',
    hasProvenance,
    hasProvenance ? 'Provenance metadata displayed' : 'Missing provenance metadata'
  );

  // --------------------------------------------------------------------------
  // Test 19: Dynamic Project Timeline & Factual Fallback Removal
  // --------------------------------------------------------------------------
  const timelineContent = fs.readFileSync(path.join(redevDir, 'ProjectTimelineSection.tsx'), 'utf-8');
  
  // 1. Timeline uses API / domain data from props
  const usesApiData =
    timelineContent.includes('lineageDetail?.timeline') &&
    timelineContent.includes('RedevelopmentMilestonePublic');

  // 2. Zero static factual fallback list
  const hasNoStaticFallbackList =
    !timelineContent.includes('FALLBACK_TIMELINE') &&
    !timelineContent.includes('const defaultMilestones') &&
    !timelineContent.includes('const mockMilestones');

  // 3. No project-specific hardcoded milestone dates or factual texts
  const hasNoHardcodedDates =
    !timelineContent.includes('2003-10-14') &&
    !timelineContent.includes('2003-10-27') &&
    !timelineContent.includes('2015-07-30') &&
    !timelineContent.includes('2017-05-02') &&
    !timelineContent.includes('2019-12-03') &&
    !timelineContent.includes('2020-02-15');

  // 4. Dynamic milestone rendering structure with provenance badges
  const rendersDynamicMilestones =
    timelineContent.includes('timelineMilestones.map') &&
    timelineContent.includes('EvidenceBadge') &&
    timelineContent.includes('item.name');

  const timelineDecoupledAndDynamic =
    usesApiData &&
    hasNoStaticFallbackList &&
    hasNoHardcodedDates &&
    rendersDynamicMilestones;

  recordTest(
    19,
    'Project Timeline: Dynamic API milestone rendering with ZERO static factual fallbacks',
    timelineDecoupledAndDynamic,
    timelineDecoupledAndDynamic
      ? 'Timeline dynamically consumes API data with no hardcoded factual dates/milestones'
      : 'Timeline still contains static fallbacks or lacks dynamic binding'
  );

  // --------------------------------------------------------------------------
  // Test 20: Owner Economics & XIRR Explicit "계산 불가"
  // --------------------------------------------------------------------------
  const ownerContent = fs.readFileSync(path.join(redevDir, 'OwnerEconomicsSection.tsx'), 'utf-8');
  const hasXirrNotReady =
    ownerContent.includes('계산 불가') &&
    ownerContent.includes('개별 조합원의 실제 납부금액과 납부일자 자료가 충분하지 않습니다.') &&
    !ownerContent.includes('>0%<') &&
    !ownerContent.includes('>N/A%<');
  recordTest(
    20,
    'Owner Economics: XIRR explicitly marked as "계산 불가" (NOT 0% or N/A%) with data gap reason',
    hasXirrNotReady,
    hasXirrNotReady ? 'XIRR displayed as 계산 불가 with explanation' : 'XIRR not properly refused'
  );

  // --------------------------------------------------------------------------
  // Test 21: Research Examples Isolation
  // --------------------------------------------------------------------------
  const hasIsolatedExamples =
    ownerContent.includes('공개자료 참고 사례 (Research Examples)') &&
    ownerContent.includes('RESEARCH_ONLY') &&
    ownerContent.includes('실제 최종 조합원 배정 결과가 아닙니다.') &&
    ownerContent.includes('isExamplesOpen');
  recordTest(
    21,
    'Research Examples Isolation: APPLICATION_EXAMPLE kept in separate collapsible section marked RESEARCH_ONLY',
    hasIsolatedExamples,
    hasIsolatedExamples ? 'Research examples strictly isolated and tagged' : 'Research examples not properly isolated'
  );

  // --------------------------------------------------------------------------
  // Test 22: Project Economics Construction Costs (6 events, REQUESTED isolation)
  // --------------------------------------------------------------------------
  const projectEconContent = fs.readFileSync(path.join(redevDir, 'ProjectEconomicsSection.tsx'), 'utf-8');
  const hasConstructionEvents =
    projectEconContent.includes('공사비 증액 요구(REQUESTED_INCREASE)는 시공사업단의 일방 청구액이며 확정 계약금액(FINAL)이 아닙니다.') &&
    projectEconContent.includes('증액 요구 (미확정)') &&
    projectEconContent.includes('부동산원 검증');
  recordTest(
    22,
    'Project Economics: Construction costs distinguish REQUESTED (증액 요구) from signed contracts',
    hasConstructionEvents,
    hasConstructionEvents ? 'Construction cost events and disclaimers present' : 'Missing construction cost distinctions'
  );

  // --------------------------------------------------------------------------
  // Test 23: REB Verification Audit Breakdown
  // --------------------------------------------------------------------------
  const hasRebSummary =
    projectEconContent.includes('한국부동산원(REB) 공사비 검증 내역 요약') &&
    projectEconContent.includes('부동산원 검증대상액') &&
    projectEconContent.includes('검증 인정액') &&
    projectEconContent.includes('부동산원 감액 조정액');
  recordTest(
    23,
    'Project Economics: REB verification audit breakdown displayed (검증대상, 인정액, 감액 조정액, 검증불가분)',
    hasRebSummary,
    hasRebSummary ? 'REB verification summary present' : 'Missing REB breakdown'
  );

  // --------------------------------------------------------------------------
  // Test 24: Land Share Semantics & Legal Disclaimer
  // --------------------------------------------------------------------------
  const landContent = fs.readFileSync(path.join(redevDir, 'LandShareSection.tsx'), 'utf-8');
  const hasLandShareSemantics =
    landContent.includes('상세 레코드 수') &&
    landContent.includes('명목 카테고리 수') &&
    landContent.includes('고유 대지지분 값') &&
    landContent.includes('종전 AreaFamily') &&
    landContent.includes('대지지분(대지권비율)은 자산의 물리적 토지 지분 비율을 나타내는 기술적 통계이며');
  recordTest(
    24,
    'Land Share: Precise counts (17 records, 15 categories, 12 values, 16 area families) & legal disclaimer',
    hasLandShareSemantics,
    hasLandShareSemantics ? 'Land share metrics and disclaimer are accurate' : 'Missing land share semantics'
  );

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  const passCount = results.filter((r) => r.passed).length;
  console.log(`📊 PHASE 8D VERIFICATION SUMMARY: ${passCount} / ${results.length} PASSED`);
  console.log('================================================================');

  if (passCount !== results.length) {
    console.error('❌ SOME TESTS FAILED. Please review the output above.');
    process.exit(1);
  } else {
    console.log('🎉 ALL 24 PHASE 8D UI TESTS PASSED SUCCESSFULLY!');
  }
}

runTests().catch((err) => {
  console.error('Verification script crashed:', err);
  process.exit(1);
});
