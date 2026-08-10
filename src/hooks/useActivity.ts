import type { ActivityEvent } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../../db';

export function useActivity() {
    return useQuery<ActivityEvent[]>({
        queryKey: ['activity'],
        queryFn: () =>
            db.getAllAsync<ActivityEvent>(
                'SELECT id, kind, title, subtitle, occurredAt FROM activity ORDER BY occurredAt DESC',
            ),
    });
}

export function useAddActivity() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (payload: Omit<ActivityEvent, 'id'>) => {
            const newItem: ActivityEvent = { id: `a_${Date.now()}`, ...payload };
            await db.runAsync(
                'INSERT INTO activity (id, kind, title, subtitle, occurredAt) VALUES (?, ?, ?, ?, ?)',
                [newItem.id, newItem.kind, newItem.title, newItem.subtitle, newItem.occurredAt],
            );
            qc.invalidateQueries({ queryKey: ['activity'] });
            return newItem;
        },
    });
}

export function useDeleteActivity() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await db.runAsync('DELETE FROM activity WHERE id = ?', [id]);
            qc.invalidateQueries({ queryKey: ['activity'] });
            return id;
        },
    });
}

