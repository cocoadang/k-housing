import { TARGET_COMPLEXES } from '../data/complexesData';
import { REDEVELOPMENT_LINEAGES_REGISTRY } from '../data/redevelopmentLineages';

export function parseHousingRoute(search: string) {
  const params = new URLSearchParams(search);
  const complexId = params.get('complex');
  const lineageId = params.get('lineage');
  const view = params.get('view');
  return {
    view: (['MAP', 'ANALYSIS', 'COMPARE', 'REDEVELOPMENT'].includes(view || '') ? view : 'MAP') as 'MAP' | 'ANALYSIS' | 'COMPARE' | 'REDEVELOPMENT',
    complexId: TARGET_COMPLEXES.some(c => c.id === complexId) ? complexId! : 'banpo_xi',
    lineageId: REDEVELOPMENT_LINEAGES_REGISTRY.some(l => l.lineageId === lineageId) ? lineageId! : 'dunchon_redevelopment',
  };
}

/** A redevelopment project and an apartment asset are deliberately different entities. */
export const APT_PROJECT_LINKS = [
  { aptProjectId: 'chokjin-3', housingLineageId: 'chokjin3_redevelopment', housingProjectId: 'proj_chokjin3_redevelopment' },
  { aptProjectId: 'samik-beach', housingComplexId: 'busan_samick_beach' },
] as const;
