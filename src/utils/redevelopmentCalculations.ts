/**
 * Phase 8C-1: Pure Mathematical Utilities for Redevelopment Analysis
 * 
 * STRICT RULES:
 * 1. Pure mathematics only — no evidence policy checks or database reads.
 * 2. Inputs must be valid numbers; otherwise return null.
 * 3. Never return 0 when a calculation cannot be performed.
 * 4. XIRR uses actual calendar day difference / 365 with combined Newton-Raphson / Bisection.
 */

export interface PureCashFlowPoint {
  amount: number; // Outflow (negative in financial math) or Inflow (positive)
  date: string; // YYYY-MM-DD
}

/**
 * 1. Nominal Asset Value Change
 * successorValue - predecessorValue
 */
export function calculateNominalValueChange(
  successorValue: number,
  predecessorValue: number
): number | null {
  if (
    typeof successorValue !== 'number' ||
    typeof predecessorValue !== 'number' ||
    isNaN(successorValue) ||
    isNaN(predecessorValue) ||
    successorValue <= 0 ||
    predecessorValue <= 0
  ) {
    return null;
  }
  return successorValue - predecessorValue;
}

/**
 * 2. Nominal Asset Value Multiple
 * successorValue / predecessorValue
 */
export function calculateValueMultiple(
  successorValue: number,
  predecessorValue: number
): number | null {
  if (
    typeof successorValue !== 'number' ||
    typeof predecessorValue !== 'number' ||
    isNaN(successorValue) ||
    isNaN(predecessorValue) ||
    successorValue <= 0 ||
    predecessorValue <= 0
  ) {
    return null;
  }
  return Number((successorValue / predecessorValue).toFixed(4));
}

/**
 * 3. Cost Adjusted Value Change
 * successorValue - economicBasis
 */
export function calculateCostAdjustedValue(
  successorValue: number,
  economicBasis: number
): number | null {
  if (
    typeof successorValue !== 'number' ||
    typeof economicBasis !== 'number' ||
    isNaN(successorValue) ||
    isNaN(economicBasis) ||
    successorValue <= 0 ||
    economicBasis <= 0
  ) {
    return null;
  }
  return successorValue - economicBasis;
}

/**
 * 4. Cost Adjusted Value Multiple
 * successorValue / economicBasis
 */
export function calculateCostAdjustedMultiple(
  successorValue: number,
  economicBasis: number
): number | null {
  if (
    typeof successorValue !== 'number' ||
    typeof economicBasis !== 'number' ||
    isNaN(successorValue) ||
    isNaN(economicBasis) ||
    successorValue <= 0 ||
    economicBasis <= 0
  ) {
    return null;
  }
  return Number((successorValue / economicBasis).toFixed(4));
}

/**
 * 5. Land Share Ratio
 * landShareSqm / exclusiveAreaSqm
 */
export function calculateLandShareRatio(
  landShareSqm: number,
  exclusiveAreaSqm: number
): number | null {
  if (
    typeof landShareSqm !== 'number' ||
    typeof exclusiveAreaSqm !== 'number' ||
    isNaN(landShareSqm) ||
    isNaN(exclusiveAreaSqm) ||
    landShareSqm <= 0 ||
    exclusiveAreaSqm <= 0
  ) {
    return null;
  }
  return Number((landShareSqm / exclusiveAreaSqm).toFixed(4));
}

/**
 * 6. Land Share Difference (Descriptive only)
 */
export function calculateLandShareDifference(
  sqmA: number,
  sqmB: number
): { differenceSqm: number; differencePercent: number } | null {
  if (
    typeof sqmA !== 'number' ||
    typeof sqmB !== 'number' ||
    isNaN(sqmA) ||
    isNaN(sqmB) ||
    sqmA <= 0 ||
    sqmB <= 0
  ) {
    return null;
  }
  const differenceSqm = Number((sqmA - sqmB).toFixed(4));
  const differencePercent = Number((((sqmA - sqmB) / sqmB) * 100).toFixed(2));
  return { differenceSqm, differencePercent };
}

/**
 * 7. Construction Cost Difference
 */
export function calculateCostDifference(
  priorAmount: number,
  targetAmount: number
): { diffAmount: number; diffPercent: number } | null {
  if (
    typeof priorAmount !== 'number' ||
    typeof targetAmount !== 'number' ||
    isNaN(priorAmount) ||
    isNaN(targetAmount) ||
    priorAmount <= 0 ||
    targetAmount <= 0
  ) {
    return null;
  }
  const diffAmount = targetAmount - priorAmount;
  const diffPercent = Number(((diffAmount / priorAmount) * 100).toFixed(2));
  return { diffAmount, diffPercent };
}

/**
 * 8. Pure XIRR Calculation
 * 
 * Numerical method:
 * NPV(r) = sum( C_i / (1 + r)^((d_i - d_0) / 365) ) = 0
 * 
 * Uses Newton-Raphson iteration with robust Bisection fallback if derivative is near zero
 * or if Newton step lands outside [-0.999, 100].
 */
export function calculateXirr(
  cashFlows: PureCashFlowPoint[],
  maxIterations: number = 100,
  tolerance: number = 1e-7
): { rate: number; iterations: number } | null {
  if (!Array.isArray(cashFlows) || cashFlows.length < 2) {
    return null;
  }

  // Parse and sort cash flows by date ascending
  const parsedFlows: { amount: number; timeYears: number }[] = [];
  const baseDate = new Date(cashFlows[0].date).getTime();
  if (isNaN(baseDate)) return null;

  let hasNegative = false;
  let hasPositive = false;

  const sortedFlows = [...cashFlows].sort((a, b) => a.date.localeCompare(b.date));
  const t0 = new Date(sortedFlows[0].date).getTime();

  for (const cf of sortedFlows) {
    if (typeof cf.amount !== 'number' || isNaN(cf.amount) || cf.amount === 0) {
      return null;
    }
    const t = new Date(cf.date).getTime();
    if (isNaN(t)) return null;

    if (cf.amount < 0) hasNegative = true;
    if (cf.amount > 0) hasPositive = true;

    const diffDays = (t - t0) / (1000 * 60 * 60 * 24);
    const timeYears = diffDays / 365.0;
    parsedFlows.push({ amount: cf.amount, timeYears });
  }

  // Must have both positive and negative cash flows
  if (!hasNegative || !hasPositive) {
    return null;
  }

  // Evaluate NPV and derivative dNPV/dr
  function npvAndDeriv(r: number): { npv: number; dNpv: number } {
    let npv = 0;
    let dNpv = 0;
    for (const f of parsedFlows) {
      const factor = Math.pow(1 + r, f.timeYears);
      if (factor === 0 || !isFinite(factor)) return { npv: NaN, dNpv: NaN };
      npv += f.amount / factor;
      dNpv += (-f.timeYears * f.amount) / (factor * (1 + r));
    }
    return { npv, dNpv };
  }

  // Initial guess: 10%
  let r = 0.1;
  let iter = 0;

  for (iter = 0; iter < maxIterations; iter++) {
    const { npv, dNpv } = npvAndDeriv(r);
    if (isNaN(npv) || isNaN(dNpv)) break;

    if (Math.abs(npv) < tolerance) {
      return { rate: Number(r.toFixed(6)), iterations: iter };
    }

    if (Math.abs(dNpv) < 1e-12) {
      break; // Derivative too small, switch to bracket/bisection
    }

    const nextR = r - npv / dNpv;
    // Bound check: rate cannot be <= -1 (-100%)
    if (nextR <= -0.999 || nextR > 50 || isNaN(nextR)) {
      break; // Newton stepped out of bounds, switch to bisection
    }

    if (Math.abs(nextR - r) < tolerance) {
      return { rate: Number(nextR.toFixed(6)), iterations: iter + 1 };
    }
    r = nextR;
  }

  // Fallback: Bisection search in [-0.99, 10.0]
  let low = -0.99;
  let high = 10.0;
  let npvLow = npvAndDeriv(low).npv;
  let npvHigh = npvAndDeriv(high).npv;

  if (isNaN(npvLow) || isNaN(npvHigh) || npvLow * npvHigh > 0) {
    // Try wider range up to 50
    high = 50.0;
    npvHigh = npvAndDeriv(high).npv;
    if (isNaN(npvHigh) || npvLow * npvHigh > 0) {
      return null; // Root not bracketed
    }
  }

  for (let bIter = 0; bIter < maxIterations; bIter++) {
    const mid = (low + high) / 2;
    const midNpv = npvAndDeriv(mid).npv;
    if (isNaN(midNpv)) return null;

    if (Math.abs(midNpv) < tolerance || (high - low) / 2 < tolerance) {
      return { rate: Number(mid.toFixed(6)), iterations: iter + bIter + 1 };
    }

    if (midNpv * npvLow < 0) {
      high = mid;
      npvHigh = midNpv;
    } else {
      low = mid;
      npvLow = midNpv;
    }
  }

  return { rate: Number(((low + high) / 2).toFixed(6)), iterations: iter + maxIterations };
}
