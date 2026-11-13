# Production release — 2026-11-14 (Asia/Seoul)

Follow-up: the three held areas are resolved and server-grounded AI diagnosis is enabled in the subsequent release. See `docs/AREA_AND_AI_RELEASE.md` for current behavior and validation. The sections below retain the original deployment baseline.

Production: https://k-housing-5he2zcaska-du.a.run.app

Runtime image: `2604c058acdd` in the Seoul Cloud Run service `k-housing` and job `khousing-collector`.

## Applied controls

- Reader identity has Datastore viewer scoped to the named housing database. A real Cloud Run identity test confirmed read allowed, write denied, other database denied.
- Collector has database write access scoped to that database, access to only the MOLIT secret, and object creation restricted to the source archive prefix. No service account keys were created.
- Client-write-denying Firestore rules were deployed to the named database and read back to verify exact content. Anonymous REST write probes returned 403. Operator routes return 503 when no operator credential is configured.
- Browser Maps key is restricted to Maps JavaScript and the two production service origins.
- Daily scheduler: 08:30 Asia/Seoul, `khousing-daily`; separate scheduler identity can invoke only the collector job. A manual Scheduler execution successfully invoked the job.

## Source and release validation

Recent six reporting months (2026-06 through 2026-11) were fetched from MOLIT with all pages checked. Independent XML comparison passed for 801 source groups; 385 source/materialization/history-preservation checks passed. Source SHA256: `164fc0a3472b5433ecabecdd910e14e7e246a12df8e6f039208de3c7569b1fea`.

The full regression suite passed 20/20 against the isolated complete historical snapshot plus the new source revision. Focused housing tests passed 15/15; apt tests passed 155/155; type checks and builds passed. Source-dependent expectations were independently recalculated and recorded in `docs/validation/source-expectations.json` rather than weakened.

The collector archives raw source before publishing an immutable revision and then switches `priceRevisions/active`. Original collections are preserved. Production collector execution `khousing-collector-5grrv` completed successfully with the final runtime image. Use `/api/data-status` for the active revision and collection timestamp.

## Integration and limits

apt PR #10 links 촉진3 to the matching redevelopment page and 삼익비치 to its price analysis. The 촉진3 page links back to apt. Progress/news and price calculations continue to run independently.

Three exact-area records remain deliberately unclassified: 과천자이 125.88㎡, 올림픽파크포레온 59.96㎡, 남천자이 115.4169㎡. No assumed area-family mapping was applied. AI generation is unavailable until a separate authorized operator/AI configuration is provided. This release validates recent six-month source reconciliation, not a full re-fetch of every historical transaction.

## Rollback

Pause `khousing-daily` before investigating ingestion. Restore the previous `priceRevisions/active` pointer from the retained manifest, or set `PRICE_REVISIONS_ENABLED=false` to read preserved historical base collections. Retain current raw source archive and manifests. For UI/runtime rollback, direct Cloud Run traffic to the previous ready revision; do not restore the former open-write rules.
