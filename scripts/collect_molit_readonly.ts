import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { TARGET_COMPLEXES } from '../src/data/complexesData';
import { AREA_FAMILIES_REGISTRY } from '../src/data/areaFamilies';
import { generateDeterministicTransactionId } from '../src/server/firestoreRepository';
import { getAreaCategory } from '../src/utils/areaUtils';

const normalize = (s: unknown) => String(s || '').replace(/[\s()_.\-·]/g, '').replace(/아파트/g, '').toLowerCase();
const parser = new XMLParser({ trimValues: true });
const now = new Date();
const months = process.env.COLLECTOR_MONTHS?.split(',') || Array.from({ length: 6 }, (_, i) => {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
});
if (months.some(m => !/^20\d{2}(0[1-9]|1[0-2])$/.test(m)) || months.length > (process.env.COLLECTOR_FULL_HISTORY === 'true' ? 240 : 24)) throw Error('INVALID_MONTH_LIST');
const secrets = process.env.COLLECTOR_SECRETS_FILE ? JSON.parse(fs.readFileSync(process.env.COLLECTOR_SECRETS_FILE, 'utf8')) : {};
const key = decodeURIComponent(process.env.MOLIT_API_KEY || secrets.MOLIT_API_KEY || '');
if (!key) throw Error('MOLIT_KEY_REQUIRED');
const output = process.env.COLLECTOR_OUTPUT || 'data/private/current-source';
fs.mkdirSync(output, { recursive: true });

async function fetchMonth(district: string, month: string) {
  const rows: any[] = [];
  for (let page = 1; ; page++) {
    const url = new URL('https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev');
    url.search = new URLSearchParams({ serviceKey: key, LAWD_CD: district, DEAL_YMD: month, pageNo: String(page), numOfRows: '1000' }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    const xml = await response.text();
    const payload = parser.parse(xml)?.response;
    if (!response.ok || !/^0+$/.test(String(payload?.header?.resultCode))) throw Error(`MOLIT_FETCH_FAILED: ${district}/${month}/${page}`);
    fs.writeFileSync(path.join(output, `${district}-${month}-${page}.xml`), xml);
    const items = payload.body?.items?.item;
    const batch = items ? (Array.isArray(items) ? items : [items]) : [];
    rows.push(...batch);
    const total = Number(payload.body?.totalCount);
    if (!Number.isSafeInteger(total) || total < 0) throw Error('INVALID_TOTAL_COUNT');
    if (rows.length === total) return rows;
    if (!batch.length || rows.length > total) throw Error('INCOMPLETE_SOURCE_PAGINATION');
  }
}

export async function collectCurrentSource() {
  const allowed = [...new Set(TARGET_COMPLEXES.map(c => c.lawdCd))];
  const districts = process.env.COLLECTOR_DISTRICTS?.split(',') || allowed;
  if (districts.some(d => !allowed.includes(d))) throw Error('UNREGISTERED_DISTRICT');
  const jobs = districts.flatMap(district => months.map(month => ({ district, month })));
  const snapshots: any[] = [];
  const transactions: any[] = [];
  for (const job of jobs) {
    const raw = await fetchMonth(job.district, job.month);
    const grouped = new Map<string, any>();
    for (const complex of TARGET_COMPLEXES.filter(c => c.lawdCd === job.district)) {
      const names = [complex.name, complex.shortName, ...(complex.apiAliases || [])].map(normalize);
      const matched = raw.filter(r => normalize(r.umdNm || r.bubdong || r.법정동) === normalize(complex.dong) && names.includes(normalize(r.aptNm)));
      for (const r of matched) {
        const price = Number(String(r.dealAmount).replaceAll(',', '').trim());
        const exclusiveArea = Number(r.excluUseAr);
        const year = Number(r.dealYear), month = Number(r.dealMonth), day = Number(r.dealDay), floor = Number(r.floor);
        const dealDate = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        if (!(price > 0 && exclusiveArea > 0 && Number.isInteger(floor)) || !Number.isFinite(price) || new Date(`${dealDate}T00:00:00Z`).toISOString().slice(0,10) !== dealDate) throw Error('INVALID_MATCHED_SOURCE_ROW');
        const family = AREA_FAMILIES_REGISTRY[complex.id]?.find(f => f.exactAreas.some(a => Math.round(a*100) === Math.round(exclusiveArea*100)));
        const id = generateDeterministicTransactionId(complex.id, { dealYmd: job.month, dealDay: day, floor, price, exclusiveArea });
        const row = grouped.get(id) || { id, transactionId:id, complexId:complex.id, complexName:r.aptNm, dealYear:year,dealMonth:month,dealDay:day,dealDate,dealYmd:job.month,price,exclusiveArea,floor,areaFamilyId:family?.id || null,standardAreaCategory:family?.standardCategory || 'OTHER',areaCategory:getAreaCategory(exclusiveArea,complex.id),normalRowCount:0,cancellationRowCount:0,activeCount:0,cancelDates:[],sourceRawComplexNames:[],sourceAptSeqs:[],dataSource:'MOLIT_OPENAPI',source:'MOLIT_APT_TRADE',schemaVersion:'SOURCE_STATUS_V2',pyeong:exclusiveArea/3.305785,pricePerSqm:price/exclusiveArea,pricePerPyeong:price/(exclusiveArea/3.305785),isOutlier:false };
        if (row.exclusiveArea !== exclusiveArea || `${year}${String(month).padStart(2,'0')}` !== job.month) throw Error('AMBIGUOUS_SOURCE_GROUP');
        if (!row.sourceRawComplexNames.includes(r.aptNm)) row.sourceRawComplexNames.push(r.aptNm);
        if (r.aptSeq && !row.sourceAptSeqs.includes(String(r.aptSeq))) row.sourceAptSeqs.push(String(r.aptSeq));
        const cancelled = String(r.cdealType || '').trim() === 'O' || Boolean(String(r.cdealDay || '').trim());
        if (cancelled) { row.cancellationRowCount++; if(r.cdealDay)row.cancelDates.push(String(r.cdealDay)); }
        else { row.normalRowCount++; row.activeCount++; }
        row.isCancelled = row.activeCount === 0;
        row.cancelDate = row.cancelDates.at(-1) || ' ';
        grouped.set(id,row);
      }
    }
    transactions.push(...grouped.values());
    snapshots.push({...job,rawCount:raw.length,canonicalCount:grouped.size,sha256:createHash('sha256').update(JSON.stringify(raw)).digest('hex')});
    console.log(`${job.district}/${job.month}: raw=${raw.length}, matched groups=${grouped.size}`);
  }
  fs.writeFileSync(path.join(output,'transactions.json'),JSON.stringify(transactions));
  fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify({fetchedAt:new Date().toISOString(),months,snapshots,canonicalCount:transactions.length,unmappedAreaCount:transactions.filter(t=>!t.areaFamilyId).length,writeCount:0},null,2));
}
if (!process.env.COLLECTOR_LIBRARY_MODE) collectCurrentSource().catch(e=>{console.error(e.message);process.exitCode=1;});
