import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSourceRevision,publishSourceRevision} from '../server/sourceRevision';
test('source revisions use valid-row multiplicity, retain unclassified evidence and never zero-fill months',()=>{
 const rows=[{id:'one',complexId:'jamsil_els',areaFamilyId:'jamsil_els_59',standardAreaCategory:'59',price:100,exclusiveArea:59.96,dealYmd:'202610',dealYear:2026,dealMonth:10,dealDate:'2026-10-10',activeCount:2,cancellationRowCount:1,isCancelled:false},{id:'two',complexId:'jamsil_els',areaFamilyId:null,price:400,exclusiveArea:60.5,dealYmd:'202610',activeCount:1}];
 const plan=buildSourceRevision(rows,{snapshots:[{district:'11710',month:'202610'},{district:'11710',month:'202611'}],fetchedAt:'2026-11-14T00:00:00Z',writeCount:0});
 assert.equal(plan.collections.monthlyComplexPrices_v2.length,1);
 assert.equal(plan.collections.monthlyComplexPrices_v2[0].tradeCount,2);
 assert.equal(plan.collections.monthlyComplexPrices_v2[0].medianPrice,100);
 assert.equal(plan.manifest.unknownAreas.length,1);
 assert.ok(plan.manifest.covered.includes('jamsil_els/202611'));
 assert.equal(plan.collections.transactions.length,2);
});
test('a failed revision cannot switch the active pointer',async()=>{
 const plan=buildSourceRevision([],{snapshots:[{district:'11710',month:'202610'}],fetchedAt:'2026-11-14T00:00:00Z',writeCount:0});
 let switched=false;
 const db={collection:()=>({count:()=>({get:async()=>({data:()=>({count:1})})}),doc:(id:string)=>({set:async()=>{if(id==='active')switched=true;}})})};
 await assert.rejects(publishSourceRevision(db,plan,'r20261114000000'),/REVISION_COUNT_MISMATCH/);
 assert.equal(switched,false);
});

test('preview history reads only the named immutable revision and covered months', async () => {
  const { readPinnedTradeHistory } = await import('../server/aptTradeHistoryPreview');
  const revision = 'r20261125084348_907cfe39';
  const collection = `transactions_${revision}`;
  const calls: string[] = [];
  const row = {id:'trade', complexId:'gwacheon_raemian_sur', dealYmd:'202611'};
  const query = {
    where: () => query, limit: () => query,
    get: async () => ({size:1, docs:[{id:row.id, data:() => row}]}),
  };
  const db = { collection: (name: string) => {
    calls.push(name);
    return name === 'priceRevisions' ? { doc: (id: string) => {
      assert.equal(id, revision);
      return { get: async () => ({data:() => ({status:'READY', revision, collections:{transactions:collection}, covered:['gwacheon_raemian_sur/202611']})}) };
    }} : query;
  }} as unknown as Parameters<typeof readPinnedTradeHistory>[0];
  assert.deepEqual(await readPinnedTradeHistory(db, revision, row.complexId, '202611', '202611'), [row]);
  assert.deepEqual(calls, ['priceRevisions', collection]);
  await assert.rejects(readPinnedTradeHistory(db, revision, row.complexId, '202610', '202611'), /PINNED_HISTORY_SCOPE_UNAVAILABLE/);
});

test('staging seals an immutable revision while leaving the active pointer untouched', async () => {
 const { stageSourceRevision } = await import('../server/sourceRevision');
 const revision='r20261127000000';
 const plan=buildSourceRevision([],{snapshots:[{district:'11710',month:'202611'}],fetchedAt:'2026-11-27T00:00:00Z',writeCount:0});
 const creates:string[]=[];
 let pointerReads=0;
 const timestamp={isEqual:(value:unknown)=>value===timestamp};
 const db={collection:(name:string)=>({
   count:()=>({get:async()=>({data:()=>({count:0})})}),
   doc:(id:string)=>({
     get:async()=>{ assert.equal(id,'active'); pointerReads++; return {updateTime:timestamp}; },
     create:async()=>{ creates.push(`${name}/${id}`); },
   }),
 })};
 await stageSourceRevision(db,plan,revision,timestamp as any);
 assert.deepEqual(creates,[`priceRevisions/${revision}`]);
 assert.equal(pointerReads,2);
});

test('same-day same-price sales preserve both reports and select a real row deterministically', async () => {
 const { projectAptBudget } = await import('../server/aptBudgetCanonicalProjection');
 const identity={id:'apt_complex', district:'11290', legalDong:'길음동', parcel:'1-0', name:'테스트 단지'};
 const revision='r20261127000000';
 const collection=`transactions_${revision}`;
 const group= {
   id:'high', complexId:identity.id, sourceDistrict:identity.district, sourceLegalDong:identity.legalDong,
   sourceParcel:identity.parcel, sourceAptSeqs:['11290-1'], dataSource:'MOLIT_OPENAPI',
   source:'MOLIT_APT_TRADE', schemaVersion:'SOURCE_STATUS_V2', dealYmd:'202610', dealDate:'2026-10-05',
   price:180000, floor:17, exclusiveArea:84.998, normalRowCount:1, activeCount:1,
   cancellationRowCount:0, isCancelled:false, cancelDates:[],
 } as const;
 const lower={...group, id:'low', floor:4, exclusiveArea:84.996};
 const input={
   request:{complexIds:[identity.id],months:['202610']},
   registry:[identity],
   receipt:{revision,collection,state:'READY' as const,buckets:[{
     district:identity.district,month:'202610',sourceTotalCount:2,pageRowCounts:[2],
     identities:[{...identity,groupedCount:2,activeCount:2,canceledCount:0}],
   }]},
   query:{revision,collection,groups:[group,lower]},
 };
 const result=projectAptBudget(input);
 assert.equal(result.incomplete,false);
 assert.equal(result.results[0].floor,lower.floor);
 assert.equal(result.results[0].area,lower.exclusiveArea);
 assert.deepEqual(result.results[0].tradeSummary,{count:2,min:180000,max:180000});
 assert.deepEqual(projectAptBudget({...input,query:{...input.query,groups:[lower,group]}}),result);
});
