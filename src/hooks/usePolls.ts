import type { LocationSelection, Poll } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthSession } from '@/lib/auth-context';
import { toPoll } from '@/lib/mappers';
import { requireUserId, supabase, unwrap, unwrapOne } from '@/lib/supabase';

/**
 * Open proposals, with `hasVoted` resolved for the current user.
 *
 * `poll_feed` computes that flag per caller from `auth.uid()`, which is why the
 * session id is part of the query key: two accounts on the same device must not
 * share a cached answer to "have I voted?".
 */
export function usePolls() {
    const { userId } = useAuthSession();

    return useQuery<Poll[]>({
        queryKey: ['polls', userId],
        queryFn: async () => {
            const rows = unwrap(
                await supabase
                    .from('poll_feed')
                    .select('*')
                    // Closed polls refuse votes (0006), so offering them is a dead end.
                    .gt('closes_at', new Date().toISOString())
                    .order('closes_at', { ascending: true })
                    .limit(50),
            );

            return rows.map(toPoll);
        },
    });
}

/**
 * Backs a proposal, or withdraws that support.
 *
 * A vote is one row in `poll_votes`; the tally is trigger-maintained, so
 * nobody can inflate it. Returns whether the user now supports the poll.
 */
export function useTogglePollVote() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (poll: Pick<Poll, 'id' | 'hasVoted'>) => {
            const userId = await requireUserId();

            if (poll.hasVoted) {
                unwrap(
                    await supabase.from('poll_votes').delete().eq('poll_id', poll.id).eq('user_id', userId),
                );
            } else {
                const result = await supabase
                    .from('poll_votes')
                    .insert({ poll_id: poll.id, user_id: userId });

                // A duplicate means the vote is already recorded — the button
                // was pressed twice, not that anything went wrong.
                if (result.error && result.error.code !== '23505') {
                    throw new Error(result.error.message);
                }
            }

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['polls'] }),
                queryClient.invalidateQueries({ queryKey: ['currentUser'] }),
                queryClient.invalidateQueries({ queryKey: ['activity'] }),
            ]);

            return !poll.hasVoted;
        },
    });
}

export function useAddPoll() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: { title: string; location: LocationSelection; closesAt: string }) => {
            const userId = await requireUserId();

            const inserted = await supabase
                .from('polls')
                .insert({
                    title: payload.title.trim(),
                    location: payload.location.name.trim(),
                    latitude: payload.location.latitude,
                    longitude: payload.location.longitude,
                    closes_at: payload.closesAt,
                    created_by: userId,
                })
                .select('id')
                .single();

            const row = unwrapOne(inserted);

            await queryClient.invalidateQueries({ queryKey: ['polls'] });
            return row.id;
        },
    });
}
