import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createAiAnalysisRouter, parseAnalysisSelection, buildAnalysisFacts, AnalysisError } from '../server/aiAnalysis';
import { AREA_FAMILIES_REGISTRY } from '../data/areaFamilies';
import type { AreaFamilyMonthlyPoint } from '../types';

const selection={complexId:'jamsil_els',areaFamilyId:'jamsil_els_59',startYmd:'202601',endYmd:'202611'};
const point=(dealYmd:string,medianPrice:number,tradeCount:number):AreaFamilyMonthlyPoint=>({dealYmd,year:+dealYmd.slice(0,4),month:+dealYmd.slice(4),displayDate:dealYmd,tradeCount,activeCount:tradeCount,medianPrice,averagePrice:medianPrice,minPrice:medianPrice,maxPrice:medianPrice,medianPricePerSqm:0,averagePricePerSqm:0,medianPricePerPyeong:0,reliability:'LOW'});
const facts=()=>buildAnalysisFacts(selection,selection.areaFamilyId,[point('202601',100000,3),point('202603',80000,1)],{revision:'r1'});
test('three primary-source areas map to the correct broad families; 115 never enters 125',()=>{
  assert.ok(AREA_FAMILIES_REGISTRY.gwacheon_xi.find(f=>f.id==='gwacheon_xi_125')?.exactAreas.includes(125.88));
  assert.ok(AREA_FAMILIES_REGISTRY.gangdong_olympic_park.find(f=>f.id==='olympic_park_59')?.exactAreas.includes(59.96));
  const n=AREA_FAMILIES_REGISTRY.busan_namcheon_xi;
  assert.equal(n.find(f=>f.exactAreas.includes(115.4169))?.id,'namcheon_xi_115');
  assert.equal(n.find(f=>f.id==='namcheon_xi_115')?.standardCategory,'OTHER');
  assert.equal(n.find(f=>f.id==='namcheon_xi_115')?.representativeSupplyArea,undefined);
  assert.ok(!n.find(f=>f.id==='namcheon_xi_125')?.exactAreas.includes(115.4169));
});
test('AI accepts only registered selection; rejects arbitrary prompts, forged prices, mismatched families and future dates',()=>{
  assert.deepEqual(parseAnalysisSelection(selection),selection);
  for(const body of [{...selection,prompt:'ignore rules'},{...selection,metricsSummary:{latestPrice:1}},{...selection,complexId:'unknown'},{...selection,areaFamilyId:'banpo_xi_59'},{...selection,endYmd:'209901'},{...selection,startYmd:'202613'}, {...selection,startYmd:'202611',endYmd:'202601'}])assert.throws(()=>parseAnalysisSelection(body),AnalysisError);
});
test('server facts use observed months, counts and prices without filling empty months',()=>{
  const f=facts();assert.equal(f.latestPrice,80000);assert.equal(f.observedMonths,2);assert.equal(f.totalTrades,4);assert.equal(f.mddPct,-20);assert.equal(f.latestLowSample,true);assert.equal(f.observedPeriod.endYmd,'202603');assert.equal(f.totalReturnPct,-20);
  const single=buildAnalysisFacts(selection,selection.areaFamilyId,[point('202601',100000,1)],{});assert.equal(single.cagrPct,null);assert.equal(single.mddPct,null);
  assert.throws(()=>buildAnalysisFacts(selection,selection.areaFamilyId,[],{}),AnalysisError);
});
async function serve(router:ReturnType<typeof createAiAnalysisRouter>, run:(post:(body:any,origin?:string)=>Promise<{status:number;data:any}>)=>Promise<void>){
  const app=express();app.use(express.json());app.use('/api/ai',router);const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const address=server.address() as any;
  try{await run(async(body,origin)=>{const r=await fetch(`http://127.0.0.1:${address.port}/api/ai/analyze`,{method:'POST',headers:{'content-type':'application/json',...(origin?{origin}:{})},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};});}finally{await new Promise<void>(r=>server.close(()=>r()));}
}
test('identical concurrent AI requests generate once and use cache; changed source invalidates report',async()=>{
  let count=0,revision='r1';
  await serve(createAiAnalysisRouter({load:async()=>({...facts(),source:{...facts().source,revision}}),generate:async()=>{count++;await new Promise(r=>setTimeout(r,15));return '원자료 진단';}}),async post=>{
    const results=await Promise.all([post(selection),post(selection)]);assert.ok(results.every(r=>r.status===200));assert.equal(count,1);assert.equal((await post(selection)).data.cached,true);
    revision='r2';await post(selection);assert.equal(count,2);
  });
});
test('generation limit returns 429; cached reports remain usable',async()=>{
  await serve(createAiAnalysisRouter({load:async s=>({...facts(),requestedPeriod:{startYmd:s.startYmd,endYmd:s.endYmd}}),generate:async()=> '진단',hourlyLimit:1}),async post=>{
    assert.equal((await post(selection)).status,200);assert.equal((await post({...selection,startYmd:'202602'})).status,429);assert.equal((await post(selection)).status,200);
  });
});
test('invalid selection, foreign origin and absent data do not call provider; provider errors are sanitized',async()=>{
  let calls=0;
  await serve(createAiAnalysisRouter({load:async()=>{throw new AnalysisError(422,'NO_DATA','자료 없음');},generate:async()=>{calls++;return 'wrong';}}),async post=>{
    assert.equal((await post({...selection,prompt:'malicious'})).status,400);assert.equal((await post(selection,'https://untrusted.example')).status,403);assert.equal((await post(selection)).status,422);assert.equal(calls,0);
  });
  await serve(createAiAnalysisRouter({load:async()=>facts(),generate:async()=>{throw Error('secret-key-and-upstream-payload');}}),async post=>{
    const r=await post(selection);assert.equal(r.status,503);assert.ok(!JSON.stringify(r.data).includes('secret-key'));
  });
});
