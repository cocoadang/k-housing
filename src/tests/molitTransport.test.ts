import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchMolitXml} from '../server/molitTransport';
const url=new URL('https://example.invalid/?serviceKey=test-secret');
test('transient network failure retries the same request without publishing fallback data',async()=>{
 let calls=0;
 const result=await fetchMolitXml(url,{wait:async()=>{},fetcher:(async()=>{if(++calls===1)throw TypeError('network failure');return new Response('<response/>',{status:200});}) as typeof fetch});
 assert.equal(calls,2);assert.equal(result.xml,'<response/>');
});
test('temporary server errors retry; authorization failures do not',async()=>{
 let calls=0;
 await fetchMolitXml(url,{wait:async()=>{},fetcher:(async()=>new Response('',{status:++calls===1?503:200})) as typeof fetch});
 assert.equal(calls,2);calls=0;
 const denied=await fetchMolitXml(url,{wait:async()=>{},fetcher:(async()=>{calls++;return new Response('',{status:403});}) as typeof fetch});
 assert.equal(calls,1);assert.equal(denied.response.status,403);
});
test('exhausted retries fail closed and never reveal a service key',async()=>{
 let calls=0;
 await assert.rejects(fetchMolitXml(url,{attempts:3,wait:async()=>{},fetcher:(async()=>{calls++;throw Error(url.toString());})as typeof fetch}),e=>e instanceof Error&&e.message==='MOLIT_NETWORK_UNAVAILABLE_AFTER_RETRIES'&&!e.message.includes('test-secret'));
 assert.equal(calls,3);
});
