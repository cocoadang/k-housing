import {
  formatExclusiveArea,
  formatSupplyArea,
  formatSupplyPyeong,
  formatSupplyAreaWithPyeong,
  formatLegacyPyeong,
  formatPricePerExclusiveSqm,
  formatPricePerSupplyPyeong,
  formatTargetSelectorOption,
  formatAreaFamilyText,
} from '../src/utils/redevelopmentAreaFormatters';
import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

console.log('================================================================');
console.log('🚀 PHASE 8L: RECONSTRUCTION UI AREA SEMANTIC RULES VERIFICATION');
console.log('================================================================');

// 1. Area Display Formatter Tests
assert(
  formatExclusiveArea(59.99) === '전용 59.99㎡',
  '1.1 formatExclusiveArea returns "전용 59.99㎡"'
);
assert(
  formatExclusiveArea(99.61) === '전용 99.61㎡',
  '1.2 formatExclusiveArea returns "전용 99.61㎡"'
);
assert(
  formatExclusiveArea(null) === '전용면적 확인 불가',
  '1.3 formatExclusiveArea with null returns "전용면적 확인 불가"'
);
assert(
  formatSupplyAreaWithPyeong(84.95) === '공급 84.95㎡ / 25.70평',
  '1.4 formatSupplyAreaWithPyeong calculates pyeong with 3.305785 divisor -> "공급 84.95㎡ / 25.70평"'
);
assert(
  formatSupplyAreaWithPyeong(null) === '공급면적 확인 불가',
  '1.5 formatSupplyAreaWithPyeong with null returns "공급면적 확인 불가"'
);
assert(
  formatSupplyPyeong(null) === '공급면적 확인 불가',
  '1.6 formatSupplyPyeong with null returns "공급면적 확인 불가"'
);
assert(
  formatLegacyPyeong('구 34평형') === '구 34평형',
  '1.7 formatLegacyPyeong returns legacy designation when provided'
);

// Price per unit formatters
assert(
  formatPricePerExclusiveSqm(200000, 100) === '20,000,000원/㎡',
  '1.8 formatPricePerExclusiveSqm returns distinct per-sqm price'
);
assert(
  formatPricePerSupplyPyeong(200000, 84.95).text.includes('원/평'),
  '1.9 formatPricePerSupplyPyeong returns distinct per-pyeong price calculated with supply area'
);
assert(
  formatPricePerSupplyPyeong(200000, undefined).text === '공급면적 확인 불가 (평당가 산출 제외)',
  '1.10 formatPricePerSupplyPyeong fails gracefully when supplyArea is missing'
);

// Text cleaner
assert(
  formatAreaFamilyText('59.99㎡ / 18.15평') === '전용 59.99㎡',
  '1.11 formatAreaFamilyText cleanses prohibited mixed notation'
);

// 2. Source Code Inspection for MarketValueSection.tsx
const marketValueSrc = fs.readFileSync(
  path.join(process.cwd(), 'src/components/Redevelopment/MarketValueSection.tsx'),
  'utf8'
);

assert(
  marketValueSrc.includes('formatExclusiveArea') &&
  marketValueSrc.includes('formatSupplyAreaWithPyeong') &&
  marketValueSrc.includes('formatPricePerExclusiveSqm') &&
  marketValueSrc.includes('formatPricePerSupplyPyeong'),
  '2.1 MarketValueSection imports and uses standardized area and unit price formatters'
);

assert(
  marketValueSrc.includes('전용면적:') &&
  marketValueSrc.includes('공급면적:') &&
  marketValueSrc.includes('관행 평형명:') &&
  marketValueSrc.includes('거래건수:') &&
  marketValueSrc.includes('전용㎡당 가격:') &&
  marketValueSrc.includes('공급평당 가격:'),
  '2.2 Comparison cards explicitly present the required dimensions & distinct unit prices'
);

assert(
  !marketValueSrc.includes('99.61㎡ / 30.1평') &&
  !marketValueSrc.includes('59.99㎡ / 18.15평'),
  '2.3 Removed mixed notation from selector and cards'
);

// 3. Source Code Inspection for LandShareSection.tsx
const landShareSrc = fs.readFileSync(
  path.join(process.cwd(), 'src/components/Redevelopment/LandShareSection.tsx'),
  'utf8'
);

assert(
  landShareSrc.includes('formatExclusiveArea') &&
  !landShareSrc.includes('대지지분 (㎡ / 평)') &&
  !landShareSrc.includes('* 0.3025'),
  '3.1 LandShareSection strictly uses formatExclusiveArea and removed arbitrary inline pyeong conversion'
);

// 4. Source Code Inspection for OwnerEconomicsSection.tsx
const ownerEconomicsSrc = fs.readFileSync(
  path.join(process.cwd(), 'src/components/Redevelopment/OwnerEconomicsSection.tsx'),
  'utf8'
);

assert(
  ownerEconomicsSrc.includes('formatExclusiveArea') &&
  !ownerEconomicsSrc.includes('* 0.3025') &&
  ownerEconomicsSrc.includes('formatAreaFamilyText'),
  '4.1 OwnerEconomicsSection displays exclusive area in sqm and cleanses research examples'
);

assert(
  ownerEconomicsSrc.includes('종전 자산 법정 정산 연결 흐름') &&
  ownerEconomicsSrc.includes('1. 대지지분') &&
  ownerEconomicsSrc.includes('2. 종전자산평가액') &&
  ownerEconomicsSrc.includes('3. 권리가액') &&
  ownerEconomicsSrc.includes('4. 조합원분양가') &&
  ownerEconomicsSrc.includes('5. 분담금 / 환급금'),
  '4.2 OwnerEconomicsSection displays the 5-step settlement pipeline'
);

// 5. Source Code Inspection for comparison59Engine.ts
const comparison59Src = fs.readFileSync(
  path.join(process.cwd(), 'src/services/comparison59Engine.ts'),
  'utf8'
);

assert(
  comparison59Src.includes('3.305785') &&
  !comparison59Src.includes('targetProperty.supplyAreaSqm / 3.3)'),
  '5.1 comparison59Engine calculates supply pyeong using 3.305785 factor'
);

console.log('================================================================');
console.log(`📊 PHASE 8L VERIFICATION SUMMARY: ${passed} / ${passed + failed} PASSED`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL PHASE 8L UI AREA SEMANTIC RULES VERIFIED SUCCESSFULLY!');
}
