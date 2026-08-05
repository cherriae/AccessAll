import { activity } from '@/data/mock';
import type { ActivityEvent } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useActivity() {
    return useQuery<ActivityEvent[]>({
        queryKey: ['activity'],
        queryFn: () => Promise.resolve(activity),
    });
}

export function useAddActivity() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (payload: Omit<ActivityEvent, 'id'>) => {
            const newItem: ActivityEvent = { id: `a_${Date.now()}`, ...payload };
            qc.setQueryData<ActivityEvent[]>(['activity'], (old = []) => [newItem, ...old]);
            return newItem;
        },
    });
}

export function useDeleteActivity() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            qc.setQueryData<ActivityEvent[]>(['activity'], (old = []) => old.filter((a) => a.id !== id));
            return id;
        },
    });
}

