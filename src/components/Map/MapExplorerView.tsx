import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import {
  ComplexInfo,
  TradeRecord,
  MapPriceMode,
  MapComplexSummary,
  AreaCategory,
  BaselineOption,
} from '../../types';
import { ComplexMapMarker } from './ComplexMapMarker';
import type { ComplexFootprints } from '../../types/schools';
import { SchoolMapPanel } from './SchoolMapPanel';
import { useRegionalSchools } from './useRegionalSchools';
import { schoolRegionFromQuery } from '../../services/schoolMapData';
import { SUBREGIONS_METADATA } from '../../data/complexesData';
const SchoolMapLayer = React.lazy(() => import('./SchoolMapLayer'));
const ComplexBoundaryLayer = React.lazy(() => import('./ComplexBoundaryLayer'));
import { computeMapComplexSummary } from '../../utils/mapUtils';
import { formatAreaCategoryLabel } from '../../utils/areaUtils';
import { formatPrice, formatPyeongPrice, formatSqmPrice } from '../../utils/calculations';
import {
  Layers,
  Key,
  Compass,
  ArrowRight,
  RefreshCw,
  ShieldAlert,
  WifiOff,
  X,
  BarChart3,
  Check,
} from 'lucide-react';

interface MapExplorerViewProps {
  complexes: ComplexInfo[];
  tradesMap: Record<string, TradeRecord[]>;
  mapSummaries?: Record<string, MapComplexSummary>;
  selectedComplexId: string;
  onSelectComplex: (complexId: string) => void;
  onNavigateToAnalysis: (complexId: string) => void;
  selectedCompareIds: string[];
  onToggleCompareId: (complexId: string) => void;
  selectedArea: AreaCategory;
  onSelectArea: (area: AreaCategory) => void;
  excludeCancelled?: boolean;
  excludeOutliers?: boolean;
  baselineOption?: BaselineOption;
  startDate?: string;
  endDate?: string;
}

type MapsConfigStatus =
  | 'CONFIG_LOADING'
  | 'CONFIG_SUCCESS'
  | 'API_KEY_NOT_CONFIGURED'
  | 'MAPS_SCRIPT_LOAD_ERROR'
  | 'MAPS_AUTH_ERROR'
  | 'NETWORK_ERROR';

const MAP_ENABLED_REGIONS = [
  '반포',
  '잠실',
  '개포',
  '대치',
  '마포',
  '성동',
  '용산',
  '길음',
  '강동',
  '과천',
  '구성남',
  '남천동',
  '센텀시티',
];

// Inner Controller to handle region fitBounds and ALL reset
const RegionFitBoundsCameraController: React.FC<{
  selectedSubRegion: string;
  mapBaseComplexes: ComplexInfo[];
}> = ({ selectedSubRegion, mapBaseComplexes }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // When 'ALL' is selected, reset to default Seoul/Metropolitan center and zoom 10 without nationwide fitBounds
    if (selectedSubRegion === 'ALL') {
      map.panTo({
        lat: 37.50,
        lng: 127.02,
      });
      map.setZoom(10);
      return;
    }

    // Filter complexes for the specific subRegion among 10 enabled regions
    const targetComplexes = mapBaseComplexes.filter((c) => c.subRegion === selectedSubRegion);

    const validComplexes = targetComplexes.filter(
      (c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude)
    );

    if (validComplexes.length === 0) {
      return;
    }

    if (validComplexes.length === 1) {
      map.panTo({
        lat: validComplexes[0].latitude,
        lng: validComplexes[0].longitude,
      });
      map.setZoom(14);
      return;
    }

    if (typeof google !== 'undefined' && google.maps && google.maps.LatLngBounds) {
      const bounds = new google.maps.LatLngBounds();
      validComplexes.forEach((c) => {
        bounds.extend({ lat: c.latitude, lng: c.longitude });
      });

      map.fitBounds(bounds, 80);

      // Prevent over-zooming for tightly located complexes
      const listener = google.maps.event.addListenerOnce(map, 'idle', () => {
        const currentZoom = map.getZoom();
        if (typeof currentZoom === 'number' && currentZoom > 15) {
          map.setZoom(15);
        }
      });

      return () => {
        if (typeof google !== 'undefined' && google.maps && google.maps.event) {
          google.maps.event.removeListener(listener);
        }
      };
    }
  }, [map, selectedSubRegion, mapBaseComplexes]);

  return null;
};

// Inner Controller to handle smooth camera panning / zoom for selected complex
const ComplexSelectionCameraController: React.FC<{
  selectedComplex: ComplexInfo | null;
}> = ({ selectedComplex }) => {
  const map = useMap();
  const isInitialMount = useRef(true);

  useEffect(() => {
    // Prevent automatic panTo on initial component mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!map || !selectedComplex) return;

    const lat = selectedComplex.latitude;
    const lng = selectedComplex.longitude;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    map.panTo({ lat, lng });
    map.setZoom(14);
  }, [map, selectedComplex?.id]);

  return null;
};

export const MapExplorerView: React.FC<MapExplorerViewProps> = ({
  complexes,
  tradesMap,
  mapSummaries,
  selectedComplexId,
  onSelectComplex,
  onNavigateToAnalysis,
  selectedCompareIds,
  onToggleCompareId,
  selectedArea,
  onSelectArea,
}) => {
  const [selectedSubRegion, setSelectedSubRegion] = useState<string>(() => {
    return schoolRegionFromQuery(new URLSearchParams(window.location.search).get('region'));
  });
  const { schoolData, schoolLoadError, retry: loadSchoolData } = useRegionalSchools(selectedSubRegion);
  const [footprints, setFootprints] = useState<ComplexFootprints | null>(null);
  const [footprintError, setFootprintError] = useState(false);
  const [showFootprints, setShowFootprints] = useState(true);
  const [showSchools, setShowSchools] = useState(true);
  const [showZones, setShowZones] = useState(false);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const hasSchoolRegion = selectedSubRegion !== 'ALL';
  const initialRegionMetadata = SUBREGIONS_METADATA.find(r => r.id === selectedSubRegion);
  const loadFootprints = useCallback(async () => {
    setFootprintError(false);
    try {
      const { default: snapshot } = await import('../../data/complexFootprints.json');
      setFootprints(snapshot as unknown as ComplexFootprints);
    } catch { setFootprintError(true); }
  }, []);
  useEffect(() => { void loadFootprints(); }, [loadFootprints]);
  const handleSchoolSelect = useCallback((id: string) => {
    setSelectedSchoolId(id);
    onSelectComplex('');
  }, [onSelectComplex]);
  const handleBoundarySelect = useCallback((id: string) => {
    setSelectedSchoolId(null);
    onSelectComplex(id);
  }, [onSelectComplex]);
  const [priceMode, setPriceMode] = useState<MapPriceMode>('LATEST_PRICE');
  const [hoveredComplexId, setHoveredComplexId] = useState<string | null>(null);
  const regionBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (selectedSubRegion && regionBtnRefs.current[selectedSubRegion]) {
      regionBtnRefs.current[selectedSubRegion]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [selectedSubRegion]);

  // Maps Configuration & Loading Lifecycle States
  const [mapsConfigStatus, setMapsConfigStatus] = useState<MapsConfigStatus>('CONFIG_LOADING');
  const [mapsApiKey, setMapsApiKey] = useState<string>('');

  // 1. Fetch Maps API Key from backend API endpoint (/api/config/maps)
  const loadMapsConfig = useCallback(async () => {
    setMapsConfigStatus('CONFIG_LOADING');

    try {
      const res = await fetch('/api/config/maps');
      if (res.ok) {
        const data = await res.json();
        if (data.apiKey && typeof data.apiKey === 'string' && data.apiKey.trim().length > 0) {
          setMapsApiKey(data.apiKey.trim());
          setMapsConfigStatus('CONFIG_SUCCESS');
        } else {
          setMapsConfigStatus('API_KEY_NOT_CONFIGURED');
        }
      } else if (res.status === 503) {
        setMapsConfigStatus('API_KEY_NOT_CONFIGURED');
      } else {
        setMapsConfigStatus('NETWORK_ERROR');
      }
    } catch (err) {
      console.error('[Google Maps] Network error fetching /api/config/maps:', err);
      setMapsConfigStatus('NETWORK_ERROR');
    }
  }, []);

  useEffect(() => {
    loadMapsConfig();

    (window as any).gm_authFailure = () => {
      console.error('[Google Maps] Authentication failure callback invoked');
      setMapsConfigStatus('MAPS_AUTH_ERROR');
    };

    return () => {
      delete (window as any).gm_authFailure;
    };
  }, [loadMapsConfig]);

  // Precompute map summary for all complexes
  const summariesMap = useMemo(() => {
    const map: Record<string, MapComplexSummary> = {};
    for (const c of complexes) {
      if (mapSummaries && mapSummaries[c.id]) {
        map[c.id] = mapSummaries[c.id];
      } else {
        map[c.id] = computeMapComplexSummary(c, tradesMap[c.id], selectedArea);
      }
    }
    return map;
  }, [complexes, tradesMap, mapSummaries, selectedArea]);

  // Base complexes for map explorer (restricted to 10 designated regions, 26 complexes total)
  const mapBaseComplexes = useMemo(() => {
    return complexes.filter((c) => MAP_ENABLED_REGIONS.includes(c.subRegion)).map(c => {
      const anchor = footprints?.anchors[c.id];
      return anchor ? { ...c, ...anchor, location: { lat: anchor.latitude, lng: anchor.longitude } } : c;
    });
  }, [complexes, footprints]);

  // Filter complexes by subregion among map-enabled complexes (no search query filter on pure map)
  const filteredComplexes = useMemo(() => {
    if (selectedSubRegion === 'ALL') {
      return mapBaseComplexes;
    }
    return mapBaseComplexes.filter((c) => c.subRegion === selectedSubRegion);
  }, [mapBaseComplexes, selectedSubRegion]);
  const visibleComplexIds = useMemo(() => filteredComplexes.map(c => c.id), [filteredComplexes]);
  const missingOutlines = useMemo(() => filteredComplexes.filter(c => footprints?.unavailable[c.id]), [filteredComplexes, footprints]);

  // Handle region filter button click
  const handleSelectSubRegion = (subId: string) => {
    setSelectedSubRegion(subId);
    setSelectedSchoolId(null);
    onSelectComplex('');
  };

  // Handle complex marker click
  const handleComplexClick = (complex: ComplexInfo) => {
    handleBoundarySelect(complex.id);
  };

  const currentSelectedComplex = useMemo(() => {
    return filteredComplexes.find((c) => c.id === selectedComplexId) || null;
  }, [filteredComplexes, selectedComplexId]);

  const selectedSummary = useMemo(() => {
    return currentSelectedComplex ? summariesMap[currentSelectedComplex.id] : null;
  }, [currentSelectedComplex, summariesMap]);

  const isCurrentInComparison = currentSelectedComplex
    ? selectedCompareIds.includes(currentSelectedComplex.id)
    : false;

  return (
    <div
      className="relative w-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden"
      style={{
        height: 'calc(100dvh - 58px)',
        minHeight: '520px',
      }}
    >
      {/* 1. Compact Top Filter Toolbar */}
      <div className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-2.5 sm:px-4 py-1.5 sm:py-2 flex flex-col md:flex-row md:items-center md:justify-between gap-1.5 md:gap-3 z-10 shadow-sm shrink-0">
        {/* Region Filter Chips */}
        <div
          className="flex flex-nowrap items-center gap-1 overflow-x-auto py-0.5 max-w-full no-scrollbar flex-1 min-w-0"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <span className="text-[11px] sm:text-xs font-semibold text-slate-400 mr-0.5 shrink-0 flex-shrink-0 flex items-center gap-1">
            <Compass className="w-3 h-3 text-emerald-400" />
            지역:
          </span>
          <button
            ref={(el) => {
              regionBtnRefs.current['ALL'] = el;
            }}
            onClick={() => handleSelectSubRegion('ALL')}
            className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[11px] sm:text-xs font-semibold shrink-0 flex-shrink-0 transition-all ${
              selectedSubRegion === 'ALL'
                ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/20 font-bold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            전체 ({mapBaseComplexes.length})
          </button>

          {MAP_ENABLED_REGIONS.map((regionName) => (
            <button
              key={regionName}
              ref={(el) => {
                regionBtnRefs.current[regionName] = el;
              }}
              onClick={() => handleSelectSubRegion(regionName)}
              className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[11px] sm:text-xs font-medium shrink-0 flex-shrink-0 transition-all ${
                selectedSubRegion === regionName
                  ? 'bg-emerald-600 text-white font-bold shadow-sm'
                  : 'bg-slate-800/90 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              {regionName}
            </button>
          ))}
        </div>

        {/* Right: Area Selector & Metric Selector */}
        <div className="flex items-center justify-between md:justify-end gap-1.5 sm:gap-2 shrink-0 overflow-x-auto no-scrollbar">
          {/* Area Selector Pill */}
          <div className="flex items-center gap-0.5 bg-slate-800/90 p-0.5 rounded-lg border border-slate-700 text-[11px]">
            {(['59', '84'] as AreaCategory[]).map((area) => (
              <button
                key={area}
                onClick={() => onSelectArea(area)}
                className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                  selectedArea === area
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {area === '59' ? '59㎡' : '84㎡'}
              </button>
            ))}
          </div>

          {/* Metric Selector (Price / Return / CAGR / Pyeong) */}
          <div className="flex items-center gap-0.5 bg-slate-800/90 p-0.5 rounded-lg border border-slate-700 text-[11px]">
            <button
              onClick={() => setPriceMode('LATEST_PRICE')}
              className={`px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-md font-medium transition-all ${
                priceMode === 'LATEST_PRICE'
                  ? 'bg-emerald-600 text-white font-bold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              실거래가
            </button>
            <button
              onClick={() => setPriceMode('PRICE_PER_SQM')}
              className={`px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-md font-medium transition-all ${
                priceMode === 'PRICE_PER_SQM'
                  ? 'bg-emerald-600 text-white font-bold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              평단가
            </button>
            <button
              onClick={() => setPriceMode('ONE_YEAR_RETURN')}
              className={`px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-md font-medium transition-all ${
                priceMode === 'ONE_YEAR_RETURN'
                  ? 'bg-emerald-600 text-white font-bold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              1년변동
            </button>
            <button
              onClick={() => setPriceMode('CAGR')}
              className={`px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-md font-medium transition-all ${
                priceMode === 'CAGR'
                  ? 'bg-emerald-600 text-white font-bold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              CAGR
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 bg-slate-900 border-b border-slate-700 px-3 py-2 text-xs shrink-0">
        <span className="text-emerald-300">단지 가격: 선택 면적의 최근 거래월 중앙값</span>
        <button type="button" aria-pressed={showFootprints} onClick={() => setShowFootprints(v => !v)} className={`px-3 py-1.5 rounded-lg ${showFootprints ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-300'}`}>단지 외곽</button>
        {hasSchoolRegion && <>
          <button type="button" aria-pressed={showSchools} onClick={() => setShowSchools(v => !v)} className={`px-3 py-1.5 rounded-lg ${showSchools ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-300'}`}>초등학교 {schoolData?.schools.length || ''}</button>
          <button type="button" aria-pressed={showZones} onClick={() => setShowZones(v => !v)} className={`px-3 py-1.5 rounded-lg ${showZones ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-300'}`}>통학구역</button>
        </>}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-[10px] text-slate-400 underline">단지 외곽 참고도형: © OpenStreetMap contributors · ODbL</a>
        {missingOutlines.map(c => <span key={c.id} className="text-[11px] text-amber-300" title={footprints?.unavailable[c.id].reason}>{c.shortName}: 독립 외곽 미확인</span>)}
        {footprintError && <button type="button" className="text-amber-300 underline" onClick={loadFootprints}>단지 외곽 불러오기 재시도</button>}
      </div>

      {/* 2. Pure Full-Screen Map Canvas */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden">
        {/* Full Viewport Google Maps Layer (Absolute Inset-0) */}
        <div className="absolute inset-0 w-full h-full bg-slate-950">
          {mapsConfigStatus === 'CONFIG_LOADING' ? (
            /* Loading State UI */
            <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-slate-950 text-center space-y-4">
              <div className="w-10 h-10 rounded-full border-4 border-slate-800 border-t-emerald-500 animate-spin" />
              <p className="text-xs text-slate-400">지도를 불러오는 중...</p>
            </div>
          ) : mapsConfigStatus === 'CONFIG_SUCCESS' && mapsApiKey ? (
            /* Active Interactive Google Map */
            <APIProvider
              apiKey={mapsApiKey}
              onError={(err) => {
                console.error('[Google Maps] APIProvider load error:', err);
                setMapsConfigStatus('MAPS_SCRIPT_LOAD_ERROR');
              }}
            >
              <Map
                defaultCenter={{
                  lat: initialRegionMetadata?.center.lat ?? 37.50,
                  lng: initialRegionMetadata?.center.lng ?? 127.02,
                }}
                defaultZoom={hasSchoolRegion ? 14 : 10}
                mapId="DEMO_MAP_ID"
                gestureHandling="greedy"
                disableDefaultUI={false}
                style={{
                  width: '100%',
                  height: '100%',
                }}
              >
                <RegionFitBoundsCameraController
                  selectedSubRegion={selectedSubRegion}
                  mapBaseComplexes={mapBaseComplexes}
                />
                <ComplexSelectionCameraController selectedComplex={currentSelectedComplex} />
                {showFootprints && footprints && <React.Suspense fallback={null}>
                  <ComplexBoundaryLayer data={footprints} complexIds={visibleComplexIds} selectedId={selectedComplexId} onSelect={handleBoundarySelect} />
                </React.Suspense>}
                {hasSchoolRegion && schoolData && <React.Suspense fallback={null}>
                  <SchoolMapLayer data={schoolData} showSchools={showSchools} showZones={showZones}
                    selectedId={selectedSchoolId} onSelect={handleSchoolSelect} />
                </React.Suspense>}

                {/* Render ComplexMapMarker for 10 map-enabled regions (filtered) */}
                {filteredComplexes.map((c) => {
                  if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) {
                    return null;
                  }

                  return (
                    <ComplexMapMarker
                      key={c.id}
                      complex={c}
                      summary={summariesMap[c.id]}
                      isSelected={c.id === selectedComplexId}
                      isHovered={c.id === hoveredComplexId}
                      priceMode={priceMode}
                      onClick={() => handleComplexClick(c)}
                      onMouseEnter={() => setHoveredComplexId(c.id)}
                      onMouseLeave={() => setHoveredComplexId(null)}
                    />
                  );
                })}
              </Map>
            </APIProvider>
          ) : (
            /* Error UI */
            <div className="w-full h-full overflow-y-auto p-4 sm:p-8 bg-slate-950 flex flex-col justify-center items-center">
              <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
                <div className="flex items-start gap-3">
                  {mapsConfigStatus === 'API_KEY_NOT_CONFIGURED' ? (
                    <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400 shrink-0">
                      <Key className="w-5 h-5" />
                    </div>
                  ) : mapsConfigStatus === 'MAPS_AUTH_ERROR' ? (
                    <div className="p-2.5 bg-rose-500/10 rounded-xl border border-rose-500/20 text-rose-400 shrink-0">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400 shrink-0">
                      <WifiOff className="w-5 h-5" />
                    </div>
                  )}

                  <div className="flex-1 space-y-1.5">
                    <h3 className="font-bold text-sm text-slate-100">
                      지도 정보를 불러오지 못했습니다
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      지도 서비스 연결을 확인 중입니다. 잠시 후 다시 시도해주세요.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-slate-800">
                  <button
                    onClick={loadMapsConfig}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-slate-950 flex items-center gap-1.5 shadow transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>다시 시도</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {hasSchoolRegion && (schoolData ? <SchoolMapPanel data={schoolData} selectedId={selectedSchoolId}
          onSelect={handleSchoolSelect} onClose={() => setSelectedSchoolId(null)} /> :
          <div role="status" className="absolute top-3 right-3 left-3 sm:left-auto z-20 rounded-xl bg-slate-900 p-3 text-xs">
            {schoolLoadError ? <><span>학교 자료를 불러오지 못했습니다.</span><button type="button" className="ml-2 underline" onClick={loadSchoolData}>다시 시도</button></> : '공식 학교 자료를 불러오는 중…'}
          </div>)}

        {/* Selected Complex Summary Card Overlay */}
        {currentSelectedComplex && (
          <>
            {/* 1. Desktop Overlay Card (>= 768px): Bottom-Left compact floating card */}
            <div className="hidden md:block absolute bottom-8 left-5 z-20 w-[340px] max-w-[calc(100%-2.5rem)] bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl p-4 space-y-3 pointer-events-auto">
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="font-bold text-base text-slate-100 truncate">
                      {currentSelectedComplex.name}
                    </h4>
                    {currentSelectedComplex.badge && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {currentSelectedComplex.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {currentSelectedComplex.subRegion} · {currentSelectedComplex.dong} · 전용 {formatAreaCategoryLabel(selectedSummary?.requestedArea || selectedArea)}
                  </p>
                </div>
                <button
                  onClick={() => onSelectComplex('')}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
                  title="닫기"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Price & Metrics Summary */}
              <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800/80 space-y-2.5 text-xs">
                <div>
                  <span className="text-[11px] text-slate-400 block mb-0.5">
                    최근 대표가격
                  </span>
                  <span className="text-xl font-black text-emerald-400 font-mono tracking-tight">
                    {selectedSummary && selectedSummary.hasData
                      ? formatPrice(selectedSummary.latestMedianPrice ?? selectedSummary.latestMonthlyMedianPrice ?? 0)
                      : '데이터 없음'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">평단가 (공급기준)</span>
                    <span className="font-semibold text-slate-200 font-mono">
                      {selectedSummary?.latestPricePerPyeong && Number.isFinite(selectedSummary.latestPricePerPyeong)
                        ? formatPyeongPrice(selectedSummary.latestPricePerPyeong)
                        : '공급면적 확인 불가'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">1년 변동</span>
                    <span className={`font-semibold font-mono ${
                      selectedSummary?.oneYearReturnPct != null
                        ? selectedSummary.oneYearReturnPct >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                        : 'text-slate-400'
                    }`}>
                      {selectedSummary?.oneYearReturnPct != null
                        ? `${selectedSummary.oneYearReturnPct >= 0 ? '+' : ''}${selectedSummary.oneYearReturnPct}%`
                        : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">CAGR</span>
                    <span className={`font-semibold font-mono ${
                      selectedSummary?.cagr != null
                        ? selectedSummary.cagr >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                        : 'text-slate-400'
                    }`}>
                      {selectedSummary?.cagr != null
                        ? `${selectedSummary.cagr >= 0 ? '+' : ''}${selectedSummary.cagr}%`
                        : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">최근 거래</span>
                    <span className="font-medium text-slate-300 font-mono text-[10px] truncate block">
                      {selectedSummary?.latestTransactionDate || selectedSummary?.latestMonth || '-'} ({selectedSummary?.transactionCount ?? 0}건)
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  onClick={() => onNavigateToAnalysis(currentSelectedComplex.id)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-colors"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>가격 상세분석</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => onToggleCompareId(currentSelectedComplex.id)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    isCurrentInComparison
                      ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300 hover:bg-indigo-600/40'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                  title="비교함에 추가/제거"
                >
                  {isCurrentInComparison ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-indigo-300" />
                      <span>비교에 추가됨 ✓</span>
                    </>
                  ) : (
                    <>
                      <Layers className="w-3.5 h-3.5" />
                      <span>비교 추가</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 2. Mobile Overlay Card (< 768px): Bottom Detail Card directly visible in viewport */}
            <div
              className="md:hidden absolute left-2 right-2 z-30 p-3.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl space-y-2 pointer-events-auto"
              style={{
                bottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
                maxHeight: '270px',
              }}
            >
              {/* Mobile Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="font-bold text-sm text-slate-100 truncate">
                      {currentSelectedComplex.name}
                    </h4>
                    {currentSelectedComplex.badge && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {currentSelectedComplex.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                    {currentSelectedComplex.subRegion} · {currentSelectedComplex.dong} · {formatAreaCategoryLabel(selectedSummary?.requestedArea || selectedArea)}
                  </p>
                </div>
                <button
                  onClick={() => onSelectComplex('')}
                  className="p-2 -mr-1 -mt-1 text-slate-400 hover:text-white rounded-lg active:bg-slate-800 shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="닫기"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile Price & Core Stats */}
              <div className="bg-slate-950/70 rounded-xl p-2.5 border border-slate-800/80 space-y-1.5 text-xs">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-base font-black text-emerald-400 font-mono">
                    {selectedSummary && selectedSummary.hasData
                      ? formatPrice(selectedSummary.latestMedianPrice ?? selectedSummary.latestMonthlyMedianPrice ?? 0)
                      : '데이터 없음'}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400 font-mono">
                    최근거래 {selectedSummary?.latestTransactionDate || selectedSummary?.latestMonth || '-'} · {selectedSummary?.transactionCount ?? 0}건
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-800/60 text-[11px]">
                  <div>
                    <span className="text-[10px] text-slate-400 block">평단가 (공급기준)</span>
                    <span className="font-semibold text-slate-200 font-mono">
                      {selectedSummary?.latestPricePerPyeong && Number.isFinite(selectedSummary.latestPricePerPyeong)
                        ? formatPyeongPrice(selectedSummary.latestPricePerPyeong)
                        : '공급면적 확인 불가'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">1년 변동</span>
                    <span className={`font-semibold font-mono ${
                      selectedSummary?.oneYearReturnPct != null
                        ? selectedSummary.oneYearReturnPct >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                        : 'text-slate-400'
                    }`}>
                      {selectedSummary?.oneYearReturnPct != null
                        ? `${selectedSummary.oneYearReturnPct >= 0 ? '+' : ''}${selectedSummary.oneYearReturnPct}%`
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Mobile Action Buttons (Touch Target >= 44px) */}
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  onClick={() => onNavigateToAnalysis(currentSelectedComplex.id)}
                  className="min-h-[44px] flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 active:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>상세분석</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => onToggleCompareId(currentSelectedComplex.id)}
                  className={`min-h-[44px] py-2.5 px-3.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 ${
                    isCurrentInComparison
                      ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  {isCurrentInComparison ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-indigo-300" />
                      <span>비교 중 ✓</span>
                    </>
                  ) : (
                    <>
                      <Layers className="w-3.5 h-3.5" />
                      <span>비교 추가</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};


