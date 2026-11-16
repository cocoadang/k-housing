# Registered-region schools and apartment footprints — 2026-11-16

**Current footprint source:** all 31 complexes now use 62 reviewed official reference parcels. See [OFFICIAL_PARCEL_AUDIT.md](OFFICIAL_PARCEL_AUDIT.md). OSM footprint sections below describe earlier releases and their source history. School data is unchanged.

This supersedes the initial Gwacheon-only presentation in GWACHEON_SCHOOLS.md. The user's clarified request is apartment complex outlines rather than large school catchments as the default coloured areas. Apartment outlines are green and enabled by default. Official school catchments remain an optional layer, off by default; they are never substituted for apartment outlines.

## Scope and sources

All 13 registered regions have official elementary-school data: 158 distinct active schools, 168 distinct official catchments, 31 registered apartment assets. Regional counts overlap and are not nationwide/district totals. Coverage selects campuses within approximately 1.5 km of registered apartment representative points, plus all operating schools linked to the included official joint catchments. Gwacheon's original six campuses are retained. The radius is not a walking distance or an assignment guarantee.

| Region | Schools | Official catchments |
| --- | ---: | ---: |
| 반포 | 10 | 11 |
| 잠실 | 10 | 11 |
| 개포 | 17 | 17 |
| 대치 | 10 | 11 |
| 마포 | 16 | 15 |
| 성동 | 18 | 19 |
| 용산 | 2 | 2 |
| 길음 | 17 | 13 |
| 강동 | 20 | 24 |
| 과천 | 6 | 7 |
| 구성남 | 25 | 31 |
| 남천동 | 5 | 5 |
| 센텀시티 | 8 | 8 |

Schoolinfo public datasets provide 2026 student/class counts (2026-04-01) and school identities. Seoul and Busan were each queried once for basic information and once for student counts using the public website's normal display request; the retained Gyeonggi snapshot was reused. EMAC's source positions (2026-10-01), SHP catchments and school-zone CSV (2026-09-20) are the same original national downloads verified for the first release. All 158 selected schools have usable official count rows; reconciliation includes general, special and itinerant totals. A future unavailable count renders as unavailable, never zero.

The two reviewed identity exceptions are Seongnam Jeil and Sinjae: Schoolinfo's split/malformed street fields do not exactly match EMAC. Official school/education-office pages confirm their correct road addresses; school name, IDs, coordinates and these source links are retained in the evidence. No fuzzy name-only joining is allowed. The joint catchment Z000151320 still links to 대원초등학교(휴교), absent from the current operating-school position file. The relationship is preserved as an unavailable member with an explicit advisory instead of silently dropping it or inventing a location/student count. Joint and one-way joint classifications remain distinct.

## Apartment outline interpretation

The OSM portion contains 30 individually reviewed residential outlines; Centum Park 2 uses the separately attributed official parcel described below. Apartment-specific source objects (including separate sub-complex parts) were selected by their recorded names, addresses and position, not by taking the nearest arbitrary polygon. Original rings, multiple parcels and school holes are retained. Source member ways are joined only along existing nodes; no bounding box, convex hull, buffer or administrative/catchment geometry is used as an apartment substitute. Version/timestamp/object links are retained. The separate derived footprint dataset is provided under ODbL-1.0 with visible © OpenStreetMap contributors attribution and a copyright/license link in the map toolbar.

These are public-map reference footprints, **not surveyed/legal cadastral boundaries**. Namcheon Xi's source object retains the older name 남천헤리치자이; its campus position matches the current Namcheondong-ro 46 development. Current name/address reference: https://www.homeknocktown.co.kr/web-front/namchunxi/. This source-name discrepancy is not applied to transaction matching. The primary API was used for bounded once-only local extracts after the preferred Overpass endpoints timed out; no polling or runtime OSM calls are introduced.

**Centum Park 2 added on 2026-11-16: all 31 assets now have separate reference outlines.** Busan City's road project identifies Park 2 as Jaesong-dong 1197; Haeundae's CCTV address list independently associates it with Centumjungang-ro 142. MOLIT Eum's public parcel search returns exactly PNU 2635010400111970000 (1197대). Its original 13-vertex EPSG:5179 ring is transformed into EPSG:4326 without simplification or a manual split. All six 201–206 tower centres fall inside; Centum Star A/B/C and the neighbouring Park 1 test point fall outside. The projected reference area is 23,993.43 m²; this is calculated from the reference ring, not a certified cadastral area. The retained source's map dataset version is 20261014, retrieved 2026-11-16.

This one feature is attributed separately to **국토교통부 토지이음**, under the source page's 공공누리 출처표시 conditions (visible 공공누리 mark), and is not labelled as an OSM feature or licensed solely under ODbL. The other 30 OSM features and every school snapshot remain byte-for-byte unchanged. The map links the official source when Park 2 is visible. The geometry is an officially displayed **reference parcel**, not a surveyed/legal boundary determination. The old merged Centum Star way remains rejected. Public raw response, query, source identity links, transformation and exclusion checks are retained in `docs/validation/centum-park-2-evidence.json` and `centum-park-2-parcel-5179.json`.

Sources: https://www.busan.go.kr/yesan/closing03/1520417 ; https://www.haeundae.go.kr/index.do?menuCd=DOM_000000102005006002 ; https://www.eum.go.kr/web/ar/lu/luLandDet.jsp?pnu=2635010400111970000 .

Map marker positions use reviewed interior footprint anchors (or the explicitly sourced missing-outline anchor) without changing transaction IDs, matching rules, raw prices or collector state. This corrects several older approximate map points. The initial regional camera fits apartment points, not large school catchments. School labels use optional collision handling while the full school list stays available.

## Operation and reproduction

The browser loads a small separate footprint module and only the chosen region's static school module; no new API credentials, paid AI, Firestore queries/writes, scheduler or collection endpoint is required. Region requests share a cache, failed loads can be retried, and superseded responses are cancelled/ignored so the wrong region cannot appear after rapid navigation. The all-regions view does not load all school snapshots.

Offline maintenance with original public downloads:

1. `python scripts/build_complex_footprints.py REVIEW_DIR` (original OSM region extracts in `REVIEW_DIR/osm-regions`).
2. `python scripts/build_registered_map_data.py SCHOOL_SOURCE_DIR REVIEW_DIR` (original Schoolinfo JSONs, EMAC SHP/CSVs and exported registered catalog).
3. `python scripts/apply_centum_park_2_parcel.py` (applies the retained official parcel after the OSM-only generator; no network calls).
4. Review changed source IDs, exceptions, counts and evidence before committing generated files. A newer dataset is not automatically assumed to preserve prior classifications.

The maintenance scripts require Python pyshp, pyproj and shapely only; they are not runtime dependencies. The public evidence report stores only the selected public rows, raw relationship records, object references and source checksums, not whole national extracts or credentials. `docs/validation/registered-map-evidence.json` is the source/reconciliation record. Existing Gwacheon snapshot/evidence is retained for regression and recovery.

Release verification requires TypeScript, all Node tests, production build, desktop/mobile browser checks on the existing Maps-authorized production origin, and Cloud Run template equality except image/revision. Preserve request-based CPU billing, scale limits, identity, secrets, collector image and schedules. Verify school/outline/catchment toggles, both area prices, region isolation, legal/source caveats and missing-outline messaging. No Telegram, scheduled collection execution or paid diagnosis is used during validation. Retain the previous ready runtime revision for rollback and record the synthetic measurement window for future cost comparisons.

Previous release (historical): PR #4 merged as 5a235e6, source 13877cf9cb78. Cloud Build 4737a997-9a33-4e47-a55e-f09a3de5a42c and both hosted validation runs succeeded. Revision k-housing-regions-13877cf receives 100% of production traffic; previous k-housing-schools-ea9f2e9 remains the rollback target. All 38 tests and type/build checks passed. Full-suite verification exposed an existing random backend-test failure when the OS assigned a port blocked by Fetch; only that test's transport was changed to Node HTTP, preserving all original authentication status and handler-count assertions. All 13 regions were checked in the production browser with correct school counts, price markers, apartment outlines on and catchments off. Actual footprint clicking opened the matching apartment card; outline/catchment switches and 390x844 mobile layouts were verified. Both area's price responses for all 31 assets were identical before/after release, and the underlying immutable source revision was unchanged. Runtime template, CPU-on-request billing and existing privileges were preserved. See docs/validation/registered-map-release-20261116.json for checks, image digest, synthetic usage window and the explicit missing Centum Park 2 outline limitation. No Telegram, collection/scheduler execution or paid AI endpoint was invoked.


Current release — Centum Park 2: PR #5 merged as 65e5d55, source d78a216d10df. Cloud Build cf8ce0c1-fa7e-4c55-a5c7-a0298876415a succeeded; revision k-housing-centum2-d78a216 receives 100% traffic. Previous k-housing-regions-13877cf remains available for rollback. All 39 tests, type checking, production build and GitHub validation passed. Both 59/84 price responses for all 31 assets matched before and after deployment; immutable source revision r20261115233017_f3ebd916 stayed unchanged. Production desktop/mobile checks confirmed the separate Park 2 outline, correct card on boundary click, outline toggle removal/restoration, eight schools, catchments off by default, and the official source link. Runtime settings, request billing, identities and existing schedules were preserved. No Telegram, collector/scheduler execution or paid model call was invoked. See `docs/validation/centum-park-2-release-20261116.json` for the deployment and synthetic telemetry window.
