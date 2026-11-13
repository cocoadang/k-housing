import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, RefreshCw, X } from 'lucide-react';
import type { ComplexInfo } from '../types';

export type AiSelection = {complexId:string;areaFamilyId?:string;selectedArea?:string;startYmd:string;endYmd:string};
type Report={analysis:string;generatedAt:string;cached:boolean;facts:{complexName:string;areaLabel:string;observedPeriod:{startYmd:string;endYmd:string};latestPrice:number;latestTradeCount:number;cagrPct:number|null;mddPct:number|null;source:{fetchedAt:string|null}}};
export const AiAnalysisDrawer:React.FC<{isOpen:boolean;onClose:()=>void;complex:ComplexInfo;selection:AiSelection|null}>=({isOpen,onClose,complex,selection})=>{
  const [report,setReport]=useState<Report|null>(null),[error,setError]=useState(''),[isLoading,setIsLoading]=useState(false),[retry,setRetry]=useState(0);
  const serial=useRef(0),selectionKey=JSON.stringify(selection);
  useEffect(()=>{
    const request=++serial.current;
    if(!isOpen || !selection)return;
    const abort=new AbortController();setReport(null);setError('');setIsLoading(true);
    (async()=>{
      try {
        const res=await fetch('/api/ai/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:selectionKey,signal:abort.signal});
        const data=await res.json();
        if(!res.ok)throw new Error(data.error?.message || 'AI 진단을 불러오지 못했습니다.');
        if(request===serial.current)setReport(data);
      }catch(e:any){if(e.name!=='AbortError' && request===serial.current)setError(e.message || 'AI 진단을 불러오지 못했습니다.');}
      finally{if(request===serial.current)setIsLoading(false);}
    })();
    return()=>abort.abort();
  },[isOpen,selectionKey,retry]);
  if(!isOpen)return null;
  const facts=report?.facts;
  return <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex justify-end" role="dialog" aria-modal="true" aria-label="AI 시장 진단">
    <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-700 h-full flex flex-col shadow-2xl text-slate-200">
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div><h3 className="font-bold flex gap-2 items-center"><Sparkles className="w-5 h-5 text-emerald-400"/>AI 시장 진단</h3><p className="text-xs text-slate-400 mt-1">{facts?.complexName || complex.name}{facts ? ` · ${facts.areaLabel}` : ''}</p></div>
        <button onClick={onClose} aria-label="AI 진단 닫기"><X className="w-5 h-5"/></button>
      </div>
      <div className="p-5 flex-1 overflow-y-auto space-y-4 text-sm leading-relaxed">
        <p className="text-xs text-slate-400">확인된 실거래 통계를 바탕으로 관측된 흐름과 자료의 한계를 설명합니다.</p>
        {isLoading && <div className="py-16 text-center" role="status"><RefreshCw className="w-7 h-7 animate-spin mx-auto mb-3 text-emerald-400"/>실거래 통계로 진단을 생성하고 있습니다…</div>}
        {error && <p role="alert" className="p-4 rounded-xl bg-rose-950/30 text-rose-200">{error}</p>}
        {facts && <>
          <div className="p-3 rounded-xl bg-slate-950 text-xs space-y-1">
            <p>실제 관측: {facts.observedPeriod.startYmd} ~ {facts.observedPeriod.endYmd}</p>
            <p>최근 월 중위가격: {facts.latestPrice.toLocaleString()}만원 · 거래 {facts.latestTradeCount}건</p>
            <p>연평균 상승률: {facts.cagrPct===null?'계산 불가':`${facts.cagrPct}%`} · 최대 낙폭: {facts.mddPct===null?'계산 불가':`${facts.mddPct}%`}</p>
          </div>
          <div className="whitespace-pre-wrap p-4 rounded-xl border border-slate-800" data-testid="ai-report">{report.analysis}</div>
          <p className="text-xs text-slate-500">{report.cached?'동일 조건으로 생성한 진단입니다. ':''}생성: {new Date(report.generatedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}{facts.source.fetchedAt ? ` · 자료 갱신: ${new Date(facts.source.fetchedAt).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})}`:''}</p>
        </>}
        <p className="text-xs text-slate-400">AI 설명에는 오류가 있을 수 있습니다. 실제 거래 내역과 함께 확인해주세요. 가격 전망이나 매수·매도 권고를 제공하지 않습니다.</p>
      </div>
      <div className="p-4 border-t border-slate-800 flex justify-between">
        <button onClick={()=>setRetry(n=>n+1)} disabled={isLoading} className="px-3 py-2 rounded-lg bg-slate-800 disabled:opacity-40">다시 확인</button>
        <button onClick={onClose} className="px-4 py-2 rounded-lg bg-emerald-600 text-slate-950 font-bold">확인 및 닫기</button>
      </div>
    </div>
  </div>;
};
