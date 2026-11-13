import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { Storage } from '@google-cloud/storage';
import { Firestore } from '@google-cloud/firestore';
import { buildSourceRevision, publishSourceRevision } from '../src/server/sourceRevision';

async function main() {
  process.env.COLLECTOR_LIBRARY_MODE='true';
  process.env.COLLECTOR_OUTPUT ||= '/tmp/khousing-source';
  const { collectCurrentSource } = await import('./collect_molit_readonly');
  await collectCurrentSource();
  const directory=process.env.COLLECTOR_OUTPUT;
  const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
  const revision=`r${new Date().toISOString().replace(/\D/g,'').slice(0,14)}`;
  if (!process.env.SOURCE_ARCHIVE_BUCKET) throw Error('SOURCE_ARCHIVE_BUCKET_REQUIRED');
  const destination=`khousing-source/${revision}/source.json.gz`;
  const files=Object.fromEntries(fs.readdirSync(directory).filter(f=>f.endsWith('.xml')||f.endsWith('.json')).map(f=>[f,fs.readFileSync(path.join(directory,f),'utf8')]));
  await new Storage().bucket(process.env.SOURCE_ARCHIVE_BUCKET).file(destination).save(gzipSync(JSON.stringify(files)),{resumable:false,contentType:'application/gzip',preconditionOpts:{ifGenerationMatch:0}});
  manifest.archiveUri=`gs://${process.env.SOURCE_ARCHIVE_BUCKET}/${destination}`;
  const plan=buildSourceRevision(JSON.parse(fs.readFileSync(path.join(directory,'transactions.json'),'utf8')),manifest);
  const db=new Firestore({projectId:process.env.GOOGLE_CLOUD_PROJECT,databaseId:process.env.FIRESTORE_DATABASE_ID});
  try { console.log(JSON.stringify(await publishSourceRevision(db,plan,revision))); }
  finally { await db.terminate(); }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
