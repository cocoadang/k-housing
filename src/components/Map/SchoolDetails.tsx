import React from 'react';
import type { ElementarySchool, GwacheonSchools } from '../../types/schools';

export function SchoolDetails({ school, data }: { school: ElementarySchool; data: GwacheonSchools }) {
  const generalClasses = school.classes - school.specialClasses;
  const generalStudents = school.students - school.specialStudents;
  const average = generalClasses > 0 ? (generalStudents / generalClasses).toFixed(1) : '—';
  const zones = data.zones.features.filter(z => z.properties.schoolIds.includes(school.id));
  return <div className="space-y-3 text-xs" data-testid="school-details">
    <p className="text-slate-400">{school.address}</p>
    <dl className="grid grid-cols-3 gap-2 rounded-lg bg-slate-950/70 p-2.5">
      <div><dt className="text-slate-400">전체 학생</dt><dd className="text-base font-bold text-sky-300">{school.students.toLocaleString()}명</dd></div>
      <div><dt className="text-slate-400">전체 학급</dt><dd className="text-base font-bold">{school.classes}개</dd></div>
      <div><dt className="text-slate-400">일반학급당</dt><dd className="text-base font-bold">{average}명</dd></div>
    </dl>
    <p className="text-[11px] text-slate-400">전체에 특수·순회 {school.specialStudents}명 / {school.specialClasses}학급 포함. 일반학급당 인원은 이를 제외해 계산합니다.</p>
    <table className="w-full text-center">
      <caption className="sr-only">{school.name} 학년별 일반학급 학생 수</caption>
      <thead><tr><th scope="col">학년</th>{school.grades.map(g => <th scope="col" key={g.grade}>{g.grade}</th>)}</tr></thead>
      <tbody><tr><th scope="row" className="py-1">학생</th>{school.grades.map(g => <td key={g.grade}>{g.students}</td>)}</tr>
        <tr><th scope="row">학급</th>{school.grades.map(g => <td key={g.grade}>{g.classes}</td>)}</tr></tbody>
    </table>
    <p className="text-[11px] text-slate-400">학교알리미 {school.disclosureYear}년 공시 · 학생 수 기준 {school.studentsAsOf}</p>
    <div className="border-t border-slate-700 pt-2 space-y-1">
      {zones.map(z => <p key={z.properties.id} className={z.properties.kind === 'joint' ? 'text-amber-300' : 'text-sky-200'}>
        {z.properties.name}{z.properties.kind === 'joint' ? ' · 공동' : ''}
      </p>)}
      <p className="text-[11px] text-slate-400">학구도 기준 {data.sources.zones.asOf}. 지도 경계는 참고용이며 주소별 최종 배정은 교육지원청·취학통지서로 확인하세요.</p>
    </div>
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-sky-300 underline underline-offset-2">
      <a href={school.sourceUrl} target="_blank" rel="noopener noreferrer">학교알리미</a>
      <a href={school.website} target="_blank" rel="noopener noreferrer">학교 홈페이지</a>
      <a href="https://schoolzone.emac.kr/gis/gis.do" target="_blank" rel="noopener noreferrer">공식 학구도</a>
    </div>
  </div>;
}
