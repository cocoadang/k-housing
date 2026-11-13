import fs from 'fs';
import path from 'path';

const LOCK_FILE = path.join(process.cwd(), 'data', '.migration_lock');

/**
 * Returns true if the application ingestion writers should be blocked from mutating Firestore transactions.
 * Checks both environment variable MIGRATION_ACTIVE=true and the atomic file lock `data/.migration_lock`.
 */
export function isMigrationLocked(): boolean {
  if (process.env.MIGRATION_ACTIVE === 'true') {
    return true;
  }
  try {
    return fs.existsSync(LOCK_FILE);
  } catch {
    return false;
  }
}

export function acquireMigrationLock(): void {
  try {
    const dir = path.dirname(LOCK_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      LOCK_FILE,
      JSON.stringify({ lockedAt: new Date().toISOString(), pid: process.pid }),
      'utf8'
    );
  } catch (err) {
    console.error('Failed to write .migration_lock:', err);
  }
}

export function releaseMigrationLock(): void {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
    }
  } catch (err) {
    console.error('Failed to remove .migration_lock:', err);
  }
}
