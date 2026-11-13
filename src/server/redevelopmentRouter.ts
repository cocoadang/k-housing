import { Router, Request, Response } from 'express';
import { redevelopmentDataService } from '../services/redevelopmentDataService';
import type { RedevelopmentAnalysisApiRequest } from '../types/redevelopmentApi';
import { Comparison59Engine, type Comparison59Input } from '../services/comparison59Engine';

export const redevelopmentRouter = Router();

/**
 * 1. GET /api/redevelopment/lineages
 * 정비사업 계보 목록 조회
 */
redevelopmentRouter.get('/lineages', (req: Request, res: Response) => {
  try {
    const result = redevelopmentDataService.getLineages();
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: err?.message || '정비사업 계보 목록을 조회하는 중 오류가 발생했습니다.',
      },
    });
  }
});

/**
 * 2. GET /api/redevelopment/lineages/:lineageId
 * 정비사업 계보 상세 및 준비도(Readiness) 조회
 */
redevelopmentRouter.get('/lineages/:lineageId', (req: Request, res: Response) => {
  const { lineageId } = req.params;
  try {
    const result = redevelopmentDataService.getLineageDetail(lineageId);
    return res.status(200).json(result);
  } catch (err: any) {
    if (err?.code === 'INVALID_LINEAGE') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_LINEAGE',
          message: err.message,
        },
      });
    }
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: err?.message || '정비사업 계보 상세 정보를 조회하는 중 오류가 발생했습니다.',
      },
    });
  }
});

/**
 * 3. GET /api/redevelopment/lineages/:lineageId/targets
 * 정비사업 구/신축 분석 대상 평형군 및 연구 사례 목록 조회
 */
redevelopmentRouter.get('/lineages/:lineageId/targets', async (req: Request, res: Response) => {
  const { lineageId } = req.params;
  try {
    const result = await redevelopmentDataService.getTargets(lineageId);
    return res.status(200).json(result);
  } catch (err: any) {
    if (err?.code === 'INVALID_LINEAGE') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_LINEAGE',
          message: err.message,
        },
      });
    }
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: err?.message || '정비사업 분석 대상을 조회하는 중 오류가 발생했습니다.',
      },
    });
  }
});

/**
 * 4. GET /api/redevelopment/price-availability
 * 특정 단지-평형군의 V2 실거래 가격 관측 가능 월 및 범위 조회
 */
redevelopmentRouter.get('/price-availability', async (req: Request, res: Response) => {
  const complexId = (req.query.complexId as string) || '';
  const areaFamilyId = (req.query.areaFamilyId as string) || '';

  try {
    const result = await redevelopmentDataService.getPriceAvailability(complexId, areaFamilyId);
    return res.status(200).json(result);
  } catch (err: any) {
    if (err?.code === 'INVALID_COMPLEX' || err?.code === 'INVALID_AREA_FAMILY') {
      return res.status(400).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      });
    }
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: err?.message || '가격 가용성 정보를 조회하는 중 오류가 발생했습니다.',
      },
    });
  }
});

/**
 * 5. GET /api/redevelopment/lineages/:lineageId/land-share
 * 정비사업 구 단지 대지지분(대지권비율) 조회
 */
redevelopmentRouter.get('/lineages/:lineageId/land-share', (req: Request, res: Response) => {
  const { lineageId } = req.params;
  try {
    const result = redevelopmentDataService.getLandShare(lineageId);
    return res.status(200).json(result);
  } catch (err: any) {
    if (err?.code === 'INVALID_LINEAGE') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_LINEAGE',
          message: err.message,
        },
      });
    }
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: err?.message || '대지지분 정보를 조회하는 중 오류가 발생했습니다.',
      },
    });
  }
});

/**
 * 6. GET /api/redevelopment/lineages/:lineageId/construction-costs
 * 정비사업 공사비 변동 타임라인 및 한국부동산원 검증 내역 조회
 */
redevelopmentRouter.get('/lineages/:lineageId/construction-costs', (req: Request, res: Response) => {
  const { lineageId } = req.params;
  try {
    const result = redevelopmentDataService.getConstructionCosts(lineageId);
    return res.status(200).json(result);
  } catch (err: any) {
    if (err?.code === 'INVALID_LINEAGE') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_LINEAGE',
          message: err.message,
        },
      });
    }
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: err?.message || '공사비 내역을 조회하는 중 오류가 발생했습니다.',
      },
    });
  }
});

/**
 * 7. POST /api/redevelopment/analysis
 * 재건축 가치분석 통합 실행
 */
redevelopmentRouter.post('/analysis', async (req: Request, res: Response) => {
  try {
    const apiReq: RedevelopmentAnalysisApiRequest = req.body;
    const result = await redevelopmentDataService.analyzeRedevelopmentPublic(apiReq);
    return res.status(200).json(result);
  } catch (err: any) {
    const badRequestCodes = [
      'INVALID_LINEAGE',
      'INVALID_COMPLEX',
      'INVALID_AREA_FAMILY',
      'INVALID_MONTH',
      'INVALID_ANALYSIS_MODE',
      'INVALID_PRICE_METRIC',
      'INVALID_PRICE_SELECTION_POLICY',
      'INVALID_EVIDENCE_POLICY',
    ];

    if (badRequestCodes.includes(err?.code)) {
      return res.status(400).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: err?.message || '재건축 분석을 수행하는 중 서버 오류가 발생했습니다.',
      },
    });
  }
});

/**
 * 8. POST /api/redevelopment/compare-59
 * 전용 59㎡ 표준화 비교 모델 계산 실행
 */
redevelopmentRouter.post('/compare-59', (req: Request, res: Response) => {
  try {
    const body: Comparison59Input = req.body;
    if (!body || !body.targetProperty || !body.investmentCost || !body.benchmark) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'targetProperty, investmentCost, benchmark는 필수 입력 항목입니다.',
        },
      });
    }

    const result = Comparison59Engine.calculate(body);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'COMPARISON_59_CALCULATION_FAILED',
        message: err?.message || '59㎡ 비교 모델 계산 중 오류가 발생했습니다.',
      },
    });
  }
});

/**
 * 9. GET /api/redevelopment/compare-59/dunchon
 * Phase 8K / 8K-1: 둔촌주공 -> 올림픽파크포레온 전용 59㎡ 표준화 비교 실제 공식 데이터 조회
 */
redevelopmentRouter.get('/compare-59/dunchon', async (req: Request, res: Response) => {
  try {
    const benchmarkMonth = req.query.benchmarkMonth as string | undefined;

    const result = await redevelopmentDataService.getComparison59RealDunchon({
      benchmarkMonth,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: err?.code || 'COMPARISON_59_REAL_DUNCHON_FAILED',
        message: err?.message || '둔촌주공 59㎡ 실제 비교 모델 조회 중 오류가 발생했습니다.',
      },
    });
  }
});

/**
 * 10. POST /api/redevelopment/compare-59/dunchon/simulate
 * Phase 8K-1: 사용자 시뮬레이션 전용 엔드포인트 (USER_SCENARIO)
 */
redevelopmentRouter.post('/compare-59/dunchon/simulate', async (req: Request, res: Response) => {
  try {
    const {
      benchmarkMonth,
      userPurchasePriceKrw,
      userAdditionalContributionKrw,
      userAcquisitionTaxKrw,
      userFinancingCostKrw,
      userOtherExpensesKrw,
    } = req.body;

    if (
      userPurchasePriceKrw === undefined ||
      userAdditionalContributionKrw === undefined ||
      userAcquisitionTaxKrw === undefined
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SIMULATION_PARAMETERS',
          message: '시뮬레이션을 위한 필수 파라미터(매입가격, 추가분담금, 취득세)가 누락되었습니다.',
        },
      });
    }

    const result = await redevelopmentDataService.simulateUserScenario59Dunchon({
      benchmarkMonth,
      userPurchasePriceKrw: Number(userPurchasePriceKrw),
      userAdditionalContributionKrw: Number(userAdditionalContributionKrw),
      userAcquisitionTaxKrw: Number(userAcquisitionTaxKrw),
      userFinancingCostKrw: userFinancingCostKrw !== undefined ? Number(userFinancingCostKrw) : undefined,
      userOtherExpensesKrw: userOtherExpensesKrw !== undefined ? Number(userOtherExpensesKrw) : undefined,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: err?.code || 'COMPARISON_59_SIMULATION_FAILED',
        message: err?.message || '59㎡ 사용자 시뮬레이션 계산 중 오류가 발생했습니다.',
      },
    });
  }
});

