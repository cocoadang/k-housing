import { createHash } from 'node:crypto';
import { TARGET_COMPLEXES } from '../data/complexesData';
import { weightedDealStats } from '../utils/transactionStatistics';

export function buildSourceRevision(transactions: any[], manifest: any) {
  if (!manifest.snapshots?.length || manifest.writeCount !== 0) throw Error('INVALID_SOURCE_MANIFEST');
  const now = manifest.fetchedAt;
  const groups = new Map<string, any[]>();
  const standards = new Map<string, any[]>();
  for (const t of transactions) {
    if (!t.areaFamilyId || t.activeCount <= 0) continue;
    const key = `${t.complexId}_${t.areaFamilyId}_${t.dealYmd}`;
    groups.set(key, [...(groups.get(key) || []), t]);
    if (['59', '84'].includes(t.standardAreaCategory)) {
      const std = `${t.complexId}_std${t.standardAreaCategory}_${t.dealYmd}`;
      standards.set(std, [...(standards.get(std) || []), t]);
    }
  }
  const aggregate = (id: string, rows: any[], standard: boolean) => {
    const stats = weightedDealStats(rows)!;
    const sqm = weightedDealStats(rows.map(r => ({ ...r, price:r.price/r.exclusiveArea })))!;
    const first = rows[0];
    const dates = rows.map(r => r.dealDate).sort();
    return { id, complexId:first.complexId, ...(standard ? {contributingAreaFamilies:[...new Set(rows.map(r=>r.areaFamilyId))]} : {areaFamilyId:first.areaFamilyId,representativeExclusiveArea:first.exclusiveArea}), standardAreaCategory:first.standardAreaCategory, areaCategory:first.standardAreaCategory, dealYmd:first.dealYmd,year:first.dealYear,month:first.dealMonth,displayDate:`${first.dealYear}.${String(first.dealMonth).padStart(2,'0')}`,tradeCount:stats.count,activeCount:stats.count,sourceCanonicalGroupCount:rows.length,medianPrice:stats.medianPrice,averagePrice:stats.avgPrice,minPrice:stats.minPrice,maxPrice:stats.maxPrice,medianPricePerSqm:sqm.medianPrice,averagePricePerSqm:sqm.avgPrice,medianPricePerPyeong:sqm.medianPrice*3.305785,firstDealDate:dates[0],lastDealDate:dates.at(-1),reliability:stats.count>=5?'HIGH':stats.count>=2?'MEDIUM':'LOW',confidenceLabel:stats.count>=5?'거래 충분':stats.count>=2?'거래 보통':'거래 희소',isPredecessor:false,createdAt:now,updatedAt:now };
  };
  const covered = TARGET_COMPLEXES.flatMap(c => manifest.snapshots.filter((s:any)=>s.district===c.lawdCd).map((s:any)=>`${c.id}/${s.month}`));
  const collections = {
    transactions,
    monthlyComplexPrices_v2: [...groups].map(([id,rows])=>aggregate(id,rows,false)),
    monthlyStandardAreaPrices_v2: [...standards].map(([id,rows])=>aggregate(id,rows,true)),
  };
  return { manifest:{...manifest,covered,sourceSha256:createHash('sha256').update(JSON.stringify(transactions)).digest('hex'),unknownAreas:transactions.filter(t=>!t.areaFamilyId).map(t=>({id:t.id,complexId:t.complexId,area:t.exclusiveArea})),counts:Object.fromEntries(Object.entries(collections).map(([k,v])=>[k,v.length]))},collections };
}

/** Immutable price collections are prepared first; only one pointer is changed after all writes succeed. */
export async function publishSourceRevision(db: any, plan: ReturnType<typeof buildSourceRevision>, revision: string) {
  if (!/^r\d{14}$/.test(revision)) throw Error('INVALID_REVISION');
  const names: Record<string,string> = {};
  for (const [name, rows] of Object.entries(plan.collections)) {
    const target = `${name}_${revision}`;
    names[name] = target;
    for (let i=0; i<rows.length; i+=400) {
      const batch=db.batch();
      for (const row of rows.slice(i,i+400)) batch.set(db.collection(target).doc(row.id), row);
      await batch.commit();
    }
    const actual = await db.collection(target).count().get();
    if (actual.data().count !== rows.length) throw Error(`REVISION_COUNT_MISMATCH: ${name}`);
  }
  await db.collection('priceRevisions').doc(revision).create({...plan.manifest,revision,collections:names,status:'READY'});
  await db.collection('priceRevisions').doc('active').set({...plan.manifest,revision,collections:names,status:'READY'});
  return {revision,counts:plan.manifest.counts};
}
