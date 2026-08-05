import { features } from '@/data/mock';
import type { Feature } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useFeatures() {
    return useQuery<Feature[]>({
        queryKey: ['features'],
        queryFn: () => Promise.resolve(features),
    });
}

export function useAddFeature() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (payload: Omit<Feature, 'id'>) => {
            const newItem: Feature = { id: `f_${Date.now()}`, ...payload };
            qc.setQueryData<Feature[]>(['features'], (old = []) => [newItem, ...old]);
            return newItem;
        },
    });
}

export function useDeleteFeature() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            qc.setQueryData<Feature[]>(['features'], (old = []) => old.filter((f) => f.id !== id));
            return id;
        },
    });
}
