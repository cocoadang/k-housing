import { resolveAreaFamily, resolveStandardCategory, getAreaCategory } from '../src/utils/areaUtils';
import { AREA_FAMILIES_REGISTRY, getAreaFamiliesForComplex } from '../src/data/areaFamilies';
import { REDEVELOPMENT_LINEAGES_REGISTRY, HISTORICAL_COMPLEXES, DUNCHON_REDEVELOPMENT_LINEAGE, DUNCHON_REDEVELOPMENT_PROJECT } from '../src/data/redevelopmentLineages';

console.log('================================================================');
console.log('PHASE 1 ARCHITECTURE VERIFICATION');
console.log('================================================================');

let passedTests = 0;
let totalTests = 0;

function assert(description: string, condition: boolean, details?: any) {
  totalTests++;
  if (condition) {
    console.log(`✅ PASS: ${description}`);
    passedTests++;
  } else {
    console.error(`❌ FAIL: ${description}`, details || '');
  }
}

// 1. Standard 59/84 resolution
const res59 = resolveAreaFamily(59.98, 'banpo_xi');
assert('banpo_xi 59.98 maps to banpo_xi_59', res59.status === 'MATCHED' && res59.family?.id === 'banpo_xi_59');
assert('banpo_xi_59 has standardCategory 59', res59.family?.standardCategory === '59');

const res84 = resolveAreaFamily(84.99, 'banpo_acro');
assert('banpo_acro 84.99 maps to banpo_acro_84', res84.status === 'MATCHED' && res84.family?.id === 'banpo_acro_84');
assert('banpo_acro_84 has standardCategory 84', res84.family?.standardCategory === '84');

// 2. Samick Beach special cases (60.83, 61.09)
const resSamick60 = resolveAreaFamily(60.83, 'busan_samick_beach');
assert('Samick Beach 60.83 maps to samick_61', resSamick60.status === 'MATCHED' && resSamick60.family?.id === 'samick_61');
assert('samick_61 has standardCategory 59', resSamick60.family?.standardCategory === '59');

const resSamick61 = resolveAreaFamily(61.09, 'busan_samick_beach');
assert('Samick Beach 61.09 maps to samick_61', resSamick61.status === 'MATCHED' && resSamick61.family?.id === 'samick_61');

// 3. Other verified families in Samick Beach
const resSamick41 = resolveAreaFamily(41.52, 'busan_samick_beach');
assert('Samick Beach 41.52 maps to samick_41', resSamick41.status === 'MATCHED' && resSamick41.family?.id === 'samick_41');
assert('samick_41 has standardCategory OTHER', resSamick41.family?.standardCategory === 'OTHER');

const resSamick84 = resolveAreaFamily(84.83, 'busan_samick_beach');
assert('Samick Beach 84.83 maps to samick_84', resSamick84.status === 'MATCHED' && resSamick84.family?.id === 'samick_84');
assert('samick_84 has standardCategory 84', resSamick84.family?.standardCategory === '84');

// 4. UNMAPPED_AREA handling (Never guess nearest)
const resUnmapped = resolveAreaFamily(52.12, 'busan_samick_beach');
assert('Arbitrary 52.12 in Samick Beach returns UNMAPPED_AREA', resUnmapped.status === 'UNMAPPED_AREA');

const resUnmappedComplex = resolveAreaFamily(84.9, 'unknown_complex_123');
assert('Unregistered complex returns UNMAPPED_AREA', resUnmappedComplex.status === 'UNMAPPED_AREA');

// 5. Backward Compatibility (Legacy getAreaCategory)
assert('Legacy getAreaCategory(60.83, busan_samick_beach) returns 59', getAreaCategory(60.83, 'busan_samick_beach') === '59');
assert('Legacy getAreaCategory(61.09, busan_samick_beach) returns 59', getAreaCategory(61.09, 'busan_samick_beach') === '59');
assert('Legacy getAreaCategory(84.95, banpo_acro) returns 84', getAreaCategory(84.95, 'banpo_acro') === '84');
assert('Legacy getAreaCategory(41.52, busan_samick_beach) returns OTHER', getAreaCategory(41.52, 'busan_samick_beach') === 'OTHER');

// 6. resolveStandardCategory
assert('resolveStandardCategory for 60.83 at samick is 59', resolveStandardCategory(60.83, 'busan_samick_beach') === '59');
assert('resolveStandardCategory for 41.52 at samick is OTHER', resolveStandardCategory(41.52, 'busan_samick_beach') === 'OTHER');
assert('resolveStandardCategory for 84.94 at banpo_xi is 84', resolveStandardCategory(84.94, 'banpo_xi') === '84');

// 7. Redevelopment Lineage & Historical Complexes check
assert('Dunchon lineage is registered', DUNCHON_REDEVELOPMENT_LINEAGE.id === 'dunchon_redevelopment');
assert('Dunchon lineage has 4 predecessors', DUNCHON_REDEVELOPMENT_LINEAGE.predecessorComplexIds.length === 4);
assert('Dunchon lineage has 1 successor (gangdong_olympic_park)', DUNCHON_REDEVELOPMENT_LINEAGE.successorComplexIds[0] === 'gangdong_olympic_park');
assert('Historical complexes are flagged historicalOnly & isActive=false', HISTORICAL_COMPLEXES.every(c => c.historicalOnly && !c.isActive));

console.log('================================================================');
console.log(`RESULTS: ${passedTests}/${totalTests} tests passed`);
console.log('================================================================');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
