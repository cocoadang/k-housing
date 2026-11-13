import { Firestore } from '@google-cloud/firestore';
async function main() {
  const projectId=process.env.GOOGLE_CLOUD_PROJECT;
  const databaseId=process.env.FIRESTORE_DATABASE_ID;
  if (!projectId || !databaseId) throw Error('EXPLICIT_DATABASE_REQUIRED');
  const db=new Firestore({projectId,databaseId});
  const other=new Firestore({projectId,databaseId:'(default)'});
  const probe=db.collection('_khousing_iam_probes').doc(`reader-${Date.now()}`);
  try {
    const count=await db.collection('transactions').count().get();
    if (!(count.data().count>0)) throw Error('READ_FAILED');
    let denied=false;
    try { await probe.create({testOnly:true}); await probe.delete(); }
    catch(e:any){if(e.code===7||e.code===403)denied=true;else throw e;}
    if(!denied) throw Error('READER_CAN_WRITE');
    let otherDenied=false;
    try {await other.collection('_khousing_iam_probes').doc('permission-check').get();}
    catch(e:any){if(e.code===7||e.code===403)otherDenied=true;else throw e;}
    if(!otherDenied)throw Error('READER_CAN_ACCESS_OTHER_DATABASE');
    console.log(JSON.stringify({readAllowed:true,writeDenied:true,otherDatabaseDenied:true}));
  } finally {await Promise.all([db.terminate(),other.terminate()]);}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
