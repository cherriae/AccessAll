import { places } from '@/data/mock';
import type { Place } from '@/types';
import { useQuery } from '@tanstack/react-query';

export function usePlace(id?: string) {
    return useQuery<Place | undefined>({
        queryKey: ['place', id],
        queryFn: () => Promise.resolve(places.find((p) => p.id === id)),
        enabled: Boolean(id),
    });
}
