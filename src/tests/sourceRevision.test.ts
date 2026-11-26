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
