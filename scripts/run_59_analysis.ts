import { getFirestoreDb } from '../src/server/firestore';
import { collection, query, where, getDocs } from 'firebase/firestore';

async function analyze() {
  const db = getFirestoreDb();
  if (!db) {
    console.error('No db');
    process.exit(1);
  }

  const complexes = [
    { id: 'gwacheon_raemian_sur', name: '과천 래미안슈르' },
    { id: 'jamsil_els', name: '잠실 엘스' },
    { id: 'banpo_raemian', name: '반포 래미안퍼스티지' },
  ];

  for (const c of complexes) {
    console.log(`\n=================== ${c.name} (${c.id}) ===================`);
    const q = query(collection(db, 'transactions'), where('complexId', '==', c.id));
    const snap = await getDocs(q);
    const docs = snap.docs.map(d => d.data());

    console.log(`Total records: ${docs.length}`);

    // Check cancellation
    const cancelled = docs.filter(d => d.isCancelled === true || (d.cancelDate && d.cancelDate.trim().length > 0));
    console.log(`Cancelled records: ${cancelled.length}`);

    // Check area distribution
    const areaMap = new Map<number, number>();
    for (const d of docs) {
      const area = Math.round(Number(d.exclusiveArea) * 100) / 100;
      areaMap.set(area, (areaMap.get(area) || 0) + 1);
    }
    const sortedAreas = Array.from(areaMap.entries()).sort((a, b) => a[0] - b[0]);
    console.log('Exclusive areas count:');
    for (const [area, count] of sortedAreas) {
      console.log(`  Area ${area}㎡: ${count} deals`);
    }

    // Check 59m2 specifically (around 59.00 ~ 60.00)
    const deals59 = docs.filter(d => {
      const isCanc = d.isCancelled === true || (d.cancelDate && d.cancelDate.trim().length > 0);
      if (isCanc) return false;
      const area = Number(d.exclusiveArea);
      return area >= 59.0 && area <= 60.5;
    });

    console.log(`Valid 59㎡ deals (excluding cancelled): ${deals59.length}`);
    const years = new Set(deals59.map(d => d.dealYear));
    const sortedYears = Array.from(years).sort((a, b) => a - b);
    console.log(`Years present: ${sortedYears.join(', ')}`);

    for (const yr of sortedYears) {
      const yrDeals = deals59.filter(d => d.dealYear === yr);
      const prices = yrDeals.map(d => d.price).sort((a, b) => a - b);
      const min = prices[0];
      const max = prices[prices.length - 1];
      const sum = prices.reduce((acc, p) => acc + p, 0);
      const avg = Math.round(sum / prices.length);
      const midIdx = Math.floor(prices.length / 2);
      const median = prices.length % 2 === 1 ? prices[midIdx] : Math.round((prices[midIdx - 1] + prices[midIdx]) / 2);
      console.log(`  Year ${yr}: ${yrDeals.length} deals | Avg: ${avg} | Median: ${median} | Min: ${min} | Max: ${max}`);
    }
  }

  process.exit(0);
}

analyze().catch(err => {
  console.error(err);
  process.exit(1);
});
