import type { Review } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { toReview } from '@/lib/mappers';
import { requireUserId, supabase, unwrap } from '@/lib/supabase';

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
                    .order('created_at', { ascending: false }),
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
                        accessibility_notes: payload.accessibilityNotes.trim(),
                        updated_at: new Date().toISOString(),
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
            ]);
        },
    });
}
