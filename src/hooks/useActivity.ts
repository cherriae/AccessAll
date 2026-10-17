import type { ActivityEvent } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSettings } from '@/hooks/useSettings';
import { useAuthSession } from '@/lib/auth-context';
import { toActivityEvent } from '@/lib/mappers';
import { requireUserId, supabase, unwrap } from '@/lib/supabase';

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
                    .order('occurred_at', { ascending: false })
                    .limit(100),
            );

            return rows.map(toActivityEvent);
        },
    });
}

/**
 * Feed entries newer than the last time the user opened their activity.
 *
 * The marker lives in `user_settings`, so reading the feed on one device clears
 * the badge on the others too.
 */
export function useUnreadActivityCount() {
    const events = useActivity().data ?? [];
    const seenAt = useSettings().data?.activitySeenAt;

    if (!seenAt) {
        return 0;
    }

    // Only things other people did count as unread; your own report or vote
    // is in the feed as a record, not as news.
    const seen = new Date(seenAt).getTime();
    return events.filter(
        (event) => (event.kind === 'comment' || event.kind === 'status') && new Date(event.occurredAt).getTime() > seen,
    ).length;
}

/** Clears the unread badge, stamped with the server's clock (`mark_activity_seen`). */
export function useMarkActivitySeen() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            await requireUserId();
            unwrap(await supabase.rpc('mark_activity_seen'));
            await queryClient.invalidateQueries({ queryKey: ['settings'] });
        },
    });
}
