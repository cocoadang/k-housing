import React from 'react';
import { InfoWindow } from '@vis.gl/react-google-maps';
import { ComplexInfo, MapComplexSummary, AreaCategory } from '../../types';
import {
  BarChart3,
  Layers,
  ArrowRight,
  MapPin,
  X,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { formatPrice, formatPyeongPrice, formatSqmPrice } from '../../utils/calculations';
import { formatAreaCategoryLabel } from '../../utils/areaUtils';

interface ComplexInfoWindowProps {
  complex: ComplexInfo;
  summary?: MapComplexSummary;
  isInCompare: boolean;
  selectedArea: AreaCategory;
  onSelectArea?: (area: AreaCategory) => void;
  onNavigateToAnalysis: (complexId: string) => void;
  onToggleCompare: (complexId: string) => void;
  onClose: () => void;
}

export const ComplexInfoWindow: React.FC<ComplexInfoWindowProps> = ({
  complex,
  summary,
  isInCompare,
  selectedArea,
  onSelectArea,
  onNavigateToAnalysis,
  onToggleCompare,
  onClose,
}) => {
  const hasValidData = Boolean(
    summary && summary.hasRequestedAreaData && summary.hasData && summary.status === 'NORMAL'
  );

  const isUnsupported =
    (selectedArea === '59' && complex.areaCapabilities?.has59 === false) ||
    (selectedArea === '84' && complex.areaCapabilities?.has84 === false);

  const targetSwitchArea = complex.areaCapabilities?.defaultArea || (String(complex.representativeArea) as AreaCategory);
  const showSwitchButton = !hasValidData && onSelectArea && selectedArea !== targetSwitchArea;

  return (
    <InfoWindow
      position={{ lat: complex.latitude, lng: complex.longitude }}
      onCloseClick={onClose}
      headerDisabled
      className="custom-gmp-infowindow"
    >
      <div className="bg-slate-900/95 backdrop-blur-md text-slate-100 p-3 sm:p-3.5 rounded-2xl border border-slate-700/80 shadow-2xl w-[280px] sm:w-[310px] font-sans space-y-2.5">
        {/* Header: Title, Badge, Close */}
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-bold text-sm text-slate-100 tracking-tight truncate">
                {complex.name}
              </h3>
              {complex.badge && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                  {complex.badge}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
              <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
              <span>{complex.district}</span>
              <span>·</span>
              <span>{complex.builtYear}년</span>
              <span>·</span>
              <span>{complex.totalUnits.toLocaleString()}세대</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Data State View: Valid vs NO_DATA */}
        {hasValidData ? (
          <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">
                {formatAreaCategoryLabel(summary?.requestedArea || selectedArea)} 실거래가
              </span>
              <span className="text-sm sm:text-base font-black text-emerald-400 font-mono">
                {formatPrice(summary?.latestMedianPrice ?? summary?.latestMonthlyMedianPrice ?? 0)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-800/80 text-[11px]">
              <div>
                <span className="text-slate-500 text-[10px]">평단가 (공급기준)</span>
                <p className="font-mono font-semibold text-slate-200">
                  {summary?.latestPricePerPyeong && isFinite(summary.latestPricePerPyeong)
                    ? formatPyeongPrice(summary.latestPricePerPyeong)
                    : '공급면적 확인 불가'}
                </p>
              </div>
              <div>
                <span className="text-slate-500 text-[10px]">1년 변동률</span>
                <p
                  className={`font-mono font-semibold ${
                    (summary?.oneYearReturn ?? summary?.oneYearReturnPct ?? 0) >= 0
                      ? 'text-rose-400'
                      : 'text-sky-400'
                  }`}
                >
                  {summary?.oneYearReturn !== undefined || summary?.oneYearReturnPct !== undefined
                    ? `${(summary?.oneYearReturn ?? summary?.oneYearReturnPct ?? 0) >= 0 ? '+' : ''}${summary?.oneYearReturn ?? summary?.oneYearReturnPct}%`
                    : '-'}
                </p>
              </div>
            </div>

            <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between pt-0.5">
              <span>최근: {summary?.latestTransactionDate || summary?.latestMonth || '-'}</span>
              <span>거래: {summary?.transactionCount ?? 0}건</span>
            </div>
          </div>
        ) : (
          <div className="bg-slate-950/80 rounded-xl p-2.5 border border-amber-900/40 space-y-2">
            <div className="flex items-start gap-1.5 text-amber-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-amber-300">
                  {isUnsupported
                    ? `${formatAreaCategoryLabel(selectedArea)} 미공급 단지`
                    : `${formatAreaCategoryLabel(selectedArea)} 실거래 데이터 없음`}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {isUnsupported
                    ? `해당 단지는 ${selectedArea}형(전용)이 공급되지 않는 단지입니다.`
                    : '최근 유효한 실거래 신고 내역이 존재하지 않습니다.'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  단지 대표면적: <strong className="text-slate-200">{complex.areaCapabilities?.defaultArea || complex.representativeArea}㎡</strong>
                </p>
              </div>
            </div>

            {/* Explicit User Switch Action (No automatic switching) */}
            {showSwitchButton && (
              <button
                onClick={() => onSelectArea(targetSwitchArea as AreaCategory)}
                className="w-full py-1 px-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
              >
                <span>대표면적({targetSwitchArea}㎡) 보기</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 pt-0.5">
          <button
            onClick={() => onNavigateToAnalysis(complex.id)}
            className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-slate-950 font-bold text-xs shadow-md shadow-emerald-600/20 transition-all"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>실거래 상세 분석</span>
            <ArrowRight className="w-3 h-3" />
          </button>
          
          <button
            onClick={() => onToggleCompare(complex.id)}
            className={`p-1.5 rounded-xl border text-xs font-semibold transition-all ${
              isInCompare
                ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
            title="다중 단지 비교함에 추가/제거"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </InfoWindow>
  );
};
