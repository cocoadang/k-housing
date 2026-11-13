/**
 * Phase 8C-2: Redevelopment Data Service
 * 
 * Orchestrates:
 * 1. Normalized Redevelopment Seed Loading
 * 2. Target Resolution & Validation (Predecessor & Successor Area Families)
 * 3. V2 Price Resolution via RedevelopmentPriceService
 * 4. Evidence / Mapping Readiness Verification
 * 5. Phase 8C-1 Value Analysis Engine Execution
 * 6. Traceable Analysis Result with Price & Evidence Provenance
 */

import fs from 'fs';
import path from 'path';
import { AREA_FAMILIES_REGISTRY } from '../data/areaFamilies';
import { TARGET_COMPLEXES } from '../data/complexesData';
import {
  HISTORICAL_COMPLEXES,
  REDEVELOPMENT_LINEAGES_REGISTRY,
  getRedevelopmentLineage,
  getRedevelopmentProject,
} from '../data/redevelopmentLineages';
import { firestoreRepository } from '../server/firestoreRepository';
import type {
  NormalizedProjectSeed,
  NormalizedMappingSeed,
  NormalizedFinancialSeed,
  NormalizedConstructionCostSeed,
  NormalizedLandShareSeed,
  NormalizedAnalysisSeed,
} from '../types/redevelopmentNormalizedSeed';
import type {
  RedevelopmentAnalysisRequest,
  ComprehensiveRedevelopmentAnalysisResult,
  PriceProvenance,
  AnalysisObservationPoint,
  OwnerNominalValueAnalysisResult,
  OwnerCostAdjustedValueAnalysisResult,
  OwnerXirrAnalysisResult,
  LandShareAnalysisResult,
  TargetLandShareResult,
  ProjectCostAnalysisResult,
  ProvenanceMetadata,
} from '../types/redevelopmentAnalysis';
import type {
  RedevelopmentLineageListItem,
  RedevelopmentLineagesResponse,
  RedevelopmentLineageDetailResponse,
  RedevelopmentTargetsResponse,
  RedevelopmentTargetInfo,
  RedevelopmentPriceAvailabilityResponse,
  CompactMonthRange,
  RedevelopmentLandShareResponse,
  LandShareTierPublic,
  LandSharePredecessorRatioPublic,
  RedevelopmentConstructionCostsResponse,
  ConstructionCostEventPublic,
  RedevelopmentAnalysisApiRequest,
  RedevelopmentAnalysisApiResponse,
  PriceObservationPublic,
  PriceSourceProvenancePublic,
  EvidenceSourceProvenancePublic,
} from '../types/redevelopmentApi';
import {
  RedevelopmentSeedBundle,
  checkNominalValueReadiness,
  checkCostAdjustedReadiness,
  checkXirrReadiness,
  checkLandShareReadiness,
  checkConstructionCostReadiness,
  evaluateLineageReadiness,
} from './redevelopmentReadinessService';
import { redevelopmentPriceService, calculateMonthDifference, normalizeYmdMonth } from './redevelopmentPriceService';
import { redevelopmentAnalysisService } from './redevelopmentAnalysisService';
import { calculateLandShareRatio } from '../utils/redevelopmentCalculations';
import { Comparison59Engine, type Comparison59Input } from './comparison59Engine';
import type {
  Standardized59ComparisonModel,
  RedevelopmentSettlementData,
  RedevelopmentReferenceData,
  InvestmentCostStructure59,
} from '../types/redevelopmentComparison59';

function computeCompactMonthRanges(sortedMonths: string[]): CompactMonthRange[] {
  if (sortedMonths.length === 0) return [];
  const ranges: CompactMonthRange[] = [];
  let currentStart = sortedMonths[0];
  let currentEnd = sortedMonths[0];
  let count = 1;

  for (let i = 1; i < sortedMonths.length; i++) {
    const prev = sortedMonths[i - 1];
    const curr = sortedMonths[i];
    if (calculateMonthDifference(prev, curr) === 1) {
      currentEnd = curr;
      count++;
    } else {
      ranges.push({ startYmd: currentStart, endYmd: currentEnd, count });
      currentStart = curr;
      currentEnd = curr;
      count = 1;
    }
  }
  ranges.push({ startYmd: currentStart, endYmd: currentEnd, count });
  return ranges;
}

export class RedevelopmentDataService {
  private seedCache: Map<string, RedevelopmentSeedBundle> = new Map();
  private sourceManifestCache: Map<string, Map<string, { title: string; sourceType: string; publisher?: string; confidence?: string; productionEligibility?: string; sourceTier?: string }>> = new Map();
  private analysisApiCache: Map<string, RedevelopmentAnalysisApiResponse> = new Map();

  /**
   * Registers an in-memory seed bundle for custom lineages or tests.
   */
  public registerSeedBundle(lineageId: string, bundle: RedevelopmentSeedBundle): void {
    this.seedCache.set(lineageId, bundle);
  }

  private createEmptyMappingSeed(lineageId: string): NormalizedMappingSeed {
    return {
      schemaVersion: 1,
      lineageId,
      projectId: '',
      generatedAt: new Date().toISOString(),
      summary: {
        predecessorFamilies: 0,
        verifiedActual: 0,
        verifiedOption: 0,
        partial: 0,
        unknown: 0,
        applicationExamples: 0,
        automatic: 0,
      },
      coverageRecords: [],
      applicationExamples: [],
    };
  }

  private createEmptyFinancialSeed(lineageId: string): NormalizedFinancialSeed {
    return {
      schemaVersion: 1,
      lineageId,
      projectId: '',
      generatedAt: new Date().toISOString(),
      proportionalRate: {
        evidenceId: 'EMPTY',
        valuePct: 0,
        unit: '%',
        asOfDate: '',
        eligibility: 'PENDING',
        calculationEligibility: 'INELIGIBLE',
        evidenceClass: 'REFERENCE',
        sourceId: 'NONE',
        notes: '공식 비례율 자료 미등록',
      },
      generalSalePrice: {
        evidenceId: 'EMPTY',
        pricePerPyeong: 0,
        unit: 'KRW',
        asOfDate: '',
        eligibility: 'PENDING',
        sourceId: 'NONE',
        notes: '',
      },
      memberSalePrice: {
        evidenceId: 'EMPTY',
        averagePricePerPyeong: 0,
        unit: 'KRW',
        asOfDate: '',
        eligibility: 'PENDING',
        sourceId: 'NONE',
        notes: '',
      },
      metricsBySemanticType: {} as any,
      applicationExampleProhibition: {
        rule: 'NO_APPLICATION_EXAMPLES',
        enforced: true,
      },
    };
  }

  private createEmptyCostSeed(lineageId: string): NormalizedConstructionCostSeed {
    return {
      schemaVersion: 1,
      lineageId,
      projectId: '',
      generatedAt: new Date().toISOString(),
      currentCostPhase: 'PLANNING',
      costEvents: [],
      rebAuditBreakdown: {
        targetAmountKrw: 0,
        reducedAmountKrw: 0,
        recognizedAmountKrw: 0,
        unverifiableAmountKrw: 0,
        notes: '',
      },
      isFinal: false,
      finalTotalCostKrw: null,
    };
  }

  private createEmptyLandSeed(lineageId: string): NormalizedLandShareSeed {
    return {
      schemaVersion: 1,
      lineageId,
      projectId: '',
      generatedAt: new Date().toISOString(),
      canonicalUnit: 'SQM',
      totalDistinctTiers: 0,
      tiers: [],
      inferenceProhibition: {
        rule: 'LAND_SHARE_TECHNICAL_ONLY',
        enforced: true,
      },
    };
  }

  private createEmptyAnalysisSeed(lineageId: string): NormalizedAnalysisSeed {
    return {
      schemaVersion: 1,
      lineageId,
      projectId: '',
      generatedAt: new Date().toISOString(),
      readinessSummary: {
        nominalAssetValue: 'NOT_READY',
        costAdjustedValue: 'NOT_READY',
        xirr: 'NOT_READY',
        landShare: 'NOT_READY',
        constructionCostTimeline: 'NOT_READY',
      },
      readinessDetails: [],
      productionEligibilityDistribution: {
        VERIFIED: 0,
        SUPPORTED: 0,
        RESEARCH_ONLY: 0,
        PENDING: 0,
        total: 0,
      },
    };
  }

  private synthesizeBundleFromRegistry(lineage: any, project?: any): RedevelopmentSeedBundle {
    const lineageId = lineage.lineageId || lineage.id!;
    const projectSeed: NormalizedProjectSeed = {
      schemaVersion: 1,
      projectId: project?.projectId || lineage.projectId || lineageId,
      lineageId,
      name: lineage.lineageName || lineage.name || project?.projectName || lineageId,
      currentStatus: project?.status || 'COMPLETED',
      predecessor: {
        totalUnits: project?.units?.before || 0,
        complexes: [],
      },
      successor: {
        name: lineage.successorComplexIds?.[0] || '신축 단지',
        totalUnits: project?.units?.after || 0,
        buildingCount: 0,
        maxFloors: 0,
        unitsBreakdown: {
          rental: 0,
          memberSaleEstimated: 0,
          generalSale: 0,
          reserve: 0,
        },
        areaFamilies: [],
      },
      milestones: [],
      generatedAt: new Date().toISOString(),
    };

    return {
      projectSeed,
      mappingSeed: this.createEmptyMappingSeed(lineageId),
      financialSeed: this.createEmptyFinancialSeed(lineageId),
      costSeed: this.createEmptyCostSeed(lineageId),
      landSeed: this.createEmptyLandSeed(lineageId),
      analysisSeed: this.createEmptyAnalysisSeed(lineageId),
    };
  }

  private loadSourceManifestMap(lineageId: string = 'dunchon_redevelopment'): Map<
    string,
    {
      title: string;
      sourceType: string;
      publisher?: string;
      confidence?: string;
      productionEligibility?: string;
      sourceTier?: string;
    }
  > {
    const canonicalId = lineageId === 'lineage_dunchon_olympic' ? 'dunchon_redevelopment' : lineageId;
    if (this.sourceManifestCache.has(canonicalId)) {
      return this.sourceManifestCache.get(canonicalId)!;
    }

    const map = new Map<
      string,
      {
        title: string;
        sourceType: string;
        publisher?: string;
        confidence?: string;
        productionEligibility?: string;
        sourceTier?: string;
      }
    >();

    try {
      const dataDir = path.join(process.cwd(), 'data', 'redevelopment');
      let manifestPath = path.join(dataDir, `${canonicalId}_source_manifest_v1.json`);
      if (!fs.existsSync(manifestPath) && canonicalId === 'dunchon_redevelopment') {
        manifestPath = path.join(dataDir, 'dunchon_source_manifest_v1.json');
      }

      if (fs.existsSync(manifestPath)) {
        const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        if (Array.isArray(parsed.sources)) {
          for (const s of parsed.sources) {
            map.set(s.sourceId, {
              title: s.title || s.documentNumber || s.sourceId,
              sourceType: s.sourceType,
              publisher: s.publisher || s.sourceOrganization,
              confidence: s.confidence || (s.sourceTier?.includes('TIER_1') ? 'VERIFIED' : 'HIGH'),
              productionEligibility:
                s.productionEligibility || (s.sourceTier?.includes('TIER_1') ? 'VERIFIED' : 'RESEARCH_ONLY'),
              sourceTier: s.sourceTier,
            });
          }
        }
      }
    } catch {
      // Non-blocking fallback
    }

    this.sourceManifestCache.set(canonicalId, map);
    return map;
  }

  /**
   * Loads normalized redevelopment seeds from data/redevelopment.
   */
  public loadSeedBundle(lineageId: string = 'dunchon_redevelopment'): RedevelopmentSeedBundle {
    const lineage = getRedevelopmentLineage(lineageId);
    if (!lineage) {
      const err: any = new Error(`등록되지 않았거나 유효하지 않은 정비사업 Lineage ID입니다: "${lineageId}"`);
      err.code = 'INVALID_LINEAGE';
      throw err;
    }

    const canonicalLineageId = lineage.lineageId || lineage.id || lineageId;

    if (this.seedCache.has(canonicalLineageId)) {
      return this.seedCache.get(canonicalLineageId)!;
    }

    const baseDir = process.cwd();
    const dataDir = path.join(baseDir, 'data', 'redevelopment');

    // 1. Dunchon Jugong canonical seed bundle
    if (canonicalLineageId === 'dunchon_redevelopment' || canonicalLineageId === 'lineage_dunchon_olympic') {
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

      const bundle: RedevelopmentSeedBundle = {
        projectSeed,
        mappingSeed,
        financialSeed,
        costSeed,
        landSeed,
        analysisSeed,
      };

      this.seedCache.set(canonicalLineageId, bundle);
      return bundle;
    }

    // 2. Generic lineage seed files on disk
    const prefix = canonicalLineageId.replace(/^lineage_/, '').replace(/_redevelopment$/, '');
    const customProjectSeedPath = path.join(dataDir, `${prefix}_project_seed_v1.json`);
    if (fs.existsSync(customProjectSeedPath)) {
      const projectSeed: NormalizedProjectSeed = JSON.parse(fs.readFileSync(customProjectSeedPath, 'utf-8'));
      const mappingSeed: NormalizedMappingSeed = fs.existsSync(path.join(dataDir, `${prefix}_mapping_seed_v1.json`))
        ? JSON.parse(fs.readFileSync(path.join(dataDir, `${prefix}_mapping_seed_v1.json`), 'utf-8'))
        : this.createEmptyMappingSeed(canonicalLineageId);
      const financialSeed: NormalizedFinancialSeed = fs.existsSync(path.join(dataDir, `${prefix}_financial_seed_v1.json`))
        ? JSON.parse(fs.readFileSync(path.join(dataDir, `${prefix}_financial_seed_v1.json`), 'utf-8'))
        : this.createEmptyFinancialSeed(canonicalLineageId);
      const costSeed: NormalizedConstructionCostSeed = fs.existsSync(path.join(dataDir, `${prefix}_construction_cost_seed_v1.json`))
        ? JSON.parse(fs.readFileSync(path.join(dataDir, `${prefix}_construction_cost_seed_v1.json`), 'utf-8'))
        : this.createEmptyCostSeed(canonicalLineageId);
      const landSeed: NormalizedLandShareSeed = fs.existsSync(path.join(dataDir, `${prefix}_land_share_seed_v1.json`))
        ? JSON.parse(fs.readFileSync(path.join(dataDir, `${prefix}_land_share_seed_v1.json`), 'utf-8'))
        : this.createEmptyLandSeed(canonicalLineageId);
      const analysisSeed: NormalizedAnalysisSeed = fs.existsSync(path.join(dataDir, `${prefix}_analysis_seed_v1.json`))
        ? JSON.parse(fs.readFileSync(path.join(dataDir, `${prefix}_analysis_seed_v1.json`), 'utf-8'))
        : this.createEmptyAnalysisSeed(canonicalLineageId);

      const bundle: RedevelopmentSeedBundle = {
        projectSeed,
        mappingSeed,
        financialSeed,
        costSeed,
        landSeed,
        analysisSeed,
      };

      this.seedCache.set(canonicalLineageId, bundle);
      return bundle;
    }

    // 3. Fallback: Synthesize bundle from registry metadata
    const project = getRedevelopmentProject(lineage.projectId || canonicalLineageId);
    const bundle = this.synthesizeBundleFromRegistry(lineage, project);
    this.seedCache.set(canonicalLineageId, bundle);
    return bundle;
  }

  /**
   * Orchestrates the complete redevelopment analysis request.
   */
  public async analyzeRedevelopment(
    request: RedevelopmentAnalysisRequest
  ): Promise<ComprehensiveRedevelopmentAnalysisResult> {
    const bundle = this.loadSeedBundle(request.lineageId);
    const policy = request.evidencePolicy || 'VERIFIED_ONLY';
    const selectionPolicy = request.priceSelectionPolicy || 'EXACT_MONTH';
    const priceMetric = request.priceMetric || 'MEDIAN_PRICE';

    const warnings: string[] = [];
    const missingRequirements: string[] = [];

    // 1. Target Validation
    const predComplex = request.predecessorTarget.complexId;
    const predFamily = request.predecessorTarget.areaFamilyId;
    const succComplex = request.successorTarget.complexId;
    const succFamily = request.successorTarget.areaFamilyId;

    const predList = AREA_FAMILIES_REGISTRY[predComplex];
    const succList = AREA_FAMILIES_REGISTRY[succComplex];

    if (!predList || !predList.some((f) => f.id === predFamily)) {
      missingRequirements.push(`유효하지 않은 종전자산 대상: ${predComplex} / ${predFamily}`);
    }
    if (!succList || !succList.some((f) => f.id === succFamily)) {
      missingRequirements.push(`유효하지 않은 신축자산 대상: ${succComplex} / ${succFamily}`);
    }

    // 2. Resolve V2 Prices
    const predPriceRes = await redevelopmentPriceService.resolvePrice({
      complexId: predComplex,
      areaFamilyId: predFamily,
      requestedMonth: request.predecessorMonth,
      selectionPolicy,
      priceMetric,
    });

    const succPriceRes = await redevelopmentPriceService.resolvePrice({
      complexId: succComplex,
      areaFamilyId: succFamily,
      requestedMonth: request.successorMonth,
      selectionPolicy,
      priceMetric,
    });

    if (predPriceRes.warnings.length > 0) warnings.push(...predPriceRes.warnings);
    if (succPriceRes.warnings.length > 0) warnings.push(...succPriceRes.warnings);

    const predObs = predPriceRes.observation;
    const succObs = succPriceRes.observation;

    // Build AnalysisObservationPoints for the 8C-1 engine
    const predPoint: AnalysisObservationPoint | null = predObs && predObs.value !== null
      ? {
          date: predObs.actualObservationMonth || predObs.requestedMonth,
          price: predObs.value,
          unit: 'KRW_MANWON',
          tradeCount: predObs.tradeCount,
          complexId: predObs.complexId,
          areaFamilyId: predObs.areaFamilyId,
          selectionPolicyUsed: predObs.selectionPolicy,
          documentId: predObs.documentId,
          sourceCollection: 'monthlyComplexPrices_v2',
        }
      : null;

    const succPoint: AnalysisObservationPoint | null = succObs && succObs.value !== null
      ? {
          date: succObs.actualObservationMonth || succObs.requestedMonth,
          price: succObs.value,
          unit: 'KRW_MANWON',
          tradeCount: succObs.tradeCount,
          complexId: succObs.complexId,
          areaFamilyId: succObs.areaFamilyId,
          selectionPolicyUsed: succObs.selectionPolicy,
          documentId: succObs.documentId,
          sourceCollection: 'monthlyComplexPrices_v2',
        }
      : null;

    // 3. Execution of Market Price Comparison
    let nominalValueResult: OwnerNominalValueAnalysisResult;
    const isHistorical = request.analysisMode === 'VERIFIED_HISTORICAL';
    const analysisMode = isHistorical ? 'VERIFIED_HISTORICAL' : 'USER_SCENARIO';
    const metricType = isHistorical ? 'NOMINAL_ASSET_VALUE_CHANGE' : 'SCENARIO_NOMINAL_VALUE_CHANGE';
    const displayLabel = isHistorical ? '명목 자산가치 변화' : '시나리오 명목 자산가치 변화';

    // We compute market comparison for user-selected predecessor & successor targets directly
    if (!predPoint) {
      nominalValueResult = {
        metricType,
        availability: predPriceRes.availability,
        readiness: 'NOT_READY',
        value: null,
        unit: 'KRW_MANWON',
        displayLabel,
        analysisMode,
        inputs: {
          predecessorFamilyId: predFamily,
          successorFamilyId: succFamily,
          predecessorPriceAvailable: false,
          successorPriceAvailable: succPoint !== null,
        },
        provenance: {
          sourceIds: [],
          evidenceIds: [],
          inputRecordIds: [],
          productionEligibility: ['NOT_APPLICABLE'],
          evaluatedAt: new Date().toISOString(),
        },
        assumptions: isHistorical ? [] : ['사용자 선택 시나리오 분석'],
        warnings: isHistorical ? [...predPriceRes.warnings] : ['SCENARIO_NOT_VERIFIED_HISTORICAL_MAPPING', ...predPriceRes.warnings],
        missingRequirements: ['종전자산 가격 관측값 부재 (MISSING_PREDECESSOR_VALUE)'],
        predecessorObservation: null,
        successorObservation: succPoint,
        historicalMappingVerified: false,
      };
    } else if (!succPoint) {
      nominalValueResult = {
        metricType,
        availability: succPriceRes.availability,
        readiness: 'NOT_READY',
        value: null,
        unit: 'KRW_MANWON',
        displayLabel,
        analysisMode,
        inputs: {
          predecessorFamilyId: predFamily,
          successorFamilyId: succFamily,
          predecessorPriceAvailable: true,
          successorPriceAvailable: false,
        },
        provenance: {
          sourceIds: [],
          evidenceIds: [],
          inputRecordIds: [],
          productionEligibility: ['NOT_APPLICABLE'],
          evaluatedAt: new Date().toISOString(),
        },
        assumptions: isHistorical ? [] : ['사용자 선택 시나리오 분석'],
        warnings: isHistorical ? [...succPriceRes.warnings] : ['SCENARIO_NOT_VERIFIED_HISTORICAL_MAPPING', ...succPriceRes.warnings],
        missingRequirements: ['신축자산 가격 관측값 부재 (MISSING_SUCCESSOR_VALUE)'],
        predecessorObservation: predPoint,
        successorObservation: null,
        historicalMappingVerified: false,
      };
    } else {
      nominalValueResult = redevelopmentAnalysisService.analyzeNominalValueChange(
        bundle,
        analysisMode,
        {
          predecessorFamilyId: predFamily,
          successorFamilyId: succFamily,
          predecessorPricePoint: predPoint,
          successorPricePoint: succPoint,
          evidencePolicy: policy,
        }
      );
      // Guarantee SCENARIO_NOT_VERIFIED_HISTORICAL_MAPPING warning exists
      if (!isHistorical && !nominalValueResult.warnings.includes('SCENARIO_NOT_VERIFIED_HISTORICAL_MAPPING')) {
        nominalValueResult.warnings.push('SCENARIO_NOT_VERIFIED_HISTORICAL_MAPPING');
      }
    }

    // 4. Cost-Adjusted Analysis (Evaluated via engine; remains PARTIAL/INSUFFICIENT_EVIDENCE as verified owner costs are missing)
    const costAdjustedResult: OwnerCostAdjustedValueAnalysisResult =
      redevelopmentAnalysisService.analyzeCostAdjustedValue(
        bundle,
        {
          basisType: 'MARKET_VALUE',
          predecessorBasisAmount: predPoint ? predPoint.price : null,
          ownerCashFlows: [],
          successorMarketValue: succPoint ? succPoint.price : null,
          evidencePolicy: policy,
        }
      );

    // 5. XIRR Analysis (Remains NOT_READY/MISSING_CASH_FLOW_DATES)
    const xirrResult: OwnerXirrAnalysisResult =
      redevelopmentAnalysisService.analyzeOwnerXirr(
        bundle,
        {
          cashFlows: [],
          evidencePolicy: policy,
        }
      );

    // 6. Land Share Integration (Predecessor Target lookup without successor mapping inference)
    let landShareResult: TargetLandShareResult | null = null;
    try {
      const regList = AREA_FAMILIES_REGISTRY[predComplex] || [];
      const regFamily = regList.find((f) => f.id === predFamily);
      const complexNumMatch = predComplex.match(/\d+$/);
      const complexNum = complexNumMatch ? parseInt(complexNumMatch[0], 10) : 1;

      const tiers = bundle.landSeed.tiers || [];
      const matchedTier = tiers.find((t) => {
        if (t.complexNumber !== complexNum) return false;
        if (regFamily) {
          const pStr = regFamily.legacyPyeongLabel || regFamily.label || '';
          const match = pStr.match(/\d+(\.\d+)?/);
          const num = match ? match[0] : '';
          return num ? t.pyeongName.includes(num) : false;
        }
        return false;
      }) || tiers.find((t) => t.complexNumber === complexNum);

      if (matchedTier && regFamily) {
        const exclusiveArea = regFamily.representativeExclusiveArea;
        const landShare = matchedTier.canonicalValueSqm;
        const ratio = calculateLandShareRatio(landShare, exclusiveArea);

        landShareResult = {
          metricType: 'LAND_SHARE_RATIO',
          availability: 'AVAILABLE',
          readiness: 'READY',
          value: ratio,
          unit: 'PERCENT',
          displayLabel: '대지지분 비율',
          analysisMode: request.analysisMode,
          inputs: {
            predecessorFamilyId: predFamily,
            exclusiveAreaSqm: exclusiveArea,
            landShareSqm: landShare,
          },
          provenance: {
            sourceIds: [matchedTier.sourceId || bundle.landSeed.sourceId],
            evidenceIds: [matchedTier.evidenceId || bundle.landSeed.evidenceId],
            inputRecordIds: [matchedTier.tierId],
            productionEligibility: [matchedTier.eligibility || bundle.landSeed.eligibility],
            evaluatedAt: new Date().toISOString(),
          },
          assumptions: [],
          warnings: [],
          missingRequirements: [],
          exclusiveAreaSqm: exclusiveArea,
          landShareSqm: landShare,
          ratioPercent: ratio !== null ? Number((ratio * 100).toFixed(2)) : undefined,
        };
      }
    } catch (e: any) {
      warnings.push(`Land share evaluation: ${e?.message || e}`);
    }

    // 7. Construction Cost Timeline Integration (Project-level timeline without generating owner contribution)
    const constructionCostResult: ProjectCostAnalysisResult =
      redevelopmentAnalysisService.analyzeConstructionCostTimeline(bundle, { evidencePolicy: policy });

    // 8. Dates & Boundary Isolation (Predecessor & Successor months kept separated, no merged series)
    const startObsMonth = predObs ? predObs.actualObservationMonth : null;
    const endObsMonth = succObs ? succObs.actualObservationMonth : null;
    const elapsedMonths = startObsMonth && endObsMonth
      ? calculateMonthDifference(startObsMonth, endObsMonth)
      : null;
    const elapsedYears = elapsedMonths !== null ? Number((elapsedMonths / 12).toFixed(2)) : null;

    // 9. Provenance Compilation
    const priceProvenance: {
      predecessor?: PriceProvenance | null;
      successor?: PriceProvenance | null;
    } = {
      predecessor: predObs ? redevelopmentPriceService.buildPriceProvenance(predObs) : null,
      successor: succObs ? redevelopmentPriceService.buildPriceProvenance(succObs) : null,
    };

    const evidenceSourceIds = new Set<string>();
    const evidenceEvidenceIds = new Set<string>();
    const evidenceEligibility = new Set<any>();

    if (bundle.landSeed.sourceId) evidenceSourceIds.add(bundle.landSeed.sourceId);
    if (bundle.landSeed.evidenceId) evidenceEvidenceIds.add(bundle.landSeed.evidenceId);
    if (bundle.landSeed.eligibility) evidenceEligibility.add(bundle.landSeed.eligibility);

    if (bundle.mappingSeed.mappingPolicy?.evidenceId) {
      evidenceEvidenceIds.add(bundle.mappingSeed.mappingPolicy.evidenceId);
    }

    if (bundle.costSeed.costEvents) {
      for (const e of bundle.costSeed.costEvents) {
        if (e.sourceId) evidenceSourceIds.add(e.sourceId);
        if (e.evidenceId) evidenceEvidenceIds.add(e.evidenceId);
        if (e.eligibility) evidenceEligibility.add(e.eligibility);
      }
    }

    const evidenceProvenance: ProvenanceMetadata = {
      sourceIds: Array.from(evidenceSourceIds),
      evidenceIds: Array.from(evidenceEvidenceIds),
      inputRecordIds: [
        ...(predObs?.documentId ? [predObs.documentId] : []),
        ...(succObs?.documentId ? [succObs.documentId] : []),
      ],
      productionEligibility: Array.from(evidenceEligibility),
      evaluatedAt: new Date().toISOString(),
    };

    return {
      lineageId: request.lineageId,
      analysisMode: request.analysisMode,
      scenario: request.analysisMode !== 'VERIFIED_HISTORICAL',
      historicalMappingVerified: false, // Dunchon has 0 verified historical actual mappings
      predecessorTarget: request.predecessorTarget,
      successorTarget: request.successorTarget,
      predecessorPriceResolution: predPriceRes,
      successorPriceResolution: succPriceRes,
      startObservationMonth: startObsMonth,
      endObservationMonth: endObsMonth,
      elapsedMonths,
      elapsedYears,
      nominalValueResult,
      costAdjustedResult,
      xirrResult,
      landShareResult,
      constructionCostResult,
      priceProvenance,
      evidenceProvenance,
      warnings: Array.from(new Set([...warnings, ...nominalValueResult.warnings])),
      missingRequirements: Array.from(new Set([...missingRequirements, ...nominalValueResult.missingRequirements])),
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * GET /api/redevelopment/lineages
   */
  public getLineages(): RedevelopmentLineagesResponse {
    const lineages: RedevelopmentLineageListItem[] = [];

    for (const lineage of REDEVELOPMENT_LINEAGES_REGISTRY) {
      const canonicalLineageId = lineage.lineageId || lineage.id!;
      let bundle: RedevelopmentSeedBundle | null = null;
      try {
        bundle = this.loadSeedBundle(canonicalLineageId);
      } catch {
        // Fallback gracefully
      }

      const preds = lineage.predecessorComplexIds.map((cid) => {
        const hist = HISTORICAL_COMPLEXES.find((h) => h.id === cid);
        const comp = TARGET_COMPLEXES.find((t) => t.id === cid);
        return {
          complexId: cid,
          complexName: hist?.name || comp?.name || cid,
          isHistoricalOnly: Boolean(hist?.historicalOnly ?? true),
        };
      });

      const succs = lineage.successorComplexIds.length > 0
        ? lineage.successorComplexIds.map((cid) => {
            const comp = TARGET_COMPLEXES.find((t) => t.id === cid);
            const hist = HISTORICAL_COMPLEXES.find((h) => h.id === cid);
            return {
              complexId: cid,
              complexName: comp?.name || hist?.name || cid,
            };
          })
        : bundle?.projectSeed?.successor?.name
        ? [
            {
              complexId: bundle.projectSeed.projectId || canonicalLineageId,
              complexName: bundle.projectSeed.successor.name,
            },
          ]
        : [];

      const isDunchon = canonicalLineageId === 'dunchon_redevelopment' || canonicalLineageId === 'lineage_dunchon_olympic';
      const project = getRedevelopmentProject(lineage.projectId || lineage.id);

      lineages.push({
        lineageId: canonicalLineageId,
        displayName:
          isDunchon
            ? '둔촌주공 재건축 (올림픽파크포레온)'
            : bundle?.projectSeed.name || lineage.lineageName || lineage.name || canonicalLineageId,
        redevelopmentType: (bundle?.projectSeed.projectType || project?.projectType || lineage.projectType || 'RECONSTRUCTION') as any,
        redevelopmentTypeLabel: bundle?.projectSeed.redevelopmentTypeLabel || project?.redevelopmentTypeLabel || lineage.redevelopmentTypeLabel || '주택재건축정비사업',
        predecessors: preds,
        successors: succs,
        analysisCapabilities: [
          'NOMINAL_VALUE_CHANGE',
          'LAND_SHARE_RATIO',
          'CONSTRUCTION_COST_TIMELINE',
          'READINESS_AUDIT',
        ],
        sourceSummary: {
          verifiedActualMappingCount: bundle?.mappingSeed.summary.verifiedActual ?? 0,
          evidenceCount: bundle?.projectSeed.milestones?.length || lineage.sourceMetadata?.length || 8,
          sourcesCount: 6,
        },
      });
    }

    return {
      success: true,
      lineages,
    };
  }

  /**
   * GET /api/redevelopment/lineages/:lineageId
   */
  public getLineageDetail(lineageId: string): RedevelopmentLineageDetailResponse {
    const lineage = getRedevelopmentLineage(lineageId);
    if (!lineage) {
      const err: any = new Error(`등록되지 않았거나 유효하지 않은 정비사업 Lineage ID입니다: "${lineageId}"`);
      err.code = 'INVALID_LINEAGE';
      throw err;
    }

    const bundle = this.loadSeedBundle(lineageId);
    const readiness = evaluateLineageReadiness(bundle, 'VERIFIED_ONLY');
    const project = getRedevelopmentProject(lineage.projectId || lineageId);
    const milestoneDates = project?.milestoneDates || {};
    const canonicalLineageId = lineage.lineageId || lineage.id || lineageId;
    const isDunchon = canonicalLineageId === 'dunchon_redevelopment' || canonicalLineageId === 'lineage_dunchon_olympic';

    const predecessors = lineage.predecessorComplexIds.map((cid) => {
      const hist = HISTORICAL_COMPLEXES.find((h) => h.id === cid);
      const comp = TARGET_COMPLEXES.find((t) => t.id === cid);
      return {
        complexId: cid,
        complexName: hist?.name || comp?.name || cid,
        isHistoricalOnly: Boolean(hist?.historicalOnly ?? true),
      };
    });

    const successors = lineage.successorComplexIds.length > 0
      ? lineage.successorComplexIds.map((cid) => {
          const comp = TARGET_COMPLEXES.find((t) => t.id === cid);
          const hist = HISTORICAL_COMPLEXES.find((h) => h.id === cid);
          return {
            complexId: cid,
            complexName: comp?.name || hist?.name || cid,
          };
        })
      : bundle.projectSeed?.successor?.name
      ? [
          {
            complexId: bundle.projectSeed.projectId || canonicalLineageId,
            complexName: bundle.projectSeed.successor.name,
          },
        ]
      : [];

    return {
      success: true,
      lineage: {
        lineageId: canonicalLineageId,
        projectId: bundle.projectSeed.projectId || project?.projectId || '',
        displayName:
          isDunchon
            ? '둔촌주공 재건축 (올림픽파크포레온)'
            : bundle.projectSeed.name || lineage.lineageName || lineage.name || canonicalLineageId,
        description:
          isDunchon
            ? '강동구 둔촌동 둔촌주공아파트 1~4단지(5,930세대)를 올림픽파크포레온(12,032세대)으로 재건축한 국내 최대 규모 정비사업'
            : lineage.description || project?.projectName || '',
        redevelopmentType: (bundle.projectSeed.projectType || project?.projectType || lineage.projectType || 'RECONSTRUCTION') as any,
        redevelopmentTypeLabel: bundle.projectSeed.redevelopmentTypeLabel || project?.redevelopmentTypeLabel || lineage.redevelopmentTypeLabel || '주택재건축정비사업',
        status: project?.status || bundle.projectSeed.currentStatus || 'COMPLETED',
        milestones: {
          promotionCommitteeApprovalDate: milestoneDates.promotionCommitteeApprovalDate || null,
          districtDesignationDate: milestoneDates.districtDesignationDate || null,
          associationApprovalDate: milestoneDates.associationEstablishmentDate || project?.associationApprovalDate || null,
          projectApprovalDate: milestoneDates.projectApprovalDate || project?.projectApprovalDate || null,
          projectNoticeDate: milestoneDates.projectNoticeDate || project?.projectNoticeDate || null,
          projectNoticeNumber: milestoneDates.projectNoticeNumber || project?.projectNoticeNumber || null,
          complexPlanApprovalDate: milestoneDates.complexPlanApprovalDate || null,
          managementDispositionApprovalDate: milestoneDates.managementDispositionDate || project?.managementDispositionApprovalDate || null,
          managementDispositionNoticeDate: milestoneDates.managementDispositionNoticeDate || project?.managementDispositionNoticeDate || null,
          managementDispositionNoticeNumber: milestoneDates.managementDispositionNoticeNumber || project?.managementDispositionNoticeNumber || null,
          demolitionDate: milestoneDates.demolitionStartDate || project?.demolitionDate || null,
          constructionStartDate: milestoneDates.constructionStartDate || project?.constructionStartDate || null,
          generalSaleDate: milestoneDates.generalSaleDate || project?.generalSaleDate || null,
          completionDate: milestoneDates.completionDate || project?.completionDate || null,
          moveInDate: milestoneDates.moveInDate || null,
        },
        timeline: (bundle.projectSeed.milestones || [])
          .filter((m) => m.milestoneId !== 'ms_transfer_pending' && !m.milestoneId.includes('legacy_audit') && m.verificationStatus !== 'UNSUPPORTED')
          .map((m) => ({
            milestoneId: m.milestoneId,
            name: m.name,
            date: m.approvalDate || m.date,
            category: (m.category || (m.milestoneId.includes('former') ? 'BACKGROUND_HISTORY' : 'PROJECT_MILESTONE')) as 'PROJECT_MILESTONE' | 'BACKGROUND_HISTORY',
            approvalDate: m.approvalDate || null,
            noticeDate: m.noticeDate || null,
            noticeNumber: m.noticeNumber || null,
            filingDate: m.filingDate || null,
            occurrenceDate: m.occurrenceDate || null,
            sourceText: m.notes || m.sourceId,
            evidenceClass: (m.evidenceClass || (m.sourceTier?.includes('OFFICIAL') ? 'OFFICIAL' : 'REFERENCE')) as 'OFFICIAL' | 'REFERENCE',
            verificationStatus: (m.verificationStatus || (m.eligibility === 'VERIFIED' ? 'VERIFIED' : 'SUPPORTED')) as 'VERIFIED' | 'SUPPORTED' | 'PENDING' | 'UNSUPPORTED' | 'CONFLICTING',
            calculationEligibility: (m.calculationEligibility || (m.evidenceClass === 'OFFICIAL' && m.eligibility === 'VERIFIED' ? 'ELIGIBLE' : 'INELIGIBLE')) as 'ELIGIBLE' | 'INELIGIBLE',
            evidenceLevel: (m.eligibility || 'VERIFIED') as 'VERIFIED' | 'SUPPORTED' | 'PENDING',
            isConfirmed: m.isConfirmed ?? true,
            notes: m.notes,
          }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        units: {
          before: bundle.projectSeed.predecessor?.totalUnits != null ? bundle.projectSeed.predecessor.totalUnits : (project?.units?.before ?? null),
          after: bundle.projectSeed.successor?.totalUnits || project?.units?.after || 0,
        },
        predecessors,
        successors,
        mappingCoverage: {
          predecessorFamilies: bundle.mappingSeed.summary.predecessorFamilies,
          verifiedActual: bundle.mappingSeed.summary.verifiedActual,
          verifiedOption: bundle.mappingSeed.summary.verifiedOption,
          partial: bundle.mappingSeed.summary.partial,
          unknown: bundle.mappingSeed.summary.unknown,
          applicationExamples: bundle.mappingSeed.summary.applicationExamples,
          automatic: bundle.mappingSeed.summary.automatic,
        },
        readiness,
        evidenceSummary: {
          evidenceCount: bundle.projectSeed.milestones?.length || 8,
          primarySourcesCount: 6,
          proportionalRatePct: bundle.financialSeed.proportionalRate?.calculationEligibility === 'ELIGIBLE' ? bundle.financialSeed.proportionalRate.valuePct : null,
          proportionalRateEligibility: bundle.financialSeed.proportionalRate?.eligibility || 'PENDING',
          constructionCostEventsCount: bundle.costSeed.costEvents?.length || 0,
        },
      },
    };
  }

  /**
   * GET /api/redevelopment/lineages/:lineageId/targets
   */
  public async getTargets(lineageId: string): Promise<RedevelopmentTargetsResponse> {
    const lineage = getRedevelopmentLineage(lineageId);
    if (!lineage) {
      const err: any = new Error(`등록되지 않은 정비사업 Lineage ID입니다: "${lineageId}"`);
      err.code = 'INVALID_LINEAGE';
      throw err;
    }
    const bundle = this.loadSeedBundle(lineageId);

    const predecessorTargets: RedevelopmentTargetInfo[] = [];
    for (const cid of lineage.predecessorComplexIds) {
      const hist = HISTORICAL_COMPLEXES.find((h) => h.id === cid);
      const comp = TARGET_COMPLEXES.find((t) => t.id === cid);
      const cName = hist?.name || comp?.name || cid;

      const metaList = await firestoreRepository.getAreaFamilyMetadata(cid);
      for (const m of metaList) {
        predecessorTargets.push({
          complexId: cid,
          complexName: cName,
          areaFamilyId: m.areaFamilyId,
          areaFamilyLabel: m.label,
          exclusiveAreaRepresentative: m.representativeExclusiveArea,
          exclusiveAreaPyeong: m.exclusiveAreaPyeong,
          supplyAreaRepresentative: null, // 공식 공급면적 미확인 상태 유지
          legacyPyeongLabel: m.legacyPyeongLabel || null,
          hasPriceData: Boolean(m.hasMonthlyData && m.monthlyPointCount > 0),
          firstObservedMonth: m.firstDealYmd,
          lastObservedMonth: m.lastDealYmd,
          observedMonthCount: m.monthlyPointCount,
          historicalOnly: Boolean(hist?.historicalOnly ?? true),
          mappingKnowledgeStatus: 'UNKNOWN',
        });
      }
    }

    const successorTargets: RedevelopmentTargetInfo[] = [];
    for (const cid of lineage.successorComplexIds) {
      const comp = TARGET_COMPLEXES.find((t) => t.id === cid);
      const hist = HISTORICAL_COMPLEXES.find((h) => h.id === cid);
      const cName = comp?.name || hist?.name || cid;

      const metaList = await firestoreRepository.getAreaFamilyMetadata(cid);
      for (const m of metaList) {
        successorTargets.push({
          complexId: cid,
          complexName: cName,
          areaFamilyId: m.areaFamilyId,
          areaFamilyLabel: m.label,
          exclusiveAreaRepresentative: m.representativeExclusiveArea,
          exclusiveAreaPyeong: m.exclusiveAreaPyeong,
          supplyAreaRepresentative: null, // 공식 공급면적 미확인 상태 유지
          legacyPyeongLabel: m.legacyPyeongLabel || null,
          hasPriceData: Boolean(m.hasMonthlyData && m.monthlyPointCount > 0),
          firstObservedMonth: m.firstDealYmd,
          lastObservedMonth: m.lastDealYmd,
          observedMonthCount: m.monthlyPointCount,
          historicalOnly: false,
        });
      }
    }

    const researchExamples = (bundle.mappingSeed.applicationExamples || []).map((ex) => ({
      exampleId: ex.exampleId,
      evidenceId: ex.evidenceId,
      sourceAreaFamily: ex.sourceAreaFamily,
      predecessorAppraisedValueKrw: null, // 공식 개별평가액 미공개 -> 임의 계산 금지
      rightsValueKrw: null, // 권리가액 미공개 -> 임의 계산 금지
      targetSuccessorAreaFamily: ex.targetSuccessorAreaFamily,
      memberSalePriceKrw: null, // 주택형별 조합원분양가 공식 부재 -> 임의 계산 금지
      financialOutcomeType: ex.financialOutcomeType,
      amountKrw: ex.amountKrw,
      productionEligibility: 'RESEARCH_ONLY' as const,
      exampleType: 'APPLICATION_EXAMPLE' as const,
      notes: ex.notes,
      evidenceGrade: 'REFERENCE (RESEARCH_ONLY)',
    }));

    return {
      success: true,
      lineageId: lineage.lineageId || lineage.id || lineageId,
      predecessorTargets,
      successorTargets,
      researchExamples,
    };
  }

  /**
   * GET /api/redevelopment/price-availability?complexId=...&areaFamilyId=...
   */
  public async getPriceAvailability(
    complexId: string,
    areaFamilyId: string
  ): Promise<RedevelopmentPriceAvailabilityResponse> {
    if (!complexId) {
      const err: any = new Error('단지 식별자(complexId)가 지정되지 않았습니다.');
      err.code = 'INVALID_COMPLEX';
      throw err;
    }
    if (!areaFamilyId) {
      const err: any = new Error('평형군 식별자(areaFamilyId)가 지정되지 않았습니다.');
      err.code = 'INVALID_AREA_FAMILY';
      throw err;
    }

    const regFamilies = AREA_FAMILIES_REGISTRY[complexId];
    if (!regFamilies || regFamilies.length === 0) {
      const err: any = new Error(`등록되지 않았거나 지원되지 않는 단지 식별자입니다: "${complexId}"`);
      err.code = 'INVALID_COMPLEX';
      throw err;
    }

    const regTarget = regFamilies.find((f) => f.id === areaFamilyId);
    if (!regTarget) {
      const err: any = new Error(`단지(${complexId})에 등록되지 않은 평형군 식별자입니다: "${areaFamilyId}"`);
      err.code = 'INVALID_AREA_FAMILY';
      throw err;
    }

    let complexName = complexId;
    const hist = HISTORICAL_COMPLEXES.find((c) => c.id === complexId);
    if (hist) {
      complexName = hist.name;
    } else {
      const target = TARGET_COMPLEXES.find((c) => c.id === complexId);
      if (target) complexName = target.name;
    }

    let points: any[] = [];
    let metadata: any = null;
    try {
      const res = await firestoreRepository.getAreaFamilyMonthlyPrices(complexId, areaFamilyId);
      points = res.points || [];
      metadata = res.metadata || null;
    } catch {
      // Return empty points safely if unobserved
      points = [];
    }

    const observedMonths = points.map((p) => p.dealYmd).sort();
    const compactRanges = computeCompactMonthRanges(observedMonths);

    return {
      success: true,
      complexId,
      complexName,
      areaFamilyId,
      areaFamilyLabel: metadata?.label || regTarget.label,
      hasPriceData: observedMonths.length > 0,
      firstObservedMonth: observedMonths.length > 0 ? observedMonths[0] : null,
      lastObservedMonth: observedMonths.length > 0 ? observedMonths[observedMonths.length - 1] : null,
      observedMonthCount: observedMonths.length,
      observedMonths,
      compactRanges,
    };
  }

  /**
   * GET /api/redevelopment/lineages/:lineageId/land-share
   */
  public getLandShare(lineageId: string): RedevelopmentLandShareResponse {
    const lineage = getRedevelopmentLineage(lineageId);
    if (!lineage) {
      const err: any = new Error(`등록되지 않았거나 유효하지 않은 정비사업 Lineage ID입니다: "${lineageId}"`);
      err.code = 'INVALID_LINEAGE';
      throw err;
    }

    const bundle = this.loadSeedBundle(lineageId);
    const tiers: LandShareTierPublic[] = (bundle.landSeed.tiers || []).map((t) => ({
      tierId: t.tierId,
      complexNumber: t.complexNumber,
      pyeongName: t.pyeongName,
      canonicalValueSqm: t.canonicalValueSqm,
      canonicalValuePyeong: t.sourceOriginalValue || Math.round((t.canonicalValueSqm / (400 / 121)) * 100) / 100,
      sourceId: t.sourceId,
      evidenceId: t.evidenceId || '',
      eligibility: t.eligibility,
    }));

    const predComplexes = lineage.predecessorComplexIds;
    const predecessorRatios: LandSharePredecessorRatioPublic[] = [];

    for (const complexId of predComplexes) {
      const regList = AREA_FAMILIES_REGISTRY[complexId] || [];
      const complexNumMatch = complexId.match(/\d+$/);
      const complexNum = complexNumMatch ? parseInt(complexNumMatch[0], 10) : 1;

      for (const regFamily of regList) {
        const matchedTier = bundle.landSeed.tiers.find((t) => {
          if (t.complexNumber !== complexNum) return false;
          const pStr = regFamily.legacyPyeongLabel || regFamily.label || '';
          const match = pStr.match(/\d+(\.\d+)?/);
          const num = match ? match[0] : '';
          return num ? t.pyeongName.includes(num) : false;
        }) || bundle.landSeed.tiers.find((t) => t.complexNumber === complexNum);

        if (matchedTier) {
          const exclusiveArea = regFamily.representativeExclusiveArea;
          const landShare = matchedTier.canonicalValueSqm;
          const ratioPercent = calculateLandShareRatio(landShare, exclusiveArea);

          predecessorRatios.push({
            complexId,
            areaFamilyId: regFamily.id,
            areaFamilyLabel: regFamily.label,
            exclusiveAreaSqm: exclusiveArea,
            matchedTierId: matchedTier.tierId,
            landShareSqm: landShare,
            landShareRatioPercent: ratioPercent,
          });
        }
      }
    }

    const canonicalLineageId = lineage.lineageId || lineage.id || lineageId;
    const isDunchon = canonicalLineageId === 'dunchon_redevelopment' || canonicalLineageId === 'lineage_dunchon_olympic';

    return {
      success: true,
      lineageId: canonicalLineageId,
      metadata: isDunchon
        ? {
            recordCount: 17,
            nominalCategoryCount: 15,
            uniqueLandShareValueCount: 12,
            uniqueAreaFamilyCount: 16,
            explanation:
              'The Phase 8B-3 normalized seed contains 17 tier records in the tiers array. Danji 1 has 5 nominal types (7.5, 16, 18, 22, 25), Danji 2 has 3 nominal types (16, 22, 25), Danji 3 has 3 nominal types (23, 31, 34), and Danji 4 has 4 nominal types (23, 25, 31, 34), summing to 15 complex-pyeong combinations. In Danji 4, 25평형 and 34평형 each have min and max building-specific land share sub-types (tier_d4_250_min, tier_d4_250_max, tier_d4_340_min, tier_d4_340_max), yielding 15 + 2 = 17 individual tier records. The distinct values across these 17 records resolve to 12 unique canonical square-meter values. The seed totalDistinctTiers of 15 accurately represents the 15 nominal categories while the tiers array contains 17 granular records.',
          }
        : {
            recordCount: tiers.length,
            nominalCategoryCount: bundle.landSeed.totalDistinctTiers || tiers.length,
            uniqueLandShareValueCount: new Set(tiers.map((t) => t.canonicalValueSqm)).size,
            uniqueAreaFamilyCount: predecessorRatios.length,
            explanation: (bundle.landSeed as any).notes || '사업시행계획 및 종전자산평가 대지지분 기준',
          },
      tiers,
      predecessorRatios,
      warnings: [
        '대지지분(대지권비율)은 자산의 물리적 토지 지분 비율을 나타내는 기술적 통계이며, 재건축 수익률, 신축 평형 배정 순위, 또는 권리가액을 단독으로 추론하거나 결정하지 않습니다.',
      ],
    };
  }

  /**
   * GET /api/redevelopment/lineages/:lineageId/construction-costs
   */
  public getConstructionCosts(lineageId: string): RedevelopmentConstructionCostsResponse {
    const lineage = getRedevelopmentLineage(lineageId);
    if (!lineage) {
      const err: any = new Error(`등록되지 않았거나 유효하지 않은 정비사업 Lineage ID입니다: "${lineageId}"`);
      err.code = 'INVALID_LINEAGE';
      throw err;
    }

    const bundle = this.loadSeedBundle(lineageId);
    const analysisRes = redevelopmentAnalysisService.analyzeConstructionCostTimeline(bundle);

    const statusMap: Record<string, string> = {
      INITIAL_CONTRACT: '최초 계약',
      AMENDMENT_CONTRACT: '변경 계약',
      REQUESTED_INCREASE: '증액 요구',
      ARBITRATION_VERIFICATION: '검증',
      SETTLEMENT_AGREEMENT: '합의',
      COMPLETION_SETTLEMENT: '최종',
      SIGNED_CONTRACT: '계약 체결',
      REQUESTED: '증액 요구',
      PROPOSED: '제안',
      VERIFIED: '검증',
      AGREED: '합의',
      FINAL: '최종',
    };

    const events: ConstructionCostEventPublic[] = (bundle.costSeed.costEvents || []).map((e) => ({
      eventId: e.eventId,
      eventDate: e.date,
      totalCostKrw: e.amountKrw,
      costPerPyeongKrw: undefined,
      status: e.status,
      publicStatusLabel: statusMap[e.status] || e.status,
      sourceId: e.sourceId,
      evidenceId: e.evidenceId,
      confidence: 'VERIFIED',
      eligibility: e.eligibility,
      description: e.notes || e.eventName,
    }));

    return {
      success: true,
      lineageId: lineage.lineageId || lineage.id || lineageId,
      currentPhase: bundle.costSeed.currentCostPhase || 'POST_COMPLETION_PRE_LIQUIDATION',
      isFinal: false,
      rebAuditSummary: bundle.costSeed.rebAuditBreakdown
        ? {
            targetAmountKrw: bundle.costSeed.rebAuditBreakdown.targetAmountKrw,
            reducedAmountKrw: bundle.costSeed.rebAuditBreakdown.reducedAmountKrw,
            recognizedAmountKrw: bundle.costSeed.rebAuditBreakdown.recognizedAmountKrw,
            unverifiableAmountKrw: bundle.costSeed.rebAuditBreakdown.unverifiableAmountKrw,
          }
        : undefined,
      events,
      comparisons: analysisRes.value || [],
      notes: [
        '공사비 증액 요구(REQUESTED_INCREASE)는 시공사업단의 일방 청구액이며 확정 계약금액(FINAL)이 아닙니다.',
        '프로젝트 총 공사비 변동은 조합원 분담금 산정에 직접 비례하지 않으며, 일반분양 수입 및 사업비 정산 결과에 따릅니다.',
      ],
    };
  }

  /**
   * POST /api/redevelopment/analysis (Public API Contract)
   */
  public async analyzeRedevelopmentPublic(
    req: RedevelopmentAnalysisApiRequest
  ): Promise<RedevelopmentAnalysisApiResponse> {
    // 1. Validate lineageId
    const lineageId = req.lineageId || 'dunchon_redevelopment';
    const lineage = getRedevelopmentLineage(lineageId);
    if (!lineage) {
      const err: any = new Error(`유효하지 않은 정비사업 Lineage ID입니다: "${lineageId}"`);
      err.code = 'INVALID_LINEAGE';
      throw err;
    }

    // 2. Validate predecessorTarget
    if (!req.predecessorTarget || typeof req.predecessorTarget !== 'object') {
      const err: any = new Error('구 단지 분석 대상(predecessorTarget)이 지정되지 않았습니다.');
      err.code = 'INVALID_COMPLEX';
      throw err;
    }
    const predComplex = req.predecessorTarget.complexId;
    const predFamily = req.predecessorTarget.areaFamilyId;

    if (!predComplex || !AREA_FAMILIES_REGISTRY[predComplex]) {
      const err: any = new Error(`등록되지 않은 구 단지 식별자입니다: "${predComplex}"`);
      err.code = 'INVALID_COMPLEX';
      throw err;
    }
    if (!lineage.predecessorComplexIds.includes(predComplex)) {
      const err: any = new Error(`해당 정비사업(${lineage.lineageName || lineageId})의 종전자산 단지가 아닙니다: "${predComplex}"`);
      err.code = 'INVALID_COMPLEX';
      throw err;
    }
    const predRegFamily = AREA_FAMILIES_REGISTRY[predComplex].find((f) => f.id === predFamily);
    if (!predFamily || !predRegFamily) {
      const err: any = new Error(`구 단지(${predComplex})에 유효하지 않은 평형군입니다: "${predFamily}"`);
      err.code = 'INVALID_AREA_FAMILY';
      throw err;
    }

    // 3. Validate successorTarget
    if (!req.successorTarget || typeof req.successorTarget !== 'object') {
      const err: any = new Error('신축 단지 분석 대상(successorTarget)이 지정되지 않았습니다.');
      err.code = 'INVALID_COMPLEX';
      throw err;
    }
    const succComplex = req.successorTarget.complexId;
    const succFamily = req.successorTarget.areaFamilyId;

    if (!succComplex || !AREA_FAMILIES_REGISTRY[succComplex]) {
      const err: any = new Error(`등록되지 않은 신축 단지 식별자입니다: "${succComplex}"`);
      err.code = 'INVALID_COMPLEX';
      throw err;
    }
    if (!lineage.successorComplexIds.includes(succComplex)) {
      const err: any = new Error(`해당 정비사업(${lineage.lineageName || lineageId})의 신축 단지가 아닙니다: "${succComplex}"`);
      err.code = 'INVALID_COMPLEX';
      throw err;
    }
    const succRegFamily = AREA_FAMILIES_REGISTRY[succComplex].find((f) => f.id === succFamily);
    if (!succFamily || !succRegFamily) {
      const err: any = new Error(`신축 단지(${succComplex})에 유효하지 않은 평형군입니다: "${succFamily}"`);
      err.code = 'INVALID_AREA_FAMILY';
      throw err;
    }

    // 4. Validate months
    const ymdRegex = /^\d{4}(0[1-9]|1[0-2])$/;
    const normPredMonth = normalizeYmdMonth(req.predecessorMonth);
    const normSuccMonth = normalizeYmdMonth(req.successorMonth);

    if (!normPredMonth || !ymdRegex.test(normPredMonth)) {
      const err: any = new Error(`유효하지 않은 구 단지 기준월입니다: "${req.predecessorMonth}" (YYYYMM 또는 YYYY-MM)`);
      err.code = 'INVALID_MONTH';
      throw err;
    }
    if (!normSuccMonth || !ymdRegex.test(normSuccMonth)) {
      const err: any = new Error(`유효하지 않은 신축 단지 기준월입니다: "${req.successorMonth}" (YYYYMM 또는 YYYY-MM)`);
      err.code = 'INVALID_MONTH';
      throw err;
    }

    // 5. Validate mode & policies
    const analysisMode = req.analysisMode || 'VERIFIED_HISTORICAL';
    if (analysisMode !== 'VERIFIED_HISTORICAL' && analysisMode !== 'USER_SCENARIO') {
      const err: any = new Error(`지원되지 않는 분석 모드입니다: "${req.analysisMode}". (VERIFIED_HISTORICAL 또는 USER_SCENARIO)`);
      err.code = 'INVALID_ANALYSIS_MODE';
      throw err;
    }

    const priceMetric = req.priceMetric || 'MEDIAN_PRICE';
    if (priceMetric !== 'MEDIAN_PRICE' && priceMetric !== 'AVERAGE_PRICE') {
      const err: any = new Error(`지원되지 않는 가격 지표입니다: "${req.priceMetric}". (MEDIAN_PRICE 또는 AVERAGE_PRICE)`);
      err.code = 'INVALID_PRICE_METRIC';
      throw err;
    }

    const priceSelectionPolicy = req.priceSelectionPolicy || req.selectionPolicy || 'EXACT_MONTH';
    if (
      priceSelectionPolicy !== 'EXACT_MONTH' &&
      priceSelectionPolicy !== 'LATEST_OBSERVED_ON_OR_BEFORE' &&
      priceSelectionPolicy !== 'EARLIEST_OBSERVED_ON_OR_AFTER'
    ) {
      const err: any = new Error(
        `지원되지 않는 가격 선택 정책입니다: "${priceSelectionPolicy}". (EXACT_MONTH, LATEST_OBSERVED_ON_OR_BEFORE, EARLIEST_OBSERVED_ON_OR_AFTER)`
      );
      err.code = 'INVALID_PRICE_SELECTION_POLICY';
      throw err;
    }

    const evidencePolicy = req.evidencePolicy || 'VERIFIED_ONLY';
    if (evidencePolicy !== 'VERIFIED_ONLY' && evidencePolicy !== 'ALLOW_SUPPORTED') {
      const err: any = new Error(`지원되지 않는 근거 검증 정책입니다: "${req.evidencePolicy}". (VERIFIED_ONLY 또는 ALLOW_SUPPORTED)`);
      err.code = 'INVALID_EVIDENCE_POLICY';
      throw err;
    }

    // 6. Check cache
    const cacheKey = `${lineageId}:${analysisMode}:${predComplex}:${predFamily}:${normPredMonth}:${succComplex}:${succFamily}:${normSuccMonth}:${priceMetric}:${priceSelectionPolicy}:${evidencePolicy}`;
    if (this.analysisApiCache.has(cacheKey)) {
      return this.analysisApiCache.get(cacheKey)!;
    }

    // 7. Invoke internal data service
    const domainReq: RedevelopmentAnalysisRequest = {
      lineageId,
      analysisMode,
      predecessorTarget: {
        complexId: predComplex,
        areaFamilyId: predFamily,
      },
      successorTarget: {
        complexId: succComplex,
        areaFamilyId: succFamily,
      },
      predecessorMonth: normPredMonth,
      successorMonth: normSuccMonth,
      priceMetric,
      priceSelectionPolicy,
      evidencePolicy,
    };

    const domainRes = await this.analyzeRedevelopment(domainReq);
    const sourceMap = this.loadSourceManifestMap(lineageId);

    // 8. Build public response
    const predObs = domainRes.predecessorPriceResolution.observation;
    const succObs = domainRes.successorPriceResolution.observation;

    const predecessorObservation: PriceObservationPublic | null = {
      complexId: predComplex,
      areaFamilyId: predFamily,
      requestedMonth: normPredMonth,
      actualObservationMonth: predObs ? predObs.actualObservationMonth : null,
      selectionPolicy: predObs ? predObs.selectionPolicy : priceSelectionPolicy,
      priceMetric: predObs ? predObs.priceMetric : priceMetric,
      value: predObs ? predObs.value : null,
      unit: predObs ? predObs.unit : 'KRW_MANWON',
      tradeCount: predObs ? predObs.tradeCount : 0,
    };

    const successorObservation: PriceObservationPublic | null = {
      complexId: succComplex,
      areaFamilyId: succFamily,
      requestedMonth: normSuccMonth,
      actualObservationMonth: succObs ? succObs.actualObservationMonth : null,
      selectionPolicy: succObs ? succObs.selectionPolicy : priceSelectionPolicy,
      priceMetric: succObs ? succObs.priceMetric : priceMetric,
      value: succObs ? succObs.value : null,
      unit: succObs ? succObs.unit : 'KRW_MANWON',
      tradeCount: succObs ? succObs.tradeCount : 0,
    };

    const priceSources: PriceSourceProvenancePublic[] = [];
    if (domainRes.priceProvenance.predecessor) {
      priceSources.push({
        collection: domainRes.priceProvenance.predecessor.sourceCollection,
        documentId: domainRes.priceProvenance.predecessor.documentId,
        dealYmd: domainRes.priceProvenance.predecessor.dealYmd,
        tradeCount: domainRes.priceProvenance.predecessor.tradeCount,
      });
    }
    if (domainRes.priceProvenance.successor) {
      priceSources.push({
        collection: domainRes.priceProvenance.successor.sourceCollection,
        documentId: domainRes.priceProvenance.successor.documentId,
        dealYmd: domainRes.priceProvenance.successor.dealYmd,
        tradeCount: domainRes.priceProvenance.successor.tradeCount,
      });
    }

    const evidenceSources: EvidenceSourceProvenancePublic[] = (domainRes.evidenceProvenance.sourceIds || []).map(
      (srcId) => {
        const info = sourceMap.get(srcId);
        return {
          sourceId: srcId,
          sourceType: (info?.sourceType as any) || 'STATUTORY_OFFICIAL',
          confidence: (info?.confidence as any) || 'VERIFIED',
          productionEligibility: (info?.productionEligibility as any) || 'VERIFIED',
          title: info?.title,
        };
      }
    );

    const extraWarnings: string[] = [];
    if (evidencePolicy === 'ALLOW_SUPPORTED') {
      extraWarnings.push('SUPPORTED_EVIDENCE_USED: 지원(SUPPORTED) 등급의 보조 근거가 계산 평가에 허용되었습니다.');
    }

    const allWarnings = Array.from(new Set([...domainRes.warnings, ...extraWarnings]));

    // Readiness calculation
    const nominalReadiness = domainRes.nominalValueResult.readiness;
    const costReadiness = domainRes.costAdjustedResult.readiness;
    const xirrReadiness = domainRes.xirrResult.readiness;
    const landShareReadiness = domainRes.landShareResult ? domainRes.landShareResult.readiness : 'NOT_READY';
    const constructionCostReadiness = domainRes.constructionCostResult
      ? domainRes.constructionCostResult.readiness
      : 'READY';

    let overallReadiness = nominalReadiness;
    if (analysisMode === 'VERIFIED_HISTORICAL' && nominalReadiness === 'NOT_READY') {
      overallReadiness = 'NOT_READY';
    }

    const canonicalLineageId = lineage.lineageId || lineage.id || lineageId;

    const apiResponse: RedevelopmentAnalysisApiResponse = {
      success: true,
      request: {
        lineageId: canonicalLineageId,
        analysisMode,
        predecessorTarget: {
          complexId: predComplex,
          areaFamilyId: predFamily,
        },
        successorTarget: {
          complexId: succComplex,
          areaFamilyId: succFamily,
        },
        predecessorMonth: normPredMonth,
        successorMonth: normSuccMonth,
        priceMetric,
        priceSelectionPolicy,
        evidencePolicy,
      },
      scenario: analysisMode === 'USER_SCENARIO',
      historicalMappingVerified: false,
      analysis: {
        ownerEconomics: {
          nominalValue: domainRes.nominalValueResult,
          costAdjustedValue: domainRes.costAdjustedResult,
          xirr: domainRes.xirrResult,
        },
        projectEconomics: {
          constructionCosts: domainRes.constructionCostResult,
        },
        landShare: domainRes.landShareResult,
      },
      predecessorObservation,
      successorObservation,
      readiness: {
        overall: overallReadiness,
        nominalValue: nominalReadiness,
        costAdjusted: costReadiness,
        xirr: xirrReadiness,
        landShare: landShareReadiness,
        constructionCost: constructionCostReadiness,
      },
      provenance: {
        priceSources,
        evidenceSources,
      },
      warnings: allWarnings,
      missingRequirements: domainRes.missingRequirements,
      evaluatedAt: new Date().toISOString(),
    };

    this.analysisApiCache.set(cacheKey, apiResponse);
    return apiResponse;
  }

  /**
   * Phase 8K / 8K-1: 전용 59㎡ 표준화 비교 - 둔촌주공 -> 올림픽파크포레온 실제 공식 데이터 연결
   * 원문 검증된 공식 증빙 및 monthlyComplexPrices_v2만 엄격히 사용하여 비교 모델 생성
   * 미확인 항목은 절대 0으로 대체하지 않고 null / DATA_NOT_AVAILABLE 유지
   */
  public async getComparison59RealDunchon(options?: {
    benchmarkMonth?: string;
  }): Promise<Standardized59ComparisonModel> {
    const succComplexId = 'gangdong_olympic_park';
    const succAreaFamilyId = 'olympic_park_59';

    // 1. Benchmark 실거래가 조회 (monthlyComplexPrices_v2)
    const priceRes = await firestoreRepository.getAreaFamilyMonthlyPrices(succComplexId, succAreaFamilyId);
    const points = priceRes.points || [];

    if (points.length === 0) {
      const err: any = new Error('올림픽파크포레온 59㎡에 대한 V2 월별 실거래 데이터가 존재하지 않습니다.');
      err.code = 'BENCHMARK_PRICE_NOT_AVAILABLE';
      throw err;
    }

    // 대상 월 선택: 옵션 지정 월 또는 최신 관측월
    let selectedPoint = points[points.length - 1];
    if (options?.benchmarkMonth) {
      const normMonth = options.benchmarkMonth.replace(/-/g, '');
      const found = points.find((p) => p.dealYmd === normMonth);
      if (found) {
        selectedPoint = found;
      }
    }

    const benchmarkPriceKrw = selectedPoint.medianPrice * 10000;
    const foreonFamilies = AREA_FAMILIES_REGISTRY[succComplexId] || [];
    const foreon59Meta = foreonFamilies.find((f) => f.id === succAreaFamilyId);
    const exclusiveAreaSqm = foreon59Meta?.representativeExclusiveArea || priceRes.metadata?.representativeExclusiveArea || 59.99;

    // 2. 실제 공식 확인 가능한 정비사업 정산 데이터
    // - 120.37% 비례율: 강동구 고시 제2017-68호 고시문 원문에 미명시되어 PENDING / INELIGIBLE로 복구 (공식 계산 미사용 -> null)
    // - 59㎡ 조합원분양가: 3.3㎡당 2,780만원 평당가 곱연산 금지, 공식 증빙 부재로 DATA_NOT_AVAILABLE (null)
    // - 59㎡ 법정 추가분담금: 관리처분계획 원문상 59㎡ 확정치 미확인으로 DATA_NOT_AVAILABLE (null)
    const settlement: RedevelopmentSettlementData = {
      appraisedPredecessorValueKrw: null, // 전수 개별 명부 공공 미공개
      proportionalRatePct: null,          // 고시 원문 미명시로 PENDING/INELIGIBLE 복구 (공식 수치로 사용 불가)
      rightsValueKrw: null,               // 전수 명부 미공개
      memberSalePrice59Krw: null,         // 특정 59㎡ 공식 조합원분양가 증빙 부재 (평당가 곱연산 생성 금지)
      officialContribution59Krw: null,    // 관리처분계획 원문상 59㎡ 확정 분담금 미확인
      evidenceTier: 'DATA_NOT_AVAILABLE',
    };

    // 3. 언론 보도 및 총회 책자 참고치 (REFERENCE / INELIGIBLE로 명확히 분리)
    const references: RedevelopmentReferenceData = {
      mediaEstimatedContributionRangeKrw: {
        min: 120000000,
        max: 128000000,
        source: '헤럴드경제 2022-12-12 보도(src_herald_contribution_cases)',
        status: 'REFERENCE',
        notes: '언론 보도 사례치로 법정 관리처분계획 원문 공식 확정 분담금이 아님 (OFFICIAL_FACT 불가, REFERENCE/INELIGIBLE)',
      },
      mediaRightsValueRangeKrw: {
        min: 447000000,
        max: 1047000000,
        source: '헤럴드경제 2022-12-12 보도(src_herald_contribution_cases)',
        status: 'REFERENCE',
        notes: '언론 보도에 언급된 권리가액 분포 범위 (공식 전수 명부 미확인, REFERENCE/INELIGIBLE)',
      },
      generalAssemblyProportionalRatePct: {
        valuePct: 120.37,
        source: '2017 관리처분총회 책자 / 2023 부동산원 검증 보고서',
        status: 'PENDING',
        notes: '강동구 고시 제2017-68호 요약문에 비례율 문구가 미기재되어 법정 고시 원문 검증 미완료 (PENDING / INELIGIBLE)',
      },
    };

    // 4. 투자 총원가 구성요소 (데이터 없는 비용은 절대 0원으로 표현하지 않고 null / DATA_NOT_AVAILABLE 유지)
    const investmentCost: InvestmentCostStructure59 = {
      purchasePriceKrw: {
        variant: 'SINGLE',
        slot: {
          value: null,
          tier: 'DATA_NOT_AVAILABLE',
          rationale: '실제 조합원의 종전 부동산 실매입가격 증빙 부재 (권리가액 대체 절대 금지)',
        },
      },
      additionalContributionKrw: {
        variant: 'SINGLE',
        slot: {
          value: null,
          tier: 'DATA_NOT_AVAILABLE',
          rationale: '공식 관리처분계획 원문상 59㎡ 특정 법정 확정 분담금 미확인 (언론 1.2~1.28억원은 REFERENCE로 별도 분리)',
        },
      },
      acquisitionTaxKrw: {
        variant: 'SINGLE',
        slot: {
          value: null,
          tier: 'DATA_NOT_AVAILABLE',
          rationale: '취득세 실지출 납부 증빙 부재',
        },
      },
      financingCostKrw: {
        variant: 'SINGLE',
        slot: {
          value: null,
          tier: 'DATA_NOT_AVAILABLE',
          rationale: '금융이자 실지출 증빙 부재',
        },
      },
      otherExpensesKrw: {
        variant: 'SINGLE',
        slot: {
          value: null,
          tier: 'DATA_NOT_AVAILABLE',
          rationale: '기타 사업비 실지출 증빙 부재',
        },
      },
    };

    const input: Comparison59Input = {
      isUserSimulation: false,
      targetProperty: {
        propertyType: 'RECONSTRUCTION',
        lineageId: 'dunchon_redevelopment',
        displayName: '둔촌주공 재건축 (전용 59㎡ 신축 배정)',
        exclusiveAreaSqm,
        supplyAreaSqm: null, // 공급면적 미확인 -> DATA_NOT_AVAILABLE 유지
        costValuationDate: '2017-05-04',
      },
      settlement,
      references,
      investmentCost,
      benchmark: {
        benchmarkComplexId: succComplexId,
        benchmarkComplexName: '올림픽파크포레온',
        areaFamilyId: succAreaFamilyId,
        exclusiveAreaSqm,
        supplyAreaSqm: null, // 공급면적 미확인 -> DATA_NOT_AVAILABLE 유지
        marketPriceKrw: benchmarkPriceKrw,
        priceMethod: 'MONTHLY_MEDIAN',
        valuationDate: selectedPoint.dealYmd,
        observationStart: `${selectedPoint.dealYmd}-01`,
        observationEnd: `${selectedPoint.dealYmd}-28`,
        transactionCount: selectedPoint.tradeCount,
        selectionMethod: 'POLICY_DEFAULT',
        selectionReason: `월별 실거래 중앙값 (monthlyComplexPrices_v2 컬렉션 ${selectedPoint.dealYmd} 거래 ${selectedPoint.tradeCount}건)`,
        tier: 'MARKET_DATA',
      },
    };

    return Comparison59Engine.calculate(input);
  }

  /**
   * Phase 8K-1: 사용자 시뮬레이션 전용 메서드 (USER_SCENARIO)
   * 실제 공식 데이터와 엄격히 분리하여 가상 시나리오를 계산
   */
  public async simulateUserScenario59Dunchon(options: {
    benchmarkMonth?: string;
    userPurchasePriceKrw: number;
    userAdditionalContributionKrw: number;
    userAcquisitionTaxKrw: number;
    userFinancingCostKrw?: number;
    userOtherExpensesKrw?: number;
  }): Promise<Standardized59ComparisonModel> {
    const succComplexId = 'gangdong_olympic_park';
    const succAreaFamilyId = 'olympic_park_59';

    const priceRes = await firestoreRepository.getAreaFamilyMonthlyPrices(succComplexId, succAreaFamilyId);
    const points = priceRes.points || [];
    if (points.length === 0) {
      throw new Error('올림픽파크포레온 59㎡ 실거래 데이터가 존재하지 않습니다.');
    }

    let selectedPoint = points[points.length - 1];
    if (options.benchmarkMonth) {
      const normMonth = options.benchmarkMonth.replace(/-/g, '');
      const found = points.find((p) => p.dealYmd === normMonth);
      if (found) selectedPoint = found;
    }

    const benchmarkPriceKrw = selectedPoint.medianPrice * 10000;
    const foreonFamilies = AREA_FAMILIES_REGISTRY[succComplexId] || [];
    const foreon59Meta = foreonFamilies.find((f) => f.id === succAreaFamilyId);
    const exclusiveAreaSqm = foreon59Meta?.representativeExclusiveArea || priceRes.metadata?.representativeExclusiveArea || 59.99;

    const input: Comparison59Input = {
      isUserSimulation: true,
      targetProperty: {
        propertyType: 'RECONSTRUCTION',
        lineageId: 'dunchon_redevelopment',
        displayName: '둔촌주공 재건축 (전용 59㎡ 신축 배정 - 사용자 시뮬레이션)',
        exclusiveAreaSqm,
        supplyAreaSqm: null,
        costValuationDate: '2017-05-04',
      },
      investmentCost: {
        purchasePriceKrw: {
          variant: 'SINGLE',
          slot: {
            value: options.userPurchasePriceKrw,
            tier: 'USER_SCENARIO',
            rationale: '사용자 직접 입력 가상 매입가격 시뮬레이션',
          },
        },
        additionalContributionKrw: {
          variant: 'SINGLE',
          slot: {
            value: options.userAdditionalContributionKrw,
            tier: 'USER_SCENARIO',
            rationale: '사용자 직접 입력 가상 추가분담금 시뮬레이션',
          },
        },
        acquisitionTaxKrw: {
          variant: 'SINGLE',
          slot: {
            value: options.userAcquisitionTaxKrw,
            tier: 'USER_SCENARIO',
            rationale: '사용자 직접 입력 가상 취득세 시뮬레이션',
          },
        },
        financingCostKrw: options.userFinancingCostKrw !== undefined ? {
          variant: 'SINGLE',
          slot: {
            value: options.userFinancingCostKrw,
            tier: 'USER_SCENARIO',
            rationale: '사용자 직접 입력 가상 금융비용 시뮬레이션',
          },
        } : undefined,
        otherExpensesKrw: options.userOtherExpensesKrw !== undefined ? {
          variant: 'SINGLE',
          slot: {
            value: options.userOtherExpensesKrw,
            tier: 'USER_SCENARIO',
            rationale: '사용자 직접 입력 가상 기타비용 시뮬레이션',
          },
        } : undefined,
      },
      benchmark: {
        benchmarkComplexId: succComplexId,
        benchmarkComplexName: '올림픽파크포레온',
        areaFamilyId: succAreaFamilyId,
        exclusiveAreaSqm,
        supplyAreaSqm: null,
        marketPriceKrw: benchmarkPriceKrw,
        priceMethod: 'MONTHLY_MEDIAN',
        valuationDate: selectedPoint.dealYmd,
        observationStart: `${selectedPoint.dealYmd}-01`,
        observationEnd: `${selectedPoint.dealYmd}-28`,
        transactionCount: selectedPoint.tradeCount,
        selectionMethod: 'POLICY_DEFAULT',
        selectionReason: `월별 실거래 중앙값 (${selectedPoint.dealYmd} 거래 ${selectedPoint.tradeCount}건)`,
        tier: 'MARKET_DATA',
      },
    };

    return Comparison59Engine.calculate(input);
  }
}

export const redevelopmentDataService = new RedevelopmentDataService();

