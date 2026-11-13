import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { XMLParser } from 'fast-xml-parser';
import { isFirestoreAvailable } from './src/server/firestore';
import { firestoreRepository, consolidateTradeRecords } from './src/server/firestoreRepository';
import { isMigrationLocked } from './src/server/migrationLock';
import { TARGET_COMPLEXES } from './src/data/complexesData';
import { aggregateTradesByMonth } from './src/utils/calculations';
import { getAreaCategory } from './src/utils/areaUtils';
import { computeMapSummaryFromMonthlyAggregates, computeMapComplexSummary } from './src/utils/mapUtils';
import type { AreaCategory, TradeRecord, MapComplexSummary } from './src/types';
import { redevelopmentRouter } from './src/server/redevelopmentRouter';

dotenv.config();

const app = express();
app.use(express.json());
const PORT = 3000;

// Initialize XML parser for MOLIT OpenAPI data.go.kr XML responses
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: true,
  trimValues: true,
});

// In-Memory Cache Layer
interface CacheEntry {
  timestamp: number;
  data: any;
  hits: number;
}
const queryCache: Map<string, CacheEntry> = new Map();
let totalCacheHits = 0;
let totalApiRequests = 0;

// Lazy initialized Gemini client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
}

let molitApiVerified = false;

// 1. Health check & environment status
app.get('/api/health', (req, res) => {
  const hasMapsKey = Boolean(
    (process.env.GOOGLE_MAPS_API_KEY && process.env.GOOGLE_MAPS_API_KEY.trim().length > 0) ||
    (process.env.VITE_GOOGLE_MAPS_API_KEY && process.env.VITE_GOOGLE_MAPS_API_KEY.trim().length > 0)
  );

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      hasMolitKey: Boolean(process.env.MOLIT_API_KEY && process.env.MOLIT_API_KEY.trim().length > 0),
      hasROneKey: Boolean(process.env.R_ONE_API_KEY && process.env.R_ONE_API_KEY.trim().length > 0),
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0),
      hasMapsKey,
      hasFirestore: isFirestoreAvailable(),
      molitApiVerified,
    },
  });
});

// 2. Google Maps Platform Client Configuration
// Google Maps JavaScript API keys are browser-facing keys.
// Security is governed by Google Cloud Console restrictions:
// 1. Application restrictions -> Websites (HTTP referrers: e.g. *.run.app/*, localhost:*)
// 2. API restrictions -> Maps JavaScript API
app.get('/api/config/maps', (req, res) => {
  const apiKey = (process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  const mapId = (process.env.GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID').trim();

  if (!apiKey) {
    return res.status(503).json({
      error: 'GOOGLE_MAPS_API_KEY_NOT_CONFIGURED',
      message: 'Google Maps API Key가 설정되어 있지 않습니다. AI Studio Secret 또는 환경변수 GOOGLE_MAPS_API_KEY를 등록해주세요.',
      configured: false,
    });
  }

  res.json({
    apiKey,
    mapId,
    configured: true,
  });
});

// Maps configuration diagnostic endpoint (without exposing full key)
app.get('/api/debug/maps', (req, res) => {
  const apiKey = (process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  res.json({
    configured: Boolean(apiKey),
    keyPrefix: apiKey ? `${apiKey.slice(0, 6)}***` : null,
    keyLength: apiKey ? apiKey.length : 0,
    environment: process.env.NODE_ENV || 'development',
    mapId: (process.env.GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID').trim(),
  });
});

// 2. Cache status & management
app.get('/api/cache/stats', (req, res) => {
  res.json({
    totalEntries: queryCache.size,
    totalHits: totalCacheHits,
    totalRequests: totalApiRequests,
    hitRatioPct: totalApiRequests > 0 ? Math.round((totalCacheHits / totalApiRequests) * 1000) / 10 : 0,
    storageType: 'In-Memory Cache',
    lastSaved: new Date().toISOString(),
  });
});

app.post('/api/cache/clear', (req, res) => {
  queryCache.clear();
  totalCacheHits = 0;
  totalApiRequests = 0;
  res.json({ success: true, message: 'In-Memory Cache가 성공적으로 초기화되었습니다.' });
});

// Helper: Normalize raw MOLIT items from XML or JSON structure
function extractMolitItems(parsedData: any): { items: any[]; totalCount?: number } {
  if (!parsedData) return { items: [] };

  const totalCount =
    parsedData.response?.body?.totalCount ??
    parsedData.body?.totalCount ??
    parsedData.totalCount;

  // Structure 1: JSON standard response.body.items.item
  if (parsedData.response?.body?.items?.item !== undefined) {
    const item = parsedData.response.body.items.item;
    return {
      items: item === null || item === '' ? [] : Array.isArray(item) ? item : [item],
      totalCount: Number(totalCount),
    };
  }

  // Structure 2: Direct body.items.item
  if (parsedData.body?.items?.item !== undefined) {
    const item = parsedData.body.items.item;
    return {
      items: item === null || item === '' ? [] : Array.isArray(item) ? item : [item],
      totalCount: Number(totalCount),
    };
  }

  // Structure 3: items.item
  if (parsedData.items?.item !== undefined) {
    const item = parsedData.items.item;
    return {
      items: item === null || item === '' ? [] : Array.isArray(item) ? item : [item],
      totalCount: Number(totalCount),
    };
  }

  // Structure 4: response.body without items tag if totalCount is 0
  if (totalCount === 0 || totalCount === '0') {
    return { items: [], totalCount: 0 };
  }

  return { items: [], totalCount: totalCount !== undefined ? Number(totalCount) : undefined };
}

// Helper: Single month fetch from MOLIT API with XML/JSON fallback parsing and full pagination
async function fetchMolitSingleMonth(lawdCd: string, dealYmd: string, apiKey: string) {
  const cacheKey = `molit_${lawdCd}_${dealYmd}`;
  if (queryCache.has(cacheKey)) {
    totalCacheHits++;
    const entry = queryCache.get(cacheKey)!;
    entry.hits++;
    return { fromCache: true, items: entry.data, totalCount: entry.data.length, resultCode: '000', resultMsg: 'OK (CACHE)' };
  }

  // Clean key in case it was pre-encoded
  let cleanKey = apiKey.trim();
  if (cleanKey.includes('%')) {
    try {
      cleanKey = decodeURIComponent(cleanKey);
    } catch (e) {}
  }
  const encodedKey = encodeURIComponent(cleanKey);

  // Helper for single page fetch
  async function fetchSinglePage(pageNo: number) {
    const url = `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?LAWD_CD=${encodeURIComponent(
      lawdCd
    )}&DEAL_YMD=${encodeURIComponent(dealYmd)}&serviceKey=${encodedKey}&pageNo=${pageNo}&numOfRows=1000&_type=json`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
      if (response.status === 429) {
        // Gentle backoff retry once if rate limited
        await new Promise((r) => setTimeout(r, 500));
        response = await fetch(url, { signal: controller.signal });
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        const error: any = new Error('공공데이터포털 서버 응답 시간이 초과되었습니다 (12초)');
        error.code = 'API_SERVER_ERROR';
        error.httpStatus = 504;
        throw error;
      }
      const error: any = new Error(`공공데이터 API 네트워크 연결 실패: ${err.message}`);
      error.code = 'NETWORK_ERROR';
      error.httpStatus = 502;
      throw error;
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      const error: any = new Error(`공공데이터 API 서버 오류 (HTTP ${response.status})`);
      error.httpStatus = response.status;
      if (response.status === 401 || response.status === 403) error.code = 'AUTH_ERROR';
      else if (response.status === 429) error.code = 'RATE_LIMIT';
      else error.code = 'API_SERVER_ERROR';
      throw error;
    }

    const rawText = await response.text();

    // Check for XML service error header
    if (rawText.includes('<cmmMsgHeader>') || rawText.includes('<OpenAPI_ServiceResponse>')) {
      const errorXml = xmlParser.parse(rawText);
      const authMsg =
        errorXml?.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnAuthMsg ||
        errorXml?.OpenAPI_ServiceResponse?.cmmMsgHeader?.errMsg ||
        '';
      const reasonCode = errorXml?.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnReasonCode || '';

      const error: any = new Error(
        authMsg
          ? `공공데이터 API 인증/서비스 오류: ${authMsg} (코드: ${reasonCode})`
          : '공공데이터포털 API 인증에 실패했습니다.'
      );
      error.httpStatus = 403;

      if (
        String(reasonCode) === '30' ||
        String(reasonCode) === '01' ||
        authMsg.includes('SERVICE_KEY') ||
        authMsg.includes('AUTH') ||
        authMsg.includes('UNREGISTERED')
      ) {
        error.code = 'AUTH_ERROR';
      } else if (String(reasonCode) === '22' || authMsg.includes('LIMITED') || authMsg.includes('EXCEED')) {
        error.code = 'RATE_LIMIT';
      } else {
        error.code = 'API_SERVER_ERROR';
      }
      throw error;
    }

    // Parse payload (try JSON first, then XML)
    let parsedPayload: any = null;
    try {
      parsedPayload = JSON.parse(rawText);
    } catch (jsonErr) {
      try {
        parsedPayload = xmlParser.parse(rawText);
      } catch (xmlErr: any) {
        const error: any = new Error('공공데이터 응답(XML/JSON) 구문 분석에 실패했습니다.');
        error.code = 'PARSE_ERROR';
        error.httpStatus = 502;
        throw error;
      }
    }

    // Validate response header code if available
    const headerCode = parsedPayload?.response?.header?.resultCode ?? parsedPayload?.header?.resultCode;
    const headerMsg = parsedPayload?.response?.header?.resultMsg ?? parsedPayload?.header?.resultMsg;

    if (headerCode !== undefined && String(headerCode) !== '00' && String(headerCode) !== '000' && String(headerCode) !== '0') {
      const error: any = new Error(`공공데이터 API 오류 (${headerCode}): ${headerMsg || 'Unknown'}`);
      if (String(headerCode) === '30' || String(headerCode) === '01') {
        error.code = 'AUTH_ERROR';
        error.httpStatus = 401;
      } else if (String(headerCode) === '22') {
        error.code = 'RATE_LIMIT';
        error.httpStatus = 429;
      } else {
        error.code = 'API_SERVER_ERROR';
        error.httpStatus = 500;
      }
      throw error;
    }

    const { items, totalCount } = extractMolitItems(parsedPayload);
    return {
      items,
      totalCount,
      headerCode: String(headerCode || '000'),
      headerMsg: String(headerMsg || 'OK'),
    };
  }

  // Paginate through all pages
  const allItems: any[] = [];
  let pageNo = 1;
  let reportedTotalCount: number | undefined = undefined;
  let lastResultCode = '000';
  let lastResultMsg = 'OK';

  while (true) {
    const pageResult = await fetchSinglePage(pageNo);
    lastResultCode = pageResult.headerCode;
    lastResultMsg = pageResult.headerMsg;

    if (pageNo === 1) {
      reportedTotalCount = pageResult.totalCount;
      // Distinguish NO_DATA vs PARSE_ERROR on page 1
      if (reportedTotalCount !== undefined && reportedTotalCount > 0 && pageResult.items.length === 0) {
        const error: any = new Error(`공공데이터 응답에 totalCount(${reportedTotalCount})는 존재하나 items 구조 파싱에 실패했습니다.`);
        error.code = 'PARSE_ERROR';
        error.httpStatus = 502;
        throw error;
      }
    }

    allItems.push(...pageResult.items);

    // Termination conditions:
    // 1. Current page returned 0 items (no more data or empty month)
    if (pageResult.items.length === 0) {
      break;
    }
    // 2. We collected all items reported by totalCount
    if (reportedTotalCount !== undefined && allItems.length >= reportedTotalCount) {
      break;
    }
    // 3. Current page returned fewer items than numOfRows (1000), meaning last page
    if (pageResult.items.length < 1000) {
      break;
    }

    pageNo++;
  }

  // Live test verification success
  molitApiVerified = true;

  // Save to In-Memory Cache
  queryCache.set(cacheKey, {
    timestamp: Date.now(),
    data: allItems,
    hits: 1,
  });

  return {
    fromCache: false,
    items: allItems,
    totalCount: reportedTotalCount !== undefined ? reportedTotalCount : allItems.length,
    resultCode: lastResultCode,
    resultMsg: lastResultMsg,
  };
}

// 3. API Debug Endpoint for verification
app.get('/api/debug/molit', async (req, res) => {
  const lawdCd = String(req.query.lawdCd || '11650');
  const dealYmd = String(req.query.dealYmd || '202408');
  const apiKey = process.env.MOLIT_API_KEY;

  if (!apiKey || apiKey.trim().length === 0) {
    return res.status(401).json({
      success: false,
      httpStatus: 401,
      resultCode: 'AUTH_ERROR',
      resultMessage: 'MOLIT_API_KEY 환경변수가 설정되어 있지 않습니다.',
      totalCount: 0,
      parsedItemCount: 0,
      sampleItem: null,
    });
  }

  try {
    const result = await fetchMolitSingleMonth(lawdCd, dealYmd, apiKey);
    const sample = result.items && result.items.length > 0 ? result.items[0] : null;

    // Diagnostic filtering for Banpo Xi if testing 11650
    let complexMatchStats: any = undefined;
    if (lawdCd === '11650') {
      const banpoXiItems = result.items.filter((it: any) => {
        const name = (it.aptNm || it.아파트 || '').replace(/\s+/g, '');
        return name.includes('반포자이');
      });
      const banpoXi59Items = banpoXiItems.filter((it: any) => {
        const area = parseFloat(it.excluUseAr || it.전용면적 || 0);
        return getAreaCategory(area, 'banpo_xi') === '59';
      });
      complexMatchStats = {
        district: '서울 서초구',
        totalDistrictTrades: result.items.length,
        banpoXiMatchedCount: banpoXiItems.length,
        banpoXi59MatchedCount: banpoXi59Items.length,
        firstDealDate: banpoXi59Items[0] ? `${banpoXi59Items[0].dealYear}-${banpoXi59Items[0].dealMonth}-${banpoXi59Items[0].dealDay}` : null,
        firstDealAmount: banpoXi59Items[0] ? `${banpoXi59Items[0].dealAmount}만원` : null,
        firstExclusiveArea: banpoXi59Items[0] ? `${banpoXi59Items[0].excluUseAr}㎡` : null,
      };
    }

    return res.json({
      success: true,
      httpStatus: 200,
      resultCode: result.resultCode,
      resultMessage: result.resultMsg,
      totalCount: result.totalCount,
      parsedItemCount: result.items.length,
      sampleItem: sample,
      complexMatchStats,
    });
  } catch (err: any) {
    return res.status(err.httpStatus || (err.code === 'AUTH_ERROR' ? 401 : 500)).json({
      success: false,
      httpStatus: err.httpStatus || 500,
      resultCode: err.code || 'UNKNOWN_ERROR',
      resultMessage: err.message || '국토교통부 실거래가 데이터 조회에 실패했습니다.',
      totalCount: 0,
      parsedItemCount: 0,
      sampleItem: null,
    });
  }
});

// 4. Single Month MOLIT API Proxy
app.get('/api/molit/trades', async (req, res) => {
  const { lawdCd, dealYmd } = req.query;
  totalApiRequests++;

  if (!lawdCd || !dealYmd) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_RESPONSE',
        message: 'lawdCd (법정동코드 5자리)와 dealYmd (거래연월 YYYYMM)는 필수 입력 파라미터입니다.',
      },
    });
  }

  const apiKey = process.env.MOLIT_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message:
          '국토교통부 실거래가 API Key(MOLIT_API_KEY)가 서버 환경변수에 설정되어 있지 않습니다. .env 파일에 공공데이터포털 인증키를 등록해주세요.',
        source: '국토교통부 아파트 매매 실거래가 공개시스템',
      },
    });
  }

  try {
    const result = await fetchMolitSingleMonth(String(lawdCd), String(dealYmd), apiKey);
    return res.json({
      success: true,
      source: result.fromCache ? 'LOCAL_CACHE' : 'MOLIT_OPENAPI',
      lawdCd,
      dealYmd,
      totalCount: result.items.length,
      items: result.items,
    });
  } catch (err: any) {
    console.error(`[MOLIT API Error] ${lawdCd} ${dealYmd}:`, err.message);
    return res.status(err.httpStatus || (err.code === 'AUTH_ERROR' ? 401 : 500)).json({
      success: false,
      error: {
        code: err.code || 'UNKNOWN_ERROR',
        message: err.message || '국토교통부 실거래가 데이터 조회에 실패했습니다.',
        source: '국토교통부 아파트 매매 실거래가 공개시스템',
        target: String(lawdCd),
        period: String(dealYmd),
      },
    });
  }
});

// 4. Multi-month Range MOLIT API Batch Proxy
app.get('/api/molit/trades-range', async (req, res) => {
  const { lawdCd, startYmd, endYmd } = req.query;
  totalApiRequests++;

  if (!lawdCd || !startYmd || !endYmd) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_RESPONSE',
        message: 'lawdCd, startYmd(YYYYMM), endYmd(YYYYMM) 파라미터가 모두 필요합니다.',
      },
    });
  }

  const apiKey = process.env.MOLIT_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message:
          '국토교통부 실거래가 API Key(MOLIT_API_KEY)가 서버 환경변수에 설정되어 있지 않습니다. .env 파일에 공공데이터포털 인증키를 등록해주세요.',
        source: '국토교통부 아파트 매매 실거래가 공개시스템',
      },
    });
  }

  // Generate list of months from startYmd to endYmd
  const startYear = parseInt(String(startYmd).substring(0, 4), 10);
  const startMonth = parseInt(String(startYmd).substring(4, 6), 10);
  const endYear = parseInt(String(endYmd).substring(0, 4), 10);
  const endMonth = parseInt(String(endYmd).substring(4, 6), 10);

  const months: string[] = [];
  let curY = startYear;
  let curM = startMonth;

  while (curY < endYear || (curY === endYear && curM <= endMonth)) {
    const mStr = curM < 10 ? `0${curM}` : `${curM}`;
    months.push(`${curY}${mStr}`);
    curM++;
    if (curM > 12) {
      curM = 1;
      curY++;
    }
  }

  if (months.length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_RESPONSE',
        message: '조회 기간(startYmd ~ endYmd)이 올바르지 않습니다.',
      },
    });
  }

  const allItems: any[] = [];
  const concurrency = 4; // Concurrency limit to prevent overwhelming Public Data Portal
  let fatalError: any = null;

  for (let i = 0; i < months.length; i += concurrency) {
    const batch = months.slice(i, i + concurrency);
    const promises = batch.map(async (ymd) => {
      try {
        const res = await fetchMolitSingleMonth(String(lawdCd), ymd, apiKey);
        return { ymd, items: res.items, error: null };
      } catch (err: any) {
        return { ymd, items: [], error: err };
      }
    });

    const results = await Promise.all(promises);
    for (const r of results) {
      if (r.error) {
        // If it's an authentication or rate-limit error, abort immediately and propagate
        if (r.error.code === 'AUTH_ERROR' || r.error.code === 'RATE_LIMIT') {
          fatalError = r.error;
          break;
        }
      }
      allItems.push(...r.items);
    }

    if (fatalError) break;
    // Small throttle between batches
    if (i + concurrency < months.length) {
      await new Promise((r) => setTimeout(r, 30));
    }
  }

  if (fatalError) {
    return res.status(fatalError.code === 'AUTH_ERROR' ? 401 : 500).json({
      success: false,
      error: {
        code: fatalError.code || 'UNKNOWN_ERROR',
        message: fatalError.message || '국토교통부 API 호출 중 치명적인 오류가 발생했습니다.',
        source: '국토교통부 아파트 매매 실거래가 공개시스템',
        target: String(lawdCd),
        period: `${startYmd} ~ ${endYmd}`,
      },
    });
  }

  return res.json({
    success: true,
    source: 'MOLIT_OPENAPI',
    lawdCd,
    startYmd,
    endYmd,
    totalMonths: months.length,
    totalCount: allItems.length,
    items: allItems,
  });
});

// Helper: Match raw apartment name and dong with complex info
function serverMatchesComplex(rawAptName: string, rawDong: string, complex: any): boolean {
  if (!rawAptName || !complex) return false;
  const normalize = (str: string) => str.replace(/\s+/g, '').replace(/[()_.\-·]/g, '').toLowerCase();
  const normalizedApiName = normalize(rawAptName);
  const normalizedComplexName = normalize(complex.name);
  const cleanApi = normalizedApiName.replace(/아파트/g, '');
  const cleanComp = normalizedComplexName.replace(/아파트/g, '');

  // 1. Dong verification (strict)
  if (rawDong && complex.dong) {
    const normRawDong = normalize(rawDong);
    const normComplexDong = normalize(complex.dong);
    if (!normRawDong.includes(normComplexDong) && !normComplexDong.includes(normRawDong)) {
      return false;
    }
  }

  // 2. Strict match: exact or API apartment name contains full complex name
  // Note: NEVER allow complex name to match a shorter raw API name (e.g. '개포자이' matching '개포자이프레지던스')
  if (cleanApi === cleanComp || normalizedApiName === normalizedComplexName || normalizedApiName.includes(normalizedComplexName)) {
    return true;
  }

  // 3. Approved explicit aliases only
  if (complex.apiAliases && complex.apiAliases.length > 0) {
    for (const alias of complex.apiAliases) {
      const normalizedAlias = normalize(alias);
      const cleanAlias = normalizedAlias.replace(/아파트/g, '');
      if (
        cleanApi === cleanAlias ||
        normalizedApiName === normalizedAlias ||
        normalizedApiName.includes(normalizedAlias)
      ) {
        return true;
      }
    }
  }

  return false;
}

// Helper: Transform raw MOLIT item to standardized TradeRecord
function serverTransformMolitItem(item: any, complex: any, index: number): TradeRecord {
  const rawPriceStr = String(item.dealAmount || item.거래금액 || '0').replace(/,/g, '').trim();
  const price = parseInt(rawPriceStr, 10);
  const rawExclu = parseFloat(String(item.excluUseAr || item.전용면적 || '0'));
  const exAreaRounded = Math.round(rawExclu * 100) / 100;
  const areaCategory = getAreaCategory(exAreaRounded, complex.id);
  const pyeong = Math.round(((exAreaRounded / 3.305785) * 1.3) * 10) / 10;
  const pricePerPyeong = pyeong > 0 ? Math.round(price / pyeong) : 0;
  const pricePerSqm = exAreaRounded > 0 ? Math.round((price / exAreaRounded) * 10) / 10 : 0;

  const y = parseInt(item.dealYear || item.년 || '2024', 10);
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

  const areaInt = Math.round(exAreaRounded * 100);
  const recordId = `${complex.id}_${y}${mStr}${dStr}_f${floor}_p${price}_a${areaInt}`;

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

// 4.2 Complex On-Demand Trades with Firestore-First Pipeline
app.get('/api/complex-trades/:complexId', async (req, res) => {
  const { complexId } = req.params;
  const {
    lawdCd,
    startYmd,
    endYmd,
    areaCategory,
    areaFamilyId,
    page: pageQuery,
    pageSize: pageSizeQuery,
    cursor: cursorQuery,
    search: searchQuery,
    sortField: sortFieldQuery,
    sortAsc: sortAscQuery,
    fetchAll,
  } = req.query;

  const targetComplex = TARGET_COMPLEXES.find((c) => c.id === complexId);
  const effectiveLawdCd = (lawdCd as string) || targetComplex?.lawdCd;
  const effectiveStartYmd = (startYmd as string) || '202509';
  const effectiveEndYmd = (endYmd as string) || '202608';
  const effectiveArea = ((areaCategory as string) || 'ALL') as AreaCategory | '114_PLUS' | 'ALL';

  if (!effectiveLawdCd) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_REQUEST', message: '단지 정보 또는 법정동코드(lawdCd)를 확인할 수 없습니다.' },
    });
  }

  // Helper to process, filter, deterministically sort, and paginate trade records
  const processTradesResponse = (allTrades: any[]) => {
    let filtered = allTrades;

    // Filter by areaFamilyId if provided
    if (areaFamilyId && typeof areaFamilyId === 'string' && areaFamilyId !== 'ALL') {
      filtered = filtered.filter((t) => t.areaFamilyId === areaFamilyId);
    }

    // Filter by text search if provided
    if (searchQuery && typeof searchQuery === 'string' && searchQuery.trim().length > 0) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((t) => {
        return (
          (t.dealDate && t.dealDate.toLowerCase().includes(q)) ||
          (t.floor !== undefined && String(t.floor).includes(q)) ||
          (t.exclusiveArea !== undefined && String(t.exclusiveArea).includes(q)) ||
          (t.price !== undefined && String(t.price).includes(q)) ||
          (t.dealType && t.dealType.toLowerCase().includes(q))
        );
      });
    }

    // Deterministic Sorting: Primary sortField + Secondary a.id tie-breaker
    const sortField = (sortFieldQuery as string) || 'dealDate';
    const isAsc = sortAscQuery === 'true' || sortAscQuery === '1';

    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'dealDate') {
        cmp = (a.dealDate || '').localeCompare(b.dealDate || '');
      } else if (sortField === 'price') {
        cmp = (a.price || 0) - (b.price || 0);
      } else if (sortField === 'exclusiveArea') {
        cmp = (a.exclusiveArea || 0) - (b.exclusiveArea || 0);
      } else if (sortField === 'floor') {
        cmp = (a.floor || 0) - (b.floor || 0);
      } else {
        cmp = (a.dealDate || '').localeCompare(b.dealDate || '');
      }

      if (cmp !== 0) {
        return isAsc ? cmp : -cmp;
      }
      // Strict tie-breaker by unique id guarantees zero duplicate or omitted records across pages
      const idCmp = (a.id || '').localeCompare(b.id || '');
      return isAsc ? idCmp : -idCmp;
    });

    const totalCount = filtered.length;

    // If fetchAll is explicitly true, return all matching records without pagination
    if (fetchAll === 'true') {
      return {
        totalCount,
        page: 1,
        pageSize: totalCount,
        totalPages: 1,
        items: filtered,
        nextCursor: null,
        hasMore: false,
      };
    }

    const pageSizeNum = Math.max(1, Math.min(100, parseInt(pageSizeQuery as string, 10) || 15));
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSizeNum));

    // Decode cursor if provided
    let cursorObj: { dealDate?: string; id?: string } | null = null;
    if (cursorQuery && typeof cursorQuery === 'string' && cursorQuery.trim().length > 0) {
      try {
        const raw = cursorQuery.trim();
        if (raw.startsWith('{')) {
          cursorObj = JSON.parse(raw);
        } else if (raw.includes('|')) {
          const [dDate, cid] = raw.split('|');
          cursorObj = { dealDate: dDate, id: cid };
        } else {
          const decoded = Buffer.from(raw, 'base64').toString('utf-8');
          cursorObj = JSON.parse(decoded);
        }
      } catch {
        // invalid cursor, start from beginning
      }
    }

    let startIdx = 0;
    if (cursorObj && cursorObj.id) {
      const foundIdx = filtered.findIndex((t) => t.id === cursorObj.id);
      if (foundIdx !== -1) {
        startIdx = foundIdx + 1;
      }
    } else if (pageQuery) {
      const pageNum = Math.max(1, parseInt(pageQuery as string, 10) || 1);
      const effectivePage = Math.min(pageNum, totalPages);
      startIdx = (effectivePage - 1) * pageSizeNum;
    }

    const items = filtered.slice(startIdx, startIdx + pageSizeNum);
    const hasMore = startIdx + pageSizeNum < totalCount;
    const lastItem = items.length > 0 ? items[items.length - 1] : null;
    const nextCursor =
      hasMore && lastItem
        ? Buffer.from(JSON.stringify({ dealDate: lastItem.dealDate, id: lastItem.id })).toString('base64')
        : null;
    const currentPage = Math.floor(startIdx / pageSizeNum) + 1;

    return {
      totalCount,
      page: Math.min(currentPage, totalPages),
      pageSize: pageSizeNum,
      totalPages,
      items,
      nextCursor,
      hasMore,
    };
  };

  // 1. Try reading from Firestore if available
  if (isFirestoreAvailable()) {
    try {
      const fsTrades = await firestoreRepository.getTransactions(
        complexId,
        effectiveStartYmd,
        effectiveEndYmd,
        effectiveArea
      );

      if (fsTrades.length > 0) {
        const processed = processTradesResponse(fsTrades);
        return res.json({
          success: true,
          source: 'FIRESTORE',
          complexId,
          lawdCd: effectiveLawdCd,
          startYmd: effectiveStartYmd,
          endYmd: effectiveEndYmd,
          areaCategory: effectiveArea,
          ...processed,
        });
      }
    } catch (fsErr: any) {
      console.warn(`[Firestore] Failed to read cached trades for ${complexId}:`, fsErr?.message || fsErr);
    }
  }

  // 2. Fetch from MOLIT API if not found in Firestore
  const apiKey = process.env.MOLIT_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: '국토교통부 실거래가 API Key(MOLIT_API_KEY)가 서버 환경변수에 설정되어 있지 않습니다.',
      },
    });
  }

  // Build months list
  const startYear = parseInt(effectiveStartYmd.substring(0, 4), 10);
  const startMonth = parseInt(effectiveStartYmd.substring(4, 6), 10);
  const endYear = parseInt(effectiveEndYmd.substring(0, 4), 10);
  const endMonth = parseInt(effectiveEndYmd.substring(4, 6), 10);

  const months: string[] = [];
  let curY = startYear;
  let curM = startMonth;
  while (curY < endYear || (curY === endYear && curM <= endMonth)) {
    const mStr = curM < 10 ? `0${curM}` : `${curM}`;
    months.push(`${curY}${mStr}`);
    curM++;
    if (curM > 12) {
      curM = 1;
      curY++;
    }
  }

  const rawItems: any[] = [];
  const concurrency = 4;
  let fatalError: any = null;

  for (let i = 0; i < months.length; i += concurrency) {
    const batch = months.slice(i, i + concurrency);
    const promises = batch.map(async (ymd) => {
      try {
        const fetchRes = await fetchMolitSingleMonth(effectiveLawdCd, ymd, apiKey);
        return { ymd, items: fetchRes.items, error: null };
      } catch (err: any) {
        return { ymd, items: [], error: err };
      }
    });

    const results = await Promise.all(promises);
    for (const r of results) {
      if (r.error && (r.error.code === 'AUTH_ERROR' || r.error.code === 'RATE_LIMIT')) {
        fatalError = r.error;
        break;
      }
      rawItems.push(...r.items);
    }

    if (fatalError) break;
    if (i + concurrency < months.length) {
      await new Promise((r) => setTimeout(r, 30));
    }
  }

  if (fatalError) {
    return res.status(fatalError.code === 'AUTH_ERROR' ? 401 : 500).json({
      success: false,
      error: fatalError,
    });
  }

  // Filter and transform matching records
  const matchingComplex = targetComplex || {
    id: complexId,
    name: complexId,
    shortName: complexId,
    lawdCd: effectiveLawdCd,
  };

  const matchedTrades: TradeRecord[] = rawItems
    .filter((item) => {
      const aptName = item.aptNm || item.아파트 || '';
      const dong = item.umdNm || item.bubdong || item.법정동 || item.dong || '';
      return serverMatchesComplex(aptName, dong, matchingComplex);
    })
    .map((item, idx) => serverTransformMolitItem(item, matchingComplex, idx));

  // Consolidate raw trades by deterministic transaction ID to merge cancellation metadata
  const consolidatedTrades = consolidateTradeRecords(matchedTrades, matchingComplex.id);

  // 3. Persist to Firestore asynchronously / safely
  if (isFirestoreAvailable() && targetComplex) {
    (async () => {
      try {
        await firestoreRepository.saveComplexMetadata(targetComplex);
        if (isMigrationLocked()) {
          console.warn(`[MIGRATION_LOCK] Complex trade fetch bypassing Firestore transactions write for '${targetComplex.id}' during migration.`);
        } else if (consolidatedTrades.length > 0) {
          await firestoreRepository.saveTransactions(consolidatedTrades, targetComplex.id);

          // Exclude cancelled trades from monthly price aggregations
          const validTrades = consolidatedTrades.filter((t) => !t.isCancelled);
          const areas: ('59' | '84' | '114_PLUS' | 'ALL')[] = ['59', '84', '114_PLUS', 'ALL'];
          for (const area of areas) {
            const areaTrades = area === 'ALL' ? validTrades : validTrades.filter((t) => t.areaCategory === area);
            const monthly = aggregateTradesByMonth(areaTrades);
            await firestoreRepository.saveMonthlyPrices(targetComplex.id, monthly, area);
          }

          await firestoreRepository.recordCollectionStatus({
            complexId: targetComplex.id,
            lawdCd: targetComplex.lawdCd,
            startYmd: effectiveStartYmd,
            endYmd: effectiveEndYmd,
            itemCount: consolidatedTrades.length,
            success: true,
          });
        }
      } catch (saveErr: any) {
        console.warn(`[Firestore] Background persist error for ${complexId}:`, saveErr?.message || saveErr);
      }
    })();
  }

  // Filter returned items by areaCategory if requested
  const filteredTrades =
    effectiveArea === 'ALL' ? consolidatedTrades : consolidatedTrades.filter((t) => t.areaCategory === effectiveArea);

  const processed = processTradesResponse(filteredTrades);

  return res.json({
    success: true,
    source: 'MOLIT_OPENAPI',
    complexId,
    lawdCd: effectiveLawdCd,
    startYmd: effectiveStartYmd,
    endYmd: effectiveEndYmd,
    areaCategory: effectiveArea,
    ...processed,
  });
});

// 4.2.1 Get All-Time High Canonical Individual Trade for AreaFamily
app.get('/api/complexes/:complexId/area-families/:areaFamilyId/ath-trade', async (req, res) => {
  const { complexId, areaFamilyId } = req.params;
  try {
    const athTrade = await firestoreRepository.getAthTrade(complexId, areaFamilyId);
    return res.json({
      success: true,
      complexId,
      areaFamilyId,
      athTrade,
    });
  } catch (err: any) {
    console.error(`[API: ath-trade] Error:`, err);
    return res.status(500).json({
      success: false,
      error: { code: 'ATH_TRADE_FETCH_FAILED', message: err?.message || String(err) },
    });
  }
});

// 4.3 Direct Monthly Price Aggregates Endpoint with Automatic Fallback
app.get('/api/monthly-prices/:complexId', async (req, res) => {
  const { complexId } = req.params;
  const { areaCategory, startYmd, endYmd } = req.query;
  const effectiveArea = (areaCategory as AreaCategory) || '59';
  const effectiveStartYmd = (startYmd as string) || '202409';
  const effectiveEndYmd = (endYmd as string) || '202608';

  const targetComplex = TARGET_COMPLEXES.find((c) => c.id === complexId);

  try {
    // 1. Fetch persisted data from Firestore (or in-memory cache)
    const monthlyPrices = await firestoreRepository.getMonthlyPrices(
      complexId,
      effectiveArea,
      effectiveStartYmd,
      effectiveEndYmd
    );

    if (monthlyPrices && monthlyPrices.length > 0) {
      return res.json({
        success: true,
        source: 'FIRESTORE',
        complexId,
        areaCategory: effectiveArea,
        totalCount: monthlyPrices.length,
        items: monthlyPrices,
      });
    }

    // Rule 18: No on-demand multi-year MOLIT loops. Return clean empty items if unbackfilled.
    return res.json({
      success: true,
      source: 'FIRESTORE',
      complexId,
      areaCategory: effectiveArea,
      totalCount: 0,
      items: [],
    });
  } catch (err: any) {
    console.warn(`[Monthly Prices API] Handled error for ${complexId}:`, err?.message || err);
    return res.json({
      success: true,
      source: 'FALLBACK_EMPTY',
      complexId,
      areaCategory: effectiveArea,
      totalCount: 0,
      items: [],
    });
  }
});

// 4.4 Lightweight Map Summaries Endpoint for all map complexes (Phase 5C: V2 Cutover to monthlyStandardAreaPrices_v2)
app.get('/api/map-summaries', async (req, res) => {
  const { areaCategory, startYmd, endYmd } = req.query;
  const rawCategory = (areaCategory as string) || '59';
  if (rawCategory !== '59' && rawCategory !== '84') {
    return res.status(400).json({
      success: false,
      error: 'INVALID_AREA_CATEGORY',
      message: `Map Explorer V2 only supports standardAreaCategory "59" or "84". Received: "${rawCategory}".`,
    });
  }
  const standardAreaCategory = rawCategory as '59' | '84';
  const effectiveStartYmd = (startYmd as string) || '201609';
  const effectiveEndYmd = (endYmd as string) || '202608';

  const mapComplexes = TARGET_COMPLEXES;
  const summaries: Record<string, MapComplexSummary> = {};

  try {
    // Phase 5C: Strictly query monthlyStandardAreaPrices_v2 using optimized bulk reader
    // No fallback to legacy monthlyComplexPrices, raw transaction scan, or MOLIT API
    const monthlyByComplex = await firestoreRepository.getAllStandardAreaMonthlyPrices(
      standardAreaCategory,
      effectiveStartYmd,
      effectiveEndYmd
    );

    for (const complex of mapComplexes) {
      const monthlyPrices = monthlyByComplex[complex.id] || [];
      if (monthlyPrices && monthlyPrices.length > 0) {
        summaries[complex.id] = computeMapSummaryFromMonthlyAggregates(
          complex,
          monthlyPrices,
          standardAreaCategory,
          { startYmd: effectiveStartYmd, endYmd: effectiveEndYmd }
        );
      } else {
        summaries[complex.id] = computeMapComplexSummary(
          complex,
          [],
          standardAreaCategory
        );
      }
    }

    return res.json({
      success: true,
      areaCategory: standardAreaCategory,
      startYmd: effectiveStartYmd,
      endYmd: effectiveEndYmd,
      totalComplexes: mapComplexes.length,
      summaries,
    });
  } catch (err: any) {
    console.error('[API: /api/map-summaries] Failed to read from monthlyStandardAreaPrices_v2:', err);
    // Explicit error surface: strictly NO silent fallback to legacy collections or transactions scan!
    return res.status(500).json({
      success: false,
      error: 'V2_READ_FAILED',
      message: `Failed to query monthlyStandardAreaPrices_v2: ${err?.message || err}`,
    });
  }
});

// =========================================================================
// 4.5 Phase 6A: AreaFamily Data Layer Endpoints for Price Analysis
// SSOT: monthlyComplexPrices_v2 + AREA_FAMILIES_REGISTRY
// =========================================================================

/**
 * GET /api/complexes/:complexId/area-families
 * Returns all verified AreaFamilies for the complex with metadata, transaction counts,
 * and monthly data availability.
 */
app.get('/api/complexes/:complexId/area-families', async (req, res) => {
  const { complexId } = req.params;

  try {
    const families = await firestoreRepository.getAreaFamilyMetadata(complexId);
    return res.json({
      success: true,
      complexId,
      totalFamilies: families.length,
      activeFamilies: families.filter((f) => f.hasMonthlyData).length,
      families,
    });
  } catch (err: any) {
    if (err?.code === 'INVALID_COMPLEX_ID') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INVALID_COMPLEX_ID',
          message: err.message,
        },
      });
    }

    console.error(`[API: /api/complexes/${complexId}/area-families] Error:`, err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'V2_AREA_MONTHLY_READ_FAILED',
        message: err?.message || String(err),
      },
    });
  }
});

/**
 * GET /api/complexes/:complexId/area-families/:areaFamilyId/monthly-prices
 * Returns sparse monthly price time-series for a specific AreaFamily.
 * Query params: startYmd (YYYYMM), endYmd (YYYYMM)
 */
app.get('/api/complexes/:complexId/area-families/:areaFamilyId/monthly-prices', async (req, res) => {
  const { complexId, areaFamilyId } = req.params;
  const { startYmd, endYmd } = req.query;

  try {
    const result = await firestoreRepository.getAreaFamilyMonthlyPrices(
      complexId,
      areaFamilyId,
      startYmd as string | undefined,
      endYmd as string | undefined
    );

    return res.json({
      success: true,
      complexId,
      areaFamilyId,
      hasMonthlyData: result.metadata.hasMonthlyData,
      metadata: result.metadata,
      period: {
        startYmd: (startYmd as string) || result.metadata.firstDealYmd || undefined,
        endYmd: (endYmd as string) || result.metadata.lastDealYmd || undefined,
        firstDealYmd: result.metadata.firstDealYmd,
        lastDealYmd: result.metadata.lastDealYmd,
      },
      pointCount: result.points.length,
      points: result.points,
    });
  } catch (err: any) {
    if (err?.code === 'INVALID_COMPLEX_ID') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INVALID_COMPLEX_ID',
          message: err.message,
        },
      });
    }

    if (err?.code === 'AREA_FAMILY_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'AREA_FAMILY_NOT_FOUND',
          message: err.message,
        },
      });
    }

    if (err?.code === 'INVALID_YMD') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_YMD',
          message: err.message,
        },
      });
    }

    if (err?.code === 'INVALID_DATE_RANGE') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DATE_RANGE',
          message: err.message,
        },
      });
    }

    console.error(
      `[API: /api/complexes/${complexId}/area-families/${areaFamilyId}/monthly-prices] Error:`,
      err
    );
    return res.status(500).json({
      success: false,
      error: {
        code: 'V2_AREA_MONTHLY_READ_FAILED',
        message: err?.message || String(err),
      },
    });
  }
});

// Redevelopment Analysis API Layer (Phase 8C-3 Public Contract)
app.use('/api/redevelopment', redevelopmentRouter);

// 5. AI Real Estate Analyst (Gemini API)
app.post('/api/ai/analyze', async (req, res) => {
  const { complexes, baseline, selectedArea, metricsSummary, hasData } = req.body;

  if (hasData === false || !metricsSummary || metricsSummary.latestPrice === undefined || metricsSummary.latestPrice === 0) {
    return res.json({
      analysis: '### ℹ️ 분석 불가 안내\n\n선택한 단지 및 기간 조건에 해당하는 실제 실거래가 데이터가 없어 AI 시장 진단을 수행할 수 없습니다.',
    });
  }

  try {
    const ai = getGeminiClient();
    if (!ai) {
      const primary = complexes?.[0];
      const complexName = primary?.name || '선택 단지';
      return res.json({
        analysis: `### ℹ️ Gemini AI 분석 엔진 안내

현재 서버 환경 변수에 **\`GEMINI_API_KEY\`**가 설정되어 있지 않습니다.
Gemini API 키를 등록하시면 단지별 시세 사이클, 복합 성장률(CAGR), MDD 낙폭 방어율, 정책 변수 연계 심층 정량 분석 리포트가 실시간 생성됩니다.

> **확인 가능한 실시간 정량 지표:**
> - 대상 단지: **${complexName}** (전용 ${selectedArea === 'ALL' ? '전체' : selectedArea + '㎡'})
> - 기간 내 CAGR, 최대 낙폭(MDD), 전고점 회복률, 3.3㎡당 단가는 대시보드 차트와 통계 매트릭스에서 즉시 확인하실 수 있습니다.`,
      });
    }

    const prompt = `당신은 대한민국 최고 수준의 시니어 부동산 데이터 엔지니어이자 금융 자산 분석가입니다.
실제 국토교통부 실거래가 데이터에서 집계된 다음 정량 지표만을 바탕으로 전문적인 부동산 시장 분석 보고서를 마크다운으로 작성해주세요.
가공되지 않은 임의의 가짜 수치를 창작하지 마시고 제공된 통계 요약에 근거하여 작성하세요.

[분석 대상 및 조건]
- 대상 단지: ${JSON.stringify(complexes)}
- 선택 평형: ${selectedArea === 'ALL' ? '전체 평형' : selectedArea + '㎡'}
- 기준 시점: ${baseline}
- 실제 집계 통계 요약: ${JSON.stringify(metricsSummary, null, 2)}

[작성 가이드]
1. 실제 실거래가 시세 변동 및 사이클 평가 (상승기, 조정기, 최근 거래가 추이)
2. 연평균 복합 성장률(CAGR), 최대 낙폭(MDD), 전고점 회복률에 대한 전문적 해석
3. 입지, 학군, 신축/구축 특성 등에 따른 시장 가치 요약
4. 실제 데이터 기반의 정량적 총평`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    res.json({
      analysis: response.text || '분석 결과를 생성하지 못했습니다.',
    });
  } catch (error: any) {
    console.error('Gemini AI Analysis Error:', error);
    res.status(500).json({ error: error.message || 'AI 분석 생성 중 오류가 발생했습니다.' });
  }
});

// 6. Start Server with Vite middleware in dev, static files in prod
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[K-RealEstate Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
