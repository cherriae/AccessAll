import type { Place } from '@/types';
import { useMutation } from '@tanstack/react-query';

const GEOCODER_URL = process.env.EXPO_PUBLIC_GEOCODER_URL ?? 'https://photon.komoot.io/api';

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type?: string; osm_id?: number; name?: string; street?: string; housenumber?: string;
    city?: string; state?: string; country?: string; type?: string; osm_value?: string;
  };
};

type PhotonResponse = { features?: PhotonFeature[] };

function resultName(feature: PhotonFeature): string {
  const p = feature.properties;
  return p.name ?? p.street ?? ([p.city, p.state, p.country].filter(Boolean).join(', ') || 'Map result');
}

function openStreetMapUrl(type?: string, id?: number): string | undefined {
  if (!id) return undefined;
  const osmType = type === 'N' || type === 'node' ? 'node'
    : type === 'W' || type === 'way' ? 'way'
      : type === 'R' || type === 'relation' ? 'relation'
        : undefined;
  return osmType ? `https://www.openstreetmap.org/${osmType}/${id}` : undefined;
}

export function useMapSearch() {
  return useMutation({
    mutationFn: async (query: string): Promise<Place[]> => {
      const response = await fetch(`${GEOCODER_URL}?q=${encodeURIComponent(query.trim())}&limit=5&lang=en`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('MAP_SEARCH_FAILED');
      const data = await response.json() as PhotonResponse;
      return (data.features ?? []).map((feature, index) => {
        const [longitude, latitude] = feature.geometry.coordinates;
        const p = feature.properties;
        const address = [
          [p.street, p.housenumber].filter(Boolean).join(' '),
          p.city,
          p.state,
          p.country,
        ].filter(Boolean).join(', ');
        return {
          id: `geo_${p.osm_type ?? 'result'}_${p.osm_id ?? index}`,
          name: resultName(feature),
          category: [p.type ?? p.osm_value, p.city, p.state, p.country].filter(Boolean).join(' · ') || 'OpenStreetMap result',
          rating: null, reviewCount: 0, quietScore: null, verified: false,
          latitude, longitude, features: [],
          address: address || undefined,
          sourceLabel: 'OpenStreetMap location',
          sourceUrl: openStreetMapUrl(p.osm_type, p.osm_id),
        };
      });
    },
  });
}
