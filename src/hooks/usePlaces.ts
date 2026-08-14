import type { MapBounds, Place } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { toPlace } from '@/lib/mappers';
import { requireUserId, supabase, unwrap, unwrapOne } from '@/lib/supabase';

/** Coordinates within ~11m of each other describe the same venue. */
const SAME_PLACE_DEGREES = 0.0001;

export function usePlaces() {
    return useQuery<Place[]>({
        queryKey: ['places'],
        queryFn: async () => {
            const rows = unwrap(
                await supabase.from('place_feed').select('*').order('created_at', { ascending: true }),
            );

            return rows.map(toPlace);
        },
    });
}

/**
 * Places within `radiusMeters` of a point, nearest first.
 *
 * Backed by the `places_nearby` RPC, which uses the GiST index on the generated
 * geography column — so this stays fast as the map fills up, unlike filtering
 * raw latitude/longitude in the client.
 */
export function useNearbyPlaces(
    center?: { latitude: number; longitude: number },
    radiusMeters = 5000,
) {
    return useQuery<Place[]>({
        queryKey: ['places', 'nearby', center?.latitude, center?.longitude, radiusMeters],
        enabled: Boolean(center),
        queryFn: async () => {
            const rows = unwrap(
                await supabase.rpc('places_nearby', {
                    lat: center!.latitude,
                    lng: center!.longitude,
                    radius_meters: radiusMeters,
                }),
            );

            return rows.map(toPlace);
        },
    });
}

/**
 * Snapping bounds to a grid before querying.
 *
 * `moveend` fires with slightly different coordinates after every pan, and each
 * distinct value would be a fresh cache entry and a fresh request. Rounding
 * outward to ~100m makes small drags reuse the previous result, and never
 * shrinks the box below what the user can see.
 */
const BOUNDS_PRECISION = 1000;

function snapOutward(bounds: MapBounds): MapBounds {
    return {
        minLatitude: Math.floor(bounds.minLatitude * BOUNDS_PRECISION) / BOUNDS_PRECISION,
        minLongitude: Math.floor(bounds.minLongitude * BOUNDS_PRECISION) / BOUNDS_PRECISION,
        maxLatitude: Math.ceil(bounds.maxLatitude * BOUNDS_PRECISION) / BOUNDS_PRECISION,
        maxLongitude: Math.ceil(bounds.maxLongitude * BOUNDS_PRECISION) / BOUNDS_PRECISION,
    };
}

/**
 * The places inside the map's current viewport.
 *
 * Runs `places_in_bounds`, which filters on the GiST-indexed geography column,
 * so the cost tracks what is on screen rather than how many places exist.
 */
export function usePlacesInBounds(bounds?: MapBounds) {
    const snapped = bounds ? snapOutward(bounds) : undefined;

    return useQuery<Place[]>({
        queryKey: [
            'places',
            'bounds',
            snapped?.minLatitude,
            snapped?.minLongitude,
            snapped?.maxLatitude,
            snapped?.maxLongitude,
        ],
        enabled: Boolean(snapped),
        // Panning back to somewhere just visited should not re-query.
        placeholderData: (previous) => previous,
        queryFn: async () => {
            const rows = unwrap(
                await supabase.rpc('places_in_bounds', {
                    min_lat: snapped!.minLatitude,
                    min_lng: snapped!.minLongitude,
                    max_lat: snapped!.maxLatitude,
                    max_lng: snapped!.maxLongitude,
                }),
            );

            return rows.map(toPlace);
        },
    });
}

export function useAddPlace() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: Omit<Place, 'id'>): Promise<Place> => {
            const userId = await requireUserId();
            const name = payload.name.trim();

            // Two people contributing the same venue from map search should
            // converge on one record, not create rivals. A unique index backs
            // this up if both arrive at once.
            const existing = unwrap(
                await supabase
                    .from('place_feed')
                    .select('*')
                    .ilike('name', name)
                    .gte('latitude', payload.latitude - SAME_PLACE_DEGREES)
                    .lte('latitude', payload.latitude + SAME_PLACE_DEGREES)
                    .gte('longitude', payload.longitude - SAME_PLACE_DEGREES)
                    .lte('longitude', payload.longitude + SAME_PLACE_DEGREES)
                    .limit(1),
            );

            if (existing.length > 0) {
                return toPlace(existing[0]);
            }

            const inserted = await supabase
                .from('places')
                .insert({
                    name,
                    category: payload.category,
                    address: payload.address ?? '',
                    accessibility_note: payload.accessibilityNote ?? '',
                    source_label: payload.sourceLabel ?? '',
                    source_url: payload.sourceUrl ?? '',
                    latitude: payload.latitude,
                    longitude: payload.longitude,
                    features: payload.features,
                    created_by: userId,
                })
                .select('id')
                .single();

            // 23505 is a unique violation: somebody else added it first.
            if (inserted.error?.code === '23505') {
                await queryClient.invalidateQueries({ queryKey: ['places'] });
                const rows = unwrap(
                    await supabase.from('place_feed').select('*').ilike('name', name).limit(1),
                );

                if (rows.length > 0) {
                    return toPlace(rows[0]);
                }
            }

            const row = unwrapOne(
                await supabase
                    .from('place_feed')
                    .select('*')
                    .eq('id', unwrapOne(inserted).id)
                    .single(),
            );

            await queryClient.invalidateQueries({ queryKey: ['places'] });
            return toPlace(row);
        },
    });
}

export function useUpdatePlaceGuide() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: {
            placeId: string;
            features: Place['features'];
            communityGuide: string;
        }) => {
            const userId = await requireUserId();

            unwrap(
                await supabase
                    .from('places')
                    .update({
                        features: payload.features,
                        community_guide: payload.communityGuide.trim(),
                        guide_author_id: userId,
                        guide_updated_at: new Date().toISOString(),
                    })
                    .eq('id', payload.placeId),
            );

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['places'] }),
                queryClient.invalidateQueries({ queryKey: ['place', payload.placeId] }),
            ]);
        },
    });
}
