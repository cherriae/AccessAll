import type { ImpactSummary, Report } from '@/types';
import { useQuery } from '@tanstack/react-query';

import { toImpactSummary, toReport } from '@/lib/mappers';
import { supabase, unwrap, unwrapOne } from '@/lib/supabase';

/**
 * Community-wide totals from the `impact_summary` view.
 *
 * Everything it counts is already public, so the numbers are the same for
 * every visitor, signed in or not.
 */
export function useImpactSummary() {
    return useQuery<ImpactSummary>({
        queryKey: ['impact'],
        queryFn: async () => toImpactSummary(unwrapOne(await supabase.from('impact_summary').select('*').single())),
    });
}

/** Unresolved reports affecting the most people: where a fix would matter most. */
export function useTopOpenReports(limit = 5) {
    return useQuery<Report[]>({
        queryKey: ['reports', 'top-open', limit],
        queryFn: async () => {
            const rows = unwrap(
                await supabase
                    .from('reports')
                    .select('id, title, location, latitude, longitude, status, created_by, created_at, upvotes, resolved_at, staff_note, staff_photo_path, staff_updated_by, staff_updated_at')
                    .neq('status', 'resolved')
                    .order('upvotes', { ascending: false })
                    .order('created_at', { ascending: true })
                    .limit(limit),
            );

            return rows.map(toReport);
        },
    });
}
