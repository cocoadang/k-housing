import React, { useEffect } from 'react';
import { AdvancedMarker, CollisionBehavior, useMap } from '@vis.gl/react-google-maps';
import type { RegionalSchoolData } from '../../types/schools';

export default function SchoolMapLayer({ data, showSchools, showZones, selectedId, onSelect }: {
  data: RegionalSchoolData; showSchools: boolean; showZones: boolean;
  selectedId: string | null; onSelect: (id: string) => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map || !showZones) return;
    const layer = new google.maps.Data({ map });
    layer.addGeoJson(data.zones);
    layer.setStyle(feature => {
      const joint = feature.getProperty('kind') !== 'single';
      const schools = feature.getProperty('schoolIds') as string[];
      const selected = !!selectedId && schools.includes(selectedId);
      return { fillColor: joint ? '#fbbf24' : '#38bdf8', fillOpacity: selected ? 0.22 : 0.08,
        strokeColor: joint ? '#d97706' : '#0284c7', strokeWeight: selected ? 3 : 1.5,
        zIndex: selected ? 2 : 1, clickable: true };
    });
    const click = layer.addListener('click', (event: google.maps.Data.MouseEvent) => {
      const ids = event.feature.getProperty('schoolIds') as string[];
      // A joint zone selects one member to open its card; both members remain listed there.
      if (ids?.length) onSelect(ids.includes(selectedId || '') ? selectedId! : ids[0]);
    });
    return () => { google.maps.event.removeListener(click); layer.setMap(null); };
  }, [map, data, showZones, selectedId, onSelect]);

  return <>{showSchools && data.schools.map(school => <AdvancedMarker
    key={school.id} position={{ lat: school.latitude, lng: school.longitude }}
    title={`${school.name} · 전체 학생 ${school.students === null ? '공시자료 없음' : school.students.toLocaleString() + '명'} · ${school.studentsAsOf} 기준`}
    collisionBehavior={selectedId === school.id ? CollisionBehavior.REQUIRED_AND_HIDES_OPTIONAL : CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY}
    zIndex={selectedId === school.id ? 1200 : 700} onClick={() => onSelect(school.id)}>
    <div className={`rounded-xl border-2 px-2.5 py-1.5 text-center shadow-lg cursor-pointer ${selectedId === school.id ? 'bg-sky-700 border-white text-white' : 'bg-white border-sky-600 text-slate-900'}`}>
      <div className="text-xs font-bold">{school.name}</div>
      <div className="text-[11px]">초 · {school.students === null ? '학생 수 미공시' : school.students.toLocaleString() + '명'}</div>
    </div>
  </AdvancedMarker>)}</>;
}
