import { Camera, Map, Marker, type CameraRef, type MapRef, type StyleSpecification } from '@maplibre/maplibre-react-native';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import type { MapBounds, Place } from '@/types';

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
}

export function PlaceMap({ places, selectedId, onSelect, onBoundsChange }: PlaceMapProps) {
  const camera = useRef<CameraRef>(null);
  const map = useRef<MapRef>(null);
  const selected = places.find((place) => place.id === selectedId) ?? places[0];

  useEffect(() => {
    if (selected) {
      camera.current?.flyTo({ center: [selected.longitude, selected.latitude], zoom: 14, duration: 500 });
    }
  }, [selected]);

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
            center: selected ? [selected.longitude, selected.latitude] : [-73.9822, 40.7532],
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
            <View style={[styles.marker, selectedId === place.id ? styles.markerSelected : null]}>
              <Text variant="caption" colorValue="#FFFFFF">{place.name.slice(0, 1)}</Text>
            </View>
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
    backgroundColor: '#4F46E5', borderWidth: 3, borderColor: '#FFFFFF',
  },
  markerSelected: { backgroundColor: '#C2410C', transform: [{ scale: 1.15 }] },
});
