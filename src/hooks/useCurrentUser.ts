import { currentUser } from '@/data/mock';
import type { User } from '@/types';
import { useQuery } from '@tanstack/react-query';

export function useCurrentUser() {
    return useQuery<User | null>({
        queryKey: ['currentUser'],
        queryFn: () => Promise.resolve(currentUser ?? null),
    });
}
