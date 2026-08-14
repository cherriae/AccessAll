import type { User } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthSession } from '@/lib/auth-context';
import { toUser } from '@/lib/mappers';
import { requireUserId, supabase, unwrap } from '@/lib/supabase';

/**
 * The signed-in user, or `null` when nobody is.
 *
 * Reads `profile_stats`, a view that counts the user's reports, reviews and
 * votes live. The old schema kept those as counter columns on `users` that
 * every mutation had to remember to bump; counting at read time cannot drift.
 */
export function useCurrentUser() {
    const { userId, isReady } = useAuthSession();

    return useQuery<User | null>({
        queryKey: ['currentUser', userId],
        enabled: isReady,
        queryFn: async () => {
            if (!userId) {
                return null;
            }

            const row = unwrap(
                await supabase.from('profile_stats').select('*').eq('id', userId).maybeSingle(),
            );

            return row ? toUser(row) : null;
        },
    });
}

export function useUpdateProfile() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: { firstName: string; lastName: string; affiliation: string }) => {
            const userId = await requireUserId();

            unwrap(
                await supabase
                    .from('profiles')
                    .update({
                        first_name: payload.firstName.trim(),
                        last_name: payload.lastName.trim(),
                        affiliation: payload.affiliation.trim(),
                    })
                    .eq('id', userId),
            );

            // The display name is generated from these columns, so anything
            // showing this user as an author is now stale too.
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['currentUser'] }),
                queryClient.invalidateQueries({ queryKey: ['reviews'] }),
                queryClient.invalidateQueries({ queryKey: ['reportComments'] }),
            ]);
        },
    });
}
