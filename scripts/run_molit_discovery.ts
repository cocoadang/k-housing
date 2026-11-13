import fs from 'fs';
import { XMLParser } from 'fast-xml-parser';
import { TARGET_COMPLEXES } from '../src/data/complexesData';
import { getAreaCategory } from '../src/utils/areaUtils';

interface MolitRawItem {
  aptNm?: string;
  아파트?: string;
  excluUseAr?: string | number;
  전용면적?: string | number;
  dealAmount?: string;
  거래금액?: string;
  dealYear?: string | number;
  년?: string | number;
  dealMonth?: string | number;
  월?: string | number;
  dealDay?: string | number;
  일?: string | number;
  dong?: string;
  법정동?: string;
  floor?: string | number;
  층?: string | number;
  cancelDealType?: string;
  해제여부?: string;
}

// 1. Identify 20 Discovery Target Complexes
const confirmed11Ids = new Set([
  'banpo_acro', 'banpo_xi', 'banpo_raemian', 'mapo_raemian_prugio',
  'mapo_prestige_xi', 'seongdong_oxu_riverzen', 'seongdong_seoulforest_riverview_xi',
  'yongsan_ichon_hangaram', 'gwacheon_xi', 'gireum_centerpiece', 'gireum_newtown_6'
]);

const discoveryComplexes = TARGET_COMPLEXES.filter(c => !confirmed11Ids.has(c.id));
console.log(`Discovery Target Complexes Count: ${discoveryComplexes.length}`);

// Group by LAWD
const lawdMap = new Map<string, typeof discoveryComplexes>();
for (const c of discoveryComplexes) {
  if (!lawdMap.has(c.lawdCd)) {
    lawdMap.set(c.lawdCd, []);
  }
  lawdMap.get(c.lawdCd)!.push(c);
}

const targetLawds = Array.from(lawdMap.keys());
console.log(`Target LAWDs (${targetLawds.length}): ${targetLawds.join(', ')}`);

// Predecessor Matching Rules (Strict Separation)
const PREDECESSORS: Record<string, { predId: string; predName: string; keywords: string[] }> = {
  'gangdong_olympic_park': { predId: 'dunchon_jugong', predName: '둔촌주공 (1~4단지)', keywords: ['둔촌주공', '둔촌 주공'] },
  'gaepo_raemian_forest': { predId: 'gaepo_siyoung', predName: '개포시영', keywords: ['개포시영', '시영'] },
  'gaepo_xi_presidence': { predId: 'gaepo_jugong_4', predName: '개포주공4단지', keywords: ['개포주공4', '개포 주공 4', '주공4단지', '개포주공4단지'] },
  'gaepo_raemian_blessige': { predId: 'gaepo_jugong_2', predName: '개포주공2단지', keywords: ['개포주공2', '개포 주공 2', '주공2단지', '개포주공2단지'] },
  'gwacheon_wieverfield': { predId: 'gwacheon_jugong_2', predName: '과천주공2단지', keywords: ['과천주공2', '주공2단지'] },
  'gwacheon_raemian_sur': { predId: 'gwacheon_jugong_3', predName: '과천주공3단지', keywords: ['과천주공3', '주공3단지'] },
  'gangdong_gracium': { predId: 'godeok_jugong_2', predName: '고덕주공2단지', keywords: ['고덕주공2', '고덕 주공 2'] },
  'gangdong_arteon': { predId: 'godeok_jugong_3', predName: '고덕주공3단지', keywords: ['고덕주공3', '고덕 주공 3'] },
};

function normalizeStr(s: string): string {
  return s.replace(/\s+/g, '').replace(/[()_.\-·]/g, '').toLowerCase();
}

function matchesComplexStrict(aptNm: string, rawDong: string, comp: (typeof TARGET_COMPLEXES)[0]): boolean {
  if (!aptNm) return false;
  const normApt = normalizeStr(aptNm);
  const normComp = normalizeStr(comp.name);
  const normShort = normalizeStr(comp.shortName);

  // Check if it's explicitly a predecessor
  const predConfig = PREDECESSORS[comp.id];
  if (predConfig) {
    for (const kw of predConfig.keywords) {
      if (normApt.includes(normalizeStr(kw))) {
        return false; // Matched predecessor, NOT current complex!
      }
    }
  }

  // Filter out predecessor names if accidentally in aliases
  const safeAliases = (comp.apiAliases || []).filter(alias => {
    if (predConfig) {
      for (const kw of predConfig.keywords) {
        if (normalizeStr(alias).includes(normalizeStr(kw))) return false;
      }
    }
    return true;
  });

  // Verify Dong match if comp has dong
  if (comp.dong && rawDong) {
    const normRawDong = normalizeStr(rawDong);
    const normCompDong = normalizeStr(comp.dong);
    if (!normRawDong.includes(normCompDong) && !normCompDong.includes(normRawDong)) {
      return false;
    }
  }

  // Check aliases first
  for (const alias of safeAliases) {
    const normAlias = normalizeStr(alias);
    if (normApt === normAlias || normApt.includes(normAlias)) {
      return true;
    }
  }

  if (normApt === normComp || normApt.includes(normComp) || (normShort.length >= 3 && normApt.includes(normShort))) {
    return true;
  }

  return false;
}

function matchesPredecessor(aptNm: string, rawDong: string, compId: string): boolean {
  const predConfig = PREDECESSORS[compId];
  if (!predConfig) return false;
  const normApt = normalizeStr(aptNm);
  for (const kw of predConfig.keywords) {
    if (normApt.includes(normalizeStr(kw))) return true;
  }
  return false;
}

// Fetch helper
const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const apiKey = process.env.MOLIT_API_KEY!.trim();
let cleanKey = apiKey;
if (cleanKey.includes('%')) {
  try { cleanKey = decodeURIComponent(cleanKey); } catch (e) {}
}

async function fetchMolit(lawdCd: string, dealYmd: string): Promise<MolitRawItem[]> {
  const url = `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?LAWD_CD=${lawdCd}&DEAL_YMD=${dealYmd}&serviceKey=${encodeURIComponent(cleanKey)}&pageNo=1&numOfRows=1000&_type=json`;
  
  let response = await fetch(url);
  if (response.status === 429) {
    await new Promise(r => setTimeout(r, 600));
    response = await fetch(url);
  }

  if (!response.ok) {
    console.error(`HTTP Error ${response.status} for ${lawdCd} ${dealYmd}`);
    return [];
  }

  const rawText = await response.text();
  try {
    const json = JSON.parse(rawText);
    const item = json.response?.body?.items?.item || json.body?.items?.item || json.items?.item;
    if (!item) return [];
    return Array.isArray(item) ? item : [item];
  } catch (e) {
    const xml = xmlParser.parse(rawText);
    const item = xml?.response?.body?.items?.item || xml?.OpenAPI_ServiceResponse?.body?.items?.item;
    if (!item) return [];
    return Array.isArray(item) ? item : [item];
  }
}

// Helper to generate months in reverse order
function getReverseMonths(startYearMonth: string, count: number): string[] {
  const res: string[] = [];
  let y = parseInt(startYearMonth.substring(0, 4), 10);
  let m = parseInt(startYearMonth.substring(4, 6), 10);

  for (let i = 0; i < count; i++) {
    const ym = `${y}${String(m).padStart(2, '0')}`;
    res.push(ym);
    m--;
    if (m === 0) {
      m = 12;
      y--;
    }
  }
  return res;
}

// Track queried lawd+month
const calledLawdMonths = new Set<string>();

interface ComplexDiscoveryData {
  id: string;
  name: string;
  lawdCd: string;
  observedAreas: Map<number, number>; // area => count
  observedMonths: Set<string>;
  allTrades: any[];
  predecessorTrades: any[];
}

const complexDataMap = new Map<string, ComplexDiscoveryData>();
for (const c of discoveryComplexes) {
  complexDataMap.set(c.id, {
    id: c.id,
    name: c.name,
    lawdCd: c.lawdCd,
    observedAreas: new Map(),
    observedMonths: new Set(),
    allTrades: [],
    predecessorTrades: []
  });
}

// Check if all complexes in a LAWD have sufficient observed areas
function isLawdComplete(lawdCd: string): boolean {
  const comps = lawdMap.get(lawdCd) || [];
  for (const c of comps) {
    const data = complexDataMap.get(c.id);
    if (!data) return false;
    // Check if at least 1 area in 58~60 and 1 area in 83~85, or enough observations
    let has59 = false;
    let has84 = false;
    for (const area of data.observedAreas.keys()) {
      if (area >= 58.0 && area <= 60.0) has59 = true;
      if (area >= 83.0 && area <= 85.0) has84 = true;
    }
    // If complex is known not to have 59 (e.g. some large-only complexes, check if we have >= 15 trades total)
    if (!has59 || !has84) {
      if (data.allTrades.length < 15) return false;
    }
  }
  return true;
}

async function runDiscovery() {
  console.log('Starting Adaptive MOLIT Discovery...');
  const allMonths = getReverseMonths('202608', 24); // up to 24 months available
  
  // Phase 1: Initial 3 months (202608, 202607, 202606)
  let currentMonthIndex = 0;
  const initialMonths = allMonths.slice(0, 3);
  currentMonthIndex = 3;

  for (const lawd of targetLawds) {
    for (const ym of initialMonths) {
      const key = `${lawd}_${ym}`;
      if (calledLawdMonths.has(key)) continue;
      calledLawdMonths.add(key);

      const items = await fetchMolit(lawd, ym);
      processMolitItems(lawd, ym, items);
      await new Promise(r => setTimeout(r, 60)); // polite rate limit
    }
  }

  // Phase 2: Expand per LAWD if needed (up to 6 months, 12 months, max 24 months)
  for (const lawd of targetLawds) {
    let monthIdx = 3;
    while (!isLawdComplete(lawd) && monthIdx < 24) {
      // Check next batch of 3 months
      const nextBatch = allMonths.slice(monthIdx, Math.min(monthIdx + 3, 24));
      monthIdx += nextBatch.length;

      console.log(`Expanding LAWD ${lawd} for further discovery: ${nextBatch.join(', ')}`);
      for (const ym of nextBatch) {
        const key = `${lawd}_${ym}`;
        if (calledLawdMonths.has(key)) continue;
        calledLawdMonths.add(key);

        const items = await fetchMolit(lawd, ym);
        processMolitItems(lawd, ym, items);
        await new Promise(r => setTimeout(r, 60));
      }
    }
  }

  console.log(`\nDiscovery completed! Total API Calls: ${calledLawdMonths.size}`);

  // Save Discovery Dataset to file
  const exportData: Record<string, any> = {};
  for (const [cId, data] of complexDataMap.entries()) {
    exportData[cId] = {
      id: data.id,
      name: data.name,
      lawdCd: data.lawdCd,
      observedAreas: Array.from(data.observedAreas.entries()).map(([a, c]) => ({ area: a, count: c })),
      observedMonths: Array.from(data.observedMonths).sort(),
      totalTrades: data.allTrades.length,
      predecessorTradesCount: data.predecessorTrades.length,
      tradesSample: data.allTrades.slice(0, 5)
    };
  }

  fs.writeFileSync('data/molit_discovery_dataset.json', JSON.stringify({
    metadata: {
      generatedAt: new Date().toISOString(),
      totalApiCalls: calledLawdMonths.size,
      queriedLawdMonths: Array.from(calledLawdMonths).sort(),
      targetComplexesCount: discoveryComplexes.length
    },
    complexes: exportData
  }, null, 2), 'utf8');

  console.log('MOLIT Discovery Dataset saved to data/molit_discovery_dataset.json');
}

function processMolitItems(lawdCd: string, dealYmd: string, items: MolitRawItem[]) {
  const comps = lawdMap.get(lawdCd) || [];
  for (const item of items) {
    const rawApt = String(item.aptNm || item.아파트 || '').trim();
    const rawDong = String(item.dong || item.법정동 || '').trim();
    const rawArea = parseFloat(String(item.excluUseAr || item.전용면적 || '0'));
    const exArea = Math.round(rawArea * 100) / 100;
    if (exArea <= 0) continue;

    for (const comp of comps) {
      // 1. Check predecessor match
      if (matchesPredecessor(rawApt, rawDong, comp.id)) {
        const data = complexDataMap.get(comp.id)!;
        data.predecessorTrades.push({
          apt: rawApt,
          dong: rawDong,
          area: exArea,
          dealYmd,
          price: item.dealAmount || item.거래금액
        });
        continue;
      }

      // 2. Check strict current complex match
      if (matchesComplexStrict(rawApt, rawDong, comp)) {
        const data = complexDataMap.get(comp.id)!;
        data.observedAreas.set(exArea, (data.observedAreas.get(exArea) || 0) + 1);
        data.observedMonths.add(dealYmd);
        data.allTrades.push({
          apt: rawApt,
          dong: rawDong,
          area: exArea,
          dealYmd,
          price: item.dealAmount || item.거래금액,
          floor: item.floor || item.층
        });
      }
    }
  }
}

runDiscovery().catch(console.error);
