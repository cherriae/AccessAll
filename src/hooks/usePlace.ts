import type { Place } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../db';

type PlaceRow = {
    id: string;
    name: string;
    category: string;
    rating: number | null;
    reviewCount: number;
    quietScore: number | null;
    verified: number;
    featuresJson: string;
};

export function usePlace(id?: string) {
    return useQuery<Place | undefined>({
        queryKey: ['place', id],
        queryFn: async () => {
            if (!id) {
                return undefined;
            }

            const row = await db.getFirstAsync<PlaceRow>(
                'SELECT id, name, category, rating, reviewCount, quietScore, verified, featuresJson FROM places WHERE id = ? LIMIT 1',
                [id],
            );

            if (!row) {
                return undefined;
            }

            return {
                id: row.id,
                name: row.name,
                category: row.category,
                rating: row.rating,
                reviewCount: row.reviewCount,
                quietScore: row.quietScore,
                verified: row.verified === 1,
                features: JSON.parse(row.featuresJson) as Place['features'],
            };
        },
        enabled: Boolean(id),
    });
}
