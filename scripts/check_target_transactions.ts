import { getFirestoreDb } from '../src/server/firestore';
import { collection, query, where, getDocs } from 'firebase/firestore';

async function inspectData() {
  const db = getFirestoreDb();
  if (!db) {
    console.error('No db');
    process.exit(1);
  }

  const targets = ['gwacheon_raemian_sur', 'jamsil_els', 'banpo_raemian'];

  for (const cid of targets) {
    const q = query(collection(db, 'transactions'), where('complexId', '==', cid));
    const snap = await getDocs(q);
    console.log(`Complex: ${cid}, Total transactions: ${snap.size}`);

    // If 0, let's see if there are other complexIds or names
    if (snap.size === 0) {
      console.log(`No transactions for complexId == '${cid}', checking by name or alias...`);
    } else {
      // Sample transaction
      const first = snap.docs[0].data();
      console.log('Sample transaction:', {
        dealDate: first.dealDate,
        dealYear: first.dealYear,
        dealMonth: first.dealMonth,
        dealDay: first.dealDay,
        price: first.price,
        exclusiveArea: first.exclusiveArea,
        complexName: first.complexName,
        isCancelled: first.isCancelled,
        cancelDate: first.cancelDate,
      });
    }
  }

  process.exit(0);
}

inspectData().catch(err => {
  console.error(err);
  process.exit(1);
});
