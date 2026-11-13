# Area resolution and AI diagnosis — 2026-11-14

Three previously held raw-source groups were checked again in the official MOLIT apartment-trade API. The identity check used registered apartment name plus legal dong, preserving the source aptSeq, lot address, exact area, transaction date, amount and floor. Another apartment with the same 59.96 sqm area in the district was explicitly excluded. Evidence rows and original XML SHA256 values: `docs/validation/area-resolution-20261114.json`.

| Complex | Source exclusive area | Decision |
| --- | --- | --- |
| 과천자이 | 125.88㎡ | Add to existing 125㎡ family; source aptSeq 41290-463 |
| 올림픽파크포레온 | 59.96㎡ | Add to existing 59㎡ family; source aptSeq 11740-5273 |
| 남천자이 | 115.4169㎡ | Create independent 115㎡ family, standard category OTHER; source aptSeq 26500-2456 |

These are broad exclusive-area comparison families. The records do not establish a lettered floorplan subtype, official supply area or a legacy pyeong label; none was inferred. The new 115 family is never combined with 125. Registry count increases from 188 to 189. The preserved historical base still contains 187 active families; the new family is available in the immutable current-source overlay. Verification assertions explicitly distinguish these facts.

The repeated six-month source collection received five additional canonical groups: 806 groups, 352 family/month aggregates, 208 standard-area/month aggregates, zero unclassified groups. Independent XML parsing passed for all 806 groups. Source/history preservation verification passed 391 checks with SHA256 equality for all four original base collections. The source hash is `714343c1d4109223f3d9924b1b744a15ff7b3d3cd72604e7295e073efb70df1b` for the isolated verified snapshot. Production may advance on later scheduled collections; `/api/data-status` identifies its exact revision.

## AI behavior

The browser submits only registered complex, exact area-family selection (or standard category), and requested months. The server loads canonical V2 monthly prices and computes observed period, counts, median prices, CAGR and MDD. Client-supplied prices, free-form prompts and extra fields are rejected. The selected family and dates in the price screen are also used by the global AI button. Empty data returns 422 without calling the model; one observed month has null CAGR/MDD.

Gemini 3.8 Flash was confirmed through a real generation call after the prior 2.5 model returned a new-user availability restriction. Only data-based Korean explanations are requested; the prompt excludes invented policy/news/school assessments and investment recommendations. The screen shows authoritative numbers independently of generated text, source date, report timestamp, loading/error states and cache status.

The Gemini key is held only in Secret Manager and restricted to the Generative Language API. Only the query service identity can access this secret; the collector cannot. Administrative/raw-collection routes remain operator-only. Model calls are bounded to 1800 output tokens, 35 seconds, at most two concurrent distinct requests and 30 new generations per hour per running instance. Identical concurrent requests are coalesced; identical reports are reused for up to six hours, with source revision/data changes invalidating the cache. These in-memory limits are operational controls, not a project billing hard cap; restarts reset them. Cloud Run remains capped at two instances.

Price-view caches now follow the active source revision (15-second pointer cache) so scheduled updates reach the chart/ledger and AI consistently. This introduces no database writes in the reader.

Focused tests cover area separation, forged inputs, data gaps, single-month behavior, concurrent deduplication, source invalidation, rate limits, foreign origins, no-data behavior and sanitized provider errors. Existing project-isolation and collector tests remain included.
