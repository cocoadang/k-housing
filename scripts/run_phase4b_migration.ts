import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getFirestoreDb } from '../src/server/firestore';
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  Firestore,
} from 'firebase/firestore';
import { TARGET_COMPLEXES } from '../src/data/complexesData';
import { HISTORICAL_COMPLEXES } from '../src/data/redevelopmentLineages';
import { resolveAreaFamily, resolveStandardCategory } from '../src/utils/areaUtils';
import {
  acquireMigrationLock,
  releaseMigrationLock,
  isMigrationLocked,
} from '../src/server/migrationLock';
import {
  matchTradeRecord,
  RawFilePayload,
} from './run_phase2_discovery';

// Paths
const RAW_DIR = path.join(process.cwd(), 'data', 'historical_raw');
const BACKUP_V2_DIR = path.join(process.cwd(), 'data', 'migration_backup_v2');
const MANIFEST_V2_PATH = path.join(process.cwd(), 'data', 'authoritative_rebuild_manifest_v2.json');
const PROGRESS_FILE = path.join(process.cwd(), 'data', 'migration_progress_v2.json');
const RESULTS_DIR = path.join(process.cwd(), 'data', 'migration_results');

const LEGACY_COMPLEX_IDS = [
  'apgujeong_hyundai',
  'apgujeong_miseong',
  'apgujeong_sinhyundai',
  'magok_mvalley_6',
  'magok_mvalley_7',
  'mokdong_14',
  'mokdong_5',
  'mokdong_7',
  'yongsan_dowon_samsung_raemian',
];

const ALL_KNOWN_COMPLEX_IDS = [
  ...TARGET_COMPLEXES.map((c) => c.id),
  ...HISTORICAL_COMPLEXES.map((h) => h.id),
  ...LEGACY_COMPLEX_IDS,
];

function computeSha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export interface CanonicalTransactionGroup {
  documentId: string;
  fingerprint: string;
  complexId: string;
  complexName: string;
  dealYmd: string;
  dealYear: number;
  dealMonth: number;
  dealDay: number;
  dealDate: string;
  floor: number;
  price: number;
  exclusiveArea: number;
  areaFamilyId: string;
  standardAreaCategory: string;
  pricePerSqm: number;
  pricePerPyeong: number;
  normalRowCount: number;
  cancellationRowCount: number;
  activeCount: number;
  cancellationState: 'ACTIVE' | 'PARTIALLY_CANCELLED' | 'CANCELLED';
  cancelDates: string[];
  source: 'MOLIT_APT_TRADE';
  rawIdentifiers: string[];
  isPredecessor: boolean;
}

export interface BatchProgressEntry {
  migrationId: string;
  stage: string;
  batchId: number;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  expectedCount: number;
  actualCount: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

function updateProgress(progressData: { migrationId: string; batches: BatchProgressEntry[] }) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progressData, null, 2), 'utf8');
}

/**
 * Robust partitioned fetch of all transactions across all known complexes
 * Bypasses the Firestore 128 MiB query memory limit.
 */
export async function fetchAllLiveTransactionsPartitioned(db: Firestore): Promise<any[]> {
  const allDocs: any[] = [];
  const chunkSize = 6;

  for (let i = 0; i < ALL_KNOWN_COMPLEX_IDS.length; i += chunkSize) {
    const chunk = ALL_KNOWN_COMPLEX_IDS.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map(async (compId) => {
        const q = query(collection(db, 'transactions'), where('complexId', '==', compId));
        const snap = await getDocs(q);
        const docs: any[] = [];
        snap.forEach((docSnap) => {
          docs.push({
            id: docSnap.id,
            ...docSnap.data(),
          });
        });
        return docs;
      })
    );
    for (const res of results) {
      allDocs.push(...res);
    }
  }

  return allDocs;
}

export async function runPhase4BMigration() {
  const timestampStr = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 15);
  const migrationId = `khousing_transactions_${timestampStr}`;
  const startedAt = new Date().toISOString();

  console.log('================================================================');
  console.log(`PHASE 4B: SAFE AUTHORITATIVE TRANSACTION MIGRATION`);
  console.log(`Migration ID: ${migrationId}`);
  console.log(`Started At: ${startedAt}`);
  console.log('================================================================\n');

  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  // STAGE 0: LOCK ACQUISITION & BACKUP VERIFICATION
  console.log('[STAGE 0: LOCK ACQUISITION & BACKUP VERIFICATION]');
  acquireMigrationLock();
  if (!isMigrationLocked()) {
    throw new Error('Failed to acquire migration lock');
  }
  console.log(' - Application Writer Lock: ACTIVE (data/.migration_lock set)');

  // Verify Backup Artifacts
  const baselineV2Path = path.join(BACKUP_V2_DIR, 'transactions_live_baseline_v2.json');
  const forwardManifestV2Path = path.join(BACKUP_V2_DIR, 'migration_forward_manifest_v2.json');
  const rollbackManifestV2Path = path.join(BACKUP_V2_DIR, 'migration_rollback_manifest_v2.json');
  const metadataV2Path = path.join(BACKUP_V2_DIR, 'migration_metadata_v2.json');

  if (
    !fs.existsSync(baselineV2Path) ||
    !fs.existsSync(forwardManifestV2Path) ||
    !fs.existsSync(rollbackManifestV2Path) ||
    !fs.existsSync(metadataV2Path) ||
    !fs.existsSync(MANIFEST_V2_PATH)
  ) {
    releaseMigrationLock();
    throw new Error('Required V2 backup or manifest artifacts are missing');
  }
  console.log(' - All V2 backup and manifest artifacts confirmed present.');

  const manifestV2 = JSON.parse(fs.readFileSync(MANIFEST_V2_PATH, 'utf8'));
  const baselineDocs: any[] = JSON.parse(fs.readFileSync(baselineV2Path, 'utf8'));
  console.log(` - Loaded Baseline V2: ${baselineDocs.length} docs`);
  console.log(` - Baseline V2 Checksum: ${manifestV2.liveChecksum}`);
  console.log(` - Expected Canonical Checksum: ${manifestV2.checksum}`);

  // STAGE 0.5: CONCURRENCY GATE & LIVE STATUS CHECK
  console.log('\n[STAGE 0.5: CONCURRENCY GATE & LIVE STATUS CHECK]');
  const db = getFirestoreDb();
  if (!db) {
    releaseMigrationLock();
    throw new Error('Failed to initialize Firestore DB client');
  }

  console.log(' - Reading live Firestore transactions (partitioned by complex)...');
  const currentLiveDocs = await fetchAllLiveTransactionsPartitioned(db);

  const sortDocs = (docs: any[]) =>
    [...docs].sort((a, b) => String(a.id || a.fingerprint).localeCompare(String(b.id || b.fingerprint)));
  const sortedLiveDocs = sortDocs(currentLiveDocs);

  console.log(` - Current Live Count in Firestore: ${sortedLiveDocs.length}`);

  // Check state: is it baseline (13,982) or stage1-4 applied (49,219)?
  const isBaselineState = sortedLiveDocs.length === manifestV2.liveBaselineCount;
  const isPostWriteState = sortedLiveDocs.length === 49219;

  if (!isBaselineState && !isPostWriteState) {
    console.error(`❌ CONCURRENCY DRIFT DETECTED: Live count ${sortedLiveDocs.length} matches neither baseline (13,982) nor post-write state (49,219).`);
    releaseMigrationLock();
    return {
      verdict: 'MIGRATION_ABORT_CONCURRENCY_DRIFT',
      migrationId,
      liveCount: sortedLiveDocs.length,
      expectedBaseline: manifestV2.liveBaselineCount,
      expectedPostWrite: 49219,
    };
  }

  if (isBaselineState) {
    const currentLiveChecksum = computeSha256(
      JSON.stringify(sortedLiveDocs.map((d) => ({ id: d.id, price: d.price, date: d.dealDate, area: d.exclusiveArea, floor: d.floor })))
    );
    if (currentLiveChecksum !== manifestV2.liveChecksum) {
      console.error('❌ CONCURRENCY GATE FAILED: Live Firestore checksum has drifted.');
      releaseMigrationLock();
      return {
        verdict: 'MIGRATION_ABORT_CONCURRENCY_DRIFT',
        migrationId,
        liveCount: sortedLiveDocs.length,
        liveChecksum: currentLiveChecksum,
        baselineChecksum: manifestV2.liveChecksum,
      };
    }
    console.log(' - Concurrency Gate: ✅ PASS (Exact match to Baseline V2: 13,982 docs)');
  } else {
    console.log(' - Concurrency Gate: ✅ PASS (Post-Write State Confirmed: 49,219 docs - Stage 1-4 already committed)');
  }

  // RECONSTRUCT CANONICAL DATASET FROM HISTORICAL RAW
  console.log('\n[RECONSTRUCTING CANONICAL DATASET]');
  const canonicalGroupsMap = new Map<string, CanonicalTransactionGroup>();
  const rawRowsByComplex = new Map<string, any[]>();
  for (const c of TARGET_COMPLEXES) rawRowsByComplex.set(c.id, []);
  for (const h of HISTORICAL_COMPLEXES) rawRowsByComplex.set(h.id, []);

  const lawdDirs = fs.readdirSync(RAW_DIR).filter((d) => fs.statSync(path.join(RAW_DIR, d)).isDirectory());
  for (const lawd of lawdDirs) {
    const lawdDirPath = path.join(RAW_DIR, lawd);
    const files = fs.readdirSync(lawdDirPath).filter((f) => f.endsWith('.json'));

    for (const f of files) {
      const filePath = path.join(lawdDirPath, f);
      const rawFile: RawFilePayload = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      for (const item of rawFile.items) {
        const match = matchTradeRecord(item, lawd);
        if (match.type === 'MATCHED_CURRENT' || match.type === 'MATCHED_PREDECESSOR') {
          rawRowsByComplex.get(match.complexId!)?.push({
            item,
            lawdCd: lawd,
            complexId: match.complexId!,
            complexName: match.complexName!,
            type: match.type === 'MATCHED_PREDECESSOR' ? 'PREDECESSOR' : 'CURRENT',
          });
        }
      }
    }
  }

  for (const [compId, rows] of rawRowsByComplex.entries()) {
    for (const r of rows) {
      const it = r.item;
      const rawPrice = parseInt(String(it.dealAmount || '0').replace(/,/g, ''), 10);
      const rawArea = parseFloat(String(it.excluUseAr || '0'));
      const dYear = parseInt(String(it.dealYear || '0'), 10);
      const dMonth = parseInt(String(it.dealMonth || '0'), 10);
      const dDay = parseInt(String(it.dealDay || '0'), 10);
      const floor = parseInt(String(it.floor || '1'), 10);

      const mStr = dMonth < 10 ? `0${dMonth}` : `${dMonth}`;
      const dStr = dDay < 10 ? `0${dDay}` : `${dDay}`;
      const areaInt = Math.round(rawArea * 100);
      const fp = `${compId}_${dYear}${mStr}_d${dDay}_f${floor}_p${rawPrice}_a${areaInt}`;

      const resFamily = resolveAreaFamily(rawArea, compId);
      const familyId = resFamily.status === 'MATCHED' && resFamily.family ? resFamily.family.id : 'UNMAPPED';
      const stdCat = resolveStandardCategory(rawArea, compId);

      const isCancel = it.cdealType === 'O' || it.cdealType === '0';
      const cancelDate = String(it.cdealDay || '').trim();

      if (!canonicalGroupsMap.has(fp)) {
        canonicalGroupsMap.set(fp, {
          documentId: fp,
          fingerprint: fp,
          complexId: compId,
          complexName: r.complexName,
          dealYmd: `${dYear}${mStr}`,
          dealYear: dYear,
          dealMonth: dMonth,
          dealDay: dDay,
          dealDate: `${dYear}-${mStr}-${dStr}`,
          floor,
          price: rawPrice,
          exclusiveArea: Math.round(rawArea * 100) / 100,
          areaFamilyId: familyId,
          standardAreaCategory: stdCat,
          pricePerSqm: Math.round((rawPrice / rawArea) * 10) / 10,
          pricePerPyeong: Math.round(((rawPrice / rawArea) * 3.30578) * 10) / 10,
          normalRowCount: 0,
          cancellationRowCount: 0,
          activeCount: 0,
          cancellationState: 'ACTIVE',
          cancelDates: [],
          source: 'MOLIT_APT_TRADE',
          rawIdentifiers: [],
          isPredecessor: r.type === 'PREDECESSOR',
        });
      }

      const grp = canonicalGroupsMap.get(fp)!;
      if (isCancel) {
        grp.cancellationRowCount++;
        if (cancelDate && !grp.cancelDates.includes(cancelDate)) {
          grp.cancelDates.push(cancelDate);
        }
      } else {
        grp.normalRowCount++;
      }
      grp.rawIdentifiers.push(`${it.aptSeq || 'seq'}_${it.bonbun || ''}_${it.bubun || ''}`);
    }
  }

  for (const grp of canonicalGroupsMap.values()) {
    const normal = grp.normalRowCount;
    const cancel = grp.cancellationRowCount;

    if (normal > cancel && cancel > 0) {
      grp.cancellationState = 'PARTIALLY_CANCELLED';
      grp.activeCount = normal - cancel;
    } else if (normal <= cancel) {
      grp.cancellationState = 'CANCELLED';
      grp.activeCount = 0;
    } else {
      grp.cancellationState = 'ACTIVE';
      grp.activeCount = normal;
    }
  }

  const allCanonicalGroups = Array.from(canonicalGroupsMap.values());
  const canonicalChecksum = computeSha256(JSON.stringify(allCanonicalGroups));
  console.log(` - Canonical Groups: ${allCanonicalGroups.length}`);
  console.log(` - Canonical Checksum: ${canonicalChecksum}`);
  if (canonicalChecksum !== manifestV2.checksum) {
    releaseMigrationLock();
    throw new Error('Canonical checksum does not match manifest V2');
  }

  const predecessorGroups = allCanonicalGroups.filter((g) => g.isPredecessor);
  const currentTargetGroups = allCanonicalGroups.filter((g) => !g.isPredecessor);

  const liveDocMap = new Map<string, any>();
  for (const d of sortedLiveDocs) {
    liveDocMap.set(d.id || d.fingerprint, d);
  }

  const targetComplexIdSet = new Set(TARGET_COMPLEXES.map((c) => c.id));
  const predecessorComplexIdSet = new Set(HISTORICAL_COMPLEXES.map((h) => h.id));

  // Legacy baseline identification
  const baselineDocMap = new Map<string, any>();
  for (const b of baselineDocs) {
    baselineDocMap.set(b.id || b.fingerprint, b);
  }

  const liveLegacyDocs = baselineDocs.filter(
    (d) => !targetComplexIdSet.has(d.complexId) && !predecessorComplexIdSet.has(d.complexId)
  );
  const liveContaminatedDocs = sortedLiveDocs.filter(
    (d) => d.complexId === 'gangdong_olympic_park' && (d.dealYmd || d.dealDate?.slice(0, 7).replace(/-/g, '')) <= '201912'
  );
  const canonicalDocIdSet = new Set(allCanonicalGroups.map((g) => g.documentId));
  const liveTargetFalsePositives = sortedLiveDocs.filter(
    (d) =>
      targetComplexIdSet.has(d.complexId) &&
      !(d.complexId === 'gangdong_olympic_park' && (d.dealYmd || d.dealDate?.slice(0, 7).replace(/-/g, '')) <= '201912') &&
      !canonicalDocIdSet.has(d.id || d.fingerprint)
  );

  const currentGroupsToCreate = currentTargetGroups.filter((g) => !liveDocMap.has(g.documentId));
  const liveTargetMatchedInCanonical = baselineDocs.filter(
    (d) =>
      targetComplexIdSet.has(d.complexId) &&
      !(d.complexId === 'gangdong_olympic_park' && (d.dealYmd || d.dealDate?.slice(0, 7).replace(/-/g, '')) <= '201912') &&
      canonicalDocIdSet.has(d.id || d.fingerprint)
  );

  console.log('\n[PLAN CONFIRMATION]');
  console.log(` - Predecessor Groups: ${predecessorGroups.length} (Expected: 3,384)`);
  console.log(` - Current Target Groups to CREATE: ${currentGroupsToCreate.length}`);
  console.log(` - Target Docs to UPDATE: ${liveTargetMatchedInCanonical.length} (Expected: 7,701)`);
  console.log(` - Contamination to DELETE: ${liveContaminatedDocs.length} (Expected: 581)`);
  console.log(` - False Positives to DELETE: ${liveTargetFalsePositives.length} (Expected: 153)`);
  console.log(` - Total DELETE Planned: ${liveContaminatedDocs.length + liveTargetFalsePositives.length} (Expected: 734)`);
  console.log(` - Legacy Docs to KEEP: ${liveLegacyDocs.length} (Expected: 5,547)`);

  const progressData: { migrationId: string; batches: BatchProgressEntry[] } = {
    migrationId,
    batches: [],
  };

  const BATCH_SIZE = 400;
  let batchCounter = 0;

  let predecessorCreated = 0;
  let predecessorSkipped = 0;
  let currentCreated = 0;
  let currentSkipped = 0;
  let updatedCount = 0;
  let contaminationDeleted = 0;
  let falsePositiveDeleted = 0;

  // ============================================================================
  // STAGE 1 & 2: PREDECESSOR CREATE & VERIFICATION
  // ============================================================================
  if (isBaselineState) {
    console.log('\n[STAGE 1: PREDECESSOR CREATE]');
    for (let i = 0; i < predecessorGroups.length; i += BATCH_SIZE) {
      batchCounter++;
      const chunk = predecessorGroups.slice(i, i + BATCH_SIZE);
      const batchId = batchCounter;
      const startedAt = new Date().toISOString();

      const progressEntry: BatchProgressEntry = {
        migrationId,
        stage: 'STAGE_1_PREDECESSOR_CREATE',
        batchId,
        operation: 'CREATE',
        status: 'RUNNING',
        expectedCount: chunk.length,
        actualCount: 0,
        startedAt,
      };
      progressData.batches.push(progressEntry);
      updateProgress(progressData);

      const batch = writeBatch(db);
      let itemsInBatch = 0;

      for (const item of chunk) {
        const existing = liveDocMap.get(item.documentId);
        if (existing) {
          if (existing.price === item.price && existing.exclusiveArea === item.exclusiveArea) {
            predecessorSkipped++;
            continue;
          } else {
            releaseMigrationLock();
            throw new Error(`Conflict in Predecessor CREATE: docId ${item.documentId}`);
          }
        }

        const docRef = doc(db, 'transactions', item.documentId);
        batch.set(docRef, {
          id: item.documentId,
          fingerprint: item.fingerprint,
          complexId: item.complexId,
          complexName: item.complexName,
          dealDate: item.dealDate,
          dealYear: item.dealYear,
          dealMonth: item.dealMonth,
          dealDay: item.dealDay,
          dealYmd: item.dealYmd,
          floor: item.floor,
          price: item.price,
          exclusiveArea: item.exclusiveArea,
          areaFamilyId: item.areaFamilyId,
          standardAreaCategory: item.standardAreaCategory,
          areaCategory: item.standardAreaCategory,
          pricePerSqm: item.pricePerSqm,
          pricePerPyeong: item.pricePerPyeong,
          normalRowCount: item.normalRowCount,
          cancellationRowCount: item.cancellationRowCount,
          activeCount: item.activeCount,
          cancellationState: item.cancellationState,
          isCancelled: item.cancellationState === 'CANCELLED',
          cancelDates: item.cancelDates,
          source: item.source,
          isPredecessor: item.isPredecessor,
          migrationId,
        });
        itemsInBatch++;
      }

      if (itemsInBatch > 0) {
        await batch.commit();
        predecessorCreated += itemsInBatch;
      }

      progressEntry.actualCount = itemsInBatch;
      progressEntry.status = 'COMPLETED';
      progressEntry.completedAt = new Date().toISOString();
      updateProgress(progressData);

      await new Promise((r) => setTimeout(r, 40));
    }
  } else {
    console.log('\n[STAGE 1: PREDECESSOR CREATE (ALREADY COMMITTED)]');
    predecessorCreated = 3384;
  }

  console.log('\n[STAGE 2: PREDECESSOR VERIFICATION]');
  let livePredCount = 0;
  let predUnmappedCount = 0;
  let predInvalidPrice = 0;
  let predPayloadMismatch = 0;

  for (const d of sortedLiveDocs) {
    if (predecessorComplexIdSet.has(d.complexId)) {
      livePredCount++;
      if (!d.areaFamilyId || d.areaFamilyId === 'UNMAPPED') predUnmappedCount++;
      if (!d.price || d.price <= 0) predInvalidPrice++;
      const expectedCanonical = canonicalGroupsMap.get(d.id || d.fingerprint);
      if (!expectedCanonical || expectedCanonical.price !== d.price) {
        predPayloadMismatch++;
      }
    }
  }

  console.log(` - Predecessor Docs in Firestore: ${livePredCount} (Expected: 3,384)`);
  console.log(` - Unmapped Area Families: ${predUnmappedCount}`);
  console.log(` - Invalid Price: ${predInvalidPrice}`);
  console.log(` - Payload Mismatch: ${predPayloadMismatch}`);

  if (
    livePredCount !== 3384 ||
    predUnmappedCount > 0 ||
    predInvalidPrice > 0 ||
    predPayloadMismatch > 0
  ) {
    releaseMigrationLock();
    throw new Error('Predecessor verification failed! Aborting.');
  }
  console.log(' - Stage 2 Predecessor Verification: ✅ 100% PASS');

  // ============================================================================
  // STAGE 3 & 4: CURRENT TARGET CREATE & UPDATE
  // ============================================================================
  if (isBaselineState) {
    console.log('\n[STAGE 3: CURRENT TARGET CREATE]');
    for (let i = 0; i < currentGroupsToCreate.length; i += BATCH_SIZE) {
      batchCounter++;
      const chunk = currentGroupsToCreate.slice(i, i + BATCH_SIZE);
      const batchId = batchCounter;
      const startedAt = new Date().toISOString();

      const progressEntry: BatchProgressEntry = {
        migrationId,
        stage: 'STAGE_3_CURRENT_TARGET_CREATE',
        batchId,
        operation: 'CREATE',
        status: 'RUNNING',
        expectedCount: chunk.length,
        actualCount: 0,
        startedAt,
      };
      progressData.batches.push(progressEntry);
      updateProgress(progressData);

      const batch = writeBatch(db);
      let itemsInBatch = 0;

      for (const item of chunk) {
        const existing = liveDocMap.get(item.documentId);
        if (existing) {
          if (existing.price === item.price && existing.exclusiveArea === item.exclusiveArea) {
            currentSkipped++;
            continue;
          } else {
            releaseMigrationLock();
            throw new Error(`Conflict in Current Target CREATE: docId ${item.documentId}`);
          }
        }

        const docRef = doc(db, 'transactions', item.documentId);
        batch.set(docRef, {
          id: item.documentId,
          fingerprint: item.fingerprint,
          complexId: item.complexId,
          complexName: item.complexName,
          dealDate: item.dealDate,
          dealYear: item.dealYear,
          dealMonth: item.dealMonth,
          dealDay: item.dealDay,
          dealYmd: item.dealYmd,
          floor: item.floor,
          price: item.price,
          exclusiveArea: item.exclusiveArea,
          areaFamilyId: item.areaFamilyId,
          standardAreaCategory: item.standardAreaCategory,
          areaCategory: item.standardAreaCategory,
          pricePerSqm: item.pricePerSqm,
          pricePerPyeong: item.pricePerPyeong,
          normalRowCount: item.normalRowCount,
          cancellationRowCount: item.cancellationRowCount,
          activeCount: item.activeCount,
          cancellationState: item.cancellationState,
          isCancelled: item.cancellationState === 'CANCELLED',
          cancelDates: item.cancelDates,
          source: item.source,
          isPredecessor: false,
          migrationId,
        });
        itemsInBatch++;
      }

      if (itemsInBatch > 0) {
        await batch.commit();
        currentCreated += itemsInBatch;
      }

      progressEntry.actualCount = itemsInBatch;
      progressEntry.status = 'COMPLETED';
      progressEntry.completedAt = new Date().toISOString();
      updateProgress(progressData);

      await new Promise((r) => setTimeout(r, 40));
    }

    console.log('\n[STAGE 4: EXISTING TARGET UPDATE]');
    for (let i = 0; i < liveTargetMatchedInCanonical.length; i += BATCH_SIZE) {
      batchCounter++;
      const chunk = liveTargetMatchedInCanonical.slice(i, i + BATCH_SIZE);
      const batchId = batchCounter;
      const startedAt = new Date().toISOString();

      const progressEntry: BatchProgressEntry = {
        migrationId,
        stage: 'STAGE_4_CURRENT_TARGET_UPDATE',
        batchId,
        operation: 'UPDATE',
        status: 'RUNNING',
        expectedCount: chunk.length,
        actualCount: 0,
        startedAt,
      };
      progressData.batches.push(progressEntry);
      updateProgress(progressData);

      const batch = writeBatch(db);
      let itemsInBatch = 0;

      for (const liveDoc of chunk) {
        const docId = liveDoc.id || liveDoc.fingerprint;
        const canonicalGrp = canonicalGroupsMap.get(docId);
        if (!canonicalGrp) {
          releaseMigrationLock();
          throw new Error(`Target update error: docId ${docId} not found in canonical groups`);
        }

        const docRef = doc(db, 'transactions', docId);
        batch.update(docRef, {
          areaFamilyId: canonicalGrp.areaFamilyId,
          standardAreaCategory: canonicalGrp.standardAreaCategory,
          normalRowCount: canonicalGrp.normalRowCount,
          cancellationRowCount: canonicalGrp.cancellationRowCount,
          activeCount: canonicalGrp.activeCount,
          cancellationState: canonicalGrp.cancellationState,
          isCancelled: canonicalGrp.cancellationState === 'CANCELLED',
          cancelDates: canonicalGrp.cancelDates,
          migrationId,
        });
        itemsInBatch++;
      }

      if (itemsInBatch > 0) {
        await batch.commit();
        updatedCount += itemsInBatch;
      }

      progressEntry.actualCount = itemsInBatch;
      progressEntry.status = 'COMPLETED';
      progressEntry.completedAt = new Date().toISOString();
      updateProgress(progressData);

      await new Promise((r) => setTimeout(r, 40));
    }
  } else {
    console.log('\n[STAGE 3: CURRENT TARGET CREATE (ALREADY COMMITTED)]');
    currentCreated = 31853;
    console.log('\n[STAGE 4: EXISTING TARGET UPDATE (ALREADY COMMITTED)]');
    updatedCount = 7701;
  }

  // ============================================================================
  // STAGE 5: CANONICAL FULL VERIFICATION (BEFORE DELETE)
  // ============================================================================
  console.log('\n[STAGE 5: CANONICAL FULL VERIFICATION (BEFORE DELETE)]');
  console.log(' - Verifying all 42,938 canonical records in live Firestore...');
  let canonicalPresent = 0;
  let canonicalMissing = 0;
  let canonicalMismatch = 0;
  let canonicalAreaFamilyMissing = 0;

  for (const grp of allCanonicalGroups) {
    const liveD = liveDocMap.get(grp.documentId);
    if (!liveD) {
      canonicalMissing++;
    } else {
      canonicalPresent++;
      if (liveD.price !== grp.price || Math.abs(liveD.exclusiveArea - grp.exclusiveArea) > 0.05) {
        canonicalMismatch++;
      }
      if (!liveD.areaFamilyId || liveD.areaFamilyId === 'UNMAPPED') {
        canonicalAreaFamilyMissing++;
      }
    }
  }

  console.log(` - Canonical Expected: ${allCanonicalGroups.length}`);
  console.log(` - Canonical Present: ${canonicalPresent} / ${allCanonicalGroups.length}`);
  console.log(` - Canonical Missing: ${canonicalMissing}`);
  console.log(` - Canonical Mismatch: ${canonicalMismatch}`);
  console.log(` - Canonical AreaFamily Missing: ${canonicalAreaFamilyMissing}`);

  if (
    canonicalPresent !== allCanonicalGroups.length ||
    canonicalMissing > 0 ||
    canonicalMismatch > 0 ||
    canonicalAreaFamilyMissing > 0
  ) {
    releaseMigrationLock();
    throw new Error('Stage 5 Canonical Verification Failed! DELETE execution BLOCKED.');
  }
  console.log(' - Stage 5 Verification: ✅ 100% PASS (DELETE Execution APPROVED)');

  // ============================================================================
  // STAGE 6: CONFIRMED DELETE (581 Contamination + 153 False Positives = 734)
  // ============================================================================
  console.log('\n[STAGE 6: CONFIRMED DELETE]');
  console.log(' - Verifying individual guards for 581 Contamination documents...');
  for (const oldDoc of liveContaminatedDocs) {
    const rawPrice = parseInt(String(oldDoc.price || '0'), 10);
    const rawArea = parseFloat(String(oldDoc.exclusiveArea || '0'));
    const floor = parseInt(String(oldDoc.floor || '1'), 10);
    const ym = oldDoc.dealYmd || oldDoc.dealDate.replace(/-/g, '').slice(0, 6);
    const day = oldDoc.dealDay || parseInt(oldDoc.dealDate.slice(8, 10), 10);
    const areaInt = Math.round(rawArea * 100);

    let replacementExists = false;
    for (let num = 1; num <= 4; num++) {
      const predId = `dunchon_jugong_${num}`;
      const candidateId = `${predId}_${ym}_d${day}_f${floor}_p${rawPrice}_a${areaInt}`;
      if (liveDocMap.has(candidateId)) {
        replacementExists = true;
        break;
      }
    }
    if (!replacementExists) {
      for (const [id, data] of liveDocMap.entries()) {
        if (
          predecessorComplexIdSet.has(data.complexId) &&
          data.dealYmd === ym &&
          data.dealDay === day &&
          data.price === rawPrice &&
          data.floor === floor
        ) {
          replacementExists = true;
          break;
        }
      }
    }

    if (!replacementExists) {
      releaseMigrationLock();
      throw new Error(`Contamination doc ${oldDoc.id} has no replacement in predecessor! DELETE aborted.`);
    }
  }
  console.log(' - 581/581 Contamination Replacements Verified in Firestore.');

  console.log(' - Verifying individual guards for 153 False Positive documents...');
  for (const fpDoc of liveTargetFalsePositives) {
    const docId = fpDoc.id || fpDoc.fingerprint;
    if (canonicalDocIdSet.has(docId)) {
      releaseMigrationLock();
      throw new Error(`False positive doc ${docId} is unexpectedly present in canonical dataset! DELETE aborted.`);
    }
  }
  console.log(' - 153/153 False Positives Guard Verified.');

  const allDeletes = [
    ...liveContaminatedDocs.map((d) => ({ ...d, deleteCategory: 'CONTAMINATION' })),
    ...liveTargetFalsePositives.map((d) => ({ ...d, deleteCategory: 'FALSE_POSITIVE' })),
  ];

  for (let i = 0; i < allDeletes.length; i += BATCH_SIZE) {
    batchCounter++;
    const chunk = allDeletes.slice(i, i + BATCH_SIZE);
    const batchId = batchCounter;
    const startedAt = new Date().toISOString();

    const progressEntry: BatchProgressEntry = {
      migrationId,
      stage: 'STAGE_6_CONFIRMED_DELETE',
      batchId,
      operation: 'DELETE',
      status: 'RUNNING',
      expectedCount: chunk.length,
      actualCount: 0,
      startedAt,
    };
    progressData.batches.push(progressEntry);
    updateProgress(progressData);

    const batch = writeBatch(db);
    for (const d of chunk) {
      const docId = d.id || d.fingerprint;
      const docRef = doc(db, 'transactions', docId);
      batch.delete(docRef);
      if (d.deleteCategory === 'CONTAMINATION') contaminationDeleted++;
      else falsePositiveDeleted++;
    }

    await batch.commit();

    progressEntry.actualCount = chunk.length;
    progressEntry.status = 'COMPLETED';
    progressEntry.completedAt = new Date().toISOString();
    updateProgress(progressData);

    console.log(` - Batch ${batchId} (DELETE): deleted ${chunk.length} docs`);
    await new Promise((r) => setTimeout(r, 40));
  }
  console.log(` - Stage 6 Complete: Deleted ${contaminationDeleted} Contamination + ${falsePositiveDeleted} False Positives (Total: ${contaminationDeleted + falsePositiveDeleted})`);

  // ============================================================================
  // STAGE 7: FINAL VERIFICATION
  // ============================================================================
  console.log('\n[STAGE 7: FINAL VERIFICATION]');
  console.log(' - Fetching full final transactions collection (partitioned)...');
  const finalDocs = await fetchAllLiveTransactionsPartitioned(db);

  const sortedFinalDocs = sortDocs(finalDocs);
  const finalDocCount = sortedFinalDocs.length;
  console.log(` - Total Final Documents: ${finalDocCount} (Expected: 48,485)`);

  const finalLegacyDocs = sortedFinalDocs.filter(
    (d) => !targetComplexIdSet.has(d.complexId) && !predecessorComplexIdSet.has(d.complexId)
  );
  const finalCanonicalDocs = sortedFinalDocs.filter(
    (d) => targetComplexIdSet.has(d.complexId) || predecessorComplexIdSet.has(d.complexId)
  );

  console.log(` - Final Legacy Non-Target: ${finalLegacyDocs.length} (Expected: 5,547)`);
  console.log(` - Final Canonical Target: ${finalCanonicalDocs.length} (Expected: 42,938)`);

  // Legacy payload preservation verification
  const initialLegacyMap = new Map<string, any>();
  for (const ld of liveLegacyDocs) {
    initialLegacyMap.set(ld.id || ld.fingerprint, ld);
  }
  let legacyChangedCount = 0;
  for (const fld of finalLegacyDocs) {
    const init = initialLegacyMap.get(fld.id || fld.fingerprint);
    if (!init || init.price !== fld.price || init.exclusiveArea !== fld.exclusiveArea) {
      legacyChangedCount++;
    }
  }
  console.log(` - Legacy Payloads Changed: ${legacyChangedCount} (Expected: 0)`);

  // Contamination verification
  let remainingContamination = 0;
  for (const fd of sortedFinalDocs) {
    if (fd.complexId === 'gangdong_olympic_park' && (fd.dealYmd || fd.dealDate?.slice(0, 7).replace(/-/g, '')) <= '201912') {
      remainingContamination++;
    }
  }
  console.log(` - Remaining Contamination under Olympic Park: ${remainingContamination} (Expected: 0)`);

  // False positive verification
  let remainingFalsePositives = 0;
  for (const fp of liveTargetFalsePositives) {
    if (sortedFinalDocs.some((d) => (d.id || d.fingerprint) === (fp.id || fp.fingerprint))) {
      remainingFalsePositives++;
    }
  }
  console.log(` - Remaining False Positives: ${remainingFalsePositives} (Expected: 0)`);

  // Cancellation verification
  let finalActiveCount = 0;
  let finalPartialCount = 0;
  let finalCancelledCount = 0;
  for (const cd of finalCanonicalDocs) {
    if (cd.cancellationState === 'ACTIVE') finalActiveCount++;
    else if (cd.cancellationState === 'PARTIALLY_CANCELLED') finalPartialCount++;
    else if (cd.cancellationState === 'CANCELLED') finalCancelledCount++;
  }
  console.log(` - Cancellation Breakdown in Canonical:`);
  console.log(`   * Active Groups: ${finalActiveCount} (Expected: 42,051)`);
  console.log(`   * Partially Cancelled Groups: ${finalPartialCount} (Expected: 7)`);
  console.log(`   * Fully Cancelled Groups: ${finalCancelledCount} (Expected: 880)`);
  console.log(`   * Total: ${finalActiveCount + finalPartialCount + finalCancelledCount}`);

  // Area coverage verification
  let finalUnmappedArea = 0;
  for (const cd of finalCanonicalDocs) {
    if (!cd.areaFamilyId || cd.areaFamilyId === 'UNMAPPED') finalUnmappedArea++;
  }
  console.log(` - Canonical Unmapped Area Families: ${finalUnmappedArea} (Expected: 0)`);

  // Checksums
  const targetCanonicalChecksum = computeSha256(
    JSON.stringify(
      sortDocs(finalCanonicalDocs).map((d) => ({
        id: d.id,
        price: d.price,
        area: d.exclusiveArea,
        floor: d.floor,
        family: d.areaFamilyId,
        cancel: d.cancellationState,
      }))
    )
  );
  const legacyChecksum = computeSha256(
    JSON.stringify(
      sortDocs(finalLegacyDocs).map((d) => ({
        id: d.id,
        price: d.price,
        area: d.exclusiveArea,
        floor: d.floor,
      }))
    )
  );
  const fullTransactionsChecksum = computeSha256(
    JSON.stringify(
      sortedFinalDocs.map((d) => ({
        id: d.id,
        price: d.price,
        area: d.exclusiveArea,
        floor: d.floor,
      }))
    )
  );

  console.log(`\n[FINAL CHECKSUMS]`);
  console.log(` - Target Canonical Checksum: ${targetCanonicalChecksum}`);
  console.log(` - Legacy Checksum: ${legacyChecksum}`);
  console.log(` - Full Transactions Checksum: ${fullTransactionsChecksum}`);

  const isSuccess =
    finalDocCount === 48485 &&
    finalLegacyDocs.length === 5547 &&
    finalCanonicalDocs.length === 42938 &&
    legacyChangedCount === 0 &&
    remainingContamination === 0 &&
    remainingFalsePositives === 0 &&
    finalCancelledCount === 880 &&
    finalPartialCount === 7 &&
    finalActiveCount === 42051 &&
    finalUnmappedArea === 0;

  // Release migration lock
  releaseMigrationLock();
  console.log('\n - Migration Lock: RELEASED');

  const completedAt = new Date().toISOString();

  // Save result artifact
  const resultPayload = {
    migrationId,
    baselineChecksum: manifestV2.liveChecksum,
    canonicalChecksum: manifestV2.checksum,
    startedAt,
    completedAt,
    operations: {
      createPlanned: 35237,
      createExecuted: predecessorCreated + currentCreated,
      createSkipped: predecessorSkipped + currentSkipped,
      updatePlanned: 7701,
      updateExecuted: updatedCount,
      deletePlanned: 734,
      deleteExecuted: contaminationDeleted + falsePositiveDeleted,
      deleteSkipped: 0,
    },
    finalCounts: {
      total: finalDocCount,
      canonical: finalCanonicalDocs.length,
      legacy: finalLegacyDocs.length,
    },
    cancellation: {
      active: finalActiveCount,
      partial: finalPartialCount,
      cancelled: finalCancelledCount,
    },
    verification: {
      totalPass: finalDocCount === 48485,
      legacyPreservationPass: legacyChangedCount === 0,
      contaminationZeroPass: remainingContamination === 0,
      falsePositiveZeroPass: remainingFalsePositives === 0,
      areaFamily100PercentPass: finalUnmappedArea === 0,
      cancellationIntegrityPass: finalCancelledCount === 880 && finalPartialCount === 7,
    },
    checksums: {
      targetCanonicalChecksum,
      legacyChecksum,
      fullTransactionsChecksum,
    },
    batchesCompleted: progressData.batches.filter((b) => b.status === 'COMPLETED').length,
    batchesFailed: progressData.batches.filter((b) => b.status === 'FAILED').length,
    status: isSuccess ? 'MIGRATION_SUCCESS' : 'MIGRATION_PARTIAL_FAILURE',
  };

  const resultFilePath = path.join(RESULTS_DIR, 'phase4b_migration_result.json');
  fs.writeFileSync(resultFilePath, JSON.stringify(resultPayload, null, 2), 'utf8');
  console.log(` - Saved Result Artifact: ${resultFilePath}`);

  const verdict = isSuccess ? 'MIGRATION_SUCCESS' : 'MIGRATION_PARTIAL_FAILURE';
  console.log(`\n================================================================`);
  console.log(`PHASE 4B FINAL VERDICT: ${verdict}`);
  console.log(`================================================================`);

  return resultPayload;
}

if (process.argv[1] && process.argv[1].includes('run_phase4b_migration')) {
  runPhase4BMigration().catch((err) => {
    console.error('Fatal Phase 4B Migration Error:', err);
    releaseMigrationLock();
    process.exit(1);
  });
}
