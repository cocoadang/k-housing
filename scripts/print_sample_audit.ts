import { getFirestoreDb } from '../src/server/firestore';
import { collection, query, where, getDocs } from 'firebase/firestore';

async function sampleAudit() {
  const db = getFirestoreDb();
  const complexes = [
    { id: 'gwacheon_raemian_sur', name: '과천 래미안슈르' },
    { id: 'jamsil_els', name: '잠실 엘스' },
    { id: 'banpo_raemian', name: '반포 래미안퍼스티지' },
  ];

  for (const c of complexes) {
    console.log(`\n=================== ${c.name} (${c.id}) ===================`);
    const q = query(collection(db, 'transactions'), where('complexId', '==', c.id));
    const snap = await getDocs(q);
    const valid = snap.docs
      .map(d => d.data())
      .filter(d => {
        const isCanc = d.isCancelled === true || (d.cancelDate && d.cancelDate.trim().length > 0);
        if (isCanc) return false;
        const area = Number(d.exclusiveArea);
        return area >= 59.0 && area <= 60.5;
      })
      .sort((a, b) => a.dealDate.localeCompare(b.dealDate));

    console.log(`Total valid 59㎡ deals: ${valid.length}`);
    console.log('--- Earliest 3 deals ---');
    valid.slice(0, 3).forEach(d => {
      console.log(`계약일: ${d.dealDate} | 단지명: ${d.complexName} | 전용면적: ${d.exclusiveArea}㎡ | 거래금액: ${d.price.toLocaleString()}만원 (${(d.price / 10000).toFixed(2)}억) | 층: ${d.floor}층`);
    });

    console.log('--- Latest 3 deals (2026) ---');
    valid.slice(-3).forEach(d => {
      console.log(`계약일: ${d.dealDate} | 단지명: ${d.complexName} | 전용면적: ${d.exclusiveArea}㎡ | 거래금액: ${d.price.toLocaleString()}만원 (${(d.price / 10000).toFixed(2)}억) | 층: ${d.floor}층`);
    });

    // Min & Max
    const byPrice = [...valid].sort((a, b) => a.price - b.price);
    const minD = byPrice[0];
    const maxD = byPrice[byPrice.length - 1];
    console.log(`--- 역대 최저가 거래 ---`);
    console.log(`계약일: ${minD.dealDate} | 단지명: ${minD.complexName} | 전용: ${minD.exclusiveArea}㎡ | 금액: ${minD.price.toLocaleString()}만원 | 층: ${minD.floor}층`);
    console.log(`--- 역대 최고가 거래 ---`);
    console.log(`계약일: ${maxD.dealDate} | 단지명: ${maxD.complexName} | 전용: ${maxD.exclusiveArea}㎡ | 금액: ${maxD.price.toLocaleString()}만원 | 층: ${maxD.floor}층`);
  }

  process.exit(0);
}

sampleAudit().catch(console.error);
