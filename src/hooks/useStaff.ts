import type { ReportStatus } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthSession } from '@/lib/auth-context';
import { supabase, unwrap } from '@/lib/supabase';

/**
 * Whether the signed-in user is school staff. This only decides which controls
 * to show; `staff_update_report` checks membership again on the server.
 */
export function useIsStaff() {
    const { userId } = useAuthSession();

    return useQuery<boolean>({
        queryKey: ['isStaff', userId],
        enabled: Boolean(userId),
        queryFn: async () => unwrap(await supabase.rpc('is_staff', {})) === true,
    });
}

export function useStaffUpdateReport() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: { reportId: string; status: ReportStatus; note: string; photoPath?: string }) => {
            unwrap(
                await supabase.rpc('staff_update_report', {
                    report_id: payload.reportId,
                    new_status: payload.status,
                    note: payload.note,
                    photo_path: payload.photoPath ?? '',
                }),
            );

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['reports'] }),
                queryClient.invalidateQueries({ queryKey: ['report', payload.reportId] }),
                queryClient.invalidateQueries({ queryKey: ['impact'] }),
            ]);
        },
    });
}
