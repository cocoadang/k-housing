import React, { useState } from 'react';
import { TradeRecord, ComplexInfo } from '../types';
import { formatPrice, formatPyeongPrice, formatSqmPrice } from '../utils/calculations';
import { Table, Search, ArrowUpDown, ShieldAlert, CheckCircle2, FileText, Download } from 'lucide-react';

interface TransactionTableProps {
  complex: ComplexInfo;
  trades: TradeRecord[];
  onExportCsv: () => void;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  complex,
  trades,
  onExportCsv,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'dealDate' | 'price' | 'exclusiveArea' | 'floor'>('dealDate');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const handleSort = (field: 'dealDate' | 'price' | 'exclusiveArea' | 'floor') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Filter
  const filteredTrades = trades.filter((t) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      t.dealDate.includes(term) ||
      t.floor.toString().includes(term) ||
      t.exclusiveArea.toString().includes(term) ||
      formatPrice(t.price).includes(term) ||
      (t.dealType && t.dealType.includes(term))
    );
  });

  // Sort
  const sortedTrades = [...filteredTrades].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'dealDate') {
      cmp = a.dealDate.localeCompare(b.dealDate);
    } else if (sortField === 'price') {
      cmp = a.price - b.price;
    } else if (sortField === 'exclusiveArea') {
      cmp = a.exclusiveArea - b.exclusiveArea;
    } else if (sortField === 'floor') {
      cmp = a.floor - b.floor;
    }
    return sortAsc ? cmp : -cmp;
  });

  const totalPages = Math.ceil(sortedTrades.length / pageSize);
  const paginatedTrades = sortedTrades.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Table className="w-4 h-4 text-emerald-400" />
            {complex.name} 개별 실거래가 상세 원장 (Ledger)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            국토교통부 실거래가 공개시스템 원천 데이터 (전용면적, 층수, 거래유형, 해제사유 여부)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="일자, 층수, 거래금액 검색..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="pl-8 pr-3 py-1.5 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-48 sm:w-60"
            />
          </div>
          <button
            onClick={onExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>CSV 저장</span>
          </button>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
        <table className="w-full text-xs text-left text-slate-300">
          <thead className="text-[11px] uppercase bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700">
            <tr>
              <th
                onClick={() => handleSort('dealDate')}
                className="py-2.5 px-3 cursor-pointer hover:text-slate-200"
              >
                <div className="flex items-center gap-1">
                  계약일자
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('price')}
                className="py-2.5 px-3 cursor-pointer hover:text-slate-200"
              >
                <div className="flex items-center gap-1">
                  실거래 가격 (만원)
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('exclusiveArea')}
                className="py-2.5 px-3 cursor-pointer hover:text-slate-200"
              >
                <div className="flex items-center gap-1">
                  전용면적
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3">전용 ㎡당 단가</th>
              <th
                onClick={() => handleSort('floor')}
                className="py-2.5 px-3 cursor-pointer hover:text-slate-200"
              >
                <div className="flex items-center gap-1">
                  층수
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3">거래 유형</th>
              <th className="py-2.5 px-3">계약 상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {paginatedTrades.length > 0 ? (
              paginatedTrades.map((t, idx) => (
                <tr
                  key={`${t.id}_${(page - 1) * pageSize + idx}`}
                  className={`hover:bg-slate-800/40 transition-colors ${
                    t.isCancelled ? 'opacity-50 line-through bg-rose-950/10' : ''
                  }`}
                >
                  <td className="py-2.5 px-3 font-mono text-slate-300 font-medium">
                    {t.dealDate}
                  </td>
                  <td className="py-2.5 px-3 font-bold font-mono text-emerald-300">
                    {formatPrice(t.price)}
                    <span className="text-[10px] text-slate-500 font-normal ml-1">
                      ({t.price.toLocaleString()}만원)
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">
                    <span className="font-mono font-medium">전용 {t.exclusiveArea}㎡</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-teal-200">
                    {formatSqmPrice(t.pricePerSqm || (t.exclusiveArea > 0 ? (t.price * 10000) / t.exclusiveArea : 0))}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-300">{t.floor}층</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        t.dealType === '직거래'
                          ? 'bg-purple-950 text-purple-300 border border-purple-800'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {t.dealType || '중개거래'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    {t.isCancelled ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-rose-400 font-semibold bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800/60">
                        <ShieldAlert className="w-3 h-3" />
                        해제 (취소 {t.cancelDate})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        정상 등기
                      </span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                  조건에 일치하는 실거래 기록이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
          <span>
            총 <strong className="text-slate-200">{filteredTrades.length}</strong>건 중{' '}
            {(page - 1) * pageSize + 1} ~ {Math.min(page * pageSize, filteredTrades.length)}건 표시
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300"
            >
              이전
            </button>
            <span className="px-2 text-slate-300 font-medium">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
