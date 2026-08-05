import { polls } from '@/data/mock';
import type { Poll } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function usePolls() {
    return useQuery<Poll[]>({
        queryKey: ['polls'],
        queryFn: () => Promise.resolve(polls),
    });
}

export function useAddPoll() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (payload: Omit<Poll, 'id' | 'hasVoted'>) => {
            const newItem: Poll = { id: `p_${Date.now()}`, hasVoted: false, ...payload } as Poll;
            qc.setQueryData<Poll[]>(['polls'], (old = []) => [newItem, ...old]);
            return newItem;
        },
    });
}

export function useDeletePoll() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            qc.setQueryData<Poll[]>(['polls'], (old = []) => old.filter((p) => p.id !== id));
            return id;
        },
    });
}
