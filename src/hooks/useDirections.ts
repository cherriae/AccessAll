import type { DirectionStep, PlaceDirection } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { toPlaceDirection } from '@/lib/mappers';
import { deletePhotos } from '@/lib/photos';
import { requireUserId, supabase, unwrap, unwrapOne } from '@/lib/supabase';

/** Step-free routes the community has written for a place. */
export function useDirections(placeId?: string) {
    return useQuery<PlaceDirection[]>({
        queryKey: ['directions', placeId],
        enabled: Boolean(placeId),
        queryFn: async () => {
            const rows = unwrap(
                await supabase
                    .from('direction_feed')
                    .select('*')
                    .eq('place_id', placeId!)
                    .order('updated_at', { ascending: false })
                    .limit(50),
            );

            return rows.map(toPlaceDirection);
        },
    });
}

/** Creates a route, or replaces one the user wrote when `id` is given. */
export function useSaveDirection() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: { id?: string; placeId: string; title: string; steps: DirectionStep[] }) => {
            const userId = await requireUserId();
            const steps = payload.steps
                .filter((step) => step.text.trim())
                .map((step) => (step.photoPath ? { text: step.text.trim(), photo: step.photoPath } : { text: step.text.trim() }));

            if (payload.id) {
                unwrapOne(
                    await supabase
                        .from('place_directions')
                        .update({ title: payload.title.trim(), steps })
                        .eq('id', payload.id)
                        .select('id')
                        .maybeSingle(),
                    'Directions could not be updated',
                );
            } else {
                unwrap(
                    await supabase.from('place_directions').insert({
                        place_id: payload.placeId,
                        user_id: userId,
                        title: payload.title.trim(),
                        steps,
                    }),
                );
            }

            await queryClient.invalidateQueries({ queryKey: ['directions', payload.placeId] });
        },
    });
}

export function useDeleteDirection() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (direction: Pick<PlaceDirection, 'id' | 'placeId' | 'steps'>) => {
            await requireUserId();

            unwrapOne(
                await supabase.from('place_directions').delete().eq('id', direction.id).select('id').maybeSingle(),
                'Directions could not be deleted',
            );

            // Best effort: the route is already gone, a leftover photo is not
            // worth failing the delete over.
            await deletePhotos(direction.steps.flatMap((step) => (step.photoPath ? [step.photoPath] : []))).catch(() => {});

            await queryClient.invalidateQueries({ queryKey: ['directions', direction.placeId] });
        },
    });
}
