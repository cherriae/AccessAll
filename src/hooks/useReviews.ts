import type { Review } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { toReview } from '@/lib/mappers';
import { requireUserId, supabase, unwrap, unwrapOne } from '@/lib/supabase';

export function useReviews(placeId?: string) {
    return useQuery<Review[]>({
        queryKey: ['reviews', placeId],
        enabled: Boolean(placeId) && !placeId?.startsWith('geo_'),
        queryFn: async () => {
            const rows = unwrap(
                await supabase
                    .from('review_feed')
                    .select('*')
                    .eq('place_id', placeId!)
                    .order('created_at', { ascending: false })
                    .limit(200),
            );

            return rows.map(toReview);
        },
    });
}

/**
 * Publishes the signed-in user's review of a place.
 *
 * One review per person per place: re-reviewing replaces your previous entry
 * rather than stacking another vote on the average. The place's rating, review
 * count and quiet score are recomputed by a database trigger, and the activity
 * entry is written by another — so the aggregate can never disagree with the
 * rows it summarises, even if this request dies halfway.
 */
export function useAddReview() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: {
            placeId: string;
            rating: number;
            quietScore: number | null;
            /** The quiet score came from the sound meter. */
            quietMeasured: boolean;
            accessibilityNotes: string;
        }) => {
            const userId = await requireUserId();

            unwrap(
                await supabase.from('reviews').upsert(
                    {
                        place_id: payload.placeId,
                        user_id: userId,
                        rating: payload.rating,
                        quiet_score: payload.quietScore,
                        quiet_measured: payload.quietMeasured && payload.quietScore !== null,
                        accessibility_notes: payload.accessibilityNotes.trim(),
                    },
                    { onConflict: 'place_id,user_id' },
                ),
            );

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['reviews', payload.placeId] }),
                queryClient.invalidateQueries({ queryKey: ['place', payload.placeId] }),
                queryClient.invalidateQueries({ queryKey: ['places'] }),
                queryClient.invalidateQueries({ queryKey: ['currentUser'] }),
                queryClient.invalidateQueries({ queryKey: ['activity'] }),
                queryClient.invalidateQueries({ queryKey: ['impact'] }),
            ]);
        },
    });
}

/** Removes the signed-in user's own review; the place stats trigger recomputes. */
export function useDeleteReview() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (review: { id: string; placeId: string }) => {
            await requireUserId();

            unwrapOne(
                await supabase.from('reviews').delete().eq('id', review.id).select('id').maybeSingle(),
                'Review could not be deleted',
            );

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['reviews', review.placeId] }),
                queryClient.invalidateQueries({ queryKey: ['place', review.placeId] }),
                queryClient.invalidateQueries({ queryKey: ['places'] }),
                queryClient.invalidateQueries({ queryKey: ['currentUser'] }),
                queryClient.invalidateQueries({ queryKey: ['impact'] }),
            ]);
        },
    });
}
