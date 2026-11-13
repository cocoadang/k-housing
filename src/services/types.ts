import { ComplexInfo, TradeRecord, ROneIndexPoint, AreaCategory, ApiErrorDetail } from '../types';

export interface FetchTradesParams {
  complex: ComplexInfo;
  startYmd: string; // YYYYMM
  endYmd: string; // YYYYMM
  areaCategory?: AreaCategory;
}

export interface TradeFetchResult {
  success: boolean;
  data: TradeRecord[];
  error?: ApiErrorDetail;
  source: string;
}

export interface IRealEstateDataService {
  getComplexList(): Promise<ComplexInfo[]>;
  getTradesForComplex(
    complex: ComplexInfo,
    startYmd: string,
    endYmd: string,
    areaCategory?: AreaCategory
  ): Promise<TradeFetchResult>;
  getROneIndices(): Promise<ROneIndexPoint[]>;
}
