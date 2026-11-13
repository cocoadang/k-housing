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


## 2026-11-14 implementation
- Dedicated reader and collector identities have database-scoped IAM conditions. Collector-only Secret Manager access and archive-prefix object creation are configured; no account key file is created.
- The current MOLIT key was connected from the existing AI Studio Secrets. Raw recent six-month responses for 13 districts are independently parsed and checked (801 canonical groups), and source revisions are validated in an isolated Firestore emulator.
- New price collections are immutable; the active pointer is published only after all revision counts match. Original collections are retained for rollback. Unknown exact areas remain explicitly unclassified.
- Latest-source comparisons execute 385 checks, including original dataset content hashes. Historical probes confirmed the 2012 ELS 35000만원, 2012 Sur 40000만원 and 2010 Banpo 77400만원 rows exist in upstream records; they were not removed as presumed errors.
- Chokjin/Jeungsan no longer show Dunchon contribution data. Header counts and construction-cost descriptions are project-specific. Analysis defaults to the current month.
- Old verification literals represented the September source snapshot. Source-aware runs use exact frozen counts from an independent baseline/source merge: Banpo Xi 59=153 months, 84=184, Samick 61=225. Samick August 2026 median is 88200만원 from seven valid raw rows. Assertions remain exact; no tolerance or bypass is added. Source hashes and independent evidence are in docs/validation/source-expectations.json.

Production update (2026-11-14): remaining deployment gates described above are completed; see docs/DEPLOYMENT.md for applied controls, validation, integration, rollback and remaining data limitations.
