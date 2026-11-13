import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { collection, query, where, getDocs, getReaderDb } from '../src/server/firestoreReader';
import { TARGET_COMPLEXES } from '../src/data/complexesData';
import { weightedDealStats } from '../src/utils/transactionStatistics';
const directory=process.env.COLLECTOR_OUTPUT || 'data/private/current-source';
const plan=JSON.parse(fs.readFileSync(`${directory}/revision-plan.json`,'utf8'));
function normalize(value:any):any {
 if (value?.$timestamp) return Date.parse(value.$timestamp);
 if (typeof value?.toMillis === 'function') return value.toMillis();
 if (Array.isArray(value)) return value.map(normalize);
 if (value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,normalize(value[k])]));
 return value;
}
const digest=(rows:any[])=>createHash('sha256').update(JSON.stringify(rows.map(normalize).sort((a,b)=>a.id.localeCompare(b.id)))).digest('hex');
async function main(){
 if (!process.env.FIRESTORE_EMULATOR_HOST) throw Error('ISOLATED_EMULATOR_REQUIRED');
 const db=getReaderDb();
 let checks=0;
 for(const complex of TARGET_COMPLEXES){
  const result=await getDocs(query(collection(db,'transactions'),where('complexId','==',complex.id)));
  const months=new Set(plan.manifest.covered.filter((x:string)=>x.startsWith(complex.id+'/')).map((x:string)=>x.split('/')[1]));
  const actual=result.docs.map((d:any)=>({id:d.id,...d.data()})).filter((d:any)=>months.has(d.dealYmd));
  const expected=plan.collections.transactions.filter((d:any)=>d.complexId===complex.id);
  const signature=(a:any[])=>a.map(d=>[d.id,d.price,d.exclusiveArea,d.activeCount,d.isCancelled]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
  assert.deepEqual(signature(actual),signature(expected));checks++;
  const monthly=await getDocs(query(collection(db,'monthlyComplexPrices_v2'),where('complexId','==',complex.id)));
  for(const doc of monthly.docs){
   const row=doc.data();if(!months.has(row.dealYmd))continue;
   const source=expected.filter((d:any)=>d.areaFamilyId===row.areaFamilyId&&d.dealYmd===row.dealYmd);
   const stats=weightedDealStats(source)!;
   assert.ok(stats);assert.equal(row.tradeCount,stats.count);assert.equal(row.medianPrice,stats.medianPrice);checks++;
  }
 }
 const original=new Firestore({projectId:process.env.GOOGLE_CLOUD_PROJECT,databaseId:process.env.FIRESTORE_DATABASE_ID});
 const counts:Record<string,number>={};
 const originalContentHashes:Record<string,string>={};
 for(const [name,expected]of Object.entries({transactions:48485,monthlyComplexPrices:5153,monthlyComplexPrices_v2:12633,monthlyStandardAreaPrices_v2:5757})){
  const result=await original.collection(name).count().get();counts[name]=result.data().count;assert.equal(counts[name],expected);checks++;
  if (process.env.VERIFICATION_SNAPSHOT_DIR) {
   const before=JSON.parse(fs.readFileSync(`${process.env.VERIFICATION_SNAPSHOT_DIR}/snapshot-${name}.json`,'utf8'));
   const after=await original.collection(name).get();
   const hash=digest(after.docs.map(d=>d.data()));
   assert.equal(hash,digest(before));originalContentHashes[name]=hash;checks++;
  }
 }
 const report={checkedAt:new Date().toISOString(),isolated:true,checks,passed:true,originalCounts:counts,originalContentHashes,sourceSha256:plan.manifest.sourceSha256,revisionCounts:plan.manifest.counts,unmappedAreas:plan.manifest.unknownAreas,limitations:['Only registered exact areas are classified; the three reviewed discoveries are included without inferring supply areas or lettered floorplan types.','Isolated data comparisons do not assert that production has had zero writes.']};
 fs.writeFileSync('data/current-source-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 await original.terminate();
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>process.exit(process.exitCode||0));
