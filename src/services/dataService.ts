import {
  ComplexInfo,
  TradeRecord,
  ROneIndexPoint,
  AreaCategory,
  MapComplexSummary,
  AreaFamilyListResponse,
  AreaFamilyMonthlyResponse,
} from '../types';
import { TARGET_COMPLEXES } from '../data/complexesData';
import { molitService } from './molitService';
import { rOneService } from './rOneService';
import { IRealEstateDataService, TradeFetchResult } from './types';

/**
 * Unified Real Estate Operational Data Gateway
 * Strictly communicates with real Public OpenAPI endpoints through the backend server proxy.
 * No mock fallbacks or simulated mock data generators are present.
 */
export class DataService implements IRealEstateDataService {
  /**
   * Get list of supported target complexes (metadata registry)
   */
  async getComplexList(): Promise<ComplexInfo[]> {
    return [...TARGET_COMPLEXES];
  }

  /**
   * Fetch real apartment trade records from MOLIT OpenAPI
   * @param complex Target complex info metadata
   * @param startYmd Start period in YYYYMM (e.g. '202401')
   * @param endYmd End period in YYYYMM (e.g. '202608')
   * @param areaCategory Optional area filter ('ALL' | '59' | '84' | '114_PLUS')
   */
  async getTradesForComplex(
    complex: ComplexInfo,
    startYmd: string,
    endYmd: string,
    areaCategory: AreaCategory | 'ALL' = 'ALL'
  ): Promise<TradeFetchResult> {
    return molitService.fetchTradesForComplex(complex, startYmd, endYmd, areaCategory);
  }

  /**
   * Fetch lightweight map marker summaries for all map-enabled complexes
   */
  async getMapSummaries(
    areaCategory: AreaCategory = '59',
    startYmd: string = '201609',
    endYmd: string = '202608'
  ): Promise<Record<string, MapComplexSummary>> {
    try {
      const url = `/api/map-summaries?areaCategory=${encodeURIComponent(
        areaCategory
      )}&startYmd=${encodeURIComponent(startYmd)}&endYmd=${encodeURIComponent(endYmd)}`;
      const res = await fetch(url);
      if (!res.ok) return {};
      const data = await res.json();
      return data.summaries || {};
    } catch {
      return {};
    }
  }

  /**
   * Phase 6A: Fetch verified AreaFamily metadata list for a complex
   */
  async getComplexAreaFamilies(complexId: string): Promise<AreaFamilyListResponse> {
    const url = `/api/complexes/${encodeURIComponent(complexId)}/area-families`;
    const res = await fetch(url);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Failed to fetch area families for ${complexId}`);
    }
    return res.json();
  }

  /**
   * Phase 6A: Fetch sparse monthly price time-series for an AreaFamily
   */
  async getAreaFamilyMonthlyPrices(
    complexId: string,
    areaFamilyId: string,
    startYmd?: string,
    endYmd?: string
  ): Promise<AreaFamilyMonthlyResponse> {
    const params = new URLSearchParams();
    if (startYmd) params.set('startYmd', startYmd);
    if (endYmd) params.set('endYmd', endYmd);

    const qs = params.toString();
    const url = `/api/complexes/${encodeURIComponent(complexId)}/area-families/${encodeURIComponent(
      areaFamilyId
    )}/monthly-prices${qs ? `?${qs}` : ''}`;

    const res = await fetch(url);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(
        errData?.error?.message || `Failed to fetch monthly prices for ${complexId} ${areaFamilyId}`
      );
    }
    return res.json();
  }

  /**
   * Phase 6A: Fetch All-Time High canonical individual trade for an AreaFamily
   * (취소/해제 제외, canonical price > 0 최고가)
   */
  async getAreaFamilyAthTrade(complexId: string, areaFamilyId: string): Promise<TradeRecord | null> {
    try {
      const url = `/api/complexes/${encodeURIComponent(complexId)}/area-families/${encodeURIComponent(
        areaFamilyId
      )}/ath-trade`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      return data.athTrade || null;
    } catch {
      return null;
    }
  }

  /**
   * Fetch canonical trades for Scatter plot within the selected analysis period for an AreaFamily
   */
  async getAreaFamilyScatterTrades(
    complexId: string,
    areaFamilyId: string,
    startYmd?: string,
    endYmd?: string
  ): Promise<TradeRecord[]> {
    try {
      const params = new URLSearchParams();
      params.set('areaFamilyId', areaFamilyId);
      if (startYmd) params.set('startYmd', startYmd);
      if (endYmd) params.set('endYmd', endYmd);
      params.set('fetchAll', 'true');

      const url = `/api/complex-trades/${encodeURIComponent(complexId)}?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.items || []).map((t: any) => ({ ...t, dataSource: 'MOLIT_OPENAPI' }));
    } catch {
      return [];
    }
  }

  /**
   * Fetch page of canonical trades for TransactionLedger using cursor-based pagination
   */
  async getAreaFamilyTradesPage(params: {
    complexId: string;
    areaFamilyId: string;
    startYmd?: string;
    endYmd?: string;
    pageSize?: number;
    cursor?: string | null;
    search?: string;
    sortField?: string;
    sortAsc?: boolean;
  }): Promise<{
    items: TradeRecord[];
    nextCursor: string | null;
    hasMore: boolean;
    totalCount: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const q = new URLSearchParams();
      q.set('areaFamilyId', params.areaFamilyId);
      if (params.startYmd) q.set('startYmd', params.startYmd);
      if (params.endYmd) q.set('endYmd', params.endYmd);
      if (params.pageSize) q.set('pageSize', String(params.pageSize));
      if (params.cursor) q.set('cursor', params.cursor);
      if (params.search && params.search.trim().length > 0) q.set('search', params.search.trim());
      if (params.sortField) q.set('sortField', params.sortField);
      if (params.sortAsc !== undefined) q.set('sortAsc', String(params.sortAsc));

      const url = `/api/complex-trades/${encodeURIComponent(params.complexId)}?${q.toString()}`;
      const res = await fetch(url);
      if (!res.ok) {
        return {
          items: [],
          nextCursor: null,
          hasMore: false,
          totalCount: 0,
          page: 1,
          totalPages: 1,
        };
      }
      const data = await res.json();
      return {
        items: (data.items || []).map((t: any) => ({ ...t, dataSource: 'MOLIT_OPENAPI' })),
        nextCursor: data.nextCursor || null,
        hasMore: Boolean(data.hasMore),
        totalCount: Number(data.totalCount || 0),
        page: Number(data.page || 1),
        totalPages: Number(data.totalPages || 1),
      };
    } catch {
      return {
        items: [],
        nextCursor: null,
        hasMore: false,
        totalCount: 0,
        page: 1,
        totalPages: 1,
      };
    }
  }

  /**
   * Fetch R-ONE real price indices (when live endpoint is integrated)
   */
  async getROneIndices(startYmd: string = '202001', endYmd?: string): Promise<ROneIndexPoint[]> {
    const end = endYmd || `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    return rOneService.fetchPriceIndices(startYmd, end);
  }
}

export const dataService = new DataService();

