# Continuation checkpoint — 2026-11-13

The original AI Studio ZIP is preserved locally. SHA-256:
`fcf04e06bea1b4b170224c0d43a6d38c6892868fd290a4e073644d61b61c6775`.
The baseline commit excludes local Firebase configuration, environment files and database snapshots. Historical seeds remain versioned; generated analyses and backups remain local. The original Phase 8M report is historical evidence, not a verification of the current revision.

## Implemented
- Query endpoints no longer write upstream results to Firestore. Legacy repository writer methods fail explicitly rather than silently claiming success.
- Firestore rules permit public reads only for five price/catalog collections and deny client writes. The named production database was checked on 2026-11-13: its deployed rules match the unsafe original and permit all writes. The replacement compiled through the Rules API with HTTP 200 and no issues, but has NOT been deployed.
- Raw MOLIT batch/debug APIs also require operator authorization. Public transaction reads return DATA_NOT_AVAILABLE when stored data is missing instead of triggering on-demand upstream collection.
- AI and cache-clear POST requests require a server-only `OPERATOR_API_SECRET` bearer token; without configuration they return 503. The browser AI action therefore cannot invoke Gemini until a suitable authenticated user flow is implemented. Never put the operator secret in the browser.
- Corrected annual 59㎡ statistics use registered exact areas, multiplicity and partial-cancellation counts. Exports include source IDs and records. Output defaults to `data/generated` so historical reports are preserved.
- Direct entry: `?view=REDEVELOPMENT&lineage=chokjin3_redevelopment` and `?view=ANALYSIS&complex=busan_samick_beach`. Chokjin 3 links back to `https://apt.dsoom.com/#/status/chokjin-3`.
- The Phase 8M runner now labels count comparisons as count integrity, marks write auditing unverified, and no longer certifies release readiness based on suite exit codes alone.

## Validation
`npm ci`, `npm run lint`, `npm test`, `npm run build`. Tests use no production credentials. For an offline server smoke test, set `NODE_ENV=production`, `DISABLE_FIRESTORE=true`, then `npm start`.

To re-run against an archived snapshot without network access:
set `ANALYSIS_INPUT` to the local JSON array path, and run `npx tsx scripts/generate_59_comparison.ts`. Results explicitly say the archived snapshot is not current or verified complete. Without this variable, the script performs Firestore reads; it does not certify MOLIT completeness.

## Release gates still outstanding
1. Review legitimate consumers before applying the compiled restrictive rules. The actual deployed rules have been read and confirmed unsafe.
2. Configure the production database identity/configuration. A separate IAM ingestion identity and correction/reconciliation job are still needed. Existing migration scripts are archived tools, not an approved production collection pipeline.
3. Compare current original MOLIT records, cancellation semantics and correction behavior against stored data. A local archived snapshot cannot establish current completeness.
4. Re-run the complete regression suite in an isolated dataset and add browser interaction verification. The old audit's eight requested critical invariant counts remain unknown; no counts are invented.
5. Select and deploy the housing origin, then enable the apt-to-housing link. No production deployment, DNS change, scheduler or apt code change has been performed.

Do not merge historical financial evidence with latest progress automatically. `chokjin-3` maps to a housing project/lineage; `samik-beach` maps to an existing apartment asset. No Gwacheon ID mapping is inferred.

Local validation result: 6 focused tests passed; TypeScript and production build passed. Offline archived analysis reproduced 171 canonical ELS rows representing 172 active transactions. Server health, lineage list and direct-link document returned HTTP 200 with database connections disabled; unconfigured AI returned HTTP 503. The legacy 20-suite audit was not run against production.
