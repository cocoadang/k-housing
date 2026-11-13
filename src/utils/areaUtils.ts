import { AreaCategory, AreaFamily, AreaFamilyResolution, StandardAreaCategory } from '../types';
import { AREA_FAMILIES_REGISTRY, getAreaFamiliesForComplex } from '../data/areaFamilies';

export interface AreaRangeConfig {
  id: '59' | '84';
  label: string;
  shortLabel: string;
  minExclusiveArea: number;
  maxExclusiveArea: number;
  description: string;
}

/**
 * 기본 주택형 전용면적 범위 (Inclusive)
 * 59형: 58.0 <= exclusiveArea <= 60.0
 * 84형: 83.0 <= exclusiveArea <= 85.0 (85.00 포함)
 */
export const AREA_CONFIGS: Record<'59' | '84', AreaRangeConfig> = {
  '59': {
    id: '59',
    label: '59㎡형',
    shortLabel: '59㎡형',
    minExclusiveArea: 58.0,
    maxExclusiveArea: 60.0,
    description: '59형 (전용 58㎡ ~ 60㎡)',
  },
  '84': {
    id: '84',
    label: '84㎡형',
    shortLabel: '84㎡형',
    minExclusiveArea: 83.0,
    maxExclusiveArea: 85.0,
    description: '84형 (전용 83㎡ ~ 85㎡, 85.00 포함)',
  },
};

/**
 * 단지별 예외 전용면적 레지스트리 (COMPLEX-SPECIFIC EXCEPTION - 하위 호환성 유지)
 * 기본 범위(58~60, 83~85)를 벗어나지만 실제 해당 단지의 59형/84형 패밀리로
 * 확인된 면적이 존재할 경우 명시적으로 등록합니다.
 * 삼익비치(남천삼익타운): 구 24평형(60.83㎡, 61.09㎡)을 59형으로 분류
 */
export const AREA_EXCEPTIONS: Record<string, { '59'?: number[]; '84'?: number[] }> = {
  busan_samick_beach: {
    '59': [60.83, 61.09],
  },
};

/**
 * Single Source of Truth (SSOT) 기반 AreaFamily 해석기
 * 
 * ARCHITECTURAL RULE:
 * 1. 단지의 공식/검증된 AreaFamilyRegistry를 최우선 조회합니다.
 * 2. 정확한 면적(exactAreas) 또는 검증된 범위(min/max)에 일치할 경우 MATCHED를 반환합니다.
 * 3. 일치하지 않는 면적은 절대로 임의로 가장 가까운 군집에 묶지 않고 UNMAPPED_AREA를 반환합니다.
 */
export function resolveAreaFamily(exclusiveArea: number, complexId?: string): AreaFamilyResolution {
  if (!complexId) {
    return { status: 'UNMAPPED_AREA' };
  }

  const families = getAreaFamiliesForComplex(complexId);
  if (!families || families.length === 0) {
    return { status: 'UNMAPPED_AREA' };
  }

  // 1. 정확한 면적 매칭 (exactAreas 우선, 허용오차 0.01)
  for (const family of families) {
    if (family.exactAreas && family.exactAreas.length > 0) {
      if (family.exactAreas.some((ea) => Math.abs(ea - exclusiveArea) < 0.01)) {
        return { status: 'MATCHED', family };
      }
    }
  }

  // 2. 대표 전용면적 직접 일치 (0.01 오차)
  for (const family of families) {
    if (Math.abs(family.representativeExclusiveArea - exclusiveArea) < 0.01) {
      return { status: 'MATCHED', family };
    }
  }

  // 3. 정의된 유효 구간(Inclusive) 매칭
  for (const family of families) {
    if (family.minExclusiveArea !== undefined && family.maxExclusiveArea !== undefined) {
      if (exclusiveArea >= family.minExclusiveArea && exclusiveArea <= family.maxExclusiveArea) {
        return { status: 'MATCHED', family };
      }
    }
  }

  // 일치하는 패밀리가 없는 경우 UNMAPPED_AREA 반환 (임의 자동 추정 금지)
  return { status: 'UNMAPPED_AREA' };
}

/**
 * 거시 비교 및 지도 탐색용 StandardAreaCategory ('59' | '84' | 'OTHER') 해석기
 * 1. AreaFamilyRegistry 매칭 시: 해당 Family의 standardCategory 반환
 * 2. 미등록 단지 또는 UNMAPPED_AREA: 기존 하위 호환 규칙 (AREA_EXCEPTIONS 및 AREA_CONFIGS) 준용
 */
export function resolveStandardCategory(exclusiveArea: number, complexId?: string): StandardAreaCategory {
  const resolution = resolveAreaFamily(exclusiveArea, complexId);
  if (resolution.status === 'MATCHED' && resolution.family) {
    return resolution.family.standardCategory;
  }

  // Fallback to legacy getAreaCategory
  const legacy = getAreaCategory(exclusiveArea, complexId);
  if (legacy === '59' || legacy === '84') {
    return legacy;
  }
  return 'OTHER';
}

/**
 * Standardized Area Category Classifier (Legacy 하위 호환 완벽 유지)
 * Based strictly on actual market exclusive area families:
 * - 1. Complex-specific exceptions checked first if registered
 * - 2. Default Standard Inclusive Ranges:
 *      59: 58.0 <= exclusiveArea <= 60.0 (inclusive)
 *      84: 83.0 <= exclusiveArea <= 85.0 (inclusive, includes 85.00)
 * - 3. Large: >= 105.0
 * - 4. Non-matching areas return 'OTHER'.
 */
export function getAreaCategory(exclusiveArea: number, complexId?: string): '59' | '84' | '114_PLUS' | 'OTHER' {
  // 1. Complex-specific exception
  if (complexId && AREA_EXCEPTIONS[complexId]) {
    const exc = AREA_EXCEPTIONS[complexId];
    if (exc['59']?.some(val => Math.abs(val - exclusiveArea) < 0.01)) {
      return '59';
    }
    if (exc['84']?.some(val => Math.abs(val - exclusiveArea) < 0.01)) {
      return '84';
    }
  }

  // 2. Standard Range (Inclusive)
  if (exclusiveArea >= AREA_CONFIGS['59'].minExclusiveArea && exclusiveArea <= AREA_CONFIGS['59'].maxExclusiveArea) {
    return '59';
  }
  if (exclusiveArea >= AREA_CONFIGS['84'].minExclusiveArea && exclusiveArea <= AREA_CONFIGS['84'].maxExclusiveArea) {
    return '84';
  }

  // 3. Large & OTHER
  if (exclusiveArea >= 105.0) {
    return '114_PLUS';
  }
  return 'OTHER';
}

/**
 * Human-readable label for selected area category
 */
export function formatAreaCategoryLabel(category: AreaCategory | string): string {
  switch (category) {
    case '59':
      return AREA_CONFIGS['59'].label;
    case '84':
      return AREA_CONFIGS['84'].label;
    default:
      return `${category}㎡`;
  }
}


