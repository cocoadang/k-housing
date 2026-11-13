import { XMLParser } from 'fast-xml-parser';
import { getFirestoreDb, isFirestoreAvailable } from './firestore';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { TARGET_COMPLEXES } from '../data/complexesData';
import { consolidateTradeRecords } from './firestoreRepository';
import { aggregateTradesByMonth } from '../utils/calculations';
import { getAreaCategory } from '../utils/areaUtils';
import { isMigrationLocked } from './migrationLock';
import type { ComplexInfo, TradeRecord, AreaCategory } from '../types';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: true,
  trimValues: true,
});

export interface BackfillJob {
  lawdCd: string;
  dealYmd: string;
}

export interface BackfillJobDoc {
  lawdCd: string;
  dealYmd: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  fetchedRows: number;
  matchedComplexes: string[];
  savedTransactions: number;
  savedMonthlyRecords: number;
  durationMs: number;
  completedAt?: any;
  error?: string;
  retries: number;
}

export interface BackfillProgressDoc {
  status: 'NOT_STARTED' | 'RUNNING' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED';
  mode: 'CANARY' | 'FULL';
  startMonth: string;
  endMonth: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  skippedJobs: number;
  totalTransactionsSaved: number;
  totalMonthlyPricesSaved: number;
  rateLimitErrors: number;
  networkErrors: number;
  startedAt: string;
  updatedAt: string;
  lastCompletedJob: string | null;
  targetComplexCount: number;
  targetComplexIds: string[];
}

export interface BackfillOptions {
  mode: 'CANARY' | 'FULL';
  canaryComplexIds?: string[];
  startMonth?: string;
  endMonth?: string;
  throttleMs?: number;
  forceRerun?: boolean;
  onProgress?: (progress: BackfillProgressDoc, lastJobResult?: any) => void;
}

/**
 * Clean and robust complex matching
 */
export function matchesComplexForBackfill(rawAptName: string, rawDong: string, complex: ComplexInfo): boolean {
  if (!rawAptName || !complex) return false;
  const normalize = (str: string) => str.replace(/\s+/g, '').replace(/[()_.\-·]/g, '').toLowerCase();
  const normalizedApiName = normalize(rawAptName);
  const normalizedComplexName = normalize(complex.name);
  const cleanApi = normalizedApiName.replace(/아파트/g, '');
  const cleanComp = normalizedComplexName.replace(/아파트/g, '');

  if (rawDong && complex.dong) {
    const normRawDong = normalize(rawDong);
    const normComplexDong = normalize(complex.dong);
    if (!normRawDong.includes(normComplexDong) && !normComplexDong.includes(normRawDong)) {
      return false;
    }
  }

  // Exact match or API name contains the full complex name (e.g. '개포래미안포레스트' in '개포래미안포레스트아파트')
  if (cleanApi === cleanComp || normalizedApiName.includes(normalizedComplexName)) {
    return true;
  }

  // Specific aliases (must be explicit)
  if (complex.apiAliases && complex.apiAliases.length > 0) {
    for (const alias of complex.apiAliases) {
      const normalizedAlias = normalize(alias);
      const cleanAlias = normalizedAlias.replace(/아파트/g, '');
      if (cleanApi === cleanAlias || normalizedApiName === normalizedAlias || normalizedApiName.includes(normalizedAlias)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Transform raw MOLIT item to normalized TradeRecord
 */
export function transformMolitItemForBackfill(item: any, complex: ComplexInfo, index: number): TradeRecord {
  const rawPriceStr = String(item.dealAmount || item.거래금액 || '0').replace(/,/g, '').trim();
  const price = parseInt(rawPriceStr, 10) || 0;
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
  const dealType = item.dealingGbn || item.거래유형 || '중개거래';

  const rawFloor = parseInt(item.floor || item.층 || '1', 10);
  const floor = isNaN(rawFloor) ? 1 : rawFloor;

  const areaInt = Math.round(exAreaRounded * 100);
  const recordId = `${complex.id}_${y}${mStr}${dStr}_f${floor}_p${price}_a${areaInt}_${index}`;

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
 * Extract items from MOLIT parsed JSON/XML
 */
function extractItems(parsedData: any): { items: any[]; totalCount?: number } {
  if (!parsedData) return { items: [] };

  const totalCount =
    parsedData.response?.body?.totalCount ??
    parsedData.body?.totalCount ??
    parsedData.totalCount;

  if (parsedData.response?.body?.items?.item !== undefined) {
    const item = parsedData.response.body.items.item;
    return {
      items: item === null || item === '' ? [] : Array.isArray(item) ? item : [item],
      totalCount: Number(totalCount),
    };
  }

  if (parsedData.body?.items?.item !== undefined) {
    const item = parsedData.body.items.item;
    return {
      items: item === null || item === '' ? [] : Array.isArray(item) ? item : [item],
      totalCount: Number(totalCount),
    };
  }

  if (parsedData.items?.item !== undefined) {
    const item = parsedData.items.item;
    return {
      items: item === null || item === '' ? [] : Array.isArray(item) ? item : [item],
      totalCount: Number(totalCount),
    };
  }

  if (totalCount === 0 || totalCount === '0') {
    return { items: [], totalCount: 0 };
  }

  return { items: [], totalCount: totalCount !== undefined ? Number(totalCount) : undefined };
}

/**
 * Single page fetch from MOLIT API with backoff
 */
async function fetchSinglePage(
  lawdCd: string,
  dealYmd: string,
  pageNo: number,
  apiKey: string
): Promise<{ items: any[]; totalCount: number; resultCode: string }> {
  let cleanKey = apiKey.trim();
  if (cleanKey.includes('%')) {
    try {
      cleanKey = decodeURIComponent(cleanKey);
    } catch (e) {}
  }
  const encodedKey = encodeURIComponent(cleanKey);
  const url = `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?LAWD_CD=${encodeURIComponent(
    lawdCd
  )}&DEAL_YMD=${encodeURIComponent(dealYmd)}&serviceKey=${encodedKey}&pageNo=${pageNo}&numOfRows=1000&_type=json`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      const error: any = new Error('공공데이터포털 서버 응답 시간 초과 (12초)');
      error.code = 'API_TIMEOUT';
      error.httpStatus = 504;
      throw error;
    }
    const error: any = new Error(`공공데이터포털 네트워크 연결 실패: ${err.message}`);
    error.code = 'NETWORK_ERROR';
    error.httpStatus = 502;
    throw error;
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    const error: any = new Error(`공공데이터 API 서버 오류 (HTTP ${response.status})`);
    error.httpStatus = response.status;
    if (response.status === 429) error.code = 'RATE_LIMIT';
    else if (response.status === 401 || response.status === 403) error.code = 'AUTH_ERROR';
    else error.code = 'API_SERVER_ERROR';
    throw error;
  }

  const rawText = await response.text();

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
    if (String(reasonCode) === '22' || authMsg.includes('LIMITED') || authMsg.includes('EXCEED')) {
      error.code = 'RATE_LIMIT';
      error.httpStatus = 429;
    } else {
      error.code = 'AUTH_ERROR';
    }
    throw error;
  }

  let parsedPayload: any = null;
  try {
    parsedPayload = JSON.parse(rawText);
  } catch (jsonErr) {
    try {
      parsedPayload = xmlParser.parse(rawText);
    } catch (xmlErr: any) {
      const error: any = new Error('공공데이터 응답 파싱 실패');
      error.code = 'PARSE_ERROR';
      error.httpStatus = 502;
      throw error;
    }
  }

  const headerCode = parsedPayload?.response?.header?.resultCode ?? parsedPayload?.header?.resultCode;
  const headerMsg = parsedPayload?.response?.header?.resultMsg ?? parsedPayload?.header?.resultMsg;

  if (headerCode !== undefined && String(headerCode) !== '00' && String(headerCode) !== '000' && String(headerCode) !== '0') {
    const error: any = new Error(`공공데이터 API 오류 (${headerCode}): ${headerMsg || 'Unknown'}`);
    if (String(headerCode) === '22') {
      error.code = 'RATE_LIMIT';
      error.httpStatus = 429;
    } else if (String(headerCode) === '30' || String(headerCode) === '01') {
      error.code = 'AUTH_ERROR';
      error.httpStatus = 401;
    } else {
      error.code = 'API_SERVER_ERROR';
      error.httpStatus = 500;
    }
    throw error;
  }

  const { items, totalCount } = extractItems(parsedPayload);
  return {
    items,
    totalCount: totalCount !== undefined ? totalCount : items.length,
    resultCode: String(headerCode || '000'),
  };
}

/**
 * Fetch all pages for a given LAWD_CD and DEAL_YMD with retry and exponential backoff
 */
export async function fetchMolitWithPagination(
  lawdCd: string,
  dealYmd: string,
  apiKey: string,
  throttleMs: number,
  onRateLimit?: () => void,
  onNetworkError?: () => void
): Promise<{ items: any[]; totalCount: number; retries: number }> {
  let pageNo = 1;
  const allItems: any[] = [];
  let totalCount = 0;
  let retriesUsed = 0;

  while (true) {
    let success = false;
    let attempt = 0;
    const maxRetries = 3;

    while (!success && attempt <= maxRetries) {
      try {
        if (attempt > 0) {
          retriesUsed++;
          const backoff = Math.min(8000, 1000 * Math.pow(2, attempt - 1)) + Math.floor(Math.random() * 300);
          console.log(`[Backoff] ${lawdCd}_${dealYmd} p${pageNo} retry #${attempt} waiting ${backoff}ms...`);
          await new Promise((r) => setTimeout(r, backoff));
        }

        const res = await fetchSinglePage(lawdCd, dealYmd, pageNo, apiKey);
        if (pageNo === 1) {
          totalCount = res.totalCount;
        }
        allItems.push(...res.items);
        success = true;
      } catch (err: any) {
        attempt++;
        if (err.code === 'RATE_LIMIT') {
          if (onRateLimit) onRateLimit();
          console.warn(`[429 RateLimit] ${lawdCd}_${dealYmd} p${pageNo} on attempt ${attempt}`);
        } else if (err.code === 'NETWORK_ERROR' || err.code === 'API_TIMEOUT') {
          if (onNetworkError) onNetworkError();
          console.warn(`[Network/Timeout] ${lawdCd}_${dealYmd} p${pageNo} on attempt ${attempt}: ${err.message}`);
        }

        if (attempt > maxRetries || err.code === 'AUTH_ERROR') {
          throw err;
        }
      }
    }

    // Check pagination completion
    const fetchedSoFar = allItems.length;
    if (fetchedSoFar >= totalCount || totalCount <= 1000 || allItems.length === 0) {
      break;
    }

    pageNo++;
    await new Promise((r) => setTimeout(r, throttleMs));
  }

  return {
    items: allItems,
    totalCount,
    retries: retriesUsed,
  };
}

/**
 * Generate monthly list YYYYMM
 */
export function generateMonthRange(startYmd: string, endYmd: string): string[] {
  const startY = parseInt(startYmd.slice(0, 4), 10);
  const startM = parseInt(startYmd.slice(4, 6), 10);
  const endY = parseInt(endYmd.slice(0, 4), 10);
  const endM = parseInt(endYmd.slice(4, 6), 10);

  const months: string[] = [];
  let y = startY;
  let m = startM;
  while (y < endY || (y === endY && m <= endM)) {
    const mStr = m < 10 ? `0${m}` : `${m}`;
    months.push(`${y}${mStr}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return months;
}

export const LAWD_EARLIEST_REQUIRED_MONTH: Record<string, string> = {
  '11170': '200601', // 용산구 (이촌 한가람 1998)
  '11200': '201201', // 성동구 (옥수리버젠 2012)
  '11290': '200611', // 성북구 (길음 6단지 2006.11)
  '11440': '201409', // 마포구 (마포래미안푸르지오 2014.09)
  '11650': '200812', // 서초구 (반포자이 2008.12 준공)
  '11680': '200706', // 강남구 (대치아이파크 2007.06/2008.08)
  '11710': '200808', // 송파구 (잠실 트리지움/리센츠 2008.08, 잠실엘스 2008.10)
  '11740': '201909', // 강동구 (고덕그라시움 2019.09)
  '26350': '200601', // 해운대구 (센텀파크 2005.11/2006.01)
  '26500': '200601', // 수영구 (삼익비치 1979)
  '41131': '202007', // 성남 수정구 (산성역 포레스티아 2020.07)
  '41133': '202211', // 성남 중원구 (e편한세상 금빛 그랑메종 2022.11)
  '41290': '200808', // 과천시 (래미안슈르 2008.08)
};

export class HistoricalBackfillEngine {
  private db = getFirestoreDb();
  private isRunning = false;

  /**
   * Run Historical Backfill according to specifications
   */
  async run(options: BackfillOptions): Promise<BackfillProgressDoc> {
    if (this.isRunning) {
      throw new Error('Backfill is already in progress.');
    }

    const apiKey = process.env.MOLIT_API_KEY;
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('MOLIT_API_KEY environment variable is not configured.');
    }

    this.isRunning = true;
    const isCanary = options.mode === 'CANARY';
    const globalStartMonth = options.startMonth;
    const endMonth = options.endMonth || '202608';
    const throttleMs = options.throttleMs !== undefined ? options.throttleMs : 250;
    const forceRerun = Boolean(options.forceRerun);

    // 1. Determine target complexes
    const canaryIds = options.canaryComplexIds || ['banpo_xi', 'gwacheon_xi', 'yongsan_ichon_hangaram'];
    const targetComplexes = isCanary
      ? TARGET_COMPLEXES.filter((c) => canaryIds.includes(c.id))
      : TARGET_COMPLEXES;

    // 2. Extract unique LAWD_CDs (excluding obsolete ones like 11470 Mokdong)
    const uniqueLawdCds = Array.from(new Set(targetComplexes.map((c) => c.lawdCd))).sort();

    const allJobs: BackfillJob[] = [];
    for (const lawdCd of uniqueLawdCds) {
      const startMonth = globalStartMonth || (isCanary ? '202409' : (LAWD_EARLIEST_REQUIRED_MONTH[lawdCd] || '201609'));
      const months = generateMonthRange(startMonth, endMonth);
      for (const dealYmd of months) {
        allJobs.push({ lawdCd, dealYmd });
      }
    }

    console.log(`\n======================================================`);
    console.log(`🚀 [Historical Backfill Engine] Starting ${options.mode} Run`);
    console.log(`======================================================`);
    console.log(`- Mode: ${options.mode}`);
    console.log(`- Target Complexes: ${targetComplexes.length} (${targetComplexes.map((c) => c.shortName).join(', ')})`);
    console.log(`- Unique LAWD_CDs: ${uniqueLawdCds.length} (${uniqueLawdCds.join(', ')})`);
    console.log(`- Period: Per-LAWD Earliest ~ ${endMonth}`);
    console.log(`- Total Unique Jobs (LAWD_CD × Months): ${allJobs.length}`);
    console.log(`- Throttle: ${throttleMs}ms between calls`);
    console.log(`- Firestore Available: ${isFirestoreAvailable()}`);
    console.log(`======================================================\n`);

    // 3. Save Complex Metadata into Firestore
    if (this.db) {
      for (const comp of targetComplexes) {
        try {
          const compRef = doc(this.db, 'complexes', comp.id);
          await setDoc(
            compRef,
            {
              id: comp.id,
              name: comp.name,
              shortName: comp.shortName,
              region: comp.region,
              province: comp.province || '',
              city: comp.city,
              district: comp.district,
              dong: comp.dong,
              subRegion: comp.subRegion || '',
              lawdCd: comp.lawdCd,
              apiAliases: comp.apiAliases || [],
              latitude: comp.latitude,
              longitude: comp.longitude,
              builtYear: comp.builtYear,
              totalUnits: comp.totalUnits,
              featuredAreas: comp.featuredAreas || [],
              representativeArea: comp.representativeArea || 59,
              category: comp.category,
              description: comp.description || '',
              badge: comp.badge || null,
              active: true,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch (e: any) {
          console.warn(`[ComplexMeta] Failed to save metadata for ${comp.id}:`, e.message);
        }
      }
    }

    // 4. Load existing completed jobs for resumability
    const completedJobIds = new Set<string>();
    if (this.db && !forceRerun) {
      try {
        const jobsColl = collection(this.db, 'backfillJobs');
        const snap = await getDocs(jobsColl);
        snap.forEach((d) => {
          const data = d.data();
          if (data.status === 'COMPLETED') {
            completedJobIds.add(d.id);
          }
        });
        console.log(`[Resumability] Found ${completedJobIds.size} already completed jobs in Firestore.`);
      } catch (e: any) {
        console.warn('[Resumability] Failed to query existing jobs:', e.message);
      }
    }

    const progress: BackfillProgressDoc = {
      status: 'RUNNING',
      mode: options.mode,
      startMonth: globalStartMonth || 'EARLIEST_BY_LAWD',
      endMonth,
      totalJobs: allJobs.length,
      completedJobs: 0,
      failedJobs: 0,
      skippedJobs: 0,
      totalTransactionsSaved: 0,
      totalMonthlyPricesSaved: 0,
      rateLimitErrors: 0,
      networkErrors: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastCompletedJob: null,
      targetComplexCount: targetComplexes.length,
      targetComplexIds: targetComplexes.map((c) => c.id),
    };

    // Save initial progress to Firestore
    await this.persistProgress(progress);

    // 5. Execute Jobs Sequentially
    let jobIdx = 0;
    for (const job of allJobs) {
      jobIdx++;
      const jobId = `${job.lawdCd}_${job.dealYmd}`;
      const startTime = Date.now();

      // Check if job is already completed and can be skipped
      if (!forceRerun && completedJobIds.has(jobId)) {
        progress.skippedJobs++;
        progress.completedJobs++;
        progress.lastCompletedJob = jobId;
        progress.updatedAt = new Date().toISOString();
        if (jobIdx % 50 === 0 || jobIdx === allJobs.length) {
          console.log(`[Job ${jobIdx}/${allJobs.length}] Skipped (Already Completed): ${jobId}`);
          await this.persistProgress(progress);
        }
        continue;
      }

      console.log(`[Job ${jobIdx}/${allJobs.length}] Fetching ${jobId} (LAWD: ${job.lawdCd}, Month: ${job.dealYmd})...`);

      let jobResult: BackfillJobDoc = {
        lawdCd: job.lawdCd,
        dealYmd: job.dealYmd,
        status: 'RUNNING',
        fetchedRows: 0,
        matchedComplexes: [],
        savedTransactions: 0,
        savedMonthlyRecords: 0,
        durationMs: 0,
        retries: 0,
      };

      try {
        // Fetch raw district rows from MOLIT OpenAPI
        const { items: rawDistrictItems, retries } = await fetchMolitWithPagination(
          job.lawdCd,
          job.dealYmd,
          apiKey,
          throttleMs,
          () => {
            progress.rateLimitErrors++;
          },
          () => {
            progress.networkErrors++;
          }
        );

        jobResult.fetchedRows = rawDistrictItems.length;
        jobResult.retries = retries;

        // Find complexes matching this LAWD_CD
        const matchingDistrictComplexes = targetComplexes.filter((c) => c.lawdCd === job.lawdCd);
        const matchedComplexIds: string[] = [];
        let totalSavedInJob = 0;
        let totalMonthlySavedInJob = 0;

        for (const complex of matchingDistrictComplexes) {
          // Filter items matching this complex
          const complexRawItems = rawDistrictItems.filter((item) => {
            const aptName = item.aptNm || item.아파트 || '';
            const dong = item.umdNm || item.bubdong || item.법정동 || item.dong || '';
            return matchesComplexForBackfill(aptName, dong, complex);
          });

          if (complexRawItems.length > 0) {
            matchedComplexIds.push(complex.id);
            const transformed = complexRawItems.map((item, idx) =>
              transformMolitItemForBackfill(item, complex, idx)
            );

            // Consolidate Trade Records (Deterministic Fingerprint & Multiplicity Calculation)
            const consolidated = consolidateTradeRecords(transformed, complex.id);

            // Persist transactions to Firestore
            if (this.db && consolidated.length > 0) {
              const savedTxCount = await this.saveTransactionsBatch(consolidated, complex.id);
              totalSavedInJob += savedTxCount;

              // Aggregate by month strictly for 59 and 84
              const validTrades = consolidated.filter((t) => !t.isCancelled && (t.activeCount ?? 1) > 0);
              const areas: ('59' | '84')[] = ['59', '84'];

              for (const area of areas) {
                const areaTrades = validTrades.filter((t) => t.areaCategory === area);

                if (areaTrades.length > 0) {
                  const monthlyAggs = aggregateTradesByMonth(areaTrades);
                  const validMonthlyAggs = monthlyAggs.filter((m) => m.transactionCount > 0 && m.medianPrice > 0);

                  if (validMonthlyAggs.length > 0) {
                    const savedMonthly = await this.saveMonthlyPricesBatch(
                      complex.id,
                      validMonthlyAggs,
                      area
                    );
                    totalMonthlySavedInJob += savedMonthly;
                  }
                }
              }
            }
          }
        }

        jobResult.status = 'COMPLETED';
        jobResult.matchedComplexes = matchedComplexIds;
        jobResult.savedTransactions = totalSavedInJob;
        jobResult.savedMonthlyRecords = totalMonthlySavedInJob;
        jobResult.durationMs = Date.now() - startTime;
        jobResult.completedAt = new Date().toISOString();

        progress.completedJobs++;
        progress.totalTransactionsSaved += totalSavedInJob;
        progress.totalMonthlyPricesSaved += totalMonthlySavedInJob;
        progress.lastCompletedJob = jobId;
        progress.updatedAt = new Date().toISOString();

        // Record job in Firestore
        await this.persistJob(jobId, jobResult);

        console.log(
          `  -> ✅ ${jobId} Done (${jobResult.durationMs}ms): ${jobResult.fetchedRows} rows, ${matchedComplexIds.length} complexes matched (${matchedComplexIds.join(', ') || 'none'}), ${totalSavedInJob} tx saved, ${totalMonthlySavedInJob} monthly prices saved.`
        );
      } catch (err: any) {
        jobResult.status = 'FAILED';
        jobResult.error = err.message || String(err);
        jobResult.durationMs = Date.now() - startTime;
        progress.failedJobs++;
        progress.updatedAt = new Date().toISOString();

        await this.persistJob(jobId, jobResult);
        console.error(`  -> ❌ ${jobId} Failed (${jobResult.durationMs}ms): ${err.message}`);
      }

      // Update progress document every 10 jobs or at the end
      if (jobIdx % 10 === 0 || jobIdx === allJobs.length) {
        await this.persistProgress(progress);
      }

      if (options.onProgress) {
        options.onProgress(progress, jobResult);
      }

      // Inter-job throttling
      if (jobIdx < allJobs.length) {
        await new Promise((r) => setTimeout(r, throttleMs));
      }
    }

    progress.status = progress.failedJobs > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';
    progress.updatedAt = new Date().toISOString();
    await this.persistProgress(progress);

    this.isRunning = false;

    console.log(`\n======================================================`);
    console.log(`🎉 [Historical Backfill Engine] ${options.mode} Run Completed!`);
    console.log(`======================================================`);
    console.log(`- Final Status: ${progress.status}`);
    console.log(`- Total Jobs: ${progress.totalJobs}`);
    console.log(`- Completed: ${progress.completedJobs} (Skipped: ${progress.skippedJobs})`);
    console.log(`- Failed: ${progress.failedJobs}`);
    console.log(`- Total Transactions Saved: ${progress.totalTransactionsSaved}`);
    console.log(`- Total Monthly Aggs Saved: ${progress.totalMonthlyPricesSaved}`);
    console.log(`- HTTP 429 Errors: ${progress.rateLimitErrors}`);
    console.log(`- Network Errors: ${progress.networkErrors}`);
    console.log(`======================================================\n`);

    return progress;
  }

  /**
   * Batch write transactions to Firestore with retry
   */
  private async saveTransactionsBatch(records: TradeRecord[], complexId: string): Promise<number> {
    if (!this.db || records.length === 0) return 0;
    if (isMigrationLocked()) {
      console.warn(`[MIGRATION_LOCK] BackfillEngine transactions write blocked for complex '${complexId}': migration in progress.`);
      return 0;
    }
    let saved = 0;
    const BATCH_SIZE = 250;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const chunk = records.slice(i, i + BATCH_SIZE);
      let committed = false;
      let attempt = 0;

      while (!committed && attempt < 3) {
        attempt++;
        try {
          const batch = writeBatch(this.db);
          chunk.forEach((r) => {
            const docRef = doc(this.db!, 'transactions', r.id);
            const normalRowCount = r.normalRowCount !== undefined ? r.normalRowCount : r.isCancelled ? 0 : 1;
            const cancellationRowCount =
              r.cancellationRowCount !== undefined ? r.cancellationRowCount : r.isCancelled ? 1 : 0;
            const activeCount =
              r.activeCount !== undefined ? r.activeCount : Math.max(0, normalRowCount - cancellationRowCount);
            const isCancelled = activeCount === 0;

            batch.set(
              docRef,
              {
                transactionId: r.id,
                fingerprint: r.id,
                complexId,
                complexName: r.complexName,
                dealDate: r.dealDate,
                dealYear: r.dealYear,
                dealMonth: r.dealMonth,
                dealDay: r.dealDay,
                dealYmd: r.dealYmd,
                price: r.price,
                exclusiveArea: r.exclusiveArea,
                areaCategory: r.areaCategory,
                pyeong: r.pyeong,
                pricePerPyeong: r.pricePerPyeong,
                pricePerSqm: r.pricePerSqm,
                floor: r.floor,
                normalRowCount,
                cancellationRowCount,
                activeCount,
                isCancelled,
                cancelDate: r.cancelDate || ' ',
                cancelDates: r.cancelDates || [],
                registrationDate: r.registrationDate || '',
                dealType: r.dealType || '',
                isOutlier: !!r.isOutlier,
                source: 'MOLIT_APT_TRADE',
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          });

          await batch.commit();
          committed = true;
          saved += chunk.length;
        } catch (bErr: any) {
          const errMsg = String(bErr?.message || bErr).toLowerCase();
          if (errMsg.includes('quota') || errMsg.includes('resource_exhausted') || errMsg.includes('resource-exhausted')) {
            console.warn(`[Firestore Quota] Daily free write quota reached during backfill for ${complexId}.`);
            return saved + chunk.length;
          }
          console.warn(`[Firestore Batch Tx Retry #${attempt}] for ${complexId}:`, bErr.message);
          if (attempt >= 3) break;
          await new Promise((r) => setTimeout(r, 500 * attempt));
        }
      }
    }
    return saved;
  }

  /**
   * Batch write monthly aggregated prices to Firestore with retry
   */
  private async saveMonthlyPricesBatch(
    complexId: string,
    monthlyAggs: any[],
    areaCategory: AreaCategory | '114_PLUS' | 'ALL'
  ): Promise<number> {
    if (!this.db || monthlyAggs.length === 0) return 0;
    let saved = 0;
    const BATCH_SIZE = 250;

    for (let i = 0; i < monthlyAggs.length; i += BATCH_SIZE) {
      const chunk = monthlyAggs.slice(i, i + BATCH_SIZE);
      let committed = false;
      let attempt = 0;

      while (!committed && attempt < 3) {
        attempt++;
        try {
          const batch = writeBatch(this.db);
          chunk.forEach((m) => {
            const docId = `${complexId}_${m.dealYmd}_${areaCategory}`;
            const docRef = doc(this.db!, 'monthlyComplexPrices', docId);

            batch.set(
              docRef,
              {
                complexId,
                dealYmd: m.dealYmd,
                month: m.month,
                year: m.year,
                displayDate: m.displayDate,
                areaCategory,
                transactionCount: m.transactionCount,
                medianPrice: m.medianPrice,
                averagePrice: m.averagePrice,
                medianPricePerSqm: m.medianPricePerSqm,
                averagePricePerSqm: m.averagePricePerSqm,
                medianPricePerPyeong: m.medianPricePerPyeong,
                minPrice: m.minPrice,
                maxPrice: m.maxPrice,
                confidence: m.confidence,
                calculatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          });

          await batch.commit();
          committed = true;
          saved += chunk.length;
        } catch (bErr: any) {
          const errMsg = String(bErr?.message || bErr).toLowerCase();
          if (errMsg.includes('quota') || errMsg.includes('resource_exhausted') || errMsg.includes('resource-exhausted')) {
            console.warn(`[Firestore Quota] Daily free write quota reached during backfill monthly prices for ${complexId}.`);
            return saved + chunk.length;
          }
          console.warn(`[Firestore Batch Monthly Retry #${attempt}] for ${complexId}:`, bErr.message);
          if (attempt >= 3) break;
          await new Promise((r) => setTimeout(r, 500 * attempt));
        }
      }
    }
    return saved;
  }

  /**
   * Persist overall progress to settings/historicalBackfill
   */
  private async persistProgress(progress: BackfillProgressDoc): Promise<void> {
    if (!this.db) return;
    try {
      const progressRef = doc(this.db, 'settings', 'historicalBackfill');
      await setDoc(progressRef, progress, { merge: true });
    } catch (e: any) {
      console.warn('[Progress] Failed to save progress:', e.message);
    }
  }

  /**
   * Persist single job document in backfillJobs/{jobId}
   */
  private async persistJob(jobId: string, jobDoc: BackfillJobDoc): Promise<void> {
    if (!this.db) return;
    try {
      const jobRef = doc(this.db, 'backfillJobs', jobId);
      await setDoc(jobRef, jobDoc, { merge: true });
    } catch (e: any) {
      console.warn(`[JobDoc] Failed to save job ${jobId}:`, e.message);
    }
  }
}

export const backfillEngine = new HistoricalBackfillEngine();
