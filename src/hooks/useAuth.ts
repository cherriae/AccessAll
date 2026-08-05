import type { User } from '@/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';

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
            qc.setQueryData(['currentUser'], user);
            return user;
        },
    });
}

export function useSignOut() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            qc.setQueryData(['currentUser'], null);
            return null;
        },
    });
}
