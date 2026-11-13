import React from 'react';
import { AdvancedMarker } from '@vis.gl/react-google-maps';
import { ComplexInfo, MapComplexSummary, MapPriceMode } from '../../types';
import { formatMarkerPrice, formatMarkerPyeongPrice } from '../../utils/mapUtils';

interface ComplexMapMarkerProps {
  complex: ComplexInfo;
  summary?: MapComplexSummary;
  isSelected: boolean;
  isHovered: boolean;
  priceMode: MapPriceMode;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export const ComplexMapMarker: React.FC<ComplexMapMarkerProps> = ({
  complex,
  summary,
  isSelected,
  isHovered,
  priceMode,
  onClick,
  onMouseEnter,
  onMouseLeave,
}) => {
  const getMetricDisplay = () => {
    // 1. Check if summary or data for requested area exists strictly
    if (!summary || !summary.hasRequestedAreaData || !summary.hasData || summary.status !== 'NORMAL') {
      const isUnsupported =
        (summary?.requestedArea === '59' && complex.areaCapabilities?.has59 === false) ||
        (summary?.requestedArea === '84' && complex.areaCapabilities?.has84 === false);

      const areaLabel = summary?.requestedArea
        ? summary.requestedArea === 'ALL'
          ? '전체'
          : `${summary.requestedArea}㎡`
        : '59㎡';
      return {
        text: isUnsupported ? `${areaLabel} 미공급` : `${areaLabel} 없음`,
        subText: '',
        isMuted: true,
        isPositive: false,
        isNegative: false,
      };
    }

    // 2. Latest Monthly Median Representative Price
    if (priceMode === 'LATEST_PRICE') {
      const areaTag = summary.requestedArea === 'ALL' ? '전체' : `${summary.requestedArea}㎡`;
      const priceVal = summary.latestMedianPrice ?? summary.latestMonthlyMedianPrice;
      const priceText = formatMarkerPrice(priceVal);
      return {
        text: priceText,
        subText: areaTag,
        isMuted: priceText === '-',
        isPositive: false,
        isNegative: false,
      };
    }

    // 3. 1-Year Return
    if (priceMode === 'ONE_YEAR_RETURN') {
      const ret = summary.oneYearReturn ?? summary.oneYearReturnPct;
      if (ret !== undefined && isFinite(ret)) {
        const sign = ret > 0 ? '+' : '';
        return {
          text: `${sign}${ret}%`,
          subText: '1년',
          isPositive: ret > 0,
          isNegative: ret < 0,
          isMuted: false,
        };
      }
      return { text: '1년전 비교불가', isMuted: true, isPositive: false, isNegative: false };
    }

    // 4. CAGR
    if (priceMode === 'CAGR') {
      const cagrVal = summary.cagr ?? summary.cagrPct;
      if (cagrVal !== undefined && isFinite(cagrVal)) {
        const sign = cagrVal > 0 ? '+' : '';
        return {
          text: `CAGR ${sign}${cagrVal}%`,
          subText: '',
          isPositive: cagrVal > 0,
          isNegative: cagrVal < 0,
          isMuted: false,
        };
      }
      return { text: 'CAGR 미산출', isMuted: true, isPositive: false, isNegative: false };
    }

    // 5. Price per Pyeong (3.3㎡)
    if (priceMode === 'PRICE_PER_SQM') {
      const pyeongPrice = summary.latestPricePerPyeong;
      if (pyeongPrice && isFinite(pyeongPrice) && pyeongPrice > 0) {
        return {
          text: formatMarkerPyeongPrice(pyeongPrice),
          subText: '',
          isMuted: false,
          isPositive: false,
          isNegative: false,
        };
      }
      return { text: '평단가 계산 불가', isMuted: true, isPositive: false, isNegative: false };
    }

    return { text: formatMarkerPrice(summary.latestMedianPrice), isMuted: false, isPositive: false, isNegative: false };
  };

  const metric = getMetricDisplay();

  const activeTheme = isSelected
    ? 'ring-2 ring-emerald-400 border-emerald-400 bg-emerald-950/95 text-white shadow-xl shadow-emerald-500/30 scale-110'
    : isHovered
    ? 'border-slate-400 bg-slate-900/95 text-slate-100 shadow-lg scale-105'
    : metric.isMuted
    ? 'border-slate-800/80 bg-slate-950/90 text-slate-400 shadow-sm hover:border-slate-600'
    : 'border-slate-700/80 bg-slate-900/90 text-slate-200 shadow-md hover:border-slate-500';

  return (
    <AdvancedMarker
      position={{ lat: complex.latitude, lng: complex.longitude }}
      onClick={onClick}
      zIndex={isSelected ? 999 : isHovered ? 500 : 100}
    >
      <div
        id={`marker-${complex.id}`}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`group cursor-pointer select-none transition-all duration-200 transform origin-bottom flex flex-col items-center`}
      >
        {/* Floating Marker Pill */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl backdrop-blur-md border text-xs font-semibold whitespace-nowrap transition-all duration-200 ${activeTheme}`}
        >
          <div
            className={`w-2 h-2 rounded-full shrink-0 ${
              isSelected
                ? 'bg-emerald-400 animate-pulse'
                : metric.isMuted
                ? 'bg-slate-500'
                : complex.province.includes('서울')
                ? 'bg-emerald-400'
                : complex.province.includes('부산')
                ? 'bg-cyan-400'
                : 'bg-indigo-400'
            }`}
          />
          <span className={`font-bold ${metric.isMuted ? 'text-slate-400' : 'text-slate-100'}`}>
            {complex.shortName}
          </span>
          
          <div className="flex items-center gap-1 border-l border-slate-700/80 pl-1.5 font-mono">
            <span
              className={
                metric.isMuted
                  ? 'text-slate-400 text-[11px]'
                  : metric.isPositive
                  ? 'text-rose-400 font-bold'
                  : metric.isNegative
                  ? 'text-sky-400 font-bold'
                  : isSelected
                  ? 'text-emerald-300 font-bold'
                  : 'text-emerald-400 font-semibold'
              }
            >
              {metric.text}
            </span>
            {metric.subText && (
              <span className="text-[10px] text-slate-400 font-normal">
                {metric.subText}
              </span>
            )}
          </div>
        </div>

        {/* Marker Needle / Pin Tip */}
        <div
          className={`w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] -mt-[1px] transition-colors ${
            isSelected
              ? 'border-t-emerald-400'
              : isHovered
              ? 'border-t-slate-400'
              : metric.isMuted
              ? 'border-t-slate-800'
              : 'border-t-slate-700'
          }`}
        />
      </div>
    </AdvancedMarker>
  );
};
