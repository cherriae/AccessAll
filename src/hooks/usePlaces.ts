import type { Place } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

function mapPlace(row: PlaceRow): Place {
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
}

export function usePlaces() {
    return useQuery<Place[]>({
        queryKey: ['places'],
        queryFn: async () => {
            const rows = await db.getAllAsync<PlaceRow>(
                'SELECT id, name, category, rating, reviewCount, quietScore, verified, featuresJson FROM places ORDER BY sortIndex ASC',
            );

            return rows.map(mapPlace);
        },
    });
}

export function useAddPlace() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (payload: Omit<Place, 'id'>) => {
            const newItem: Place = { id: `pl_${Date.now()}`, ...payload };
            const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM places');
            const nextIndex = row?.count ?? 0;
            await db.runAsync(
                'INSERT INTO places (id, name, category, rating, reviewCount, quietScore, verified, featuresJson, sortIndex) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [newItem.id, newItem.name, newItem.category, newItem.rating, newItem.reviewCount, newItem.quietScore, newItem.verified ? 1 : 0, JSON.stringify(newItem.features), nextIndex],
            );
            qc.invalidateQueries({ queryKey: ['places'] });
            return newItem;
        },
    });
}

export function useDeletePlace() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await db.runAsync('DELETE FROM places WHERE id = ?', [id]);
            qc.invalidateQueries({ queryKey: ['places'] });
            return id;
        },
    });
}
