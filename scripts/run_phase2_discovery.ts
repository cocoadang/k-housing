import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { XMLParser } from 'fast-xml-parser';
import { TARGET_COMPLEXES } from '../src/data/complexesData';
import { HISTORICAL_COMPLEXES, DUNCHON_REDEVELOPMENT_LINEAGE } from '../src/data/redevelopmentLineages';
import { AREA_FAMILIES_REGISTRY, PENDING_COMPLEX_FAMILIES } from '../src/data/areaFamilies';
import { ComplexInfo } from '../src/types';

// ============================================================================
// Phase 2: HISTORICAL DATA DISCOVERY & COLLECTION PLANNING ENGINE
// ============================================================================

const RAW_DIR = path.join(process.cwd(), 'data', 'historical_raw');
const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

export function normalizeStr(str: string): string {
  if (!str) return '';
  return str.replace(/\s+/g, '').replace(/[()_.\-·]/g, '').toLowerCase();
}

function computeChecksum(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function getCleanApiKey(): string {
  const apiKey = process.env.MOLIT_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('MOLIT_API_KEY environment variable is required.');
  }
  let cleanKey = apiKey.trim();
  if (cleanKey.includes('%')) {
    try {
      cleanKey = decodeURIComponent(cleanKey);
    } catch (e) {}
  }
  return cleanKey;
}

export function generateMonthRange(start: string, end: string): string[] {
  const months: string[] = [];
  let y = parseInt(start.slice(0, 4), 10);
  let m = parseInt(start.slice(4, 6), 10);
  const endY = parseInt(end.slice(0, 4), 10);
  const endM = parseInt(end.slice(4, 6), 10);

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

// ============================================================================
// 1. Complex Definitions & Recommended Start/End Months
// ============================================================================

export interface ComplexCoveragePlan {
  complexId: string;
  complexName: string;
  lawdCd: string;
  dong: string;
  builtYear: number;
  type: 'CURRENT' | 'PREDECESSOR';
  recommendedStartMonth: string;
  recommendedEndMonth: string;
  status: 'COMPLETE' | 'PARTIAL' | 'NO_DATA' | 'REVIEW_REQUIRED';
}

export function getRecommendedMonths(complex: ComplexInfo, isPredecessor: boolean = false): { start: string; end: string } {
  const end = isPredecessor ? '201912' : '202608';
  let start = '200601';

  if (isPredecessor) {
    start = '200601';
  } else {
    if (!complex.builtYear || complex.builtYear <= 2006) {
      start = '200601';
    } else if (complex.builtYear <= 2010) {
      const earlyYear = Math.max(2006, complex.builtYear - 2);
      start = `${earlyYear}01`;
    } else if (complex.id === 'gangdong_olympic_park') {
      start = '202312';
    } else {
      const earlyYear = Math.max(2006, complex.builtYear - 3);
      start = `${earlyYear}01`;
    }
  }

  return { start, end };
}

// Predecessor Candidates (for investigation, not automatically added to production)
export interface PredecessorCandidate {
  successorComplexId: string;
  successorName: string;
  candidateName: string;
  builtYear?: number;
  dong: string;
  lawdCd: string;
  description: string;
}

export const PREDECESSOR_CANDIDATES: PredecessorCandidate[] = [
  {
    successorComplexId: 'gaepo_raemian_forest',
    successorName: '개포래미안포레스트',
    candidateName: '개포시영',
    builtYear: 1984,
    dong: '개포동',
    lawdCd: '11680',
    description: '개포시영아파트 (1984년 준공, 개포래미안포레스트로 재건축)',
  },
  {
    successorComplexId: 'gaepo_xi_presidence',
    successorName: '개포자이프레지던스',
    candidateName: '개포주공4단지',
    builtYear: 1982,
    dong: '개포동',
    lawdCd: '11680',
    description: '개포주공4단지 (1982년 준공, 개포자이프레지던스로 재건축)',
  },
  {
    successorComplexId: 'gaepo_raemian_blessige',
    successorName: '래미안블레스티지',
    candidateName: '개포주공2단지',
    builtYear: 1982,
    dong: '개포동',
    lawdCd: '11680',
    description: '개포주공2단지 (1982년 준공, 래미안블레스티지로 재건축)',
  },
  {
    successorComplexId: 'daechi_raemian_palace',
    successorName: '래미안대치팰리스',
    candidateName: '청실',
    builtYear: 1979,
    dong: '대치동',
    lawdCd: '11680',
    description: '대치 청실아파트 (1979년 준공, 래미안대치팰리스로 재건축)',
  },
  {
    successorComplexId: 'daechi_ipark',
    successorName: '대치아이파크',
    candidateName: '도곡주공2차',
    builtYear: 1985,
    dong: '대치동',
    lawdCd: '11680',
    description: '도곡주공2차아파트 (대치아이파크로 재건축)',
  },
  {
    successorComplexId: 'gwacheon_wieverfield',
    successorName: '과천위버필드',
    candidateName: '과천주공2단지',
    builtYear: 1981,
    dong: '원문동',
    lawdCd: '41290',
    description: '과천주공2단지 (과천위버필드로 재건축)',
  },
  {
    successorComplexId: 'gwacheon_xi',
    successorName: '과천자이',
    candidateName: '과천주공6단지',
    builtYear: 1983,
    dong: '별양동',
    lawdCd: '41290',
    description: '과천주공6단지 (과천자이로 재건축)',
  },
  {
    successorComplexId: 'gwacheon_raemian_sur',
    successorName: '래미안슈르',
    candidateName: '과천주공3단지',
    builtYear: 1982,
    dong: '원문동',
    lawdCd: '41290',
    description: '과천주공3단지 (래미안슈르로 재건축)',
  },
  {
    successorComplexId: 'jamsil_els',
    successorName: '잠실엘스',
    candidateName: '잠실주공1단지',
    builtYear: 1975,
    dong: '잠실동',
    lawdCd: '11710',
    description: '잠실주공1단지 (잠실엘스로 재건축)',
  },
  {
    successorComplexId: 'jamsil_ricenz',
    successorName: '리센츠',
    candidateName: '잠실주공2단지',
    builtYear: 1976,
    dong: '잠실동',
    lawdCd: '11710',
    description: '잠실주공2단지 (리센츠로 재건축)',
  },
  {
    successorComplexId: 'jamsil_trizium',
    successorName: '트리지움',
    candidateName: '잠실주공3단지',
    builtYear: 1976,
    dong: '잠실동',
    lawdCd: '11710',
    description: '잠실주공3단지 (트리지움으로 재건축)',
  },
  {
    successorComplexId: 'gangdong_gracium',
    successorName: '고덕그라시움',
    candidateName: '고덕주공2단지',
    builtYear: 1983,
    dong: '고덕동',
    lawdCd: '11740',
    description: '고덕주공2단지 (고덕그라시움으로 재건축)',
  },
  {
    successorComplexId: 'gangdong_arteon',
    successorName: '고덕아르테온',
    candidateName: '고덕주공3단지',
    builtYear: 1983,
    dong: '상일동',
    lawdCd: '11740',
    description: '고덕주공3단지 (고덕아르테온으로 재건축)',
  },
  {
    successorComplexId: 'banpo_acro',
    successorName: '아크로리버파크',
    candidateName: '신반포1차',
    builtYear: 1977,
    dong: '반포동',
    lawdCd: '11650',
    description: '신반포1차아파트 (아크로리버파크로 재건축)',
  },
  {
    successorComplexId: 'banpo_xi',
    successorName: '반포자이',
    candidateName: '반포주공3단지',
    builtYear: 1978,
    dong: '반포동',
    lawdCd: '11650',
    description: '반포주공3단지 (반포자이로 재건축)',
  },
  {
    successorComplexId: 'banpo_raemian',
    successorName: '래미안퍼스티지',
    candidateName: '반포주공2단지',
    builtYear: 1977,
    dong: '반포동',
    lawdCd: '11650',
    description: '반포주공2단지 (래미안퍼스티지로 재건축)',
  },
];

// ============================================================================
// 2. MOLIT API Fetcher with Multi-Page Handling & Rate Limiting
// ============================================================================

export interface MolitRawItem {
  aptNm?: string;
  aptSeq?: string;
  bonbun?: string;
  bubun?: string;
  buildYear?: number | string;
  buyerGbn?: string;
  slerGbn?: string;
  cdealDay?: string;
  cdealType?: string;
  dealAmount?: string;
  dealDay?: number | string;
  dealMonth?: number | string;
  dealYear?: number | string;
  dealingGbn?: string;
  estateAgentSggNm?: string;
  excluUseAr?: number | string;
  floor?: number | string;
  jibun?: string;
  landLeaseholdGbn?: string;
  rgstDate?: string;
  sggCd?: string;
  umdNm?: string;
  [key: string]: any;
}

export interface RawFilePayload {
  metadata: {
    lawdCd: string;
    dealYmd: string;
    totalCount: number;
    fetchedRows: number;
    pages: number;
    collectedAt: string;
    source: 'MOLIT_APT_TRADE';
    checksum: string;
  };
  items: MolitRawItem[];
}

async function fetchMolitSinglePage(
  lawdCd: string,
  dealYmd: string,
  pageNo: number,
  apiKey: string
): Promise<{ items: MolitRawItem[]; totalCount: number }> {
  const encodedKey = encodeURIComponent(apiKey);
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
    throw new Error(`MOLIT network error: ${err.message}`);
  }
  clearTimeout(timeoutId);

  if (response.status === 429) {
    throw new Error('MOLIT HTTP 429');
  }

  if (!response.ok) {
    throw new Error(`MOLIT HTTP error ${response.status}`);
  }

  const rawText = await response.text();
  let parsedPayload: any = null;

  try {
    parsedPayload = JSON.parse(rawText);
  } catch {
    try {
      parsedPayload = xmlParser.parse(rawText);
    } catch {
      throw new Error('Failed to parse MOLIT response (neither JSON nor XML)');
    }
  }

  // Header validation
  const headerCode = parsedPayload?.response?.header?.resultCode ?? parsedPayload?.header?.resultCode ?? parsedPayload?.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnReasonCode;
  if (headerCode !== undefined && String(headerCode) !== '00' && String(headerCode) !== '000' && String(headerCode) !== '0') {
    const headerMsg = parsedPayload?.response?.header?.resultMsg ?? parsedPayload?.header?.resultMsg ?? parsedPayload?.OpenAPI_ServiceResponse?.cmmMsgHeader?.errMsg;
    if (String(headerCode) === '23' || String(headerMsg).includes('제한')) {
      throw new Error('MOLIT HTTP 429');
    }
    throw new Error(`MOLIT API Error (${headerCode}): ${headerMsg}`);
  }

  // Body extraction
  const body = parsedPayload?.response?.body || parsedPayload?.body;
  const totalCount = parseInt(body?.totalCount || '0', 10);
  const itemsContainer = body?.items?.item;

  let items: MolitRawItem[] = [];
  if (itemsContainer) {
    items = Array.isArray(itemsContainer) ? itemsContainer : [itemsContainer];
  }

  return { items, totalCount };
}

export async function fetchMolitMonthFull(
  lawdCd: string,
  dealYmd: string,
  apiKey: string
): Promise<RawFilePayload> {
  let pageNo = 1;
  const allItems: MolitRawItem[] = [];
  let totalCount = 0;

  while (true) {
    let success = false;
    let attempt = 0;
    while (!success && attempt < 5) {
      try {
        if (attempt > 0) {
          // Exponential backoff
          await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
        }
        const res = await fetchMolitSinglePage(lawdCd, dealYmd, pageNo, apiKey);
        if (pageNo === 1) totalCount = res.totalCount;
        allItems.push(...res.items);
        success = true;
      } catch (err: any) {
        attempt++;
        if (err.message.includes('429')) {
          // Wait 3 seconds on rate limit
          await new Promise((r) => setTimeout(r, 3000));
        }
        if (attempt >= 5) throw err;
      }
    }

    if (allItems.length >= totalCount || allItems.length === 0) {
      break;
    }
    pageNo++;
    await new Promise((r) => setTimeout(r, 150));
  }

  const itemsJson = JSON.stringify(allItems);
  const checksum = computeChecksum(itemsJson);

  return {
    metadata: {
      lawdCd,
      dealYmd,
      totalCount,
      fetchedRows: allItems.length,
      pages: pageNo,
      collectedAt: new Date().toISOString(),
      source: 'MOLIT_APT_TRADE',
      checksum,
    },
    items: allItems,
  };
}

// ============================================================================
// 3. Matcher & Collision Protection
// ============================================================================

export type MatchResultType = 'MATCHED_CURRENT' | 'MATCHED_PREDECESSOR' | 'UNMATCHED' | 'AMBIGUOUS';

export interface MatchResult {
  type: MatchResultType;
  complexId?: string;
  complexName?: string;
  matchedAlias?: string;
  isPredecessorCandidate?: boolean;
  predecessorCandidateInfo?: PredecessorCandidate;
  candidateSuccessorId?: string;
}

export function matchTradeRecord(item: MolitRawItem, lawdCd: string): MatchResult {
  const rawApt = String(item.aptNm || '').trim();
  const rawDong = String(item.umdNm || item.dong || '').trim();
  const normApt = normalizeStr(rawApt);
  const normDong = normalizeStr(rawDong);

  if (!rawApt) return { type: 'UNMATCHED' };

  // 1. Check Historical Predecessors explicitly registered (Dunchon Jugong 1~4)
  for (const hist of HISTORICAL_COMPLEXES) {
    if (hist.lawdCd === lawdCd) {
      if (hist.dong && normDong && !normDong.includes(normalizeStr(hist.dong)) && !normalizeStr(hist.dong).includes(normDong)) {
        continue;
      }
      for (const alias of hist.apiAliases || [hist.name]) {
        const normAlias = normalizeStr(alias);
        if (normApt === normAlias || normApt === `${normAlias}아파트` || normApt === normAlias.replace(/단지/g, '')) {
          return {
            type: 'MATCHED_PREDECESSOR',
            complexId: hist.id,
            complexName: hist.name,
            matchedAlias: alias,
          };
        }
      }
    }
  }

  // 2. Predecessor Candidates Check (e.g. 개포시영, 개포주공4, 과천주공2, etc.)
  for (const pred of PREDECESSOR_CANDIDATES) {
    if (pred.lawdCd === lawdCd) {
      if (pred.dong && normDong && !normDong.includes(normalizeStr(pred.dong)) && !normalizeStr(pred.dong).includes(normDong)) {
        continue;
      }
      const normCand = normalizeStr(pred.candidateName);
      if (normApt === normCand || normApt === `${normCand}아파트` || normApt.includes(normCand)) {
        return {
          type: 'UNMATCHED',
          isPredecessorCandidate: true,
          predecessorCandidateInfo: pred,
          candidateSuccessorId: pred.successorComplexId,
        };
      }
    }
  }

  // 3. Current Target Complexes Match
  const matchedCurrents: { complex: ComplexInfo; alias: string }[] = [];

  for (const comp of TARGET_COMPLEXES) {
    if (comp.lawdCd !== lawdCd) continue;

    // Dong validation
    if (comp.dong && normDong) {
      const normCompDong = normalizeStr(comp.dong);
      if (!normDong.includes(normCompDong) && !normCompDong.includes(normDong)) {
        continue;
      }
    }

    // Strict Name / Alias matching (NO reverse substrings!)
    const cleanCompName = normalizeStr(comp.name.replace(/\([^)]*\)/g, ''));
    const cleanCompApt = cleanCompName.replace(/아파트/g, '');

    // Check exact name
    if (normApt === cleanCompName || normApt === `${cleanCompName}아파트` || normApt === cleanCompApt) {
      matchedCurrents.push({ complex: comp, alias: comp.name });
      continue;
    }

    // Check specific registered approved aliases
    let aliasMatched = false;
    for (const alias of comp.apiAliases || []) {
      const isPredecessorName =
        PREDECESSOR_CANDIDATES.some((p) => normalizeStr(p.candidateName) === normalizeStr(alias)) ||
        ['신반포1차', '반포주공2단지', '반포주공3단지', '과천주공2단지', '과천주공6단지', '과천주공3단지', '고덕주공2단지', '고덕주공3단지', '둔촌주공'].includes(
          alias
        );

      if (isPredecessorName) {
        continue;
      }

      const normAlias = normalizeStr(alias);
      const cleanAlias = normAlias.replace(/아파트/g, '');
      if (normApt === normAlias || normApt === `${normAlias}아파트` || normApt === cleanAlias) {
        matchedCurrents.push({ complex: comp, alias });
        aliasMatched = true;
        break;
      }

      if (cleanAlias.length >= 5 && (normApt.startsWith(cleanAlias) || normApt.includes(cleanAlias))) {
        matchedCurrents.push({ complex: comp, alias });
        aliasMatched = true;
        break;
      }
    }
  }

  if (matchedCurrents.length === 1) {
    return {
      type: 'MATCHED_CURRENT',
      complexId: matchedCurrents[0].complex.id,
      complexName: matchedCurrents[0].complex.name,
      matchedAlias: matchedCurrents[0].alias,
    };
  } else if (matchedCurrents.length > 1) {
    return {
      type: 'AMBIGUOUS',
      complexName: rawApt,
    };
  }

  return { type: 'UNMATCHED' };
}

// ============================================================================
// 4. Main Phase 2 Execution Orchestrator
// ============================================================================

export async function runPhase2Discovery() {
  console.log('================================================================');
  console.log('PHASE 2: HISTORICAL DATA DISCOVERY & COLLECTION PLANNING');
  console.log('================================================================');

  const apiKey = getCleanApiKey();
  fs.mkdirSync(RAW_DIR, { recursive: true });

  // 1. Build Coverage Plan for 31 Current Complexes
  console.log('\n[1. TARGET COMPLEXES & PREDECESSORS UNIVERSE]');
  const complexPlans: ComplexCoveragePlan[] = [];

  for (const comp of TARGET_COMPLEXES) {
    const { start, end } = getRecommendedMonths(comp, false);
    complexPlans.push({
      complexId: comp.id,
      complexName: comp.name,
      lawdCd: comp.lawdCd,
      dong: comp.dong,
      builtYear: comp.builtYear,
      type: 'CURRENT',
      recommendedStartMonth: start,
      recommendedEndMonth: end,
      status: 'COMPLETE',
    });
  }

  // Predecessors (Dunchon Jugong 1~4)
  for (const hist of HISTORICAL_COMPLEXES) {
    const { start, end } = getRecommendedMonths(hist, true);
    complexPlans.push({
      complexId: hist.id,
      complexName: hist.name,
      lawdCd: hist.lawdCd,
      dong: hist.dong,
      builtYear: hist.builtYear,
      type: 'PREDECESSOR',
      recommendedStartMonth: start,
      recommendedEndMonth: end,
      status: 'COMPLETE',
    });
  }

  console.log(`Configured ${TARGET_COMPLEXES.length} current complexes + ${HISTORICAL_COMPLEXES.length} historical predecessors.`);

  // 2. Build MOLIT Collection Universe (LAWD_CD × DEAL_YMD deduplicated)
  console.log('\n[2. COLLECTION UNIVERSE (DEDUPLICATED LAWD_CD × DEAL_YMD)]');
  const lawdMonthUniverse = new Map<string, Set<string>>();

  for (const plan of complexPlans) {
    if (!lawdMonthUniverse.has(plan.lawdCd)) {
      lawdMonthUniverse.set(plan.lawdCd, new Set());
    }
    const months = generateMonthRange(plan.recommendedStartMonth, plan.recommendedEndMonth);
    for (const m of months) {
      lawdMonthUniverse.get(plan.lawdCd)!.add(m);
    }
  }

  interface UniverseItem {
    lawdCd: string;
    dealYmd: string;
    classification: 'REUSABLE_EXISTING' | 'RECOLLECT_REQUIRED' | 'NEW_COLLECTION' | 'OUTSIDE_REQUIRED_RANGE' | 'UNKNOWN_REVIEW';
  }

  const allUniverseItems: UniverseItem[] = [];

  const fsSnapPath = path.join(process.cwd(), 'data', 'firestore_snapshot.json');
  let fsSnap: any[] = [];
  if (fs.existsSync(fsSnapPath)) {
    fsSnap = JSON.parse(fs.readFileSync(fsSnapPath, 'utf8'));
  }

  const snapLawdMonths = new Set<string>();
  for (const t of fsSnap) {
    const comp = TARGET_COMPLEXES.find((c) => c.id === t.complexId) || HISTORICAL_COMPLEXES.find((h) => h.id === t.complexId);
    if (comp) {
      const ym = t.dealYmd || (t.dealDate ? t.dealDate.replace(/-/g, '').slice(0, 6) : '');
      if (ym) snapLawdMonths.add(`${comp.lawdCd}_${ym}`);
    }
  }

  for (const [lawd, monthsSet] of lawdMonthUniverse.entries()) {
    const sortedMonths = Array.from(monthsSet).sort();
    for (const ym of sortedMonths) {
      const key = `${lawd}_${ym}`;
      const localFile = path.join(RAW_DIR, lawd, `${ym}.json`);

      let classification: UniverseItem['classification'] = 'NEW_COLLECTION';

      if (fs.existsSync(localFile)) {
        try {
          const content = JSON.parse(fs.readFileSync(localFile, 'utf8'));
          if (content.metadata && content.metadata.fetchedRows >= content.metadata.totalCount) {
            classification = 'REUSABLE_EXISTING';
          } else {
            classification = 'RECOLLECT_REQUIRED';
          }
        } catch {
          classification = 'RECOLLECT_REQUIRED';
        }
      } else if (snapLawdMonths.has(key)) {
        classification = 'RECOLLECT_REQUIRED';
      } else {
        classification = 'NEW_COLLECTION';
      }

      allUniverseItems.push({ lawdCd: lawd, dealYmd: ym, classification });
    }
  }

  const reusableCount = allUniverseItems.filter((u) => u.classification === 'REUSABLE_EXISTING').length;
  const recollectCount = allUniverseItems.filter((u) => u.classification === 'RECOLLECT_REQUIRED').length;
  const newCount = allUniverseItems.filter((u) => u.classification === 'NEW_COLLECTION').length;

  console.log(`Total Universe Unique LAWD/Months: ${allUniverseItems.length}`);
  console.log(` - REUSABLE_EXISTING: ${reusableCount}`);
  console.log(` - RECOLLECT_REQUIRED: ${recollectCount}`);
  console.log(` - NEW_COLLECTION: ${newCount}`);

  // 3. API Collection: Polite fetching with concurrency 2 and 150ms delay
  console.log('\n[3. MOLIT API RAW DATA COLLECTION]');
  const itemsToFetch = allUniverseItems.filter((u) => u.classification !== 'REUSABLE_EXISTING');
  console.log(`Remaining items to fetch: ${itemsToFetch.length} LAWD/months`);

  let apiRequests = 0;
  let paginationRequests = 0;
  let successfulRequests = 0;
  let failedRequests = 0;

  const CONCURRENCY = 2;
  for (let i = 0; i < itemsToFetch.length; i += CONCURRENCY) {
    const chunk = itemsToFetch.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (task) => {
        const lawdDir = path.join(RAW_DIR, task.lawdCd);
        fs.mkdirSync(lawdDir, { recursive: true });
        const filePath = path.join(lawdDir, `${task.dealYmd}.json`);

        try {
          apiRequests++;
          const result = await fetchMolitMonthFull(task.lawdCd, task.dealYmd, apiKey);
          if (result.metadata.pages > 1) {
            paginationRequests += result.metadata.pages - 1;
            apiRequests += result.metadata.pages - 1;
          }
          successfulRequests++;
          fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf8');
        } catch (err: any) {
          failedRequests++;
          console.error(`[Error] Fetch failed for ${task.lawdCd} ${task.dealYmd}:`, err.message);
        }
      })
    );

    // Polite throttle between batches: 150ms
    await new Promise((r) => setTimeout(r, 150));

    if ((i + CONCURRENCY) % 100 === 0 || i + CONCURRENCY >= itemsToFetch.length) {
      console.log(
        `Progress: ${Math.min(i + CONCURRENCY, itemsToFetch.length)} / ${itemsToFetch.length} (${Math.round(
          (Math.min(i + CONCURRENCY, itemsToFetch.length) / itemsToFetch.length) * 100
        )}%)`
      );
    }
  }

  console.log('\n[API Call Report]');
  console.log(` - Total Unique LAWD/Months in Universe: ${allUniverseItems.length}`);
  console.log(` - Actual API Requests (including pagination): ${apiRequests}`);
  console.log(` - Pagination Additional Requests: ${paginationRequests}`);
  console.log(` - Successful Requests: ${successfulRequests}`);
  console.log(` - Failed Requests: ${failedRequests}`);

  // 4. Raw Dataset Loading & Matcher Dry Run
  console.log('\n[4. CURRENT MATCHER DRY RUN & COLLISION AUDIT]');
  let totalRawRows = 0;
  let matchedCurrentCount = 0;
  let matchedPredecessorCount = 0;
  let unmatchedCount = 0;
  let ambiguousCount = 0;
  let predecessorLeakageCount = 0; // gangdong_olympic_park contamination count

  interface ComplexRawMatchedItem {
    item: MolitRawItem;
    lawdCd: string;
    dealYmd: string;
    match: MatchResult;
  }

  const complexMatchedTrades = new Map<string, ComplexRawMatchedItem[]>();
  for (const c of TARGET_COMPLEXES) complexMatchedTrades.set(c.id, []);
  for (const h of HISTORICAL_COMPLEXES) complexMatchedTrades.set(h.id, []);

  const predecessorCandidateObservations = new Map<string, { candidate: PredecessorCandidate; trades: MolitRawItem[] }>();

  // Process all raw files
  for (const item of allUniverseItems) {
    const filePath = path.join(RAW_DIR, item.lawdCd, `${item.dealYmd}.json`);
    if (!fs.existsSync(filePath)) continue;

    const rawFile: RawFilePayload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const rawItem of rawFile.items) {
      totalRawRows++;
      const match = matchTradeRecord(rawItem, item.lawdCd);

      if (match.type === 'MATCHED_CURRENT') {
        matchedCurrentCount++;
        complexMatchedTrades.get(match.complexId!)?.push({
          item: rawItem,
          lawdCd: item.lawdCd,
          dealYmd: item.dealYmd,
          match,
        });

        // Leakage test for gangdong_olympic_park
        if (match.complexId === 'gangdong_olympic_park') {
          const aptNorm = normalizeStr(rawItem.aptNm || '');
          if (aptNorm.includes('둔촌주공') || aptNorm.includes('둔촌1') || aptNorm.includes('둔촌2') || aptNorm.includes('둔촌3') || aptNorm.includes('둔촌4')) {
            predecessorLeakageCount++;
          }
        }
      } else if (match.type === 'MATCHED_PREDECESSOR') {
        matchedPredecessorCount++;
        complexMatchedTrades.get(match.complexId!)?.push({
          item: rawItem,
          lawdCd: item.lawdCd,
          dealYmd: item.dealYmd,
          match,
        });
      } else if (match.type === 'AMBIGUOUS') {
        ambiguousCount++;
      } else {
        unmatchedCount++;
        if (match.isPredecessorCandidate && match.predecessorCandidateInfo) {
          const candKey = `${match.candidateSuccessorId}_${match.predecessorCandidateInfo.candidateName}`;
          if (!predecessorCandidateObservations.has(candKey)) {
            predecessorCandidateObservations.set(candKey, { candidate: match.predecessorCandidateInfo, trades: [] });
          }
          predecessorCandidateObservations.get(candKey)!.trades.push(rawItem);
        }
      }
    }
  }

  console.log(`Total Raw Rows Loaded: ${totalRawRows}`);
  console.log(` - MATCHED_CURRENT: ${matchedCurrentCount}`);
  console.log(` - MATCHED_PREDECESSOR: ${matchedPredecessorCount}`);
  console.log(` - UNMATCHED: ${unmatchedCount}`);
  console.log(` - AMBIGUOUS: ${ambiguousCount}`);
  console.log(` - PREDECESSOR_LEAKAGE (둔촌주공 -> 올림픽파크포레온): ${predecessorLeakageCount}`);

  // 5. Area Discovery & Cancellation Grouping per Complex
  console.log('\n[5. AREA DISCOVERY & CANCELLATION ANALYSIS]');

  interface AreaDiscoveryRecord {
    complexId: string;
    complexName: string;
    totalTrades: number;
    activeTrades: number;
    cancelledTrades: number;
    partiallyCancelledTrades: number;
    earliestDealMonth: string;
    latestDealMonth: string;
    distinctAreas: {
      exclusiveArea: number;
      tradeCount: number;
      activeCount: number;
      cancelledCount: number;
      earliestMonth: string;
      latestMonth: string;
      isRareArea: boolean;
    }[];
  }

  const areaDiscoveryResults: AreaDiscoveryRecord[] = [];
  const fourCasesVerification: any[] = [];

  for (const [compId, matchedRows] of complexMatchedTrades.entries()) {
    const comp = TARGET_COMPLEXES.find((c) => c.id === compId) || HISTORICAL_COMPLEXES.find((h) => h.id === compId);
    if (!comp) continue;

    interface GroupedDeal {
      fingerprint: string;
      normalRows: MolitRawItem[];
      cancelRows: MolitRawItem[];
      activeCount: number;
      isCancelled: boolean;
      isPartiallyCancelled: boolean;
    }

    const groupMap = new Map<string, GroupedDeal>();
    for (const r of matchedRows) {
      const it = r.item;
      const rawPrice = parseInt(String(it.dealAmount || '0').replace(/,/g, ''), 10);
      const rawArea = parseFloat(String(it.excluUseAr || '0'));
      const dYear = parseInt(String(it.dealYear || '0'), 10);
      const dMonth = parseInt(String(it.dealMonth || '0'), 10);
      const dDay = parseInt(String(it.dealDay || '0'), 10);
      const floor = parseInt(String(it.floor || '1'), 10);

      const mStr = dMonth < 10 ? `0${dMonth}` : `${dMonth}`;
      const dStr = dDay < 10 ? `0${dDay}` : `${dDay}`;
      const areaInt = Math.round(rawArea * 100);
      const fp = `${compId}_${dYear}${mStr}_d${dDay}_f${floor}_p${rawPrice}_a${areaInt}`;

      if (!groupMap.has(fp)) {
        groupMap.set(fp, {
          fingerprint: fp,
          normalRows: [],
          cancelRows: [],
          activeCount: 0,
          isCancelled: false,
          isPartiallyCancelled: false,
        });
      }

      const grp = groupMap.get(fp)!;
      const isCancel = it.cdealType === 'O' || it.cdealType === '0';
      if (isCancel) {
        grp.cancelRows.push(it);
      } else {
        grp.normalRows.push(it);
      }
    }

    let activeTrades = 0;
    let cancelledTrades = 0;
    let partiallyCancelledTrades = 0;

    for (const grp of groupMap.values()) {
      const normalCount = grp.normalRows.length;
      const cancelCount = grp.cancelRows.length;
      grp.activeCount = Math.max(0, normalCount - cancelCount);

      if (grp.activeCount === 0) {
        grp.isCancelled = true;
        cancelledTrades += normalCount;
      } else if (normalCount > cancelCount && cancelCount > 0) {
        grp.isPartiallyCancelled = true;
        partiallyCancelledTrades += cancelCount;
        activeTrades += grp.activeCount;
      } else {
        activeTrades += grp.activeCount;
      }

      if (
        (compId === 'banpo_raemian' && grp.fingerprint.includes('202409_d6_f4_p706000_a19822')) ||
        (compId === 'mapo_raemian_prugio' && grp.fingerprint.includes('202407_d30_f14_p229500_a11428')) ||
        (compId === 'mapo_raemian_prugio' && grp.fingerprint.includes('202503_d15_f10_p209000_a8489')) ||
        (compId === 'mapo_raemian_prugio' && grp.fingerprint.includes('202504_d7_f14_p170000_a5992'))
      ) {
        fourCasesVerification.push({
          fingerprint: grp.fingerprint,
          complexId: compId,
          normalRowCount: normalCount,
          cancellationRowCount: cancelCount,
          activeCount: grp.activeCount,
          isPartiallyCancelled: grp.isPartiallyCancelled,
          result: normalCount > cancelCount && cancelCount > 0 ? 'CONFIRMED_PARTIAL_CANCEL' : 'REVIEW_REQUIRED',
        });
      }
    }

    const areaStatsMap = new Map<number, { total: number; active: number; cancel: number; minM: string; maxM: string }>();
    let earliestM = '999999';
    let latestM = '000000';

    for (const r of matchedRows) {
      const it = r.item;
      const area = Math.round(parseFloat(String(it.excluUseAr || '0')) * 100) / 100;
      if (area <= 0) continue;

      const ym = r.dealYmd;
      if (ym < earliestM) earliestM = ym;
      if (ym > latestM) latestM = ym;

      if (!areaStatsMap.has(area)) {
        areaStatsMap.set(area, { total: 0, active: 0, cancel: 0, minM: ym, maxM: ym });
      }
      const st = areaStatsMap.get(area)!;
      st.total++;
      if (it.cdealType === 'O' || it.cdealType === '0') {
        st.cancel++;
      } else {
        st.active++;
      }
      if (ym < st.minM) st.minM = ym;
      if (ym > st.maxM) st.maxM = ym;
    }

    const distinctAreas = Array.from(areaStatsMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([ar, st]) => ({
        exclusiveArea: ar,
        tradeCount: st.total,
        activeCount: st.active,
        cancelledCount: st.cancel,
        earliestMonth: st.minM,
        latestMonth: st.maxM,
        isRareArea: st.total <= 2,
      }));

    areaDiscoveryResults.push({
      complexId: compId,
      complexName: comp.name,
      totalTrades: matchedRows.length,
      activeTrades,
      cancelledTrades,
      partiallyCancelledTrades,
      earliestDealMonth: matchedRows.length > 0 ? earliestM : 'NONE',
      latestDealMonth: matchedRows.length > 0 ? latestM : 'NONE',
      distinctAreas,
    });
  }

  // 6. AreaFamily Candidate Discovery & Clustering
  console.log('\n[6. AREA FAMILY CANDIDATE DISCOVERY & CLUSTERING]');

  interface ComplexFamilyCandidates {
    complexId: string;
    complexName: string;
    registeredFamilies: { id: string; name: string; standardCategory: string; representativeArea: number }[];
    candidateFamilies: {
      candidateId: string;
      candidateName: string;
      representativeArea: number;
      observedAreas: number[];
      totalTrades: number;
      earliestMonth: string;
      latestMonth: string;
      standardCategorySuggestion: '59' | '84' | 'OTHER';
      recommendation: 'HIGH_CONFIDENCE_CANDIDATE' | 'REVIEW';
    }[];
    unmappedAreas: { exclusiveArea: number; tradeCount: number; isRare: boolean }[];
  }

  const areaFamilyCandidatesReport: ComplexFamilyCandidates[] = [];

  for (const disc of areaDiscoveryResults) {
    const existingFamilies = AREA_FAMILIES_REGISTRY[disc.complexId] || [];
    const registered = existingFamilies.map((f) => ({
      id: f.id,
      name: f.label || (f as any).name || f.id,
      standardCategory: f.standardCategory,
      representativeArea: f.representativeExclusiveArea,
    }));

    const unmappedList: { exclusiveArea: number; tradeCount: number; isRare: boolean }[] = [];
    for (const ar of disc.distinctAreas) {
      const isCovered = existingFamilies.some((f) => {
        if (f.exactAreas && f.exactAreas.length > 0) {
          return f.exactAreas.some((ea) => Math.abs(ea - ar.exclusiveArea) < 0.05);
        }
        if (f.minExclusiveArea !== undefined && f.maxExclusiveArea !== undefined) {
          return ar.exclusiveArea >= f.minExclusiveArea && ar.exclusiveArea <= f.maxExclusiveArea;
        }
        return Math.abs(f.representativeExclusiveArea - ar.exclusiveArea) < 0.1;
      });

      if (!isCovered) {
        unmappedList.push({
          exclusiveArea: ar.exclusiveArea,
          tradeCount: ar.tradeCount,
          isRare: ar.isRareArea,
        });
      }
    }

    const candidateFamilies: ComplexFamilyCandidates['candidateFamilies'] = [];
    const sortedUnmapped = [...unmappedList].sort((a, b) => a.exclusiveArea - b.exclusiveArea);
    const visited = new Set<number>();

    for (let i = 0; i < sortedUnmapped.length; i++) {
      const item = sortedUnmapped[i];
      if (visited.has(item.exclusiveArea)) continue;

      const cluster: typeof sortedUnmapped = [item];
      visited.add(item.exclusiveArea);

      for (let j = i + 1; j < sortedUnmapped.length; j++) {
        const nextItem = sortedUnmapped[j];
        if (visited.has(nextItem.exclusiveArea)) continue;
        if (nextItem.exclusiveArea - item.exclusiveArea <= 0.8) {
          cluster.push(nextItem);
          visited.add(nextItem.exclusiveArea);
        }
      }

      const totalClusterTrades = cluster.reduce((sum, c) => sum + c.tradeCount, 0);
      const repArea = Math.round((cluster.reduce((sum, c) => sum + c.exclusiveArea * c.tradeCount, 0) / totalClusterTrades) * 100) / 100;
      const py = Math.round(((repArea / 3.305785) * 1.3) * 10) / 10;

      let stdCat: '59' | '84' | 'OTHER' = 'OTHER';
      if (repArea >= 58.0 && repArea <= 61.5) stdCat = '59';
      else if (repArea >= 83.0 && repArea <= 86.0) stdCat = '84';

      const candidateId = `${disc.complexId}_cand_${Math.round(repArea)}`;
      const pyeongStr = Math.round(py);

      candidateFamilies.push({
        candidateId,
        candidateName: `${pyeongStr}평형 (${repArea}㎡)`,
        representativeArea: repArea,
        observedAreas: cluster.map((c) => c.exclusiveArea),
        totalTrades: totalClusterTrades,
        earliestMonth: disc.earliestDealMonth,
        latestMonth: disc.latestDealMonth,
        standardCategorySuggestion: stdCat,
        recommendation: totalClusterTrades >= 5 ? 'HIGH_CONFIDENCE_CANDIDATE' : 'REVIEW',
      });
    }

    areaFamilyCandidatesReport.push({
      complexId: disc.complexId,
      complexName: disc.complexName,
      registeredFamilies: registered,
      candidateFamilies,
      unmappedAreas: unmappedList,
    });
  }

  // 7. Predecessor Discovery: Dunchon Jugong 1~4 Analysis
  console.log('\n[7. PREDECESSOR DISCOVERY & PRICE DIFFERENCE CHECK (둔촌주공 1~4)]');
  const dunchonStats: any[] = [];
  const dunchonComplexes = ['dunchon_jugong_1', 'dunchon_jugong_2', 'dunchon_jugong_3', 'dunchon_jugong_4'];

  for (const dId of dunchonComplexes) {
    const matched = complexMatchedTrades.get(dId) || [];
    const prices: number[] = [];
    const pricesPerSqm: number[] = [];
    const areaCounts = new Map<number, number>();

    let minYM = '999999';
    let maxYM = '000000';

    for (const r of matched) {
      const it = r.item;
      const p = parseInt(String(it.dealAmount || '0').replace(/,/g, ''), 10);
      const a = parseFloat(String(it.excluUseAr || '0'));
      const ym = r.dealYmd;
      if (p > 0) prices.push(p);
      if (p > 0 && a > 0) pricesPerSqm.push(Math.round((p / a) * 10) / 10);
      if (a > 0) {
        const roundedA = Math.round(a * 100) / 100;
        areaCounts.set(roundedA, (areaCounts.get(roundedA) || 0) + 1);
      }
      if (ym < minYM) minYM = ym;
      if (ym > maxYM) maxYM = ym;
    }

    prices.sort((a, b) => a - b);
    pricesPerSqm.sort((a, b) => a - b);
    const medianPrice = prices.length > 0 ? prices[Math.floor(prices.length / 2)] : 0;
    const medianPricePerSqm = pricesPerSqm.length > 0 ? pricesPerSqm[Math.floor(pricesPerSqm.length / 2)] : 0;

    dunchonStats.push({
      complexId: dId,
      name: HISTORICAL_COMPLEXES.find((h) => h.id === dId)?.name,
      totalTrades: matched.length,
      medianPrice,
      medianPricePerSqm,
      earliestTrade: matched.length > 0 ? minYM : 'NONE',
      latestTrade: matched.length > 0 ? maxYM : 'NONE',
      distinctAreas: Array.from(areaCounts.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([area, count]) => ({ area, count })),
    });
  }

  // 8. Predecessor Candidates in Gaepo & Elsewhere
  console.log('\n[8. ADDITIONAL PREDECESSOR CANDIDATES DISCOVERY]');
  const predecessorCandidatesObservedList: any[] = [];
  for (const [key, obs] of predecessorCandidateObservations.entries()) {
    predecessorCandidatesObservedList.push({
      key,
      candidateName: obs.candidate.candidateName,
      successorComplexId: obs.candidate.successorComplexId,
      successorName: obs.candidate.successorName,
      dong: obs.candidate.dong,
      observedTrades: obs.trades.length,
      description: obs.candidate.description,
    });
  }

  // 9. Generate Artifacts
  console.log('\n[9. GENERATING ARTIFACT FILES]');

  const manifestData = {
    generatedAt: new Date().toISOString(),
    phase: 'PHASE_2_HISTORICAL_DATA_DISCOVERY',
    collectionStrategy: 'MOLIT API READ -> LOCAL RAW JSON DATASET (NO FIRESTORE WRITE)',
    quotaSummary: {
      totalUniverseUniqueLawdMonths: allUniverseItems.length,
      apiRequests,
      paginationRequests,
      successfulRequests,
      failedRequests,
    },
    coverageClassification: {
      reusableExisting: reusableCount,
      recollectRequired: recollectCount,
      newCollection: newCount,
    },
    complexCoveragePlans: complexPlans,
  };
  fs.writeFileSync(path.join(process.cwd(), 'data', 'historical_collection_manifest.json'), JSON.stringify(manifestData, null, 2), 'utf8');

  const discoveryData = {
    generatedAt: new Date().toISOString(),
    totalRawRows,
    matchedCurrentCount,
    matchedPredecessorCount,
    unmatchedCount,
    ambiguousCount,
    predecessorLeakageCount,
    areaDiscoveryResults,
  };
  fs.writeFileSync(path.join(process.cwd(), 'data', 'historical_area_discovery.json'), JSON.stringify(discoveryData, null, 2), 'utf8');

  const candidatesData = {
    generatedAt: new Date().toISOString(),
    policy: 'SUGGESTION ONLY - PRODUCTION REGISTRY UNTOUCHED',
    areaFamilyCandidatesReport,
    predecessorDunchonAnalysis: dunchonStats,
    predecessorCandidatesObserved: predecessorCandidatesObservedList,
  };
  fs.writeFileSync(path.join(process.cwd(), 'data', 'area_family_candidates.json'), JSON.stringify(candidatesData, null, 2), 'utf8');

  const matcherValidationData = {
    generatedAt: new Date().toISOString(),
    predecessorLeakage: predecessorLeakageCount,
    fourCasesPartialCancelVerification: fourCasesVerification,
    matcherSummary: {
      totalRawRows,
      matchedCurrentCount,
      matchedPredecessorCount,
      unmatchedCount,
      ambiguousCount,
    },
  };
  fs.writeFileSync(path.join(process.cwd(), 'data', 'matcher_validation_report.json'), JSON.stringify(matcherValidationData, null, 2), 'utf8');

  console.log('Artifacts generated successfully in data/:');
  console.log(' - data/historical_collection_manifest.json');
  console.log(' - data/historical_area_discovery.json');
  console.log(' - data/area_family_candidates.json');
  console.log(' - data/matcher_validation_report.json');

  return {
    manifestData,
    discoveryData,
    candidatesData,
    matcherValidationData,
    dunchonStats,
    fourCasesVerification,
  };
}

if (process.argv[1] && process.argv[1].includes('run_phase2_discovery')) {
  runPhase2Discovery()
    .then(() => {
      console.log('\n================================================================');
      console.log('PHASE 2 COMPLETED SUCCESSFULLY (STATUS: HISTORICAL_AREA_DISCOVERY_READY)');
      console.log('================================================================');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Phase 2 execution failed:', err);
      process.exit(1);
    });
}
