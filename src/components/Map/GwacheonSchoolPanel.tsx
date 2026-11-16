import React, { useState } from 'react';
import type { GwacheonSchools } from '../../types/schools';
import { SchoolDetails } from './SchoolDetails';

export function GwacheonSchoolPanel({ data, selectedId, onSelect, onClose }: {
  data: GwacheonSchools; selectedId: string | null;
  onSelect: (id: string) => void; onClose: () => void;
}) {
  const [listOpen, setListOpen] = useState(false);
  const school = data.schools.find(s => s.id === selectedId);
  return <section aria-label="과천 초등학교 정보" className="absolute top-3 right-3 left-3 sm:left-auto sm:w-[330px] z-20 rounded-xl border border-slate-700 bg-slate-900/95 shadow-xl p-3 max-h-[42%] sm:max-h-[70%] overflow-y-auto">
    <div className="flex items-center justify-between gap-2 mb-2">
      <h3 className="font-bold text-sm text-sky-200">{school?.name || `과천 초등학교 ${data.schools.length}곳`}</h3>
      <button type="button" className="text-xs px-2 py-1 rounded bg-slate-800" onClick={school ? onClose : () => setListOpen(v => !v)}>
        {school ? '목록으로' : listOpen ? '목록 접기' : '목록 보기'}
      </button>
    </div>
    {school ? <SchoolDetails school={school} data={data} /> : <>
      <p className="text-[11px] text-slate-300">학생 수 2026-04-01 · 통학구역 2026-09-20 기준</p>
      <p className="text-[11px] text-slate-400 mt-1">파랑: 통학구역 · 주황: 공동통학구역<br />경계는 참고용입니다. 주소별 최종 배정은 교육지원청 확인이 필요합니다.</p>
      {listOpen && <ul className="mt-2 space-y-1">{data.schools.map(s => <li key={s.id}>
        <button type="button" onClick={() => onSelect(s.id)} className="w-full flex justify-between gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs hover:bg-slate-700">
          <span>{s.name}</span><span>{s.students.toLocaleString()}명</span>
        </button>
      </li>)}</ul>}
      <a href={data.sources.students.url} target="_blank" rel="noopener noreferrer" className="text-[11px] underline text-sky-300 inline-block mt-2">학교알리미 자료</a>
      <a href="https://schoolzone.emac.kr/publicData/publicDataList.do" target="_blank" rel="noopener noreferrer" className="text-[11px] underline text-sky-300 inline-block mt-2 ml-3">공식 경계 자료</a>
    </>}
  </section>;
}
