import { Camera, Map, Marker, type CameraRef, type MapRef, type StyleSpecification } from '@maplibre/maplibre-react-native';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { Radius } from '@/constants/theme';
import { PIN_COLORS } from '@/constants/map';
import type { MapBounds, MapPin, Place } from '@/types';

const NO_PINS: MapPin[] = [];

/** MapLibre reports bounds as `[west, south, east, north]`. */
function toMapBounds([west, south, east, north]: [number, number, number, number]): MapBounds {
  return { minLatitude: south, minLongitude: west, maxLatitude: north, maxLongitude: east };
}

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
  /** Where to open when there is no place to centre on. Defaults to Midtown Manhattan. */
  initialCenter?: { latitude: number; longitude: number };
}

export function PlaceMap({ places, selectedId, onSelect, onBoundsChange, pins = NO_PINS, onPinPress, initialCenter }: PlaceMapProps) {
  const camera = useRef<CameraRef>(null);
  const map = useRef<MapRef>(null);
  const reduceMotion = useReducedMotion();
  const selected = places.find((place) => place.id === selectedId);
  const flownTo = useRef<string | undefined>(undefined);

  // Fly only when the *selection* changes. Every pan refetches `places`, and
  // re-flying on that dragged the camera back to the selection after each pan.
  useEffect(() => {
    if (!selected || flownTo.current === selected.id) return;
    flownTo.current = selected.id;
    camera.current?.flyTo({ center: [selected.longitude, selected.latitude], zoom: 14, duration: reduceMotion ? 0 : 500 });
  }, [selected, reduceMotion]);

  const initial = selected ?? places[0] ?? initialCenter;

  return (
    <View style={styles.frame}>
      <Map
        ref={map}
        mapStyle={MAP_STYLE}
        style={styles.map}
        logo
        onRegionDidChange={(event) => onBoundsChange?.(toMapBounds(event.nativeEvent.bounds))}
        // `onRegionDidChange` only fires once the user moves the map, so the
        // first viewport has to be read directly or nothing loads until they do.
        onDidFinishLoadingMap={() => {
          map.current?.getBounds().then((bounds) => onBoundsChange?.(toMapBounds(bounds)));
        }}
      >
        <Camera
          ref={camera}
          initialViewState={{
            center: initial ? [initial.longitude, initial.latitude] : [-73.9822, 40.7532],
            zoom: 12,
          }}
        />
        {places.map((place) => (
          <Marker
            key={place.id}
            id={place.id}
            lngLat={[place.longitude, place.latitude]}
            onPress={() => onSelect(place)}
          >
            <View
              style={[styles.marker, selectedId === place.id ? styles.markerSelected : null]}
              accessible
              accessibilityRole="button"
              accessibilityLabel={place.category ? `${place.name}, ${place.category}` : place.name}
              accessibilityState={{ selected: selectedId === place.id }}
            >
              <Text variant="caption" colorValue="#FFFFFF" importantForAccessibility="no">{place.name.slice(0, 1)}</Text>
            </View>
          </Marker>
        ))}
        {pins.map((pin) => (
          <Marker key={`${pin.kind}-${pin.id}`} id={`${pin.kind}-${pin.id}`} lngLat={[pin.longitude, pin.latitude]} onPress={() => onPinPress?.(pin)}>
            <View
              style={[styles.pin, { backgroundColor: PIN_COLORS[pin.kind], borderRadius: pin.kind === 'outage' ? 6 : Radius.full }]}
              accessible
              accessibilityRole={onPinPress ? 'button' : 'image'}
              accessibilityLabel={pin.label}
            />
          </Marker>
        ))}
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: 360, borderRadius: Radius.lg, overflow: 'hidden' },
  map: { flex: 1 },
  marker: {
    width: 32, height: 32, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center',
    backgroundColor: PIN_COLORS.place, borderWidth: 3, borderColor: '#FFFFFF',
  },
  markerSelected: { backgroundColor: PIN_COLORS.selected, transform: [{ scale: 1.15 }] },
  pin: { width: 22, height: 22, borderWidth: 3, borderColor: '#FFFFFF' },
});
