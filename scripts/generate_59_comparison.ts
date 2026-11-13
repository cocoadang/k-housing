import { createHash } from 'node:crypto';
import { weightedDealStats, effectiveDealCount, registeredAreaMatches } from '../src/utils/transactionStatistics';
import { AREA_FAMILIES_REGISTRY } from '../src/data/areaFamilies';
import { getReaderDb as getFirestoreDb, collection, query, where, getDocs } from '../src/server/firestoreReader';
import fs from 'fs';
import path from 'node:path';

interface Deal {
  id?: string;
  activeCount?: number;
  normalRowCount?: number;
  cancellationRowCount?: number;
  dealDate: string;
  dealYear: number;
  dealMonth: number;
  dealDay: number;
  price: number;
  exclusiveArea: number;
  complexName: string;
  complexId: string;
  floor?: number;
  isCancelled: boolean;
  cancelDate?: string;
}

interface YearStats {
  year: number;
  count: number;
  avgPrice: number;
  medianPrice: number;
  minPrice: number;
  maxPrice: number;
}

// Percentile function (Linear interpolation between closest ranks - NIST / Excel PERCENTILE.INC / R type 7)
function calculatePercentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) throw new Error('NO_OBSERVATIONS');
  if (sortedArr.length === 1) return sortedArr[0];
  const index = (sortedArr.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
}

// Historical percentile of a value: percentage of observations less than or equal to value
// Or rank-based percentile: (rank - 0.5) / n * 100 or count(x <= v) / n * 100
function getPercentileRank(arr: number[], val: number): number {
  const countLess = arr.filter(x => x < val).length;
  const countEqual = arr.filter(x => x === val).length;
  // Standard mid-rank percentile: (countLess + 0.5 * countEqual) / arr.length * 100
  // Or percentage strictly <= val
  return ((countLess + 0.5 * countEqual) / arr.length) * 100;
}

async function run() {
  const inputPath = process.env.ANALYSIS_INPUT;
  const snapshot: Deal[] | null = inputPath ? JSON.parse(fs.readFileSync(inputPath, 'utf8')) : null;
  const db = snapshot ? null : getFirestoreDb();
  if (!db && !snapshot) {
    console.error('No DB');
    process.exit(1);
  }

  const complexConfigs = [
    {
      id: 'gwacheon_raemian_sur',
      name: '과천 래미안슈르',
      shortName: '래미안슈르',
      areaMin: 59.0,
      areaMax: 60.5,
      builtDate: '2008-08',
    },
    {
      id: 'jamsil_els',
      name: '잠실 엘스',
      shortName: '잠실엘스',
      areaMin: 59.0,
      areaMax: 60.5,
      builtDate: '2008-09',
    },
    {
      id: 'banpo_raemian',
      name: '반포 래미안퍼스티지',
      shortName: '래미안퍼스티지',
      areaMin: 59.0,
      areaMax: 60.5,
      builtDate: '2009-07',
    },
  ];

  const rawDealsByComplex: Record<string, Deal[]> = {};
  const validDealsByComplex: Record<string, Deal[]> = {};
  const statsByComplex: Record<string, Record<number, YearStats>> = {};

  for (const cfg of complexConfigs) {
    const docs: Deal[] = snapshot ? snapshot.filter(d => d.complexId === cfg.id) : await (async () => {
      const snap = await getDocs(query(collection(db!, 'transactions'), where('complexId', '==', cfg.id)));
      return snap.docs.map(d => ({ ...d.data(), id: d.id }) as Deal);
    })();
    rawDealsByComplex[cfg.id] = docs;

    const family = AREA_FAMILIES_REGISTRY[cfg.id]?.find(f => f.standardCategory === '59');
    if (!family) throw new Error(`MISSING_REGISTERED_59_FAMILY: ${cfg.id}`);
    const valid = docs.filter(d => d.dealDate >= `${cfg.builtDate}-01` && d.dealDate <= new Date().toISOString().slice(0, 10) && effectiveDealCount(d) > 0 && Number.isFinite(d.price) && d.price > 0 && registeredAreaMatches(d.exclusiveArea, family.exactAreas));

    valid.sort((a, b) => a.dealDate.localeCompare(b.dealDate));
    validDealsByComplex[cfg.id] = valid;

    // Year stats
    const years = Array.from(new Set(valid.map(d => d.dealYear))).sort((a, b) => a - b);
    statsByComplex[cfg.id] = {};

    for (const yr of years) {
      const yrDeals = valid.filter(d => d.dealYear === yr);
      const stats = weightedDealStats(yrDeals);
      if (stats) statsByComplex[cfg.id][yr] = { year: yr, ...stats };
    }
  }

  // All years from 2008 to 2026
  const allYears: number[] = [];
  for (let y = 2008; y <= new Date().getFullYear(); y++) allYears.push(y);

  interface AnnualComparisonRow {
    year: number;
    gwacheon: YearStats | null;
    jamsil: YearStats | null;
    banpo: YearStats | null;
    ratioA: number | null; // Gwacheon / Jamsil
    ratioB: number | null; // Gwacheon / Banpo
    ratioC: number | null; // Jamsil / Banpo
  }

  const comparisonRows: AnnualComparisonRow[] = [];

  for (const yr of allYears) {
    const gw = statsByComplex['gwacheon_raemian_sur'][yr] || null;
    const js = statsByComplex['jamsil_els'][yr] || null;
    const bp = statsByComplex['banpo_raemian'][yr] || null;

    const ratioA = gw && js ? Math.round((gw.medianPrice / js.medianPrice) * 10000) / 10000 : null;
    const ratioB = gw && bp ? Math.round((gw.medianPrice / bp.medianPrice) * 10000) / 10000 : null;
    const ratioC = js && bp ? Math.round((js.medianPrice / bp.medianPrice) * 10000) / 10000 : null;

    comparisonRows.push({
      year: yr,
      gwacheon: gw,
      jamsil: js,
      banpo: bp,
      ratioA,
      ratioB,
      ratioC,
    });
  }

  // Summary statistics for ratios A, B, C
  function computeRatioStats(ratios: { year: number; val: number }[], name: string) {
    if (!ratios.length) return null;
    const vals = ratios.map(r => r.val).sort((a, b) => a - b);
    const n = vals.length;
    const sum = vals.reduce((a, b) => a + b, 0);
    const mean = Math.round((sum / n) * 10000) / 10000;
    const mid = Math.floor(n / 2);
    const median = n % 2 === 1 ? vals[mid] : Math.round(((vals[mid - 1] + vals[mid]) / 2) * 10000) / 10000;
    const p25 = Math.round(calculatePercentile(vals, 0.25) * 10000) / 10000;
    const p75 = Math.round(calculatePercentile(vals, 0.75) * 10000) / 10000;
    const min = vals[0];
    const max = vals[vals.length - 1];
    const recent = ratios[ratios.length - 1].val;
    const recentPercentileRank = Math.round(getPercentileRank(vals, recent) * 10) / 10;

    return {
      ratioName: name,
      observations: n,
      mean,
      median,
      p25,
      p75,
      min,
      max,
      recentValue: recent,
      recentPercentileRank,
      allValuesSorted: vals,
      series: ratios,
    };
  }

  const seriesA = comparisonRows.filter(r => r.ratioA !== null).map(r => ({ year: r.year, val: r.ratioA! }));
  const seriesB = comparisonRows.filter(r => r.ratioB !== null).map(r => ({ year: r.year, val: r.ratioB! }));
  const seriesC = comparisonRows.filter(r => r.ratioC !== null).map(r => ({ year: r.year, val: r.ratioC! }));

  const statsA = computeRatioStats(seriesA, 'A (과천 래미안슈르 / 잠실 엘스)');
  const statsB = computeRatioStats(seriesB, 'B (과천 래미안슈르 / 반포 래미안퍼스티지)');
  const statsC = computeRatioStats(seriesC, 'C (잠실 엘스 / 반포 래미안퍼스티지)');

  console.log('\n=== RATIO SUMMARY STATISTICS ===');
  console.log('Ratio A:', statsA);
  console.log('Ratio B:', statsB);
  console.log('Ratio C:', statsC);

  // Write out full verification dataset and analysis reports
  const fullOutput = {
    metadata: {
      generatedAt: new Date().toISOString(),
      canonicalInputSha256: createHash('sha256').update(JSON.stringify(rawDealsByComplex)).digest('hex'),
      upstreamMolitReverification: 'NOT_PERFORMED_BY_THIS_EXPORT_SCRIPT',
      inputMode: snapshot ? 'ARCHIVED_SNAPSHOT_NOT_CURRENT_OR_COMPLETE' : 'FIRESTORE_READ',
      coverage: Object.fromEntries(complexConfigs.map(c => [c.id, { sourceRows: rawDealsByComplex[c.id].length, completenessVerified: false }])),
      dataSource: '국토교통부 실거래가 공개시스템 원천데이터 (MOLIT_APT_TRADE)',
      dataPrinciples: [
        '국토교통부 실거래가 원천데이터만 사용',
        '매매 거래만 사용',
        '계약해제 거래 제외 (해제사유발생일/해제여부 True 제외)',
        '전용 59㎡ 계열만 사용 (과천 래미안슈르 59.97㎡, 잠실 엘스 59.96㎡, 반포 래미안퍼스티지 59.89~59.98㎡)',
        '임의 보간 금지 (거래 없는 연도는 거래 없음 표시)',
        '서로 다른 평형을 임의로 연결하지 않음',
      ],
      complexes: [
        {
          id: 'gwacheon_raemian_sur',
          name: '과천 래미안슈르 (과천3단지)',
          address: '경기도 과천시 원문동',
          moveInDate: '2008년 8월',
          exclusiveArea59Molit: '59.97㎡',
          total59ValidTransactions: validDealsByComplex['gwacheon_raemian_sur'].reduce((n, d) => n + effectiveDealCount(d), 0),
        },
        {
          id: 'jamsil_els',
          name: '잠실 엘스',
          address: '서울특별시 송파구 잠실동',
          moveInDate: '2008년 9월',
          exclusiveArea59Molit: '59.96㎡',
          total59ValidTransactions: validDealsByComplex['jamsil_els'].reduce((n, d) => n + effectiveDealCount(d), 0),
        },
        {
          id: 'banpo_raemian',
          name: '반포 래미안퍼스티지',
          address: '서울특별시 서초구 반포동',
          moveInDate: '2009년 7월',
          exclusiveArea59Molit: '59.89㎡, 59.96㎡, 59.98㎡',
          total59ValidTransactions: validDealsByComplex['banpo_raemian'].reduce((n, d) => n + effectiveDealCount(d), 0),
        },
      ],
    },
    sourceDeals: validDealsByComplex,
    annualStats: comparisonRows,
    relativePriceStats: {
      A_Gwacheon_to_Jamsil: statsA,
      B_Gwacheon_to_Banpo: statsB,
      C_Jamsil_to_Banpo: statsC,
    },
  };

  const outputDir = process.env.ANALYSIS_OUTPUT_DIR || 'data/generated';
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'molit_59_comparison_analysis.json'), JSON.stringify(fullOutput, null, 2));

  // CSV generation
  let csv = '연도,과천_거래건수,과천_평균가(만원),과천_중앙가(만원),과천_최저가(만원),과천_최고가(만원),잠실_거래건수,잠실_평균가(만원),잠실_중앙가(만원),잠실_최저가(만원),잠실_최고가(만원),반포_거래건수,반포_평균가(만원),반포_중앙가(만원),반포_최저가(만원),반포_최고가(만원),A_상대가격(과천/잠실),B_상대가격(과천/반포),C_상대가격(잠실/반포)\n';

  for (const r of comparisonRows) {
    const gwStr = r.gwacheon ? `${r.gwacheon.count},${r.gwacheon.avgPrice},${r.gwacheon.medianPrice},${r.gwacheon.minPrice},${r.gwacheon.maxPrice}` : '거래없음,-,-,-,-';
    const jsStr = r.jamsil ? `${r.jamsil.count},${r.jamsil.avgPrice},${r.jamsil.medianPrice},${r.jamsil.minPrice},${r.jamsil.maxPrice}` : '거래없음,-,-,-,-';
    const bpStr = r.banpo ? `${r.banpo.count},${r.banpo.avgPrice},${r.banpo.medianPrice},${r.banpo.minPrice},${r.banpo.maxPrice}` : '거래없음,-,-,-,-';
    const aStr = r.ratioA !== null ? r.ratioA.toFixed(4) : '-';
    const bStr = r.ratioB !== null ? r.ratioB.toFixed(4) : '-';
    const cStr = r.ratioC !== null ? r.ratioC.toFixed(4) : '-';
    csv += `${r.year},${gwStr},${jsStr},${bpStr},${aStr},${bStr},${cStr}\n`;
  }

  fs.writeFileSync(path.join(outputDir, 'molit_59_comparison_analysis.csv'), csv);
  console.log(`Saved corrected analysis and source deals to ${outputDir}. Completeness is not certified.`);

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
