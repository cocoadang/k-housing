import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { loadRegionalSchools, schoolRegionFromQuery } from '../services/schoolMapData';
import { useRegionalSchools } from '../components/Map/useRegionalSchools';
import { SchoolDetails } from '../components/Map/SchoolDetails';
import { SchoolMapPanel } from '../components/Map/SchoolMapPanel';
import { SUBREGIONS_METADATA, TARGET_COMPLEXES } from '../data/complexesData';
import type { ComplexFootprints, RegionalSchoolData } from '../types/schools';

const datasets: RegionalSchoolData[] = readdirSync(new URL('../data/schools/', import.meta.url)).filter(n => n.endsWith('.json')).map(n => JSON.parse(readFileSync(new URL('../data/schools/' + n, import.meta.url), 'utf8')));
const evidence = JSON.parse(readFileSync(new URL('../../docs/validation/registered-map-evidence.json', import.meta.url), 'utf8'));
const footprints: ComplexFootprints = JSON.parse(readFileSync(new URL('../data/complexFootprints.json', import.meta.url), 'utf8'));

test('all 13 registered regions load only their own official snapshot and share cached requests', async () => {
  assert.equal(datasets.length, 13);
  assert.deepEqual(datasets.map(d => d.region).sort(), SUBREGIONS_METADATA.map(r => r.id).sort());
  for (const d of datasets) {
    const first = loadRegionalSchools(d.region), second = loadRegionalSchools(d.region);
    assert.equal(first, second);
    assert.equal((await first).region, d.region);
    assert.equal((await first).schools.length, evidence.regions[d.region].schools);
  }
  assert.equal(schoolRegionFromQuery('gwacheon'), '과천');
  assert.equal(schoolRegionFromQuery('namcheon'), '남천동');
  assert.equal(schoolRegionFromQuery('반포'), '반포');
  assert.equal(schoolRegionFromQuery('constructor'), 'ALL');
  await assert.rejects(loadRegionalSchools('__proto__'));
});

test('158 distinct schools reconcile students and class totals against retained official rows', () => {
  const schools = new Map(datasets.flatMap(d => d.schools).map(s => [s.id, s]));
  assert.equal(schools.size, 158);
  assert.equal(evidence.schoolRows.length, 158);
  for (const s of schools.values()) {
    const row = evidence.schoolRows.find((r: any) => r.basic.SCHUL_CODE === s.id);
    assert.ok(row);
    assert.equal(s.name, row.basic.SCHUL_NM);
    assert.equal(s.emacId, row.position['학교ID']);
    assert.equal(s.address, row.position['소재지도로명주소']);
    assert.equal(s.students, row.counts.COL_S_SUM);
    assert.equal(s.classes, row.counts.COL_C_SUM);
    assert.equal(s.students, s.grades.reduce((n, g) => n + g.students, s.specialStudents!));
    assert.equal(s.classes, s.grades.reduce((n, g) => n + g.classes, s.specialClasses!));
    assert.equal(s.studentsAsOf, '2026-04-01');
  }
  assert.ok(evidence.manualIdentityReviews.B000003734.evidenceUrl.includes('goesn.kr'));
  assert.ok(evidence.manualIdentityReviews.B000002694.evidenceUrl.includes('pen.go.kr'));
});

test('168 official catchments retain their linked schools and original closed coordinate rings', () => {
  const zones = new Map(datasets.flatMap(d => d.zones.features).map(z => [z.properties.id, z]));
  const schools = new Map(datasets.flatMap(d => d.schools).map(s => [s.id, s]));
  assert.equal(zones.size, 168);
  for (const z of zones.values()) {
    const expected = evidence.relations.filter((r: any) => r['학구ID'] === z.properties.id).map((r: any) => r['학교ID']).sort();
    assert.deepEqual([...z.properties.schoolIds.map(id => schools.get(id)!.emacId), ...(z.properties.unavailableMembers || []).map(m => m.emacId)].sort(), expected);
    assert.ok(['single', 'joint', 'oneway'].includes(z.properties.kind));
    assert.equal(z.properties.asOf, '2026-09-20');
    const polygons = z.geometry.type === 'Polygon' ? [z.geometry.coordinates as number[][][]] : z.geometry.coordinates as number[][][][];
    for (const polygon of polygons) for (const ring of polygon) {
      assert.deepEqual(ring[0], ring.at(-1));
      assert.ok(ring.length >= 4);
      for (const [lng, lat] of ring) assert.ok(lng > 126 && lng < 130 && lat > 34 && lat < 39);
    }
  }
});

function ringContains(r: number[][], x: number, y: number) {
  let yes = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [a, b] = r[i], [c, d] = r[j];
    if ((b > y) !== (d > y) && x < (c - a) * (y - b) / (d - b) + a) yes = !yes;
  }
  return yes;
}

test('30 apartment outlines are distinct from school boundaries; missing 2nd Centum outline is never fabricated', () => {
  assert.equal(footprints.collection.features.length, 30);
  assert.deepEqual(Object.keys(footprints.unavailable), ['busan_centum_park_2']);
  assert.equal(Object.keys(footprints.anchors).length, TARGET_COMPLEXES.length);
  assert.equal(footprints.license, 'ODbL-1.0');
  assert.ok(!footprints.collection.features.some(f => f.properties.complexId === 'busan_centum_park_2'));
  for (const f of footprints.collection.features) {
    const a = footprints.anchors[f.properties.complexId];
    const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates as number[][][]] : f.geometry.coordinates as number[][][][];
    assert.ok(polygons.some(p => ringContains(p[0], a.longitude, a.latitude) && !p.slice(1).some(h => ringContains(h, a.longitude, a.latitude))), f.properties.name);
    for (const p of polygons) for (const r of p) assert.deepEqual(r[0], r.at(-1));
    for (const ref of f.properties.sourceObjects) {
      assert.ok(ref.url.startsWith('https://www.openstreetmap.org/'));
      assert.ok(ref.version > 0);
    }
  }
  const els = footprints.collection.features.find(f => f.properties.complexId === 'jamsil_els')!;
  const elsPolygons = els.geometry.type === 'Polygon' ? [els.geometry.coordinates] : els.geometry.coordinates;
  assert.ok(elsPolygons.some(p => p.length > 1), 'the school hole inside ELS must remain a hole');
});

test('generic school card labels current region, limited scope, official dates and missing counts honestly', () => {
  const d = datasets.find(d => d.region === '남천동')!;
  const panel = renderToStaticMarkup(<SchoolMapPanel data={d} selectedId={null} onSelect={() => {}} onClose={() => {}} />);
  assert.ok(panel.includes('남천동 주변 초등학교'));
  assert.ok(!panel.includes('과천 초등학교'));
  assert.ok(panel.includes('대표위치 주변 약 1.5km'));
  const s = { ...d.schools[0], students: null, classes: null, specialStudents: null, specialClasses: null, grades: [] };
  const details = renderToStaticMarkup(<SchoolDetails school={s} data={d} />);
  assert.ok(details.includes('공식 학생 수 자료가 없습니다'));
  assert.ok(!details.includes('NaN') && !details.includes('Infinity'));
});

test('rapid region changes cannot show a stale school response; rejection can be retried and ALL clears schools', async () => {
  const dom = new JSDOM('<div id="root"></div>');
  const originalWindow = globalThis.window, originalDocument = globalThis.document;
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const pending = new Map<string, { resolve: (v: RegionalSchoolData) => void; reject: (e: Error) => void }>();
  const loader = (region: string) => new Promise<RegionalSchoolData>((resolve, reject) => pending.set(region, { resolve, reject }));
  let retry: () => void;
  function Harness({ region }: { region: string }) {
    const state = useRegionalSchools(region, loader); retry = state.retry;
    return <div>{state.schoolData?.region || (state.schoolLoadError ? 'ERROR' : 'LOADING')}</div>;
  }
  const container = document.getElementById('root')!, root = createRoot(container);
  try {
    await act(async () => { root.render(<Harness region="반포" />); });
    await act(async () => { root.render(<Harness region="남천동" />); });
    await act(async () => { pending.get('남천동')!.resolve(datasets.find(d => d.region === '남천동')!); });
    await act(async () => { pending.get('반포')!.resolve(datasets.find(d => d.region === '반포')!); });
    assert.equal(container.textContent, '남천동');
    await act(async () => { root.render(<Harness region="과천" />); });
    await act(async () => { pending.get('과천')!.reject(new Error('offline')); });
    assert.equal(container.textContent, 'ERROR');
    await act(async () => { retry(); });
    await act(async () => { pending.get('과천')!.resolve(datasets.find(d => d.region === '과천')!); });
    assert.equal(container.textContent, '과천');
    await act(async () => { root.render(<Harness region="ALL" />); });
    assert.equal(container.textContent, 'LOADING');
  } finally {
    await act(async () => { root.unmount(); });
    Object.assign(globalThis, { window: originalWindow, document: originalDocument, IS_REACT_ACT_ENVIRONMENT: false });
    dom.window.close();
  }
});
