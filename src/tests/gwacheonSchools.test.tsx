import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import raw from '../data/gwacheonSchools.json';
import evidence from '../../docs/validation/gwacheon-school-evidence.json';
import type { GwacheonSchools } from '../types/schools';
import { SchoolDetails } from '../components/Map/SchoolDetails';
import { TARGET_COMPLEXES } from '../data/complexesData';

const data = raw as GwacheonSchools;

// Independent ray casting on WGS84; tests detect wrong axis order, datum and broken holes.
function ringContains(ring: number[][], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

test('six schools match official identities, addresses and source student/class totals', () => {
  assert.equal(data.schools.length, 6);
  assert.equal(data.schools.reduce((n, s) => n + s.students, 0), 5254);
  const expected = { S090003042: 649, S090003043: 367, S090003052: 1630, S090003082: 810, S090007632: 1266, S090007937: 532 };
  for (const s of data.schools) {
    const source = evidence.schoolRows.find(r => r.basic.SCHUL_CODE === s.id)!;
    assert.equal(s.students, expected[s.id]);
    assert.equal(s.students, source.counts.COL_S_SUM);
    assert.equal(s.classes, source.counts.COL_C_SUM);
    assert.equal(s.name, source.position['학교명']);
    assert.equal(s.address, source.position['소재지도로명주소']);
    assert.equal(s.emacId, source.position['학교ID']);
    assert.equal(s.grades.reduce((n, g) => n + g.students, s.specialStudents), s.students);
    assert.equal(s.grades.reduce((n, g) => n + g.classes, s.specialClasses), s.classes);
    assert.ok(s.sourceUrl.startsWith('https://www.schoolinfo.go.kr/'));
  }
});

test('official polygons preserve rings, WGS84 location and both joint-zone members', () => {
  assert.equal(data.zones.features.length, 7);
  const joint = data.zones.features.find(z => z.properties.kind === 'joint')!;
  assert.equal(joint.properties.id, 'Z000151416');
  assert.deepEqual(joint.properties.schoolIds, ['S090003052', 'S090007632']);
  for (const z of data.zones.features) {
    const polygons = z.geometry.type === 'Polygon' ? [z.geometry.coordinates as number[][][]] : z.geometry.coordinates as number[][][][];
    for (const polygon of polygons) for (const ring of polygon) {
      assert.deepEqual(ring[0], ring.at(-1));
      assert.ok(ring.length >= 4);
      for (const [lng, lat] of ring) assert.ok(lng > 126.8 && lng < 127.1 && lat > 37.3 && lat < 37.6);
    }
    const members = evidence.relations.filter(r => r['학구ID'] === z.properties.id).map(r => r['학교ID']).sort();
    assert.deepEqual(z.properties.schoolIds.map(id => data.schools.find(s => s.id === id)!.emacId).sort(), members);
  }
  for (const s of data.schools) {
    assert.ok(data.zones.features.some(z => {
      if (!z.properties.schoolIds.includes(s.id)) return false;
      const polygons = z.geometry.type === 'Polygon' ? [z.geometry.coordinates as number[][][]] : z.geometry.coordinates as number[][][][];
      return polygons.some(p => ringContains(p[0], s.longitude, s.latitude) && !p.slice(1).some(hole => ringContains(hole, s.longitude, s.latitude)));
    }), `${s.name} official position must lie within its mapped zone`);
  }
});

test('school card separates general and special counts and never claims guaranteed assignment or achievement ranking', () => {
  const s = data.schools.find(s => s.id === 'S090003052')!;
  const html = renderToStaticMarkup(<SchoolDetails school={s} data={data} />);
  assert.ok(html.includes('1,630명'));
  assert.ok(html.includes('25.7명')); // 1621 general students / 63 general classes, not 1630 / 65.
  assert.ok(html.includes('2026-04-01') && html.includes('2026-09-20'));
  assert.ok(html.includes('공동통학구역'));
  assert.ok(html.includes('주소별 최종 배정'));
  assert.ok(!html.includes('학업성취도') && !html.includes('배정 확정'));
  const empty = renderToStaticMarkup(<SchoolDetails school={{ ...s, classes: s.specialClasses }} data={data} />);
  assert.ok(!empty.includes('Infinity') && !empty.includes('NaN'));
});

test('Gwacheon marker coordinate pairs stay consistent and within the actual residential area', () => {
  const complexes = TARGET_COMPLEXES.filter(c => c.subRegion === '과천');
  assert.equal(complexes.length, 3);
  for (const c of complexes) {
    assert.deepEqual(c.location, { lat: c.latitude, lng: c.longitude });
    assert.ok(c.latitude > 37.418 && c.latitude < 37.431);
    assert.ok(c.longitude > 126.988 && c.longitude < 127.001);
  }
});
