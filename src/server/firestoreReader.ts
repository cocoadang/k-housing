import { Firestore as ServerFirestore } from '@google-cloud/firestore';
import * as browserSdk from 'firebase/firestore';
import { getFirestoreDb } from './firestore';

let serverDb: ServerFirestore | undefined;
/** Production reads use the Cloud Run identity; local legacy verification uses its isolated emulator. */
export function getReaderDb(): any {
  if (process.env.DISABLE_FIRESTORE === 'true') return null;
  if (process.env.USE_SERVER_IAM !== 'true') return getFirestoreDb();
  serverDb ??= new ServerFirestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT, databaseId: process.env.FIRESTORE_DATABASE_ID });
  return serverDb;
}
export const collection = (db: any, name: string): any => typeof db.collection === 'function' ? { db, name, ref:db.collection(name), filters:[] } : browserSdk.collection(db, name);
export const where = (field: string, op: browserSdk.WhereFilterOp, value: any) => ({ field, op, value });
export function query(ref: any, ...filters: ReturnType<typeof where>[]): any {
  return ref.ref ? { ...ref, filters:[...ref.filters,...filters],ref:filters.reduce((q, f) => q.where(f.field, f.op, f.value), ref.ref) } : browserSdk.query(ref, ...filters.map(f => browserSdk.where(f.field, f.op, f.value)));
}
let revisionCache: {until:number;data:any} | undefined;
export async function getActivePriceRevision(db:any=getReaderDb()) {
  if(process.env.PRICE_REVISIONS_ENABLED!=='true' || !db?.collection)return null;
  if (!revisionCache || revisionCache.until < Date.now()) {
    const pointer = await db.collection('priceRevisions').doc('active').get();
    revisionCache = { until:Date.now()+15000,data:pointer.data() };
  }
  return revisionCache.data;
}
export async function getDocs(ref: any): Promise<any> {
  if (!ref.ref) return browserSdk.getDocs(ref);
  const base = await ref.ref.get();
  if (process.env.PRICE_REVISIONS_ENABLED !== 'true') return base;
  const revision = await getActivePriceRevision(ref.db);
  if (revision?.status !== 'READY' || !revision.collections[ref.name]) return base;
  const covered = new Set(revision.covered);
  let overlay = ref.db.collection(revision.collections[ref.name]);
  for (const f of ref.filters) overlay=overlay.where(f.field,f.op,f.value);
  const additional = await overlay.get();
  const docs = [...base.docs.filter((d:any)=>!covered.has(`${d.data().complexId}/${d.data().dealYmd}`)), ...additional.docs];
  return { docs,size:docs.length,empty:docs.length===0,forEach:(callback:any)=>docs.forEach(callback) };
}
