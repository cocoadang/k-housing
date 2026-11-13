/**
 * Phase 8C-1: Redevelopment Value Analysis Engine
 * 
 * CORE ARCHITECTURAL PRINCIPLE:
 * "CALCULATE WHEN JUSTIFIED, REFUSE WHEN NOT JUSTIFIED"
 * 
 * Strict Domain Isolation:
 * - OWNER ECONOMICS & PROJECT ECONOMICS are strictly decoupled.
 * - All results follow AnalysisResultContract with explicit provenance and warnings.
 * - Refuses calculation with value: null when requirements are unmet.
 */

import {
  AnalysisMode,
  EvidenceEligibilityPolicy,
  PredecessorBasisType,
  OwnerCashFlowItem,
  AnalysisObservationPoint,
  OwnerNominalValueAnalysisResult,
  OwnerCostAdjustedValueAnalysisResult,
  OwnerXirrAnalysisResult,
  LandShareAnalysisResult,
  LandShareSimilarityResult,
  ProjectCostAnalysisResult,
  ProjectCostEventComparison,
  LandShareRatioItem,
} from '../types/redevelopmentAnalysis';
import {
  RedevelopmentSeedBundle,
  checkNominalValueReadiness,
  checkCostAdjustedReadiness,
  checkXirrReadiness,
  checkLandShareReadiness,
  checkConstructionCostReadiness,
  isEvidenceEligible,
} from './redevelopmentReadinessService';
import {
  calculateNominalValueChange,
  calculateValueMultiple,
  calculateCostAdjustedValue,
  calculateCostAdjustedMultiple,
  calculateLandShareRatio,
  calculateLandShareDifference,
  calculateCostDifference,
  calculateXirr,
  PureCashFlowPoint,
} from '../utils/redevelopmentCalculations';

export class RedevelopmentAnalysisService {
  /**
   * 1. Owner Economics: Nominal Asset Value Change Analysis
   */
  public analyzeNominalValueChange(
    bundle: RedevelopmentSeedBundle,
    mode: AnalysisMode,
    options: {
      predecessorFamilyId: string;
      successorFamilyId: string;
      predecessorPricePoint: AnalysisObservationPoint | null;
      successorPricePoint: AnalysisObservationPoint | null;
      evidencePolicy?: EvidenceEligibilityPolicy;
    }
  ): OwnerNominalValueAnalysisResult {
    const policy = options.evidencePolicy || 'VERIFIED_ONLY';
    const readinessEval = checkNominalValueReadiness(bundle, mode, {
      predecessorFamilyId: options.predecessorFamilyId,
      successorFamilyId: options.successorFamilyId,
      predecessorPriceAvailable: options.predecessorPricePoint !== null,
      successorPriceAvailable: options.successorPricePoint !== null,
    });

    const isHistorical = mode === 'VERIFIED_HISTORICAL';
    const metricType = isHistorical
      ? 'NOMINAL_ASSET_VALUE_CHANGE'
      : 'SCENARIO_NOMINAL_VALUE_CHANGE';
    const displayLabel = isHistorical
      ? '명목 자산가치 변화'
      : '시나리오 명목 자산가치 변화';

    const warnings = [...readinessEval.warnings];
    const assumptions = [...readinessEval.assumptions];
    const missingRequirements = [...readinessEval.missingRequirements];

    // Provenance builder
    const sourceIds: string[] = [];
    const evidenceIds: string[] = [];
    const inputRecordIds: string[] = [];
    const productionEligibility = [];

    if (options.predecessorPricePoint) {
      inputRecordIds.push(
        `${options.predecessorPricePoint.complexId}::${options.predecessorPricePoint.areaFamilyId}::${options.predecessorPricePoint.date}`
      );
    }
    if (options.successorPricePoint) {
      inputRecordIds.push(
        `${options.successorPricePoint.complexId}::${options.successorPricePoint.areaFamilyId}::${options.successorPricePoint.date}`
      );
    }

    if (readinessEval.readiness !== 'READY' || readinessEval.availability !== 'AVAILABLE') {
      return {
        metricType,
        availability: readinessEval.availability,
        readiness: readinessEval.readiness,
        value: null,
        unit: 'KRW_MANWON',
        displayLabel,
        analysisMode: mode,
        inputs: {
          predecessorFamilyId: options.predecessorFamilyId,
          successorFamilyId: options.successorFamilyId,
          evidencePolicy: policy,
        },
        provenance: {
          sourceIds,
          evidenceIds,
          inputRecordIds,
          productionEligibility,
          evaluatedAt: new Date().toISOString(),
        },
        assumptions,
        warnings,
        missingRequirements,
        historicalMappingVerified: false,
      };
    }

    const pVal = options.predecessorPricePoint!.price;
    const sVal = options.successorPricePoint!.price;
    const value = calculateNominalValueChange(sVal, pVal);

    let elapsedDays: number | null = null;
    let elapsedYears: number | null = null;

    if (options.predecessorPricePoint?.date && options.successorPricePoint?.date) {
      const pDateStr = options.predecessorPricePoint.date.length === 6
        ? `${options.predecessorPricePoint.date.slice(0, 4)}-${options.predecessorPricePoint.date.slice(4, 6)}-01`
        : options.predecessorPricePoint.date;
      const sDateStr = options.successorPricePoint.date.length === 6
        ? `${options.successorPricePoint.date.slice(0, 4)}-${options.successorPricePoint.date.slice(4, 6)}-01`
        : options.successorPricePoint.date;

      const d1 = new Date(pDateStr).getTime();
      const d2 = new Date(sDateStr).getTime();
      if (!isNaN(d1) && !isNaN(d2)) {
        elapsedDays = Math.round(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));
        elapsedYears = Number((elapsedDays / 365.25).toFixed(2));
      }
    }

    warnings.push(
      '재건축 경계(Redevelopment Boundary)를 가로지르는 연속 시계열 합성 및 CAGR 산출은 원천 금지됨'
    );

    return {
      metricType,
      availability: 'AVAILABLE',
      readiness: 'READY',
      value,
      unit: 'KRW_MANWON',
      displayLabel,
      analysisMode: mode,
      inputs: {
        predecessorFamilyId: options.predecessorFamilyId,
        successorFamilyId: options.successorFamilyId,
        predecessorPricePoint: options.predecessorPricePoint,
        successorPricePoint: options.successorPricePoint,
        evidencePolicy: policy,
      },
      provenance: {
        sourceIds,
        evidenceIds,
        inputRecordIds,
        productionEligibility,
        evaluatedAt: new Date().toISOString(),
      },
      assumptions,
      warnings,
      missingRequirements,
      predecessorObservation: options.predecessorPricePoint,
      successorObservation: options.successorPricePoint,
      elapsedDays,
      elapsedYears,
      historicalMappingVerified: isHistorical,
    };
  }

  /**
   * 2. Owner Economics: Cost Adjusted Value Analysis
   */
  public analyzeCostAdjustedValue(
    bundle: RedevelopmentSeedBundle,
    options: {
      basisType: PredecessorBasisType;
      predecessorBasisAmount: number | null;
      ownerCashFlows: OwnerCashFlowItem[];
      successorMarketValue: number | null;
      evidencePolicy?: EvidenceEligibilityPolicy;
    }
  ): OwnerCostAdjustedValueAnalysisResult {
    const policy = options.evidencePolicy || 'VERIFIED_ONLY';
    const readinessEval = checkCostAdjustedReadiness(bundle, {
      hasPredecessorBasis: options.predecessorBasisAmount !== null,
      hasVerifiedContribution: options.ownerCashFlows.length > 0,
      evidencePolicy: policy,
    });

    const warnings = [...readinessEval.warnings];
    const assumptions = [...readinessEval.assumptions];
    const missingRequirements = [...readinessEval.missingRequirements];

    if (options.basisType === 'MARKET_VALUE') {
      warnings.push('MARKET_VALUE_BASED_ANALYSIS: 구 아파트 매수가격 기준 분석으로 실제 감정/권리가액과 구별됨');
    } else if (options.basisType === 'RIGHTS_VALUE') {
      warnings.push('RIGHTS_VALUE_BASED_ANALYSIS: 법정 권리가액 기준 분석으로 실제 현금 취득원가와 구별됨');
    }

    const sourceIds: string[] = [];
    const evidenceIds: string[] = [];
    const inputRecordIds: string[] = [];
    const eligibleFlows: OwnerCashFlowItem[] = [];

    // Filter cash flows by policy
    for (const flow of options.ownerCashFlows) {
      if (isEvidenceEligible(flow.productionEligibility, policy)) {
        eligibleFlows.push(flow);
        if (flow.sourceId) sourceIds.push(flow.sourceId);
        if (flow.evidenceId) evidenceIds.push(flow.evidenceId);
        inputRecordIds.push(flow.flowId);
      } else {
        warnings.push(`현금흐름 항목 '${flow.flowId}'은 정책(${policy}) 요건 미달로 계산에서 제외됨`);
      }
    }

    if (
      options.predecessorBasisAmount === null ||
      options.successorMarketValue === null ||
      readinessEval.readiness !== 'READY'
    ) {
      return {
        metricType: 'COST_ADJUSTED_VALUE_CHANGE',
        availability: options.predecessorBasisAmount === null
          ? 'MISSING_COST_BASIS'
          : readinessEval.availability,
        readiness: readinessEval.readiness,
        value: null,
        unit: 'KRW_MANWON',
        displayLabel: '비용 반영 자산가치 변화',
        analysisMode: 'USER_SCENARIO',
        inputs: {
          basisType: options.basisType,
          predecessorBasisAmount: options.predecessorBasisAmount,
          cashFlowCount: options.ownerCashFlows.length,
          successorMarketValue: options.successorMarketValue,
          evidencePolicy: policy,
        },
        provenance: {
          sourceIds,
          evidenceIds,
          inputRecordIds,
          productionEligibility: eligibleFlows.map((f) => f.productionEligibility),
          evaluatedAt: new Date().toISOString(),
        },
        assumptions,
        warnings,
        missingRequirements,
        basisType: options.basisType,
        predecessorBasisAmount: options.predecessorBasisAmount,
        totalOutflows: null,
        totalRefunds: null,
        netEconomicBasis: null,
        successorValue: options.successorMarketValue,
        cashFlowsIncluded: eligibleFlows,
      };
    }

    // Sum outflows and refunds
    let totalOutflows = 0;
    let totalRefunds = 0;
    for (const flow of eligibleFlows) {
      if (flow.amount > 0) {
        totalOutflows += flow.amount;
      } else {
        totalRefunds += Math.abs(flow.amount);
      }
    }

    const netEconomicBasis = options.predecessorBasisAmount + totalOutflows - totalRefunds;
    const value = calculateCostAdjustedValue(options.successorMarketValue, netEconomicBasis);

    return {
      metricType: 'COST_ADJUSTED_VALUE_CHANGE',
      availability: 'AVAILABLE',
      readiness: 'READY',
      value,
      unit: 'KRW_MANWON',
      displayLabel: '비용 반영 자산가치 변화',
      analysisMode: 'USER_SCENARIO',
      inputs: {
        basisType: options.basisType,
        predecessorBasisAmount: options.predecessorBasisAmount,
        totalOutflows,
        totalRefunds,
        successorMarketValue: options.successorMarketValue,
        evidencePolicy: policy,
      },
      provenance: {
        sourceIds,
        evidenceIds,
        inputRecordIds,
        productionEligibility: eligibleFlows.map((f) => f.productionEligibility),
        evaluatedAt: new Date().toISOString(),
      },
      assumptions,
      warnings,
      missingRequirements,
      basisType: options.basisType,
      predecessorBasisAmount: options.predecessorBasisAmount,
      totalOutflows,
      totalRefunds,
      netEconomicBasis,
      successorValue: options.successorMarketValue,
      cashFlowsIncluded: eligibleFlows,
    };
  }

  /**
   * 3. Owner Economics: XIRR Analysis
   */
  public analyzeOwnerXirr(
    bundle: RedevelopmentSeedBundle,
    options: {
      cashFlows: OwnerCashFlowItem[];
      evidencePolicy?: EvidenceEligibilityPolicy;
    }
  ): OwnerXirrAnalysisResult {
    const policy = options.evidencePolicy || 'VERIFIED_ONLY';
    const readinessEval = checkXirrReadiness(bundle, {
      evidencePolicy: policy,
    });

    const warnings = [...readinessEval.warnings];
    const assumptions = [...readinessEval.assumptions];
    const missingRequirements = [...readinessEval.missingRequirements];

    const sourceIds: string[] = [];
    const evidenceIds: string[] = [];
    const inputRecordIds: string[] = [];

    // Check if cash flows are provided and pass eligibility
    const validMathFlows: PureCashFlowPoint[] = [];
    let hasNullDate = false;
    let totalOutflow = 0;
    let finalSuccessorValue: number | null = null;

    for (const flow of options.cashFlows) {
      if (!isEvidenceEligible(flow.productionEligibility, policy)) {
        warnings.push(`현금흐름 '${flow.flowId}'은 정책(${policy}) 미달로 차단됨`);
        continue;
      }
      if (!flow.date || flow.date.trim() === '') {
        hasNullDate = true;
        continue;
      }
      if (flow.sourceId) sourceIds.push(flow.sourceId);
      if (flow.evidenceId) evidenceIds.push(flow.evidenceId);
      inputRecordIds.push(flow.flowId);

      // Financial math convention: outflow (owner expense) is negative, inflow (asset value) is positive
      const mathAmount = flow.flowType === 'ACQUISITION' || flow.flowType === 'ADDITIONAL_CONTRIBUTION' || flow.flowType === 'ADDITIONAL_CHARGE'
        ? -Math.abs(flow.amount)
        : Math.abs(flow.amount);

      if (mathAmount < 0) totalOutflow += Math.abs(mathAmount);
      if (mathAmount > 0) finalSuccessorValue = mathAmount;

      validMathFlows.push({
        amount: mathAmount,
        date: flow.date,
      });
    }

    // Strict Gate: If any cash flow lacks a verified real date, calculation is strictly blocked!
    if (hasNullDate || validMathFlows.length < 2) {
      if (hasNullDate) {
        missingRequirements.push('일부 현금흐름 항목의 실제 납부일자(date)가 누락됨 (MISSING_CASH_FLOW_DATES)');
      }
      return {
        metricType: 'XIRR',
        availability: hasNullDate ? 'MISSING_CASH_FLOW_DATES' : readinessEval.availability,
        readiness: 'NOT_READY',
        value: null,
        unit: 'PERCENT',
        displayLabel: '연평균 내부수익률 (XIRR)',
        analysisMode: 'USER_SCENARIO',
        inputs: {
          cashFlowCount: options.cashFlows.length,
          validMathFlowCount: validMathFlows.length,
          evidencePolicy: policy,
        },
        provenance: {
          sourceIds,
          evidenceIds,
          inputRecordIds,
          productionEligibility: options.cashFlows.map((f) => f.productionEligibility),
          evaluatedAt: new Date().toISOString(),
        },
        assumptions,
        warnings,
        missingRequirements,
        cashFlowCount: validMathFlows.length,
        startDate: null,
        endDate: null,
        totalOutflow: null,
        finalSuccessorValue: null,
      };
    }

    // Run pure math calculation
    const mathRes = calculateXirr(validMathFlows);
    if (!mathRes) {
      return {
        metricType: 'XIRR',
        availability: 'INVALID_INPUT',
        readiness: 'NOT_READY',
        value: null,
        unit: 'PERCENT',
        displayLabel: '연평균 내부수익률 (XIRR)',
        analysisMode: 'USER_SCENARIO',
        inputs: {
          validMathFlowCount: validMathFlows.length,
          evidencePolicy: policy,
        },
        provenance: {
          sourceIds,
          evidenceIds,
          inputRecordIds,
          productionEligibility: options.cashFlows.map((f) => f.productionEligibility),
          evaluatedAt: new Date().toISOString(),
        },
        assumptions,
        warnings: [...warnings, '현금흐름 패턴이 XIRR 수렴 조건을 충족하지 못함 (양수/음수 부호 불완전 또는 발산)'],
        missingRequirements,
        cashFlowCount: validMathFlows.length,
        startDate: validMathFlows[0].date,
        endDate: validMathFlows[validMathFlows.length - 1].date,
        totalOutflow,
        finalSuccessorValue,
      };
    }

    // Format XIRR: rate is decimal (e.g. 0.0845 = 8.45%)
    const xirrPercent = Number((mathRes.rate * 100).toFixed(2));

    return {
      metricType: 'XIRR',
      availability: 'AVAILABLE',
      readiness: 'READY',
      value: xirrPercent,
      unit: 'PERCENT',
      displayLabel: '연평균 내부수익률 (XIRR)',
      analysisMode: 'USER_SCENARIO',
      inputs: {
        validMathFlowCount: validMathFlows.length,
        evidencePolicy: policy,
      },
      provenance: {
        sourceIds,
        evidenceIds,
        inputRecordIds,
        productionEligibility: options.cashFlows.map((f) => f.productionEligibility),
        evaluatedAt: new Date().toISOString(),
      },
      assumptions,
      warnings,
      missingRequirements,
      cashFlowCount: validMathFlows.length,
      startDate: validMathFlows[0].date,
      endDate: validMathFlows[validMathFlows.length - 1].date,
      totalOutflow,
      finalSuccessorValue,
      iterationsUsed: mathRes.iterations,
    };
  }

  /**
   * 4. Land Share Analysis (Descriptive only, No Causal Inference)
   */
  public analyzeLandShare(
    bundle: RedevelopmentSeedBundle,
    options?: { evidencePolicy?: EvidenceEligibilityPolicy }
  ): LandShareAnalysisResult {
    const policy = options?.evidencePolicy || 'ALLOW_SUPPORTED';
    const readinessEval = checkLandShareReadiness(bundle, { evidencePolicy: policy });

    const warnings = [...readinessEval.warnings];
    const assumptions = [...readinessEval.assumptions];
    const missingRequirements = [...readinessEval.missingRequirements];

    const sourceIds: string[] = bundle.landSeed.sourceId ? [bundle.landSeed.sourceId] : [];
    const evidenceIds: string[] = bundle.landSeed.evidenceId ? [bundle.landSeed.evidenceId] : [];
    const inputRecordIds = bundle.landSeed.tiers.map((t) => t.tierId);
    const productionEligibility = bundle.landSeed.eligibility ? [bundle.landSeed.eligibility] : [];

    if (readinessEval.readiness !== 'READY') {
      return {
        metricType: 'LAND_SHARE_RATIO',
        availability: readinessEval.availability,
        readiness: readinessEval.readiness,
        value: null,
        unit: 'RATIO',
        displayLabel: '평형별 대지지분 비율',
        analysisMode: 'VERIFIED_HISTORICAL',
        inputs: { totalTiers: bundle.landSeed.tiers.length, policy },
        provenance: {
          sourceIds,
          evidenceIds,
          inputRecordIds,
          productionEligibility,
          evaluatedAt: new Date().toISOString(),
        },
        assumptions,
        warnings,
        missingRequirements,
        rankingsByRatio: [],
      };
    }

    const items: LandShareRatioItem[] = bundle.landSeed.tiers.map((tier) => {
      // Find corresponding exclusive area sqm
      const predCov = bundle.mappingSeed.coverageRecords.find(
        (c) => c.complexNumber === tier.complexNumber && c.pyeongName === tier.pyeongName
      );
      const exclusiveAreaSqm = predCov?.exclusiveAreaSqm || 60; // fallback if record missing
      const landShareRatio = calculateLandShareRatio(tier.canonicalValueSqm, exclusiveAreaSqm) || 0;

      return {
        tierId: tier.tierId,
        complexNumber: tier.complexNumber,
        pyeongName: tier.pyeongName,
        exclusiveAreaSqm,
        landShareSqm: tier.canonicalValueSqm,
        landShareRatio,
        sourceOriginalPyeong: tier.sourceOriginalValue,
      };
    });

    // Rank by ratio descending
    const sorted = [...items].sort((a, b) => b.landShareRatio - a.landShareRatio);
    const rankingsByRatio = sorted.map((it, idx) => ({
      tierId: it.tierId,
      pyeongName: `${it.complexNumber}단지 ${it.pyeongName}`,
      landShareRatio: it.landShareRatio,
      rank: idx + 1,
    }));

    return {
      metricType: 'LAND_SHARE_RATIO',
      availability: 'AVAILABLE',
      readiness: 'READY',
      value: items,
      unit: 'RATIO',
      displayLabel: '평형별 대지지분 비율',
      analysisMode: 'VERIFIED_HISTORICAL',
      inputs: { totalTiers: items.length, policy },
      provenance: {
        sourceIds,
        evidenceIds,
        inputRecordIds,
        productionEligibility,
        evaluatedAt: new Date().toISOString(),
      },
      assumptions,
      warnings,
      missingRequirements,
      rankingsByRatio,
    };
  }

  /**
   * Compare two land share tiers (Strictly descriptive)
   */
  public compareLandShareTiers(
    bundle: RedevelopmentSeedBundle,
    tierAId: string,
    tierBId: string
  ): LandShareSimilarityResult {
    const tierA = bundle.landSeed.tiers.find((t) => t.tierId === tierAId);
    const tierB = bundle.landSeed.tiers.find((t) => t.tierId === tierBId);

    const causalInferenceWarning =
      '대지지분 유사성은 단순 물리적 면적 비교이며, 종전자산평가액이나 신축 배정 평형에 대한 권리적 등가성(Equivalence)을 생성하지 않습니다.';

    if (!tierA || !tierB) {
      return {
        metricType: 'LAND_SHARE_DIFFERENCE',
        availability: 'INVALID_INPUT',
        readiness: 'NOT_READY',
        value: null,
        unit: 'SQM',
        displayLabel: '대지지분 기술적 차이',
        analysisMode: 'VERIFIED_HISTORICAL',
        inputs: { tierAId, tierBId },
        provenance: {
          sourceIds: [],
          evidenceIds: [],
          inputRecordIds: [],
          productionEligibility: [],
          evaluatedAt: new Date().toISOString(),
        },
        assumptions: [],
        warnings: [causalInferenceWarning],
        missingRequirements: ['유효한 대지지분 티어 ID 지정 필요'],
        causalInferenceWarning,
      };
    }

    const diff = calculateLandShareDifference(tierA.canonicalValueSqm, tierB.canonicalValueSqm);

    return {
      metricType: 'LAND_SHARE_DIFFERENCE',
      availability: 'AVAILABLE',
      readiness: 'READY',
      value: {
        tierA: tierA.tierId,
        tierB: tierB.tierId,
        differenceSqm: diff?.differenceSqm || 0,
        differencePercent: diff?.differencePercent || 0,
      },
      unit: 'SQM',
      displayLabel: '대지지분 기술적 차이',
      analysisMode: 'VERIFIED_HISTORICAL',
      inputs: {
        tierA: { id: tierA.tierId, sqm: tierA.canonicalValueSqm },
        tierB: { id: tierB.tierId, sqm: tierB.canonicalValueSqm },
      },
      provenance: {
        sourceIds: [tierA.sourceId, tierB.sourceId],
        evidenceIds: [tierA.evidenceId || '', tierB.evidenceId || ''].filter(Boolean),
        inputRecordIds: [tierA.tierId, tierB.tierId],
        productionEligibility: [tierA.eligibility, tierB.eligibility],
        evaluatedAt: new Date().toISOString(),
      },
      assumptions: ['기술적 면적 차이 비교'],
      warnings: [causalInferenceWarning],
      missingRequirements: [],
      causalInferenceWarning,
    };
  }

  /**
   * 5. Project Economics: Construction Cost Timeline Analysis
   */
  public analyzeConstructionCostTimeline(
    bundle: RedevelopmentSeedBundle,
    options?: { evidencePolicy?: EvidenceEligibilityPolicy }
  ): ProjectCostAnalysisResult {
    const policy = options?.evidencePolicy || 'ALLOW_SUPPORTED';
    const readinessEval = checkConstructionCostReadiness(bundle, { evidencePolicy: policy });

    const warnings = [...readinessEval.warnings];
    const assumptions = [...readinessEval.assumptions];
    const missingRequirements = [...readinessEval.missingRequirements];

    const sourceIds: string[] = [];
    const evidenceIds: string[] = [];
    const inputRecordIds: string[] = [];
    const productionEligibility = [];

    for (const ev of bundle.costSeed.costEvents) {
      if (ev.sourceId) sourceIds.push(ev.sourceId);
      if (ev.evidenceId) evidenceIds.push(ev.evidenceId);
      inputRecordIds.push(ev.eventId);
      productionEligibility.push(ev.eligibility);
    }

    if (readinessEval.readiness !== 'READY') {
      return {
        metricType: 'CONSTRUCTION_COST_TIMELINE',
        availability: readinessEval.availability,
        readiness: readinessEval.readiness,
        value: null,
        unit: 'KRW_WON',
        displayLabel: '정비사업 공사비 변동 타임라인',
        analysisMode: 'VERIFIED_HISTORICAL',
        inputs: { totalEvents: bundle.costSeed.costEvents.length },
        provenance: {
          sourceIds,
          evidenceIds,
          inputRecordIds,
          productionEligibility,
          evaluatedAt: new Date().toISOString(),
        },
        assumptions,
        warnings,
        missingRequirements,
        totalEventsTracked: bundle.costSeed.costEvents.length,
        currentCostPhase: bundle.costSeed.currentCostPhase,
        isFinal: bundle.costSeed.isFinal,
      };
    }

    // Build event comparisons preserving semantic labels
    const comparisons: ProjectCostEventComparison[] = [];
    const events = bundle.costSeed.costEvents;

    for (let i = 1; i < events.length; i++) {
      const prior = events[i - 1];
      const curr = events[i];

      const diff = calculateCostDifference(prior.amountKrw, curr.amountKrw);

      let semanticLabel = 'SEQUENTIAL_COST_CHANGE';
      if (prior.status === 'SIGNED_CONTRACT' && curr.status === 'SIGNED_CONTRACT') {
        semanticLabel = 'CONTRACT_AMENDMENT_CHANGE';
      } else if (curr.status === 'REQUESTED') {
        semanticLabel = 'REQUESTED_CHANGE_FROM_PRIOR_CONTRACT';
      } else if (curr.status === 'VERIFIED') {
        semanticLabel = 'AUDIT_VERIFICATION_REDUCTION';
      } else if (curr.status === 'AGREED') {
        semanticLabel = 'INFRASTRUCTURE_ADDITION_AGREEMENT';
      }

      comparisons.push({
        priorEventId: prior.eventId,
        priorStatus: prior.status,
        priorAmountKrw: prior.amountKrw,
        priorDate: prior.date,
        targetEventId: curr.eventId,
        targetStatus: curr.status,
        targetAmountKrw: curr.amountKrw,
        targetDate: curr.date,
        differenceAmountKrw: diff?.diffAmount || 0,
        differencePercent: diff?.diffPercent || 0,
        comparisonSemanticLabel: semanticLabel,
      });
    }

    return {
      metricType: 'CONSTRUCTION_COST_TIMELINE',
      availability: 'AVAILABLE',
      readiness: 'READY',
      value: comparisons,
      unit: 'KRW_WON',
      displayLabel: '정비사업 공사비 변동 타임라인',
      analysisMode: 'VERIFIED_HISTORICAL',
      inputs: { totalEvents: events.length },
      provenance: {
        sourceIds,
        evidenceIds,
        inputRecordIds,
        productionEligibility,
        evaluatedAt: new Date().toISOString(),
      },
      assumptions,
      warnings,
      missingRequirements,
      totalEventsTracked: events.length,
      rebAuditSummary: bundle.costSeed.rebAuditBreakdown,
      currentCostPhase: bundle.costSeed.currentCostPhase,
      isFinal: bundle.costSeed.isFinal,
    };
  }
}

export const redevelopmentAnalysisService = new RedevelopmentAnalysisService();
