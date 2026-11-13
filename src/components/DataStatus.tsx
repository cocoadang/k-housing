import React, {useEffect,useState} from 'react';
export function DataStatus(){
 const [status,setStatus]=useState<any>(null);
 useEffect(()=>{const controller=new AbortController();fetch('/api/data-status',{signal:controller.signal}).then(r=>r.ok?r.json():null).then(setStatus).catch(()=>{});return()=>controller.abort();},[]);
 if(!status?.revision)return null;
 return <div className="px-4 py-2 text-xs text-slate-400 border-b border-slate-800" role="status">
   최근 갱신: {new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(status.fetchedAt))} · 최근 {status.months.length}개월 원자료 대조
   {status.unclassifiedCount>0 && <span className="ml-2 text-amber-400">주택형 분류 보류 {status.unclassifiedCount}건</span>}
 </div>;
}
