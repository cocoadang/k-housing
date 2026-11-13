import { ROneIndexPoint } from '../types';

/**
 * 한국부동산원 (R-ONE) 부동산통계정보 OpenAPI Service Client
 * 
 * Dataset: 전국주택가격동향조사 아파트 월간 매매가격지수 (기준시점: 2021.06 = 100.0)
 * Status: Phase 2 실제 연동 준비 중 (가짜/MOCK 데이터는 반환하지 않음)
 */
export class ROneService {
  async fetchPriceIndices(startYmd: string, endYmd: string): Promise<ROneIndexPoint[]> {
    // 실제 R-ONE API 연동 전까지는 빈 배열 반환 (가짜 데이터 미사용)
    return [];
  }
}

export const rOneService = new ROneService();
