import type { Poll } from '@/types';
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
                await supabase.from('poll_feed').select('*').order('closes_at', { ascending: true }),
            );

            return rows.map(toPoll);
        },
    });
}

export function useVotePoll() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (pollId: string) => {
            const userId = await requireUserId();

            const result = await supabase
                .from('poll_votes')
                .insert({ poll_id: pollId, user_id: userId });

            // A duplicate means the vote is already recorded — the button was
            // pressed twice, not that anything went wrong.
            if (result.error && result.error.code !== '23505') {
                throw new Error(result.error.message);
            }

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['polls'] }),
                queryClient.invalidateQueries({ queryKey: ['currentUser'] }),
                queryClient.invalidateQueries({ queryKey: ['activity'] }),
            ]);

            return pollId;
        },
    });
}

export function useAddPoll() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: { title: string; location: string; closesAt: string }) => {
            const userId = await requireUserId();

            const inserted = await supabase
                .from('polls')
                .insert({
                    title: payload.title.trim(),
                    location: payload.location.trim(),
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
