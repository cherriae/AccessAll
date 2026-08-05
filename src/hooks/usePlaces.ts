import { places } from '@/data/mock';
import type { Place } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function usePlaces() {
    return useQuery<Place[]>({
        queryKey: ['places'],
        queryFn: () => Promise.resolve(places),
    });
}

export function useAddPlace() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (payload: Omit<Place, 'id'>) => {
            const newItem: Place = { id: `pl_${Date.now()}`, ...payload };
            qc.setQueryData<Place[]>(['places'], (old = []) => [newItem, ...old]);
            return newItem;
        },
    });
}

export function useDeletePlace() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            qc.setQueryData<Place[]>(['places'], (old = []) => old.filter((p) => p.id !== id));
            return id;
        },
    });
}
