import type { User } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../../db';

type UserRow = {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    affiliation: string;
    reports: number;
    reviews: number;
    votes: number;
};

function mapUser(row?: UserRow | null): User | null {
    if (!row) {
        return null;
    }

    return {
        id: row.id,
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        affiliation: row.affiliation,
        stats: {
            reports: row.reports,
            reviews: row.reviews,
            votes: row.votes,
        },
    };
}

export function useCurrentUser() {
    return useQuery<User | null>({
        queryKey: ['currentUser'],
        queryFn: async () => mapUser(await db.getFirstAsync<UserRow>(
            'SELECT u.id, u.email, u.firstName, u.lastName, u.affiliation, u.reports, u.reviews, u.votes FROM users u JOIN session s ON s.userId = u.id WHERE s.singleton = 1 LIMIT 1',
        )),
    });
}

export function useUpdateProfile() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (payload: { firstName: string; lastName: string; affiliation: string }) => {
            const session = await db.getFirstAsync<{ userId: string }>('SELECT userId FROM session WHERE singleton = 1');
            if (!session) throw new Error('SIGN_IN_REQUIRED');
            await db.runAsync(
                'UPDATE users SET firstName = ?, lastName = ?, affiliation = ? WHERE id = ?',
                [payload.firstName.trim(), payload.lastName.trim(), payload.affiliation.trim(), session.userId],
            );
            await qc.invalidateQueries({ queryKey: ['currentUser'] });
        },
    });
}
