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
