import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { toNumber } from '@/lib/mappers';
import { medianSlope, roundSlope } from '@/lib/slope';
import { requireUserId, supabase, unwrap } from '@/lib/supabase';

export interface RampSummary {
    /** Median of everyone's measurements, in percent; null when nobody has measured. */
    medianPercent: number | null;
    count: number;
    /** The signed-in user's own measurement, if any. */
    ownPercent: number | null;
}

/** Community ramp measurements for one place, reduced to a median. */
export function useRampSummary(placeId: string | undefined, userId: string | undefined) {
    return useQuery<RampSummary>({
        queryKey: ['ramps', placeId, userId],
        enabled: Boolean(placeId),
        queryFn: async () => {
            const rows = unwrap(
                await supabase
                    .from('ramp_measurements')
                    .select('user_id, slope_percent')
                    .eq('place_id', placeId!)
                    .limit(500),
            );
            const values = rows.map((row) => toNumber(row.slope_percent) ?? 0);
            const own = rows.find((row) => row.user_id === userId);

            return {
                medianPercent: medianSlope(values),
                count: rows.length,
                ownPercent: own ? toNumber(own.slope_percent) : null,
            };
        },
    });
}

/**
 * Saves the user's measurement for a place, replacing their earlier one.
 *
 * Update-then-insert rather than an upsert: an upsert also rewrites the key
 * columns, which clients are deliberately not granted UPDATE on.
 */
export function useSaveRampMeasurement() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ placeId, percent }: { placeId: string; percent: number }) => {
            const userId = await requireUserId();
            const slope = roundSlope(percent);

            const updated = unwrap(
                await supabase
                    .from('ramp_measurements')
                    .update({ slope_percent: slope, created_at: new Date().toISOString() })
                    .eq('place_id', placeId)
                    .eq('user_id', userId)
                    .select('place_id'),
            );

            if (updated.length === 0) {
                unwrap(await supabase.from('ramp_measurements').insert({ place_id: placeId, user_id: userId, slope_percent: slope }));
            }

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['ramps', placeId] }),
                queryClient.invalidateQueries({ queryKey: ['impact'] }),
            ]);
        },
    });
}
