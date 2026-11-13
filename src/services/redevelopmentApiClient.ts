/**
 * Redevelopment Public API Client
 * 
 * Strict Client-Side HTTP wrapper for /api/redevelopment/* endpoints.
 * ZERO direct Firestore dependencies, ZERO client-side calculations.
 */

import type {
  RedevelopmentLineagesResponse,
  RedevelopmentLineageDetailResponse,
  RedevelopmentTargetsResponse,
  RedevelopmentPriceAvailabilityResponse,
  RedevelopmentLandShareResponse,
  RedevelopmentConstructionCostsResponse,
  RedevelopmentAnalysisApiRequest,
  RedevelopmentAnalysisApiResponse,
} from '../types/redevelopmentApi';

const BASE_URL = '/api/redevelopment';

export class RedevelopmentApiClient {
  /**
   * 1. GET /api/redevelopment/lineages
   */
  public async getLineages(): Promise<RedevelopmentLineagesResponse> {
    const res = await fetch(`${BASE_URL}/lineages`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to fetch lineages (HTTP ${res.status})`);
    }
    return res.json();
  }

  /**
   * 2. GET /api/redevelopment/lineages/:lineageId
   */
  public async getLineageDetail(lineageId: string): Promise<RedevelopmentLineageDetailResponse> {
    const res = await fetch(`${BASE_URL}/lineages/${encodeURIComponent(lineageId)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to fetch lineage details (HTTP ${res.status})`);
    }
    return res.json();
  }

  /**
   * 3. GET /api/redevelopment/lineages/:lineageId/targets
   */
  public async getTargets(lineageId: string): Promise<RedevelopmentTargetsResponse> {
    const res = await fetch(`${BASE_URL}/lineages/${encodeURIComponent(lineageId)}/targets`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to fetch targets (HTTP ${res.status})`);
    }
    return res.json();
  }

  /**
   * 4. GET /api/redevelopment/price-availability
   */
  public async getPriceAvailability(
    complexId: string,
    areaFamilyId: string
  ): Promise<RedevelopmentPriceAvailabilityResponse> {
    const params = new URLSearchParams({
      complexId,
      areaFamilyId,
    });
    const res = await fetch(`${BASE_URL}/price-availability?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to fetch price availability (HTTP ${res.status})`);
    }
    return res.json();
  }

  /**
   * 5. GET /api/redevelopment/lineages/:lineageId/land-share
   */
  public async getLandShare(lineageId: string): Promise<RedevelopmentLandShareResponse> {
    const res = await fetch(`${BASE_URL}/lineages/${encodeURIComponent(lineageId)}/land-share`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to fetch land share (HTTP ${res.status})`);
    }
    return res.json();
  }

  /**
   * 6. GET /api/redevelopment/lineages/:lineageId/construction-costs
   */
  public async getConstructionCosts(lineageId: string): Promise<RedevelopmentConstructionCostsResponse> {
    const res = await fetch(`${BASE_URL}/lineages/${encodeURIComponent(lineageId)}/construction-costs`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to fetch construction costs (HTTP ${res.status})`);
    }
    return res.json();
  }

  /**
   * 7. POST /api/redevelopment/analysis
   */
  public async runAnalysis(request: RedevelopmentAnalysisApiRequest): Promise<RedevelopmentAnalysisApiResponse> {
    const res = await fetch(`${BASE_URL}/analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to run analysis (HTTP ${res.status})`);
    }
    return res.json();
  }
}

export const redevelopmentApiClient = new RedevelopmentApiClient();
