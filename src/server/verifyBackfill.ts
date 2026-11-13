import dotenv from 'dotenv';
dotenv.config();

import { getFirestoreDb } from './firestore';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { TARGET_COMPLEXES } from '../data/complexesData';
import { firestoreRepository } from './firestoreRepository';

export async function runFullVerification() {
  const db = getFirestoreDb();
  if (!db) {
    console.error('Firestore not available for verification');
    return;
  }

  console.log('====================================================');
  console.log('📊 [K-Housing] Historical Backfill Verification Audit');
  console.log('====================================================\n');

  // 1. Check settings/historicalBackfill
  const progressSnap = await getDoc(doc(db, 'settings', 'historicalBackfill'));
  const progressData = progressSnap.data() || {};
  console.log('1. [System Progress]');
  console.log(JSON.stringify(progressData, null, 2));

  // 2. Check backfillJobs
  const jobsSnap = await getDocs(collection(db, 'backfillJobs'));
  let completedJobs = 0;
  let failedJobs = 0;
  jobsSnap.forEach((d) => {
    const data = d.data();
    if (data.status === 'COMPLETED') completedJobs++;
    else if (data.status === 'FAILED') failedJobs++;
  });
  console.log(`\n2. [Jobs Count] Total: ${jobsSnap.size}, Completed: ${completedJobs}, Failed: ${failedJobs}`);

  // 3. Complex-by-complex Audit for 36 complexes
  console.log('\n3. [36 Complex Full Data Audit]');
  const complexStats: any[] = [];

  for (const complex of TARGET_COMPLEXES) {
    const txList = await firestoreRepository.getTransactions(complex.id, '201609', '202608', 'ALL');
    const monthlyList = await firestoreRepository.getMonthlyPrices(complex.id, 'ALL', '201609', '202608');
    const monthly59 = await firestoreRepository.getMonthlyPrices(complex.id, '59', '201609', '202608');
    const monthly84 = await firestoreRepository.getMonthlyPrices(complex.id, '84', '201609', '202608');

    let totalNormal = 0;
    let totalCancel = 0;
    let totalActive = 0;

    let minDate = '9999-99-99';
    let maxDate = '0000-00-00';

    txList.forEach((t) => {
      totalNormal += t.normalRowCount ?? (t.isCancelled ? 0 : 1);
      totalCancel += t.cancellationRowCount ?? (t.isCancelled ? 1 : 0);
      totalActive += t.activeCount ?? (t.isCancelled ? 0 : 1);
      if (t.dealDate < minDate) minDate = t.dealDate;
      if (t.dealDate > maxDate) maxDate = t.dealDate;
    });

    const hasEarliest = txList.length > 0;
    const earliestMonth = hasEarliest ? minDate.slice(0, 7) : 'N/A';
    const latestMonth = hasEarliest ? maxDate.slice(0, 7) : 'N/A';

    // 5Y and 10Y check (relative to 2026.08)
    // 5Y: has data in or before 2021.08
    // 10Y: has data in or before 2016.12
    const has5Y = txList.some((t) => t.dealYmd <= '202108');
    const has10Y = txList.some((t) => t.dealYmd <= '201612');

    const stat = {
      id: complex.id,
      name: complex.name,
      district: complex.district,
      lawdCd: complex.lawdCd,
      builtYear: complex.builtYear,
      uniqueFingerprints: txList.length,
      normalCount: totalNormal,
      cancelCount: totalCancel,
      activeCount: totalActive,
      earliestDate: hasEarliest ? minDate : 'N/A',
      latestDate: hasEarliest ? maxDate : 'N/A',
      earliestMonth,
      latestMonth,
      monthlyAllCount: monthlyList.length,
      monthly59Count: monthly59.length,
      monthly84Count: monthly84.length,
      has5YData: has5Y,
      has10YData: has10Y,
    };
    complexStats.push(stat);

    console.log(
      `[${complex.id}] ${complex.name} (Built: ${complex.builtYear}): Fingerprints=${stat.uniqueFingerprints}, Active=${stat.activeCount} (Norm=${stat.normalCount}, Cancel=${stat.cancelCount}), Range=${stat.earliestDate} ~ ${stat.latestDate}, MonthlyALL=${stat.monthlyAllCount} mos, 5Y=${has5Y ? 'O' : 'X'}, 10Y=${has10Y ? 'O' : 'X'}`
    );
  }

  // 4. Namcheon Xi Audit
  console.log('\n4. [Namcheon Xi Special Audit]');
  const namcheonTx = await firestoreRepository.getTransactions('busan_namcheon_xi', '201609', '202608', 'ALL');
  console.log(`Namcheon Xi total transactions: ${namcheonTx.length}`);
  if (namcheonTx.length > 0) {
    console.log(`Earliest Namcheon trade: Date=${namcheonTx[0].dealDate}, Price=${namcheonTx[0].price}만원, Area=${namcheonTx[0].exclusiveArea}㎡, ComplexName="${namcheonTx[0].complexName}"`);
    console.log(`Pre-2023 trades count (should be 0):`, namcheonTx.filter((t) => t.dealYmd < '202301').length);
  }

  // 5. Check Seoul Forest Riverview Xi and Dowon Samsung Raemian
  console.log('\n5. [Mandatory Inclusions Check]');
  const sfTx = await firestoreRepository.getTransactions('seongdong_seoulforest_riverview_xi', '201609', '202608', 'ALL');
  const dowonTx = await firestoreRepository.getTransactions('yongsan_dowon_samsung_raemian', '201609', '202608', 'ALL');
  console.log(`Seoul Forest Riverview Xi: TxCount=${sfTx.length}, Earliest=${sfTx[0]?.dealDate}`);
  console.log(`Dowon Samsung Raemian: TxCount=${dowonTx.length}, Earliest=${dowonTx[0]?.dealDate}`);

  // 6. Exclusions Check
  console.log('\n6. [Exclusions Check]');
  console.log('Trimage in TARGET_COMPLEXES:', TARGET_COMPLEXES.some((c) => c.name.includes('트리마제')));
  console.log('Hannam The Hill in TARGET_COMPLEXES:', TARGET_COMPLEXES.some((c) => c.name.includes('한남더힐')));

  return {
    progressData,
    completedJobs,
    failedJobs,
    complexStats,
  };
}

if (process.argv[1].includes('verifyBackfill')) {
  runFullVerification().then(() => process.exit(0));
}
