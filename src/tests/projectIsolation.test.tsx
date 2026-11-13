import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OwnerEconomicsSection } from '../components/Redevelopment/OwnerEconomicsSection';
import { ProjectEconomicsSection } from '../components/Redevelopment/ProjectEconomicsSection';
import { ProjectHeader } from '../components/Redevelopment/ProjectHeader';

for (const lineage of ['chokjin3_redevelopment', 'jeungsan4_redevelopment']) {
  test(`${lineage} does not render Dunchon owner evidence`, () => {
    const html = renderToStaticMarkup(<OwnerEconomicsSection lineageId={lineage} />);
    assert.ok(!html.includes('둔촌주공'));
    assert.ok(!html.includes('1.88'));
    assert.ok(html.includes('계산할 수 없습니다'));
  });
}
test('Dunchon matrix remains available only for Dunchon', () => {
  assert.ok(renderToStaticMarkup(<OwnerEconomicsSection lineageId="dunchon_redevelopment" />).includes('둔촌주공'));
});
test('project costs and header contain no unrelated fixed sample amounts or counts', () => {
  const costs = renderToStaticMarkup(<ProjectEconomicsSection constructionCosts={null} isLoading={false} />);
  assert.ok(!costs.includes('2.67'));
  const header = renderToStaticMarkup(<ProjectHeader lineages={[]} selectedLineageId="chokjin3_redevelopment" onSelectLineageId={() => {}} lineageDetail={null} isLoading={false} landShareCount={0} constructionCostCount={1} />);
  assert.ok(!header.includes('17티어'));
  assert.ok(!header.includes('6이벤트'));
  assert.ok(header.includes('1이벤트'));
});
