import type { RegionalSchoolData } from '../types/schools';

const loaders: Record<string, () => Promise<{ default: unknown }>> = {
  '반포': () => import('../data/schools/반포.json'),
  '잠실': () => import('../data/schools/잠실.json'),
  '개포': () => import('../data/schools/개포.json'),
  '대치': () => import('../data/schools/대치.json'),
  '마포': () => import('../data/schools/마포.json'),
  '성동': () => import('../data/schools/성동.json'),
  '용산': () => import('../data/schools/용산.json'),
  '길음': () => import('../data/schools/길음.json'),
  '강동': () => import('../data/schools/강동.json'),
  '과천': () => import('../data/schools/과천.json'),
  '구성남': () => import('../data/schools/구성남.json'),
  '남천동': () => import('../data/schools/남천동.json'),
  '센텀시티': () => import('../data/schools/센텀시티.json'),
};

export const SCHOOL_REGION_ALIASES: Record<string, string> = {
  banpo: '반포', jamsil: '잠실', gaepo: '개포', daechi: '대치', mapo: '마포',
  seongdong: '성동', yongsan: '용산', gireum: '길음', gangdong: '강동',
  gwacheon: '과천', seongnam: '구성남', namcheon: '남천동', centum: '센텀시티',
};

export function schoolRegionFromQuery(value: string | null): string {
  const region = value && (SCHOOL_REGION_ALIASES[value] || value);
  return region && Object.hasOwn(loaders, region) ? region : 'ALL';
}

const cache = new Map<string, Promise<RegionalSchoolData>>();
export function loadRegionalSchools(region: string): Promise<RegionalSchoolData> {
  if (!Object.hasOwn(loaders, region)) return Promise.reject(new Error('Unsupported school region'));
  if (!cache.has(region)) {
    const pending = loaders[region]().then(({ default: data }) => {
      const snapshot = data as RegionalSchoolData;
      if (snapshot.region !== region || !snapshot.schools?.length || !snapshot.zones?.features) throw new Error('School snapshot mismatch');
      return snapshot;
    }).catch(error => { cache.delete(region); throw error; });
    cache.set(region, pending);
  }
  return cache.get(region)!;
}
