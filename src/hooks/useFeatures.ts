import type { Feature } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../../db';

export function useFeatures() {
    return useQuery<Feature[]>({
        queryKey: ['features'],
        queryFn: async () => {
            const rows = await db.getAllAsync<{
                id: string;
                title: string;
                description: string;
                action: string;
                route: Feature['route'];
                icon: Feature['icon'];
                accent: Feature['accent'];
            }>('SELECT id, title, description, action, route, icon, accent FROM features ORDER BY sortIndex ASC');

            return rows.map((row) => ({
                id: row.id,
                title: row.title,
                description: row.description,
                action: row.action,
                route: row.route,
                icon: row.icon,
                accent: row.accent,
            }));
        },
    });
}

export function useAddFeature() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (payload: Omit<Feature, 'id'>) => {
            const newItem: Feature = { id: `f_${Date.now()}`, ...payload };
            const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM features');
            const nextIndex = row?.count ?? 0;
            await db.runAsync(
                'INSERT INTO features (id, title, description, action, route, icon, accent, sortIndex) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [newItem.id, newItem.title, newItem.description, newItem.action, newItem.route, newItem.icon, newItem.accent, nextIndex],
            );
            qc.invalidateQueries({ queryKey: ['features'] });
            return newItem;
        },
    });
}

export function useDeleteFeature() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await db.runAsync('DELETE FROM features WHERE id = ?', [id]);
            qc.invalidateQueries({ queryKey: ['features'] });
            return id;
        },
    });
}
