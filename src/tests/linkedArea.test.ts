import {test} from 'node:test';import assert from 'node:assert/strict';
import {parseHousingRoute} from '../utils/housingRoute';
import {getLinkedAreaFamily} from '../utils/areaFamilyUtils';
test('external links preserve allowed area groups and reject invalid input',()=>{
 for(const area of ['59','84'])assert.equal(parseHousingRoute(`?view=ANALYSIS&complex=busan_samick_beach&areaCategory=${area}`).areaCategory,area);
 for(const area of ['', 'ALL','114','<script>'])assert.equal(parseHousingRoute(`?areaCategory=${encodeURIComponent(area)}`).areaCategory,undefined);
});
test('linked area matches registered groups, including 61sqm in the 59 group, and never silently changes area',()=>{
 const f=(id:string,area:number,category:string)=>({areaFamilyId:id,representativeExclusiveArea:area,standardAreaCategory:category,hasMonthlyData:true}) as any;
 const families=[f('samick_61',61.09,'59'),f('samick_84',84.83,'84')];
 assert.equal(getLinkedAreaFamily(families,'59')?.areaFamilyId,'samick_61');
 assert.equal(getLinkedAreaFamily(families,'84')?.areaFamilyId,'samick_84');
 assert.equal(getLinkedAreaFamily([f('centum_84',84.99,'84')],'59'),null);
});
