import type {RequestHandler} from 'express';
import {Firestore} from '@google-cloud/firestore';
import {createCanonicalManifestFirestoreStore, oldestObservation, readCanonicalBudgetProjection, type CanonicalManifestStore} from './aptBudgetFirestoreProjection';
import {aptRecommendationRegistry as registry} from './aptRecommendationRegistry';
const projectId='gen-lang-client-0064554427', databaseId='ai-studio-khousing-38852770-f782-474c-b219-956fbb846237';
const maxAgeMs=108_000_000, maxFutureMs=300_000;
const districts=new Set(registry.map(r=>r.district));
const rev=/^r\d{14}(?:_[a-f0-9]{8})?$/;
let db:Firestore|undefined;
export function aptRecommendationMonths(now:Date) {
 const kst=new Date(now.getTime()+32_400_000);
 return [0,1,2].map(i=>new Date(Date.UTC(kst.getUTCFullYear(),kst.getUTCMonth()-i,1)).toISOString().slice(0,7).replace('-',''));
}
function store() {
 if(process.env.USE_SERVER_IAM!=='true'||process.env.FIRESTORE_EMULATOR_HOST||
   process.env.GOOGLE_CLOUD_PROJECT!==projectId||process.env.FIRESTORE_DATABASE_ID!==databaseId) throw Error('APT_DATABASE_UNAVAILABLE');
 return createCanonicalManifestFirestoreStore(db??=new Firestore({projectId,databaseId}));
}
export function createAptRecommendationHandler(deps={store,now:()=>new Date()}):RequestHandler {
 let cache:{key:string;until:number;result:ReturnType<typeof read>}|undefined;
 async function read(at:Date,months:string[],pin?:string) {
  let oldest=Infinity;
  const base=deps.store();
  const scoped:CanonicalManifestStore={
   async manifest(id) {
    const m=await base.manifest(id==='active'&&pin?pin:id);
    if (pin&&m?.revision!==pin) throw Error('PIN_MISMATCH');
    if (m) oldest=Math.min(oldest,oldestObservation(m,months,districts,at,{maxAgeMs,maxFutureMs}));
    return m;
   },
   page:q=>base.page(q),
  };
  const p=await readCanonicalBudgetProjection(scoped,{complexIds:registry.map(r=>r.id),months},registry);
  if(p.incomplete||!Number.isFinite(oldest)) throw Error('DATA_UNAVAILABLE');
  return {schema:1,readMode:pin?'pinned':'active',revision:p.revision,months,checkedAt:at.toISOString(),observedAt:new Date(oldest).toISOString(),validUntil:oldest+maxAgeMs,results:p.results};
 }
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(Object.keys(req.query).length){res.status(400).json({error:'APT_RECOMMENDATION_INVALID_SCOPE'});return;}
  const pin=process.env.APT_RECOMMENDATION_PREVIEW_REVISION;
  const at=deps.now(),months=aptRecommendationMonths(at),key=months.join(',')+':'+(pin??'');
  try {
   if(pin!==undefined&&!rev.test(pin)) throw Error('INVALID_PIN');
   if(!cache||cache.key!==key||cache.until<=at.getTime()) cache={key,until:at.getTime()+30_000,result:read(at,months,pin)};
   const data=await cache.result;
   if(data.validUntil<=deps.now().getTime()) throw Error('DATA_EXPIRED');
   res.json(data);
  }catch{res.status(503).json({error:'APT_RECOMMENDATION_UNAVAILABLE'});}
 };
}
