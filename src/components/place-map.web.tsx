import 'maplibre-gl/dist/maplibre-gl.css';

import { Map as MapLibreMap, Marker as MapLibreMarker, NavigationControl, type Marker, type StyleSpecification } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { PIN_COLORS } from '@/constants/map';
import type { MapBounds, MapPin, Place } from '@/types';

const NO_PINS: MapPin[] = [];

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
  /** Fires once the map settles, so callers can fetch just what is visible. */
  onBoundsChange?: (bounds: MapBounds) => void;
  /** Reports and elevator outages drawn alongside the places. */
  pins?: MapPin[];
  onPinPress?: (pin: MapPin) => void;
}

export function PlaceMap({ places, selectedId, onSelect, onBoundsChange, pins = NO_PINS, onPinPress }: PlaceMapProps) {
  const container = useRef<View>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const reduceMotion = useReducedMotion();

  // Held in a ref so the map is created exactly once. Listing the callback as a
  // dependency of the setup effect below would tear down and rebuild the whole
  // map every time the parent re-renders with a new closure.
  const boundsCallback = useRef(onBoundsChange);
  useEffect(() => { boundsCallback.current = onBoundsChange; }, [onBoundsChange]);

  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = new MapLibreMap({
      container: container.current as unknown as HTMLElement,
      style: MAP_STYLE,
      center: [-73.9822, 40.7532],
      zoom: 11,
    });
    instance.addControl(new NavigationControl(), 'top-right');

    const reportBounds = () => {
      const bounds = instance.getBounds();
      boundsCallback.current?.({
        minLatitude: bounds.getSouth(),
        minLongitude: bounds.getWest(),
        maxLatitude: bounds.getNorth(),
        maxLongitude: bounds.getEast(),
      });
    };

    // `load` seeds the first query; `moveend` only fires once panning settles,
    // so this does not fire per frame while the user drags.
    instance.on('load', reportBounds);
    instance.on('moveend', reportBounds);

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
      element.setAttribute('aria-label', place.category ? `${place.name}, ${place.category}` : place.name);
      element.setAttribute('aria-pressed', String(selectedId === place.id));
      Object.assign(element.style, {
        width: selectedId === place.id ? '36px' : '30px',
        height: selectedId === place.id ? '36px' : '30px',
        borderRadius: '999px',
        border: '3px solid white',
        background: selectedId === place.id ? PIN_COLORS.selected : PIN_COLORS.place,
        color: 'white', cursor: 'pointer', fontWeight: '700',
      });
      element.textContent = place.name.slice(0, 1);
      element.onclick = () => onSelect(place);
      return new MapLibreMarker({ element })
        .setLngLat([place.longitude, place.latitude])
        .addTo(map.current!);
    });

    for (const pin of pins) {
      const element = document.createElement('button');
      element.type = 'button';
      element.title = pin.label;
      element.setAttribute('aria-label', pin.label);
      Object.assign(element.style, {
        width: '22px', height: '22px', borderRadius: pin.kind === 'outage' ? '6px' : '999px',
        border: '3px solid white', background: PIN_COLORS[pin.kind], cursor: onPinPress ? 'pointer' : 'default',
        boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
      });
      if (onPinPress) element.onclick = () => onPinPress(pin);
      markers.current.push(new MapLibreMarker({ element }).setLngLat([pin.longitude, pin.latitude]).addTo(map.current!));
    }
  }, [onSelect, places, selectedId, pins, onPinPress]);

  // Fly only when the *selection* changes. `places` is refetched after every
  // pan, and re-flying on that snapped the map back to the selection.
  const flownTo = useRef<string | undefined>(undefined);
  useEffect(() => {
    const selected = places.find((place) => place.id === selectedId);
    if (!selected || flownTo.current === selected.id) return;
    flownTo.current = selected.id;
    map.current?.flyTo({ center: [selected.longitude, selected.latitude], zoom: 14, animate: !reduceMotion });
  }, [places, selectedId, reduceMotion]);

  return <View ref={container} style={styles.map} />;
}

const styles = StyleSheet.create({
  map: { height: 420, borderRadius: Radius.lg, overflow: 'hidden' },
});
