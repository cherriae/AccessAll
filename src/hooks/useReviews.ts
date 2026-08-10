import type { Review } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../../db';

export function useReviews(placeId?: string) {
  return useQuery<Review[]>({
    queryKey: ['reviews', placeId],
    enabled: Boolean(placeId),
    queryFn: () => db.getAllAsync<Review>(
      `SELECT r.id, r.placeId, (u.firstName || ' ' || u.lastName) AS authorName,
              r.rating, r.quietScore, r.accessibilityNotes, r.createdAt
       FROM reviews r JOIN users u ON u.id = r.userId
       WHERE r.placeId = ? ORDER BY r.createdAt DESC`,
      [placeId!],
    ),
  });
}

export function useAddReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { placeId: string; rating: number; quietScore: number | null; accessibilityNotes: string }) => {
      const session = await db.getFirstAsync<{ userId: string }>('SELECT userId FROM session WHERE singleton = 1');
      if (!session) throw new Error('SIGN_IN_REQUIRED');
      const createdAt = new Date().toISOString();
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          'INSERT INTO reviews (id, placeId, userId, rating, quietScore, accessibilityNotes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [`rv_${Date.now()}`, payload.placeId, session.userId, payload.rating, payload.quietScore, payload.accessibilityNotes.trim(), createdAt],
        );
        await db.runAsync(
          `UPDATE places SET
             rating = ((COALESCE(rating, 0) * reviewCount) + ?) / (reviewCount + 1),
             quietScore = CASE WHEN ? IS NULL THEN quietScore ELSE ((COALESCE(quietScore, 0) * reviewCount) + ?) / (reviewCount + 1) END,
             reviewCount = reviewCount + 1 WHERE id = ?`,
          [payload.rating, payload.quietScore, payload.quietScore, payload.placeId],
        );
        await db.runAsync('UPDATE users SET reviews = reviews + 1 WHERE id = ?', [session.userId]);
        await db.runAsync(
          'INSERT INTO activity (id, kind, title, subtitle, occurredAt) SELECT ?, ?, ?, name, ? FROM places WHERE id = ?',
          [`a_${Date.now()}`, 'review', 'You added an accessibility review', createdAt, payload.placeId],
        );
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['reviews', payload.placeId] }),
        qc.invalidateQueries({ queryKey: ['place', payload.placeId] }),
        qc.invalidateQueries({ queryKey: ['places'] }),
        qc.invalidateQueries({ queryKey: ['currentUser'] }),
        qc.invalidateQueries({ queryKey: ['activity'] }),
      ]);
    },
  });
}
