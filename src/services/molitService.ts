import { ComplexInfo, TradeRecord, AreaCategory, ApiErrorDetail } from '../types';
import { getAreaCategory } from '../utils/areaUtils';
import { TradeFetchResult } from './types';

/**
 * 국토교통부 아파트매매 실거래자료 OpenAPI Client
 *
 * Backend Server API Proxy: /api/molit/trades-range & /api/molit/trades
 */
export class MolitService {
  /**
   * Complex Name Matcher
   * Compares raw API aptNm against complex name, shortName, and all apiAliases.
   */
  private matchesComplex(rawAptName: string, rawDong: string, complex: ComplexInfo): boolean {
    if (!rawAptName) return false;

    const normalize = (str: string) =>
      str
        .replace(/\s+/g, '')
        .replace(/[()_.\-·]/g, '')
        .toLowerCase();

    const normalizedApiName = normalize(rawAptName);
    const normalizedComplexName = normalize(complex.name);
    const normalizedShortName = normalize(complex.shortName);

    // 1. Direct name match
    if (normalizedApiName.includes(normalizedComplexName) || normalizedComplexName.includes(normalizedApiName)) {
      return true;
    }

    // 2. Short name match
    if (normalizedShortName.length >= 2 && normalizedApiName.includes(normalizedShortName)) {
      return true;
    }

    // 3. API Aliases match
    if (complex.apiAliases && complex.apiAliases.length > 0) {
      for (const alias of complex.apiAliases) {
        const normalizedAlias = normalize(alias);
        if (
          normalizedApiName === normalizedAlias ||
          normalizedApiName.includes(normalizedAlias)
        ) {
          // If dong is also available, verify dong consistency if specified
          if (rawDong && complex.dong) {
            const normRawDong = normalize(rawDong);
            const normComplexDong = normalize(complex.dong);
            if (normRawDong.includes(normComplexDong) || normComplexDong.includes(normRawDong)) {
              return true;
            }
            return false;
          }
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Transform raw MOLIT item to normalized TradeRecord
   */
  private transformMolitItem(item: any, complex: ComplexInfo, index: number): TradeRecord {
    const rawPrice = String(item.dealAmount || item.거래금액 || '0').replace(/,/g, '').trim();
    const price = parseInt(rawPrice, 10) || 0;
    const exclusiveArea = parseFloat(String(item.excluUseAr || item.전용면적 || '84.0')) || 84.0;
    const exAreaRounded = Math.round(exclusiveArea * 100) / 100;
    const pyeong = Math.round((exAreaRounded / 3.305785) * 10) / 10;
    const pricePerPyeong = exAreaRounded > 0 ? Math.round(price / (exAreaRounded / 3.305785)) : 0;
    const pricePerSqm = exAreaRounded > 0 ? Math.round((price / exAreaRounded) * 10) / 10 : 0;

    const areaCategory = getAreaCategory(exAreaRounded, complex.id);

    const defaultYear = new Date().getFullYear();
    const y = parseInt(item.dealYear || item.년 || String(defaultYear), 10);
    const m = parseInt(item.dealMonth || item.월 || '1', 10);
    const d = parseInt(item.dealDay || item.일 || '1', 10);
    const mStr = m < 10 ? `0${m}` : `${m}`;
    const dStr = d < 10 ? `0${d}` : `${d}`;

    const isCancelled = !!(item.cdealType === 'O' || item.해제여부 === 'O');
    const cancelDate = item.cdealDay || item.해제사유발생일 || undefined;
    const rawDealType = item.dealingGbn || item.거래유형;
    const dealType = (rawDealType && String(rawDealType).trim().length > 0) ? String(rawDealType).trim() : '확인불가';

    const rawFloor = parseInt(item.floor || item.층 || '1', 10);
    const floor = isNaN(rawFloor) ? 1 : rawFloor;

    const aptSeq = item.aptSeq || item.일련번호 || '';
    const recordId = `${complex.id}_${y}${mStr}${dStr}_${aptSeq}_f${floor}_p${price}_a${Math.round(exAreaRounded * 100)}_${index}`;

    return {
      id: recordId,
      complexId: complex.id,
      complexName: item.aptNm || item.아파트 || complex.name,
      dealYear: y,
      dealMonth: m,
      dealDay: d,
      dealDate: `${y}-${mStr}-${dStr}`,
      dealYmd: `${y}${mStr}`,
      price,
      exclusiveArea: exAreaRounded,
      areaCategory,
      pyeong,
      pricePerPyeong,
      pricePerSqm,
      floor,
      isCancelled,
      cancelDate,
      dealType,
      isOutlier: false,
      dataSource: 'MOLIT_OPENAPI',
    };
  }

  /**
   * Fetch trades for a specific complex over a multi-month date range
   */
  async fetchTradesForComplex(
    complex: ComplexInfo,
    startYmd: string,
    endYmd: string,
    areaCategory: AreaCategory | 'ALL' = 'ALL'
  ): Promise<TradeFetchResult> {
    const complexEndpoint = `/api/complex-trades/${encodeURIComponent(
      complex.id
    )}?lawdCd=${encodeURIComponent(complex.lawdCd)}&startYmd=${encodeURIComponent(
      startYmd
    )}&endYmd=${encodeURIComponent(endYmd)}&areaCategory=${encodeURIComponent(areaCategory)}`;

    let response: Response;
    try {
      response = await fetch(complexEndpoint);
    } catch (networkErr: any) {
      return {
        success: false,
        data: [],
        source: '국토교통부 아파트 매매 실거래가 공개시스템',
        error: {
          code: 'NETWORK_ERROR',
          message: '백엔드 서버 또는 공공데이터포털과의 네트워크 연결에 실패했습니다.',
          source: '국토교통부 아파트 매매 실거래가 공개시스템',
          target: complex.name,
          period: `${startYmd.slice(0, 4)}.${startYmd.slice(4)} ~ ${endYmd.slice(0, 4)}.${endYmd.slice(4)}`,
          rawDetails: networkErr.message,
        },
      };
    }

    const payload = await response.json();

    if (!response.ok || !payload.success) {
      const err = payload.error || {};
      return {
        success: false,
        data: [],
        source: '국토교통부 아파트 매매 실거래가 공개시스템',
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || '국토교통부 실거래가 데이터를 조회하지 못했습니다.',
          source: err.source || '국토교통부 아파트 매매 실거래가 공개시스템',
          target: complex.name,
          period: `${startYmd.slice(0, 4)}.${startYmd.slice(4)} ~ ${endYmd.slice(0, 4)}.${endYmd.slice(4)}`,
          rawDetails: err.rawDetails || err.message,
        },
      };
    }

    const trades: TradeRecord[] = (payload.items || []).map((t: any) => ({
      ...t,
      dataSource: 'MOLIT_OPENAPI',
    }));

    return {
      success: true,
      data: trades,
      source: '국토교통부 아파트 매매 실거래가 공개시스템',
    };
  }
}

export const molitService = new MolitService();
