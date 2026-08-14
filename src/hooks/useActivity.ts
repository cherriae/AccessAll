import type { ActivityEvent } from '@/types';
import { useQuery } from '@tanstack/react-query';

import { useAuthSession } from '@/lib/auth-context';
import { toActivityEvent } from '@/lib/mappers';
import { supabase, unwrap } from '@/lib/supabase';

/**
 * The signed-in user's activity feed.
 *
 * Entries are written by database triggers when something actually happens —
 * a review is published, a report filed, a vote cast — so the feed is a record
 * of the data rather than a parallel log the client has to remember to append
 * to. Row level security restricts reads to your own rows; a signed-out visitor
 * simply has no feed.
 */
export function useActivity() {
    const { userId, isReady } = useAuthSession();

    return useQuery<ActivityEvent[]>({
        queryKey: ['activity', userId],
        enabled: isReady,
        queryFn: async () => {
            if (!userId) {
                return [];
            }

            const rows = unwrap(
                await supabase
                    .from('activity')
                    .select('*')
                    .order('occurred_at', { ascending: false }),
            );

            return rows.map(toActivityEvent);
        },
    });
}
