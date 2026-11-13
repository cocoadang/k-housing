/**
 * Phase 8C-1: Redevelopment Analysis Readiness Engine
 * 
 * CORE PRINCIPLE:
 * "CALCULATE WHEN JUSTIFIED, REFUSE WHEN NOT JUSTIFIED"
 * 
 * Strictly verifies whether data requirements, evidence policies, and domain
 * constraints are fulfilled before allowing calculation to execute.
 */

import {
  NormalizedProjectSeed,
  NormalizedMappingSeed,
  NormalizedFinancialSeed,
  NormalizedConstructionCostSeed,
  NormalizedLandShareSeed,
  NormalizedAnalysisSeed,
  ProductionEligibility,
} from '../types/redevelopmentNormalizedSeed';
import {
  AnalysisReadiness,
  CalculationAvailability,
  EvidenceEligibilityPolicy,
  AnalysisMode,
  ValueMetricType,
  LineageReadinessSummary,
} from '../types/redevelopmentAnalysis';

export interface RedevelopmentSeedBundle {
  projectSeed: NormalizedProjectSeed;
  mappingSeed: NormalizedMappingSeed;
  financialSeed: NormalizedFinancialSeed;
  costSeed: NormalizedConstructionCostSeed;
  landSeed: NormalizedLandShareSeed;
  analysisSeed: NormalizedAnalysisSeed;
}

export interface ReadinessEvaluationResult {
  readiness: AnalysisReadiness;
  availability: CalculationAvailability;
  missingRequirements: string[];
  warnings: string[];
  assumptions: string[];
}

/**
 * 1. Check Evidence Eligibility according to Policy
 */
export function isEvidenceEligible(
  eligibility: ProductionEligibility,
  policy: EvidenceEligibilityPolicy = 'VERIFIED_ONLY'
): boolean {
  if (eligibility === 'RESEARCH_ONLY' || eligibility === 'PENDING') {
    return false;
  }
  if (policy === 'VERIFIED_ONLY') {
    return eligibility === 'VERIFIED';
  }
  if (policy === 'ALLOW_SUPPORTED') {
    return eligibility === 'VERIFIED' || eligibility === 'SUPPORTED';
  }
  return false;
}

/**
 * 2. Nominal Asset Value Readiness
 */
export function checkNominalValueReadiness(
  bundle: RedevelopmentSeedBundle,
  mode: AnalysisMode,
  options?: {
    predecessorFamilyId?: string;
    successorFamilyId?: string;
    predecessorPriceAvailable?: boolean;
    successorPriceAvailable?: boolean;
  }
): ReadinessEvaluationResult {
  const missingRequirements: string[] = [];
  const warnings: string[] = [];
  const assumptions: string[] = [];

  if (mode === 'VERIFIED_HISTORICAL') {
    // Requires verified mapping in mappingSeed
    const verifiedCount =
      bundle.mappingSeed.summary.verifiedActual +
      bundle.mappingSeed.summary.verifiedOption;

    if (verifiedCount === 0) {
      missingRequirements.push('공식 관리처분계획인가 세대별 최종 배정 명부 부재');
      missingRequirements.push('검증된 1:1 또는 1:N 실제 배정 매핑 없음 (UNKNOWN)');
      warnings.push(
        '면적 유사도나 비공식 분양신청 시뮬레이션을 통한 자동 배정 추론은 엄격히 차단됨'
      );
      return {
        readiness: 'NOT_READY',
        availability: 'UNVERIFIED_MAPPING',
        missingRequirements,
        warnings,
        assumptions,
      };
    }

    // Check specific family mapping if provided
    if (options?.predecessorFamilyId) {
      const rec = bundle.mappingSeed.coverageRecords.find(
        (r) => r.familyId === options.predecessorFamilyId
      );
      if (!rec || rec.coverageStatus === 'UNKNOWN') {
        missingRequirements.push(
          `Predecessor family '${options.predecessorFamilyId}' 배정 상태 UNKNOWN`
        );
        return {
          readiness: 'NOT_READY',
          availability: 'UNVERIFIED_MAPPING',
          missingRequirements,
          warnings,
          assumptions,
        };
      }
    }

    return {
      readiness: 'READY',
      availability: 'AVAILABLE',
      missingRequirements,
      warnings,
      assumptions,
    };
  }

  // USER_SCENARIO Mode
  warnings.push('SCENARIO_NOT_VERIFIED_HISTORICAL_MAPPING');
  assumptions.push('사용자가 명시적으로 선택한 가상 시나리오 평형 조합 분석');

  if (!options?.predecessorFamilyId || !options?.successorFamilyId) {
    missingRequirements.push('predecessorFamilyId 및 successorFamilyId 지정 필요');
    return {
      readiness: 'NOT_READY',
      availability: 'INVALID_INPUT',
      missingRequirements,
      warnings,
      assumptions,
    };
  }

  if (options.predecessorPriceAvailable === false) {
    missingRequirements.push('종전 평형의 해당 거래월 실거래가 데이터 부재');
    return {
      readiness: 'NOT_READY',
      availability: 'MISSING_PREDECESSOR_VALUE',
      missingRequirements,
      warnings,
      assumptions,
    };
  }

  if (options.successorPriceAvailable === false) {
    missingRequirements.push('신축 평형의 해당 거래월 실거래가 데이터 부재');
    return {
      readiness: 'NOT_READY',
      availability: 'MISSING_SUCCESSOR_VALUE',
      missingRequirements,
      warnings,
      assumptions,
    };
  }

  return {
    readiness: 'READY',
    availability: 'AVAILABLE',
    missingRequirements,
    warnings,
    assumptions,
  };
}

/**
 * 3. Cost Adjusted Value Readiness
 */
export function checkCostAdjustedReadiness(
  bundle: RedevelopmentSeedBundle,
  options?: {
    hasPredecessorBasis?: boolean;
    hasVerifiedContribution?: boolean;
    evidencePolicy?: EvidenceEligibilityPolicy;
  }
): ReadinessEvaluationResult {
  const missingRequirements: string[] = [];
  const warnings: string[] = [];
  const assumptions: string[] = [];

  const policy = options?.evidencePolicy || 'VERIFIED_ONLY';

  // Check proportional rate presence
  if (!bundle.financialSeed.proportionalRate || bundle.financialSeed.proportionalRate.valuePct == null) {
    missingRequirements.push('관리처분계획 비례율 및 권리가액 데이터 부재');
    return {
      readiness: 'NOT_READY',
      availability: 'DATA_NOT_AVAILABLE',
      missingRequirements,
      warnings,
      assumptions,
    };
  }

  const finMetrics: Record<string, any> = bundle.financialSeed.metricsBySemanticType || {};

  // Check individual appraisal roster
  if (!finMetrics.PREDECESSOR_APPRAISAL_VALUE?.rosterAvailable) {
    missingRequirements.push('전수 세대별 개별 종전자산평가액 원부 명부 공공 미공개');
  }

  // Check individual contribution roster
  if (!finMetrics.ADDITIONAL_CONTRIBUTION?.individualRosterValues) {
    missingRequirements.push('신축 평형 배정별 개별 조합원 실제 분담금 명부 부재');
  }

  // Check evidence policy compliance
  const propRateEligible = isEvidenceEligible(
    bundle.financialSeed.proportionalRate.eligibility,
    policy
  );
  if (!propRateEligible) {
    missingRequirements.push(`비례율 데이터가 선택된 정책(${policy}) 요건을 충족하지 않음`);
  }

  warnings.push(
    '사업 단위의 총공사비 또는 공사비 증액분을 개인 조합원 추가분담금으로 임의 변환하는 행위는 엄격히 금지됨'
  );

  if (missingRequirements.length > 0) {
    return {
      readiness: 'PARTIAL',
      availability: 'INSUFFICIENT_EVIDENCE',
      missingRequirements,
      warnings,
      assumptions,
    };
  }

  return {
    readiness: 'READY',
    availability: 'AVAILABLE',
    missingRequirements,
    warnings,
    assumptions,
  };
}

/**
 * 4. XIRR Readiness
 */
export function checkXirrReadiness(
  bundle: RedevelopmentSeedBundle,
  options?: {
    cashFlowDatesCount?: number;
    hasNegativeFlow?: boolean;
    hasPositiveFlow?: boolean;
    evidencePolicy?: EvidenceEligibilityPolicy;
  }
): ReadinessEvaluationResult {
  const missingRequirements: string[] = [];
  const warnings: string[] = [];
  const assumptions: string[] = [];

  missingRequirements.push(
    '실제 조합원 일자별 현금흐름(계약금·중도금 회차별 납부일 및 납부액) 원천 데이터 부재'
  );
  missingRequirements.push('이주비 대출 실행일 및 금융비용 발생 시점 데이터 부재');
  missingRequirements.push('환급금 수령자의 실제 환급금 지급일 및 분할 지급 내역 부재');

  warnings.push(
    '임의의 날짜(인가일, 착공일, 준공일 등)를 현금흐름 납부일로 가공/대체하는 행위는 엄격히 금지됨 (NO DATE FABRICATION)'
  );

  return {
    readiness: 'NOT_READY',
    availability: 'MISSING_CASH_FLOW_DATES',
    missingRequirements,
    warnings,
    assumptions,
  };
}

/**
 * 5. Land Share Readiness
 */
export function checkLandShareReadiness(
  bundle: RedevelopmentSeedBundle,
  options?: { evidencePolicy?: EvidenceEligibilityPolicy }
): ReadinessEvaluationResult {
  const missingRequirements: string[] = [];
  const warnings: string[] = [];
  const assumptions: string[] = [];

  const policy = options?.evidencePolicy || 'VERIFIED_ONLY';
  const landEligible = isEvidenceEligible(bundle.landSeed.eligibility || 'SUPPORTED', policy);

  if (!landEligible) {
    missingRequirements.push(`대지지분 데이터의 eligibility가 정책(${policy}) 요건 미달`);
    return {
      readiness: 'NOT_READY',
      availability: 'UNSUPPORTED_EVIDENCE',
      missingRequirements,
      warnings,
      assumptions,
    };
  }

  const expectedTiers = bundle.landSeed.totalDistinctTiers ?? 15;
  if (expectedTiers === 0 || bundle.landSeed.tiers.length === 0) {
    missingRequirements.push('재개발 저층주거지 특성상 규격화된 아파트 단지형 대지지분 데이터 부재');
    return {
      readiness: 'NOT_READY',
      availability: 'DATA_NOT_AVAILABLE',
      missingRequirements,
      warnings,
      assumptions,
    };
  }

  if (bundle.landSeed.tiers.length < expectedTiers) {
    missingRequirements.push(`${expectedTiers}개 전수 대지지분 티어 데이터 불완전`);
    return {
      readiness: 'PARTIAL',
      availability: 'INSUFFICIENT_EVIDENCE',
      missingRequirements,
      warnings,
      assumptions,
    };
  }

  warnings.push(
    '대지지분 분석은 평형별 지분 크기 및 비율의 기술적(descriptive) 비교에 한정되며, 권리가액 또는 신축 배정 평형에 대한 인과 추론은 엄격히 금지됨'
  );

  return {
    readiness: 'READY',
    availability: 'AVAILABLE',
    missingRequirements,
    warnings,
    assumptions,
  };
}

/**
 * 6. Construction Cost Timeline Readiness
 */
export function checkConstructionCostReadiness(
  bundle: RedevelopmentSeedBundle,
  options?: { evidencePolicy?: EvidenceEligibilityPolicy }
): ReadinessEvaluationResult {
  const missingRequirements: string[] = [];
  const warnings: string[] = [];
  const assumptions: string[] = [];

  if (bundle.costSeed.costEvents.length === 0) {
    missingRequirements.push('공사비 이벤트 이력 부재');
    return {
      readiness: 'NOT_READY',
      availability: 'DATA_NOT_AVAILABLE',
      missingRequirements,
      warnings,
      assumptions,
    };
  }

  warnings.push(
    '시공사업단 증액 요구액(REQUESTED)은 계약 확정액이 아니며 법적 도급계약(SIGNED_CONTRACT) 및 부동산원 검증(VERIFIED)과 분리 관리됨'
  );
  warnings.push('최종 청산 결산 승인 전으로 총공사비는 미확정(NOT_FINAL) 상태임');

  return {
    readiness: 'READY',
    availability: 'AVAILABLE',
    missingRequirements,
    warnings,
    assumptions,
  };
}

/**
 * 7. Comprehensive Lineage Readiness Summary
 */
export function evaluateLineageReadiness(
  bundle: RedevelopmentSeedBundle,
  policy: EvidenceEligibilityPolicy = 'VERIFIED_ONLY'
): LineageReadinessSummary {
  const nominalHistorical = checkNominalValueReadiness(bundle, 'VERIFIED_HISTORICAL');
  const nominalScenario = checkNominalValueReadiness(bundle, 'USER_SCENARIO', {
    predecessorFamilyId: 'pred_dummy',
    successorFamilyId: 'succ_dummy',
    predecessorPriceAvailable: true,
    successorPriceAvailable: true,
  });
  const costAdjusted = checkCostAdjustedReadiness(bundle, { evidencePolicy: policy });
  const xirr = checkXirrReadiness(bundle, { evidencePolicy: policy });
  const landShare = checkLandShareReadiness(bundle, { evidencePolicy: policy });
  const constructionCost = checkConstructionCostReadiness(bundle, { evidencePolicy: policy });

  return {
    lineageId: bundle.projectSeed.lineageId,
    projectId: bundle.projectSeed.projectId,
    evidencePolicy: policy,
    nominalHistorical: {
      readiness: nominalHistorical.readiness,
      availability: nominalHistorical.availability,
      missingRequirements: nominalHistorical.missingRequirements,
      warnings: nominalHistorical.warnings,
    },
    nominalScenario: {
      readiness: nominalScenario.readiness,
      availability: nominalScenario.availability,
      missingRequirements: nominalScenario.missingRequirements,
      warnings: nominalScenario.warnings,
    },
    costAdjusted: {
      readiness: costAdjusted.readiness,
      availability: costAdjusted.availability,
      missingRequirements: costAdjusted.missingRequirements,
      warnings: costAdjusted.warnings,
    },
    xirr: {
      readiness: xirr.readiness,
      availability: xirr.availability,
      missingRequirements: xirr.missingRequirements,
      warnings: xirr.warnings,
    },
    landShare: {
      readiness: landShare.readiness,
      availability: landShare.availability,
      missingRequirements: landShare.missingRequirements,
      warnings: landShare.warnings,
    },
    constructionCostTimeline: {
      readiness: constructionCost.readiness,
      availability: constructionCost.availability,
      missingRequirements: constructionCost.missingRequirements,
      warnings: constructionCost.warnings,
    },
    evaluatedAt: new Date().toISOString(),
  };
}
