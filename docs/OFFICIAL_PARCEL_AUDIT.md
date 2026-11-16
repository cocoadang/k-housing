# Official parcel audit — 2026-11-16

All other 30 registered complexes were compared with MOLIT Eum's publicly displayed parcel geometry (dataset version 20261014). All 30 OSM-derived outlines differ from the official reference rings and are replaced; the previously verified Centum Park 2 geometry is unchanged. The current 31 complexes use 62 distinct parcels. All marker anchors, school/catchment snapshots, transaction identities and price logic remain unchanged.

## Source and interpretation

Eum public FA parcel search returns the PNU, lot number and EPSG:5179 rings. The site's land detail page displays a KOGL mark and permits reuse with attribution. K-apt's published complex list corroborates names, subcomplex identities, household counts and representative addresses; original selected rows are retained. Several K-apt representative lot numbers are older than the returned cadastral numbers (for example Gwacheon Xi and Mapo Prestige Xi); these are preserved explicitly rather than silently rewritten or joined using fuzzy names. Existing named campus objects and OSM apartment-building positions corroborate parcel membership. Their counts are incomplete and can include building parts; this audit does not claim an official census of every tower or certify boundaries by survey.

Representative-point-only lookup was rejected as insufficient: Acro occupies 2-12 and 2-13, Hangaram occupies six parcels, and all six Grandmaison subcomplexes must be retained. Each reviewed parcel is taken in full, transformed into WGS84, and unioned with its same-complex companions. No clipping to the old footprint, convex hull, buffer, simplification or straight-line bridge is used. School holes and separated parts remain. Shared ownership, easements and legally surveyed boundaries cannot be determined from this reference map.

Notable corrections: Forest excludes the neighbouring Gaepo Xi Rene parcel 1283 (the old OSM polygon contained its explicitly named apartment building); Forest retains parcels 1282/1282-1. Grandmaison's former envelope already included all six subcomplexes, but also intervening roads/open areas: all six official parcels are now shown separately. Sanseong Xi Prugio's four subcomplex parcels are retained. Every other complex's original edge position is replaced with its reviewed official reference ring.

Sources: [MOLIT Eum](https://www.eum.go.kr/web/am/amMain.jsp), [K-apt Seoul](https://www.k-apt.go.kr/cmmn/introMmentPop.do?bjdCode=11&searchOccuDate=202609&upYn=Y), [Busan](https://www.k-apt.go.kr/cmmn/introMmentPop.do?bjdCode=26&searchOccuDate=202609&upYn=Y), [Gyeonggi](https://www.k-apt.go.kr/cmmn/introMmentPop.do?bjdCode=41&searchOccuDate=202609&upYn=Y). Each current feature retains a deep link for every PNU. Geometry attribution in the UI is MOLIT Eum / KOGL attribution. OSM source-object history remains in the earlier evidence and retained baseline.

## Review results

IoU is old/new intersected area divided by their union; it measures geometric difference, not survey accuracy. Calculated areas are reference geometry areas, not certified land-register areas.

| Complex | Parcels | Old/new IoU | Official reference m² |
| --- | ---: | ---: | ---: |
| 아크로리버파크 | 2 | 0.857 | 68,788 |
| 반포자이 | 1 | 0.864 | 194,309 |
| 래미안퍼스티지 | 2 | 0.843 | 132,957 |
| 마포래미안푸르지오 (마래푸) | 4 | 0.929 | 146,225 |
| 마포프레스티지자이 (마프자) | 3 | 0.905 | 63,182 |
| 옥수리버젠 | 2 | 0.848 | 73,723 |
| 서울숲리버뷰자이 | 1 | 0.940 | 38,321 |
| 이촌 한가람 | 6 | 0.795 | 54,866 |
| 과천위버필드 | 2 | 0.882 | 100,549 |
| 과천자이 | 1 | 0.854 | 105,419 |
| 래미안슈르 (과천3단지) | 2 | 0.937 | 190,376 |
| 산성역 포레스티아 | 1 | 0.899 | 158,383 |
| 산성역 자이푸르지오 | 4 | 0.777 | 154,578 |
| e편한세상 금빛 그랑메종 | 6 | 0.762 | 169,558 |
| 래미안길음센터피스 | 1 | 0.902 | 71,256 |
| 길음뉴타운 6단지 (래미안) | 1 | 0.873 | 43,181 |
| 올림픽파크포레온 | 3 | 0.957 | 462,379 |
| 고덕그라시움 | 2 | 0.952 | 207,700 |
| 고덕아르테온 | 2 | 0.937 | 174,683 |
| 삼익비치 (남천삼익타운) | 3 | 0.868 | 173,927 |
| 남천자이 | 1 | 0.874 | 36,217 |
| 센텀파크 1차 | 1 | 0.968 | 77,372 |
| 잠실엘스 | 1 | 0.938 | 224,113 |
| 리센츠 | 1 | 0.871 | 210,990 |
| 트리지움 | 1 | 0.875 | 150,666 |
| 개포래미안포레스트 | 2 | 0.837 | 98,480 |
| 개포자이프레지던스 | 1 | 0.906 | 142,524 |
| 래미안블레스티지 | 1 | 0.849 | 86,394 |
| 래미안대치팰리스 | 2 | 0.879 | 78,717 |
| 대치아이파크 | 1 | 0.907 | 36,201 |
| 센텀파크2차 | 1 | 1.000 | 23,993 |

## Reproduction and validation

Run `python scripts/apply_registered_parcels.py` after any older OSM/school maintenance generator. This supersedes the earlier single-Centum overlay for current releases. The script is offline and checksum-guards `docs/validation/registered-parcel-source-20261116.json`, which retains the selected original raw official rings, reviewed parcel memberships, K-apt rows, pre-change geometry and observed apartment points. It verifies validity, every retained marker anchor and all reviewed included/excluded apartment points. `registered-parcel-audit-20261116.json` records per-complex areas and differences.

Validation requires TypeScript, the full suite and build, school/price preservation, production desktop/mobile map checks, and unchanged live Cloud Run template other than revision/image. No Telegram, scheduled collection or paid AI call is invoked. Retain the prior ready revision for rollback and record synthetic validation traffic separately from normal cost telemetry.
