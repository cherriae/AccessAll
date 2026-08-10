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
    latitude: number;
    longitude: number;
    address: string;
    accessibilityNote: string;
    sourceLabel: string;
    sourceUrl: string;
    communityGuide: string;
    guideAuthor: string;
    guideUpdatedAt: string;
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
        latitude: row.latitude,
        longitude: row.longitude,
        address: row.address || undefined,
        accessibilityNote: row.accessibilityNote || undefined,
        sourceLabel: row.sourceLabel || undefined,
        sourceUrl: row.sourceUrl || undefined,
        communityGuide: row.communityGuide || undefined,
        guideAuthor: row.guideAuthor || undefined,
        guideUpdatedAt: row.guideUpdatedAt || undefined,
        features: JSON.parse(row.featuresJson) as Place['features'],
    };
}

export function usePlaces() {
    return useQuery<Place[]>({
        queryKey: ['places'],
        queryFn: async () => {
            const rows = await db.getAllAsync<PlaceRow>(
                'SELECT id, name, category, rating, reviewCount, quietScore, verified, latitude, longitude, featuresJson, address, accessibilityNote, sourceLabel, sourceUrl, communityGuide, guideAuthor, guideUpdatedAt FROM places ORDER BY sortIndex ASC',
            );

            return rows.map(mapPlace);
        },
    });
}

export function useUpdatePlaceGuide() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (payload: { placeId: string; features: Place['features']; communityGuide: string }) => {
            const user = await db.getFirstAsync<{ firstName: string; lastName: string }>(
                `SELECT u.firstName, u.lastName FROM users u
                 JOIN session s ON s.userId = u.id WHERE s.singleton = 1 LIMIT 1`,
            );
            if (!user) throw new Error('AUTH_REQUIRED');

            const updatedAt = new Date().toISOString();
            await db.runAsync(
                `UPDATE places
                 SET featuresJson = ?, communityGuide = ?, guideAuthor = ?, guideUpdatedAt = ?
                 WHERE id = ?`,
                [JSON.stringify(payload.features), payload.communityGuide.trim(), `${user.firstName} ${user.lastName}`, updatedAt, payload.placeId],
            );
            await qc.invalidateQueries({ queryKey: ['places'] });
            await qc.invalidateQueries({ queryKey: ['place', payload.placeId] });
        },
    });
}

export function useAddPlace() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (payload: Omit<Place, 'id'>) => {
            const session = await db.getFirstAsync<{ userId: string }>(
                'SELECT userId FROM session WHERE singleton = 1',
            );
            if (!session) {
                throw new Error('AUTH_REQUIRED');
            }
            const duplicate = await db.getFirstAsync<{ id: string }>(
                `SELECT id FROM places
                 WHERE LOWER(name) = LOWER(?)
                   AND ABS(latitude - ?) < 0.0001
                   AND ABS(longitude - ?) < 0.0001
                 LIMIT 1`,
                [payload.name.trim(), payload.latitude, payload.longitude],
            );
            if (duplicate) {
                return { id: duplicate.id, ...payload };
            }
            const newItem: Place = { id: `pl_${Date.now()}`, ...payload };
            const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM places');
            const nextIndex = row?.count ?? 0;
            await db.runAsync(
                'INSERT INTO places (id, name, category, rating, reviewCount, quietScore, verified, latitude, longitude, featuresJson, address, accessibilityNote, sourceLabel, sourceUrl, sortIndex) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [newItem.id, newItem.name, newItem.category, newItem.rating, newItem.reviewCount, newItem.quietScore, newItem.verified ? 1 : 0, newItem.latitude, newItem.longitude, JSON.stringify(newItem.features), newItem.address ?? '', newItem.accessibilityNote ?? '', newItem.sourceLabel ?? '', newItem.sourceUrl ?? '', nextIndex],
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
