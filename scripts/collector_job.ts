import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { Storage } from '@google-cloud/storage';
import { Firestore } from '@google-cloud/firestore';
import { buildSourceRevision, publishSourceRevision } from '../src/server/sourceRevision';
import { mergeRetainedRefresh } from '../src/server/refreshRetention';

async function main() {
  const validateOnly = process.env.COLLECTOR_VALIDATE_ONLY === 'true';
  const db = new Firestore({
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    databaseId: process.env.FIRESTORE_DATABASE_ID,
  });
  try {
    const activeRef = db.collection('priceRevisions').doc('active');
    const active = await activeRef.get();
    const baseline = active.data();
    if (!baseline || baseline.status !== 'READY' || !active.updateTime ||
        !/^r\d{14}(?:_[a-f0-9]{8})?$/.test(baseline.revision) ||
        baseline.collections?.transactions !== `transactions_${baseline.revision}`) {
      throw Error('TRUSTED_ACTIVE_BASELINE_REQUIRED');
    }
    const storedDoc = await db.collection('priceRevisions').doc(baseline.revision).get();
    const storedManifest = storedDoc.data();
    if (storedManifest?.status !== 'READY' || storedManifest.revision !== baseline.revision ||
        storedManifest.collections?.transactions !== baseline.collections.transactions ||
        storedManifest.counts?.transactions !== baseline.counts?.transactions) {
      throw Error('BASELINE_MANIFEST_MISMATCH');
    }
    const stored = await db.collection(baseline.collections.transactions).get();
    if (!stored.size || stored.size !== baseline.counts.transactions ||
        stored.docs.some(doc => doc.id !== doc.data().id)) {
      throw Error('BASELINE_TRANSACTION_SET_MISMATCH');
    }

    process.env.COLLECTOR_LIBRARY_MODE = 'true';
    process.env.COLLECTOR_OUTPUT ||= fs.mkdtempSync('/tmp/khousing-source-');
    const { collectCurrentSource } = await import('./collect_molit_readonly');
    await collectCurrentSource();
    const directory = process.env.COLLECTOR_OUTPUT;
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
    const freshRows = JSON.parse(fs.readFileSync(path.join(directory, 'transactions.json'), 'utf8'));
    if (manifest.canonicalCount !== freshRows.length || !freshRows.length) throw Error('INVALID_FRESH_TRANSACTION_SET');
    const revision = 'r' + new Date().toISOString().replace(/\D/g, '').slice(0, 14) + '_' + randomBytes(4).toString('hex');
    const bucket = process.env.SOURCE_ARCHIVE_BUCKET;
    const destination = `khousing-source/${revision}/source.json.gz`;
    const archiveUri = bucket ? `gs://${bucket}/${destination}` : undefined;
    const retained = mergeRetainedRefresh(
      { rows: stored.docs.map(doc => doc.data() as typeof freshRows[number]), manifest: baseline as typeof manifest },
      { rows: freshRows, manifest: { ...manifest, snapshots: manifest.snapshots.map(snapshot => ({ ...snapshot, archiveUri })) } },
    );
    const plan = buildSourceRevision(retained.rows, {
      ...manifest,
      snapshots: retained.snapshots,
      months: [...new Set(retained.snapshots.map(snapshot => snapshot.month))].sort(),
      covered: baseline.covered,
      canonicalCount: retained.rows.length,
      unmappedAreaCount: retained.rows.filter(row => !row.areaFamilyId).length,
      ...(archiveUri ? { archiveUri } : {}),
    });
    if (!(await activeRef.get()).updateTime?.isEqual(active.updateTime)) throw Error('ACTIVE_REVISION_CHANGED');
    const report = {
      baselineRevision: baseline.revision,
      baselineGroups: retained.baselineGroups,
      retainedMissingGroups: retained.retainedMissingGroups,
      groups: retained.rows.length,
      protectedGroupsHeld: retained.protectedGroupsHeld,
      requiresAptReceiptRefresh: retained.requiresAptReceiptRefresh,
    };
    if (validateOnly) {
      console.log(JSON.stringify({ ...report, databaseWrites: 0 }));
      return;
    }
    if (retained.requiresAptReceiptRefresh) throw Error('APT_RECEIPT_REFRESH_REQUIRED');
    if (!bucket) throw Error('SOURCE_ARCHIVE_BUCKET_REQUIRED');

    const files = Object.fromEntries(fs.readdirSync(directory)
      .filter(name => name.endsWith('.xml') || name.endsWith('.json'))
      .map(name => [name, fs.readFileSync(path.join(directory, name), 'utf8')]));
    files['transactions.json'] = JSON.stringify(plan.collections.transactions);
    files['manifest.json'] = JSON.stringify(plan.manifest);
    await new Storage().bucket(bucket).file(destination).save(gzipSync(JSON.stringify(files)), {
      resumable: false, contentType: 'application/gzip', preconditionOpts: { ifGenerationMatch: 0 },
    });
    const published = await publishSourceRevision(db, plan, revision, active.updateTime);
    console.log(JSON.stringify({ ...report, ...published }));
  } finally {
    await db.terminate();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
