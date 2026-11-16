import {Storage} from '@google-cloud/storage';
import {randomUUID} from 'node:crypto';
export interface CacheRecord {generation:string;data:any}
export interface ConditionalCache {read(key:string):Promise<CacheRecord|null>;write(key:string,data:any,generation:string):Promise<void>;remove(key:string,generation:string):Promise<void>}
export class CacheBusy extends Error {}
export function createPersistentAnalysisCache(store:ConditionalCache,now=Date.now){
 return {async getOrCreate(key:string,generate:()=>Promise<any>){
  const old=await store.read(key);
  if(old?.data.state==='complete' && typeof old.data.value?.analysis==='string')return {value:old.data.value,cached:true};
  if(old?.data.state==='pending' && old.data.until>now())throw new CacheBusy('AI_CACHE_BUSY');
  const owner=randomUUID();
  await store.write(key,{state:'pending',owner,until:now()+120000},old?.generation||'0');
  const lease=await store.read(key);if(lease?.data.owner!==owner)throw new CacheBusy('AI_CACHE_BUSY');
  try {const value=await generate();await store.write(key,{state:'complete',value},lease.generation);return {value,cached:false};}
  catch(e){await store.remove(key,lease.generation).catch(()=>{});throw e;}
 }};
}
let cache:ReturnType<typeof createPersistentAnalysisCache>|undefined;
export function productionAnalysisCache(){
 const bucketName=process.env.AI_CACHE_BUCKET;if(!bucketName)return undefined;
 if(cache)return cache;
 const bucket=new Storage().bucket(bucketName);
 const store:ConditionalCache={
  async read(key){const file=bucket.file(key+'.json');try{const [metadata]=await file.getMetadata();const [bytes]=await file.download({validation:'crc32c',ifGenerationMatch:metadata.generation} as any);return {generation:String(metadata.generation),data:JSON.parse(bytes.toString())};}catch(e:any){if(e.code===404)return null;throw e;}},
  async write(key,data,generation){try{await bucket.file(key+'.json').save(JSON.stringify(data),{resumable:false,contentType:'application/json',preconditionOpts:{ifGenerationMatch:generation},metadata:{cacheControl:'no-store'}});}catch(e:any){if(e.code===412)throw new CacheBusy('AI_CACHE_BUSY');throw e;}},
  async remove(key,generation){await bucket.file(key+'.json').delete({ifGenerationMatch:generation});}
 };
 return cache=createPersistentAnalysisCache(store);
}
