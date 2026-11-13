import React, { useState, useEffect, useCallback } from 'react';
import { TradeRecord, ComplexInfo, AreaFamilyMetadata } from '../../types';
import { formatPrice, formatPyeongPrice } from '../../utils/calculations';
import { dataService } from '../../services/dataService';
import { Table, Search, ArrowUpDown, Download, ChevronLeft, ChevronRight, CheckCircle2, ShieldAlert, Loader2 } from 'lucide-react';

interface TransactionLedgerProps {
  complex: ComplexInfo;
  selectedAreaFamilyId?: string | null;
  selectedFamily?: AreaFamilyMetadata | null;
  startYmd: string;
  endYmd: string;
  onExportCsv: () => void;
  trades?: TradeRecord[];
}

export const TransactionLedger: React.FC<TransactionLedgerProps> = ({
  complex,
  selectedAreaFamilyId,
  selectedFamily,
  startYmd,
  endYmd,
  onExportCsv,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'dealDate' | 'price' | 'exclusiveArea' | 'floor'>('dealDate');
  const [sortAsc, setSortAsc] = useState(false);

  // Server-side cursor pagination state
  const [items, setItems] = useState<TradeRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [page, setPage] = useState<number>(1);
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([null]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const pageSize = 15;
  const supplyArea = selectedFamily?.representativeSupplyArea;
  const hasSupplyArea = typeof supplyArea === 'number' && supplyArea > 0;
  const supplyPyeong = hasSupplyArea ? supplyArea / 3.305785 : null;

  // Query page with a given cursor
  const loadPage = useCallback(
    async (targetCursor: string | null, targetPageNum: number) => {
      if (!selectedAreaFamilyId) return;
      setIsLoading(true);
      try {
        const res = await dataService.getAreaFamilyTradesPage({
          complexId: complex.id,
          areaFamilyId: selectedAreaFamilyId,
          startYmd,
          endYmd,
          pageSize,
          cursor: targetCursor,
          search: searchTerm,
          sortField,
          sortAsc,
        });
        setItems(res.items);
        setTotalCount(res.totalCount);
        setTotalPages(res.totalPages);
        setNextCursor(res.nextCursor);
        setHasMore(res.hasMore);
        setPage(targetPageNum);
      } catch (err) {
        console.error('[TransactionLedger] Failed to fetch trades page:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [complex.id, selectedAreaFamilyId, startYmd, endYmd, searchTerm, sortField, sortAsc, pageSize]
  );

  // When filters (complex, areaFamily, date range, search, sort) change:
  // Reset pagination to Page 1 and clear cursor history
  useEffect(() => {
    setPage(1);
    setCursorHistory([null]);
    setNextCursor(null);
    setHasMore(false);
    loadPage(null, 1);
  }, [complex.id, selectedAreaFamilyId, startYmd, endYmd, searchTerm, sortField, sortAsc, loadPage]);

  const handleNextPage = () => {
    if (!hasMore || !nextCursor || isLoading) return;
    const targetPage = page + 1;
    setCursorHistory((prev) => {
      const nextArr = [...prev.slice(0, page), nextCursor];
      return nextArr;
    });
    loadPage(nextCursor, targetPage);
  };

  const handlePrevPage = () => {
    if (page <= 1 || isLoading) return;
    const targetPage = page - 1;
    const prevCursor = cursorHistory[targetPage - 1] ?? null;
    loadPage(prevCursor, targetPage);
  };

  const handleSort = (field: 'dealDate' | 'price' | 'exclusiveArea' | 'floor') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
      {/* Header & Search & CSV Download */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
            <Table className="w-4 h-4 text-emerald-400" />
            {complex.name} 개별 실거래 내역
            {isLoading && <Loader2 className="w-4 h-4 text-emerald-400 animate-spin ml-1" />}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            선택된 조건에 해당하는 국토교통부 아파트 매매 실거래 원천 내역 (총 {totalCount}건)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="일자, 층수, 금액 검색..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
              }}
              className="pl-8 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-44 sm:w-56"
            />
          </div>
          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>CSV 다운로드</span>
          </button>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
        <table className="w-full text-xs text-left text-slate-300">
          <thead className="text-[11px] uppercase bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700">
            <tr>
              <th
                onClick={() => handleSort('dealDate')}
                className="py-3 px-3.5 cursor-pointer hover:text-slate-200"
              >
                <div className="flex items-center gap-1">
                  계약일자
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th
                onClick={() => handleSort('price')}
                className="py-3 px-3.5 cursor-pointer hover:text-slate-200"
              >
                <div className="flex items-center gap-1">
                  실거래 가격
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th
                onClick={() => handleSort('exclusiveArea')}
                className="py-3 px-3.5 cursor-pointer hover:text-slate-200"
              >
                <div className="flex items-center gap-1">
                  전용면적
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th className="py-3 px-3.5">평단가 (공급기준)</th>
              <th
                onClick={() => handleSort('floor')}
                className="py-3 px-3.5 cursor-pointer hover:text-slate-200"
              >
                <div className="flex items-center gap-1">
                  층수
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th className="py-3 px-3.5">거래 유형</th>
              <th className="py-3 px-3.5">계약 상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {items.length > 0 ? (
              items.map((t, idx) => (
                <tr
                  key={`${t.id}_${(page - 1) * pageSize + idx}`}
                  className={`hover:bg-slate-800/50 transition-colors ${
                    t.isCancelled ? 'opacity-40 line-through bg-rose-950/20' : ''
                  }`}
                >
                  <td className="py-2.5 px-3.5 font-mono text-slate-300 font-medium whitespace-nowrap">
                    {t.dealDate}
                  </td>
                  <td className="py-2.5 px-3.5 font-bold font-mono text-emerald-300 whitespace-nowrap">
                    {formatPrice(t.price)}
                  </td>
                  <td className="py-2.5 px-3.5 text-slate-300 whitespace-nowrap">
                    <span className="font-mono font-medium">전용 {t.exclusiveArea}㎡</span>
                  </td>
                  <td className="py-2.5 px-3.5 text-teal-200 font-mono whitespace-nowrap">
                    {hasSupplyArea && supplyPyeong && t.price > 0 ? (
                      formatPyeongPrice(Math.round(t.price / supplyPyeong))
                    ) : (
                      <span className="text-slate-500 text-[11px] font-sans">공급면적 확인 불가</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3.5 font-mono text-slate-300 whitespace-nowrap">
                    {t.floor}층
                  </td>
                  <td className="py-2.5 px-3.5 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        t.dealType === '직거래'
                          ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                          : t.dealType === '중개거래'
                          ? 'bg-slate-800 text-slate-300 border border-slate-700/50'
                          : 'text-slate-400 bg-slate-800/60 border border-slate-700/50'
                      }`}
                      title={!t.dealType || t.dealType === '확인불가' ? '2021년 11월 이전 거래는 국토교통부 거래유형 미제공' : undefined}
                    >
                      {t.dealType || '확인불가'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3.5 whitespace-nowrap">
                    {t.isCancelled ? (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        <ShieldAlert className="w-3 h-3" />
                        해제({t.cancelDate || '취소'})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium bg-emerald-500/10 text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        정상계약
                      </span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  {isLoading ? '실거래 내역을 불러오는 중입니다...' : '선택한 조건의 실거래 내역이 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls & Footnote */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span>
            {totalCount > 0
              ? `${(page - 1) * pageSize + 1} - ${Math.min(page * pageSize, totalCount)} / 총 ${totalCount}건`
              : '0건'}
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-[11px] text-slate-500">국토교통부 실거래가 기준 (Cursor Pagination)</span>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={handlePrevPage}
              className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 transition-colors"
              title="이전 페이지"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono text-slate-300">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={!hasMore || isLoading}
              onClick={handleNextPage}
              className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 transition-colors"
              title="다음 페이지"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Historical Data Footnote */}
      <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-500 leading-relaxed">
        ※ 거래유형(중개거래/직거래)은 국토교통부 실거래가 공개시스템 정책 개정에 따라 2021년 11월 계약분부터 제공되며, 2021년 11월 이전 거래는 공공데이터 원본상 거래유형이 수집되지 않아 &apos;확인불가&apos;로 표기됩니다.
      </div>
    </div>
  );
};
