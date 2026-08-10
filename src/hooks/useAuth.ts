import type { User } from '@/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../../db';

type SignUpPayload = { firstName: string; lastName: string; affiliation?: string };
type SignInPayload = { firstName: string; lastName: string };

export function useSignUp() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (p: SignUpPayload) => {
            const user: User = {
                id: `u_${Date.now()}`,
                firstName: p.firstName,
                lastName: p.lastName,
                affiliation: p.affiliation ?? '',
                stats: { reports: 0, reviews: 0, votes: 0 },
            };
            await db.runAsync(
                'INSERT OR REPLACE INTO current_user (id, firstName, lastName, affiliation, reports, reviews, votes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [user.id, user.firstName, user.lastName, user.affiliation, user.stats.reports, user.stats.reviews, user.stats.votes],
            );
            qc.setQueryData(['currentUser'], user);
            return user;
        },
    });
}

export function useSignIn() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (_: SignInPayload) => {
            // For now, auth is mocked: just set a session based on provided names.
            const user: User = {
                id: `u_${Date.now()}`,
                firstName: _.firstName,
                lastName: _.lastName,
                affiliation: '',
                stats: { reports: 0, reviews: 0, votes: 0 },
            };
            await db.runAsync(
                'INSERT OR REPLACE INTO current_user (id, firstName, lastName, affiliation, reports, reviews, votes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [user.id, user.firstName, user.lastName, user.affiliation, user.stats.reports, user.stats.reviews, user.stats.votes],
            );
            qc.setQueryData(['currentUser'], user);
            return user;
        },
    });
}

export function useSignOut() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            await db.runAsync('DELETE FROM current_user');
            qc.setQueryData(['currentUser'], null);
            return null;
        },
    });
}
