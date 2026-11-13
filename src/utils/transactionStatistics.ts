export interface StatisticalDeal {
  id?: string;
  price: number;
  exclusiveArea: number;
  isCancelled?: boolean;
  cancelDate?: string;
  activeCount?: number;
  normalRowCount?: number;
  cancellationRowCount?: number;
}

/** Consolidated rows represent multiple deals. Explicit counts take precedence over cancellation dates. */
export function effectiveDealCount(deal: StatisticalDeal): number {
  if (deal.isCancelled) return 0;
  if (deal.activeCount !== undefined) {
    if (!Number.isSafeInteger(deal.activeCount) || deal.activeCount < 0) throw new Error('INVALID_ACTIVE_COUNT');
    return deal.activeCount;
  }
  if (deal.normalRowCount !== undefined || deal.cancellationRowCount !== undefined) {
    const normal = deal.normalRowCount ?? 0;
    const cancelled = deal.cancellationRowCount ?? 0;
    if (![normal, cancelled].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('INVALID_ROW_COUNT');
    return Math.max(0, normal - cancelled);
  }
  return deal.cancelDate?.trim() ? 0 : 1;
}

export function registeredAreaMatches(area: number, exactAreas: number[]): boolean {
  return Number.isFinite(area) && exactAreas.some(a => Math.round(a * 100) === Math.round(area * 100));
}

export function weightedDealStats(deals: StatisticalDeal[]) {
  const rows = deals.map(deal => ({ price: deal.price, count: effectiveDealCount(deal) }))
    .filter(row => row.count > 0 && Number.isFinite(row.price) && row.price > 0)
    .sort((a, b) => a.price - b.price);
  const count = rows.reduce((n, row) => n + row.count, 0);
  if (!count) return null;
  const at = (index: number) => {
    let cumulative = 0;
    for (const row of rows) { cumulative += row.count; if (index < cumulative) return row.price; }
    throw new Error('INVALID_WEIGHTED_RANK');
  };
  return {
    count,
    avgPrice: Math.round(rows.reduce((sum, row) => sum + row.price * row.count, 0) / count * 10) / 10,
    medianPrice: (at(Math.floor((count - 1) / 2)) + at(Math.floor(count / 2))) / 2,
    minPrice: rows[0].price,
    maxPrice: rows[rows.length - 1].price,
  };
}
