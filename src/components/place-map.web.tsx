import 'maplibre-gl/dist/maplibre-gl.css';

import { Map as MapLibreMap, Marker as MapLibreMarker, NavigationControl, type Marker, type StyleSpecification } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import type { Place } from '@/types';

const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    openStreetMap: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'openStreetMap', type: 'raster', source: 'openStreetMap' }],
};

export interface PlaceMapProps {
  places: Place[];
  selectedId?: string;
  onSelect: (place: Place) => void;
}

export function PlaceMap({ places, selectedId, onSelect }: PlaceMapProps) {
  const container = useRef<View>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);

  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = new MapLibreMap({
      container: container.current as unknown as HTMLElement,
      style: MAP_STYLE,
      center: [-73.9822, 40.7532],
      zoom: 11,
    });
    instance.addControl(new NavigationControl(), 'top-right');
    map.current = instance;
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    markers.current.forEach((marker) => marker.remove());
    markers.current = places.map((place) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.title = place.name;
      element.setAttribute('aria-label', `Show ${place.name} on the map`);
      Object.assign(element.style, {
        width: selectedId === place.id ? '36px' : '30px',
        height: selectedId === place.id ? '36px' : '30px',
        borderRadius: '999px',
        border: '3px solid white',
        background: selectedId === place.id ? '#C2410C' : '#4F46E5',
        color: 'white', cursor: 'pointer', fontWeight: '700',
      });
      element.textContent = place.name.slice(0, 1);
      element.onclick = () => onSelect(place);
      return new MapLibreMarker({ element })
        .setLngLat([place.longitude, place.latitude])
        .addTo(map.current!);
    });
  }, [onSelect, places, selectedId]);

  useEffect(() => {
    const selected = places.find((place) => place.id === selectedId);
    if (selected) map.current?.flyTo({ center: [selected.longitude, selected.latitude], zoom: 14 });
  }, [places, selectedId]);

  return <View ref={container} style={styles.map} />;
}

const styles = StyleSheet.create({
  map: { height: 420, borderRadius: Radius.lg, overflow: 'hidden' },
});
