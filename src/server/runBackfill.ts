import dotenv from 'dotenv';
dotenv.config();

import { backfillEngine } from './backfillEngine';

async function main() {
  const args = process.argv.slice(2);
  const modeArg = args[0]?.toUpperCase() === 'FULL' ? 'FULL' : 'CANARY';
  const forceArg = args.includes('--force');

  console.log(`[Backfill Runner] Running with mode: ${modeArg}, force: ${forceArg}`);

  try {
    const result = await backfillEngine.run({
      mode: modeArg,
      canaryComplexIds: ['banpo_xi', 'gwacheon_xi', 'yongsan_ichon_hangaram'],
      throttleMs: 250,
      forceRerun: forceArg,
    });

    console.log('[Backfill Runner] Execution Finished with result:', JSON.stringify(result, null, 2));
    process.exit(result.status === 'FAILED' ? 1 : 0);
  } catch (err: any) {
    console.error('[Backfill Runner] Fatal error:', err);
    process.exit(1);
  }
}

main();
