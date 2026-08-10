import type { User } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../db';

type UserRow = {
    id: string;
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
        queryFn: async () => mapUser(await db.getFirstAsync<UserRow>('SELECT id, firstName, lastName, affiliation, reports, reviews, votes FROM current_user LIMIT 1')),
    });
}
