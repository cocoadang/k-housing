import React, { useState, useEffect } from 'react';
import { Database, ShieldCheck, RefreshCw, Server, Cpu, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { ComplexInfo } from '../types';

interface ApiInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentComplex: ComplexInfo;
}

export const ApiInspectorModal: React.FC<ApiInspectorModalProps> = ({
  isOpen,
  onClose,
  currentComplex,
}) => {
  const [cacheStats, setCacheStats] = useState<any>({
    totalEntries: 0,
    totalHits: 0,
    totalRequests: 0,
    hitRatioPct: 0,
    storageType: 'In-Memory Cache',
  });
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [testYmd, setTestYmd] = useState('202408');
  const [testResponse, setTestResponse] = useState<any>(null);
  const [isLoadingTest, setIsLoadingTest] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const fetchStatus = () => {
    fetch('/api/cache/stats')
      .then((res) => res.json())
      .then((data) => setCacheStats(data))
      .catch(() => {});

    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setHealthStatus(data))
      .catch(() => {});
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClearCache = async () => {
    setIsClearing(true);
    try {
      await fetch('/api/cache/clear', { method: 'POST' });
      setCacheStats({
        totalEntries: 0,
        totalHits: 0,
        totalRequests: 0,
        hitRatioPct: 0,
        storageType: 'In-Memory Cache',
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsClearing(false);
    }
  };

  const handleTestQuery = async () => {
    setIsLoadingTest(true);
    setTestResponse(null);
    try {
      const res = await fetch(`/api/molit/trades?lawdCd=${currentComplex.lawdCd}&dealYmd=${testYmd}`);
      const data = await res.json();
      setTestResponse(data);
      fetchStatus();
    } catch (e: any) {
      setTestResponse({ success: false, error: { message: e.message } });
    } finally {
      setIsLoadingTest(false);
    }
  };

  const hasMolitKey = healthStatus?.env?.hasMolitKey;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl text-slate-200 p-5 sm:p-6 space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                OpenAPI 파이프라인 & 캐시 아키텍처
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  실제 데이터 모드 (Production)
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                국토교통부 아파트 실거래가 OpenAPI 백엔드 프록시 및 In-Memory 캐시 모니터링
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Server API Key Configuration Status */}
        <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200">서버 환경변수 및 인증키 상태</span>
              <span className="text-[10px] text-slate-400 font-mono">Backend Secure Proxy</span>
            </div>
            {hasMolitKey ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" /> MOLIT_API_KEY 등록됨
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                <AlertCircle className="w-3.5 h-3.5" /> MOLIT_API_KEY 미설정
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            API Key는 보안을 위해 브라우저에 절대 노출되지 않으며, 서버의 <code className="text-slate-300">.env (MOLIT_API_KEY)</code>를 통해 공공데이터포털(data.go.kr)에 안전하게 프록시 요청됩니다.
          </p>
        </div>

        {/* Cache Performance Card */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
          <div>
            <span className="text-[11px] text-slate-400 block">캐시 적중률 (Hit Ratio)</span>
            <span className="text-xl font-bold text-emerald-400 font-mono">
              {cacheStats.hitRatioPct || 0}%
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">보관 데이터셋</span>
            <span className="text-sm font-bold text-slate-100 font-mono mt-1 block">
              {cacheStats.totalEntries || 0}개 월간 데이터
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">총 API 요청 처리</span>
            <span className="text-xl font-bold text-slate-100 font-mono">
              {cacheStats.totalRequests || 0} Calls
            </span>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleClearCache}
              disabled={isClearing}
              className="w-full py-1.5 px-2 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 rounded-lg text-xs font-semibold text-rose-300 transition-colors flex items-center justify-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isClearing ? 'animate-spin' : ''}`} />
              캐시 플러시
            </button>
          </div>
        </div>

        {/* OpenAPI Technical Specifications */}
        <div className="space-y-3 text-xs">
          <h4 className="font-bold text-slate-200 flex items-center gap-1.5">
            <Server className="w-4 h-4 text-emerald-400" />
            1. 국토교통부 아파트매매 실거래자료 OpenAPI 규격 (data.go.kr)
          </h4>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] space-y-1.5 text-slate-300">
            <div>
              <span className="text-emerald-400">Endpoint:</span>{' '}
              http://openapi.molit.go.kr/OpenAPI_ToolInstallPackage/service/rest/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev
            </div>
            <div>
              <span className="text-emerald-400">현재 단지 법정동코드 (LAWD_CD):</span>{' '}
              <strong className="text-amber-300">{currentComplex.lawdCd}</strong> ({currentComplex.district})
            </div>
            <div>
              <span className="text-emerald-400">단지 별칭(apiAliases):</span>{' '}
              <span className="text-slate-400">[{currentComplex.apiAliases?.join(', ')}]</span>
            </div>
            <div>
              <span className="text-emerald-400">Security Architecture:</span> Server-Side Proxy (MOLIT_API_KEY)
            </div>
          </div>

          <h4 className="font-bold text-slate-200 flex items-center gap-1.5 pt-2">
            <ShieldCheck className="w-4 h-4 text-sky-400" />
            2. 한국부동산원(R-ONE) 부동산통계 OpenAPI 규격
          </h4>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] space-y-1 text-slate-300">
            <div>
              <span className="text-sky-400">상태:</span>{' '}
              <span className="text-amber-300 font-semibold">실제 R-ONE OpenAPI 연동 준비 중 (Phase 2 예정)</span>
            </div>
            <div>
              <span className="text-sky-400">Dataset:</span> 전국주택가격동향조사 아파트 매매가격지수 (월간)
            </div>
          </div>
        </div>

        {/* Live OpenAPI Query Sandbox */}
        <div className="space-y-3 pt-2 border-t border-slate-800 text-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="font-bold text-slate-200 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-emerald-400" />
              3. 실시간 API 프록시 쿼리 테스트
            </h4>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={testYmd}
                onChange={(e) => setTestYmd(e.target.value)}
                placeholder="YYYYMM"
                className="w-24 px-2 py-1 bg-slate-950 border border-slate-800 rounded font-mono text-center text-slate-200 focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={handleTestQuery}
                disabled={isLoadingTest}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 font-semibold rounded text-slate-950 transition-colors flex items-center gap-1"
              >
                {isLoadingTest && <RefreshCw className="w-3 h-3 animate-spin" />}
                {isLoadingTest ? '요청 중...' : '쿼리 실행'}
              </button>
            </div>
          </div>

          {testResponse && (
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 max-h-48 overflow-y-auto">
              <pre className="text-[10px] font-mono text-slate-300 leading-relaxed whitespace-pre-wrap">
                {JSON.stringify(testResponse, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 font-medium text-xs rounded-lg text-slate-200 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
