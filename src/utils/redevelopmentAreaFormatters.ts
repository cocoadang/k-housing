/**
 * Phase 8L & Area Formatting Standard
 * 
 * Strict formatting rules:
 * - 전용면적은 ㎡로만 표시: "전용 59.99㎡"
 * - 공급면적은 ㎡와 평을 함께 표시 가능: "공급 84.95㎡ / 25.70평" (평수 계산: supplyAreaSqm / 3.305785)
 * - 전용면적을 평으로 환산하여 표시 금지 ("59.99㎡ / 18.15평" 같은 혼합 표기 전체 UI에서 영구 제거)
 * - 공급면적이 null이면 평수도 계산하지 말고 "공급면적 확인 불가"로 표시
 * - 평당가는 실제 공급면적 기준으로만 계산 (supplyAreaSqm / 3.305785)
 */

export const PYEONG_DIVISOR = 3.305785;

/**
 * 전용면적 표기 규칙: "전용 59.99㎡" (㎡로만 표시, 평 환산 절대 금지)
 */
export function formatExclusiveArea(sqm: number | null | undefined): string {
  if (sqm === null || sqm === undefined || isNaN(sqm) || sqm <= 0) {
    return '전용면적 확인 불가';
  }
  return `전용 ${sqm.toFixed(2).replace(/\.00$/, '')}㎡`;
}

/**
 * 공급면적 단독 표기: "공급 84.95㎡" (부재 시 "공급면적 확인 불가")
 */
export function formatSupplyArea(sqm: number | null | undefined): string {
  if (sqm === null || sqm === undefined || isNaN(sqm) || sqm <= 0) {
    return '공급면적 확인 불가';
  }
  return `공급 ${sqm.toFixed(2).replace(/\.00$/, '')}㎡`;
}

/**
 * 공급평형 단독 표기: 실제 공급면적 / 3.305785 계산 가능할 때만 "25.70평", 부재 시 "공급면적 확인 불가"
 */
export function formatSupplyPyeong(supplySqm: number | null | undefined): string {
  if (supplySqm === null || supplySqm === undefined || isNaN(supplySqm) || supplySqm <= 0) {
    return '공급면적 확인 불가';
  }
  const pyeong = supplySqm / PYEONG_DIVISOR;
  return `${pyeong.toFixed(2)}평`;
}

/**
 * 공급면적 + 평수 동시 표기 규칙: "공급 84.95㎡ / 25.70평"
 * 공급면적이 null이면 평수도 계산하지 말고 "공급면적 확인 불가"로 표시
 */
export function formatSupplyAreaWithPyeong(supplySqm: number | null | undefined): string {
  if (supplySqm === null || supplySqm === undefined || isNaN(supplySqm) || supplySqm <= 0) {
    return '공급면적 확인 불가';
  }
  const pyeong = supplySqm / PYEONG_DIVISOR;
  return `공급 ${supplySqm.toFixed(2).replace(/\.00$/, '')}㎡ / ${pyeong.toFixed(2)}평`;
}

/**
 * 기존 시장 관행명 표기: "구 34평형" (전용/3.3 계산값이 아닌 분양 당시 공인 명칭)
 */
export function formatLegacyPyeong(label?: string | null): string | null {
  if (!label || label.trim() === '') return null;
  const clean = label.trim().replace(/^구\s*/, '');
  return `구 ${clean}`;
}

/**
 * 대상 선택 드롭다운 옵션 라벨:
 * 예: "둔촌주공 1단지 - 51㎡형 (구 16평형) (전용 50.84㎡)"
 * 혹은 공급면적이 있으면: "둔촌주공 1단지 - 16평형 (전용 50.84㎡ · 공급 84.95㎡ / 25.70평)"
 * ⚠️ 전용㎡를 평으로 환산한 '59.99㎡ / 18.15평' 같은 혼합 표기는 절대 출력하지 않음
 */
export function formatTargetSelectorOption(target: {
  complexName: string;
  areaFamilyLabel: string;
  exclusiveAreaRepresentative: number;
  supplyAreaRepresentative?: number | null;
  legacyPyeongLabel?: string | null;
}): string {
  const exclusiveText = formatExclusiveArea(target.exclusiveAreaRepresentative);
  if (target.supplyAreaRepresentative && target.supplyAreaRepresentative > 0) {
    const supplyText = formatSupplyAreaWithPyeong(target.supplyAreaRepresentative);
    return `${target.complexName} - ${target.areaFamilyLabel} (${exclusiveText} · ${supplyText})`;
  }
  const legacyText = formatLegacyPyeong(target.legacyPyeongLabel);
  if (legacyText && !target.areaFamilyLabel.includes(legacyText)) {
    return `${target.complexName} - ${target.areaFamilyLabel} (${exclusiveText} · ${legacyText})`;
  }
  return `${target.complexName} - ${target.areaFamilyLabel} (${exclusiveText})`;
}

/**
 * 전용㎡당 가격 표기
 * @param priceManwon 실거래가 (만원 단위)
 * @param exclusiveSqm 전용면적 (㎡)
 */
export function formatPricePerExclusiveSqm(
  priceManwon: number | null | undefined,
  exclusiveSqm: number | null | undefined
): string {
  if (!priceManwon || !exclusiveSqm || exclusiveSqm <= 0) {
    return '산출 불가';
  }
  const won = priceManwon * 10000;
  const perSqm = Math.round(won / exclusiveSqm);
  return `${perSqm.toLocaleString()}원/㎡`;
}

/**
 * 공급평당 가격 표기: 평당가는 실제 공급면적 기준으로만 계산!
 * supplySqm 부재 시 '공급면적 확인 불가 (평당가 산출 제외)'
 * @param priceManwon 실거래가 (만원 단위)
 * @param supplySqm 공급면적 (㎡)
 */
export function formatPricePerSupplyPyeong(
  priceManwon: number | null | undefined,
  supplySqm: number | null | undefined
): { text: string; isCalculable: boolean } {
  if (!supplySqm || supplySqm <= 0) {
    return {
      text: '공급면적 확인 불가 (평당가 산출 제외)',
      isCalculable: false,
    };
  }
  if (!priceManwon) {
    return {
      text: '거래가격 부재',
      isCalculable: false,
    };
  }
  const won = priceManwon * 10000;
  const pyeong = supplySqm / PYEONG_DIVISOR;
  const perPyeong = Math.round(won / pyeong);
  return {
    text: `${perPyeong.toLocaleString()}원/평`,
    isCalculable: true,
  };
}

/**
 * 일반 텍스트 내 잘못된 'XX㎡ / YY평' 혼합 표기 자동 정화
 */
export function formatAreaFamilyText(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/(\d+(?:\.\d+)?)\s*㎡\s*\/\s*(\d+(?:\.\d+)?)\s*평/g, '전용 $1㎡');
}
