import fs from 'node:fs';
/** Exact frozen expectations, generated independently from archived baseline + verified raw source. */
export function expectedSeriesCount(key: string, historical: number): number {
  if (!process.env.VERIFICATION_EXPECTATIONS) return historical;
  const data=JSON.parse(fs.readFileSync(process.env.VERIFICATION_EXPECTATIONS,'utf8'));
  const value=data.seriesCounts?.[key];
  if (!Number.isSafeInteger(value) || value < 0 || !data.sourceSha256) throw Error(`MISSING_VERIFIED_EXPECTATION: ${key}`);
  return value;
}
