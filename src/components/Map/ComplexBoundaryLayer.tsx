import React, { useEffect } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import type { ComplexFootprints } from '../../types/schools';

export default function ComplexBoundaryLayer({ data, complexIds, selectedId, onSelect }: {
  data: ComplexFootprints; complexIds: string[]; selectedId: string;
  onSelect: (id: string) => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const layer = new google.maps.Data({ map });
    const ids = new Set(complexIds);
    layer.addGeoJson({ type: 'FeatureCollection', features: data.collection.features.filter(f => ids.has(f.properties.complexId)) });
    layer.setStyle(feature => {
      const selected = feature.getProperty('complexId') === selectedId;
      return { fillColor: '#10b981', fillOpacity: selected ? 0.3 : 0.12, strokeColor: selected ? '#047857' : '#059669',
        strokeWeight: selected ? 3 : 2, zIndex: selected ? 30 : 20, clickable: true };
    });
    const listener = layer.addListener('click', (event: google.maps.Data.MouseEvent) => {
      const id = event.feature.getProperty('complexId');
      if (typeof id === 'string') onSelect(id);
    });
    return () => { google.maps.event.removeListener(listener); layer.setMap(null); };
  }, [map, data, complexIds, selectedId, onSelect]);
  return null;
}
