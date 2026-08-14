import type { Feature } from '@/types';
import { useQuery } from '@tanstack/react-query';

import { toFeature } from '@/lib/mappers';
import { supabase, unwrap } from '@/lib/supabase';

/**
 * The product areas promoted on the home screen.
 *
 * Reference content rather than community data: readable by everyone, writable
 * by nobody through the API. Changing the cards is a migration, not a mutation.
 */
export function useFeatures() {
    return useQuery<Feature[]>({
        queryKey: ['features'],
        // These change about as often as the app ships, so re-fetching them on
        // every screen focus is pure noise.
        staleTime: 60 * 60 * 1000,
        queryFn: async () => {
            const rows = unwrap(
                await supabase.from('app_features').select('*').order('sort_index', { ascending: true }),
            );

            return rows.map(toFeature);
        },
    });
}
