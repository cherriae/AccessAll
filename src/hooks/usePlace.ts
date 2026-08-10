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

export function usePlace(id?: string) {
    return useQuery<Place | null>({
        queryKey: ['place', id],
        queryFn: async () => {
            if (!id) {
                return null;
            }

            const row = await db.getFirstAsync<PlaceRow>(
                'SELECT id, name, category, rating, reviewCount, quietScore, verified, latitude, longitude, featuresJson, address, accessibilityNote, sourceLabel, sourceUrl, communityGuide, guideAuthor, guideUpdatedAt FROM places WHERE id = ? LIMIT 1',
                [id],
            );

            if (!row) {
                return null;
            }

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
        },
        // Map-search previews live only in memory until a review or guide is
        // published, so querying SQLite for their temporary IDs is meaningless.
        enabled: Boolean(id) && !id?.startsWith('geo_'),
    });
}
