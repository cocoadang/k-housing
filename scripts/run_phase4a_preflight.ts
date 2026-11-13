import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getFirestoreDb } from '../src/server/firestore';
import { collection, getDocs } from 'firebase/firestore';
import { TARGET_COMPLEXES } from '../src/data/complexesData';
import { HISTORICAL_COMPLEXES } from '../src/data/redevelopmentLineages';

export async function fetchLiveTransactions() {
  console.log('[Phase 4A Preflight] Initializing Read-Only fetch from Firestore...');
  const db = getFirestoreDb();
  if (!db) throw new Error('Failed to initialize Firestore DB client');

  const collRef = collection(db, 'transactions');
  const snap = await getDocs(collRef);
  console.log(`[Phase 4A Preflight] Fetched ${snap.size} documents from live Firestore.`);

  const liveDocs: any[] = [];
  snap.forEach((docSnap) => {
    liveDocs.push({
      id: docSnap.id,
      ...docSnap.data(),
    });
  });

  return liveDocs;
}

if (process.argv[1] && process.argv[1].includes('run_phase4a_preflight')) {
  fetchLiveTransactions()
    .then((docs) => {
      const dumpPath = path.join(process.cwd(), 'data', 'live_firestore_dump.json');
      fs.writeFileSync(dumpPath, JSON.stringify(docs, null, 2), 'utf8');
      console.log(`Saved live dump to ${dumpPath} (${docs.length} docs)`);
    })
    .catch((err) => {
      console.error('Error fetching live transactions:', err);
      process.exit(1);
    });
}
