import type { Place } from '@/types';
import { useQuery } from '@tanstack/react-query';

import { toPlace } from '@/lib/mappers';
import { supabase, unwrap } from '@/lib/supabase';

export function usePlace(id?: string) {
    return useQuery<Place | null>({
        queryKey: ['place', id],
        // Map-search previews live only in memory until a review or guide is
        // published, so querying the database for their temporary IDs is
        // meaningless — and their `geo_` ids are not valid UUIDs anyway.
        enabled: Boolean(id) && !id?.startsWith('geo_'),
        queryFn: async () => {
            if (!id) {
                return null;
            }

            const row = unwrap(
                await supabase.from('place_feed').select('*').eq('id', id).maybeSingle(),
            );

            return row ? toPlace(row) : null;
        },
    });
}
