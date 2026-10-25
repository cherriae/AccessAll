import type { LocationSelection, Report, ReportComment } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthSession } from '@/lib/auth-context';
import { toReport, toReportComment } from '@/lib/mappers';
import { requireUserId, supabase, unwrap, unwrapOne } from '@/lib/supabase';

/** Everything but the generated `location_point`, which arrives as a WKB blob. */
// One literal (not concatenated) so supabase-js can infer the row type from it.
const REPORT_COLUMNS =
    'id, title, location, latitude, longitude, status, created_by, created_at, upvotes, resolved_at, staff_note, staff_photo_path, staff_updated_by, staff_updated_at';

export function useReports() {
    return useQuery<Report[]>({
        queryKey: ['reports'],
        queryFn: async () => {
            const rows = unwrap(
                await supabase.from('reports').select(REPORT_COLUMNS).order('created_at', { ascending: false }).limit(200),
            );

            return rows.map(toReport);
        },
    });
}

export function useReport(id?: string) {
    return useQuery<Report | null>({
        queryKey: ['report', id],
        enabled: Boolean(id),
        queryFn: async () => {
            const row = unwrap(
                await supabase.from('reports').select(REPORT_COLUMNS).eq('id', id!).maybeSingle(),
            );

            return row ? toReport(row) : null;
        },
    });
}

export function useAddReport() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: { title: string; location: LocationSelection }) => {
            const userId = await requireUserId();

            const inserted = await supabase
                .from('reports')
                .insert({
                    title: payload.title.trim(),
                    // The picker only yields places the geocoder returned, so
                    // the name and the coordinates always describe each other.
                    location: payload.location.name.trim(),
                    latitude: payload.location.latitude,
                    longitude: payload.location.longitude,
                    created_by: userId,
                })
                .select('id')
                .single();

            const row = unwrapOne(inserted);

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['reports'] }),
                queryClient.invalidateQueries({ queryKey: ['currentUser'] }),
                queryClient.invalidateQueries({ queryKey: ['activity'] }),
                queryClient.invalidateQueries({ queryKey: ['impact'] }),
            ]);

            return row.id;
        },
    });
}

/**
 * Moves a report between open, in progress and resolved.
 *
 * Only the author may do this (`reports_update_own`). Selecting the row back
 * turns a policy refusal — which PostgREST reports as zero rows, not an error —
 * into a failure the screen can show.
 */
export function useUpdateReportStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: { id: string; status: Report['status'] }) => {
            await requireUserId();

            unwrapOne(
                await supabase
                    .from('reports')
                    .update({ status: payload.status })
                    .eq('id', payload.id)
                    .select('id')
                    .maybeSingle(),
                'Report could not be updated',
            );

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['reports'] }),
                queryClient.invalidateQueries({ queryKey: ['report', payload.id] }),
                queryClient.invalidateQueries({ queryKey: ['impact'] }),
            ]);
        },
    });
}

/** Deletes the signed-in user's own report, with its comments and upvotes. */
export function useDeleteReport() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            await requireUserId();

            unwrapOne(
                await supabase.from('reports').delete().eq('id', id).select('id').maybeSingle(),
                'Report could not be deleted',
            );

            queryClient.removeQueries({ queryKey: ['report', id] });
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['reports'] }),
                queryClient.invalidateQueries({ queryKey: ['currentUser'] }),
                queryClient.invalidateQueries({ queryKey: ['activity'] }),
                queryClient.invalidateQueries({ queryKey: ['impact'] }),
            ]);
        },
    });
}

export function useReportComments(reportId?: string) {
    return useQuery<ReportComment[]>({
        queryKey: ['reportComments', reportId],
        enabled: Boolean(reportId),
        queryFn: async () => {
            const rows = unwrap(
                await supabase
                    .from('report_comment_feed')
                    .select('*')
                    .eq('report_id', reportId!)
                    .order('created_at', { ascending: true })
                    .limit(500),
            );

            return rows.map(toReportComment);
        },
    });
}

export function useAddReportComment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ reportId, body }: { reportId: string; body: string }) => {
            const userId = await requireUserId();

            unwrap(
                await supabase.from('report_comments').insert({
                    report_id: reportId,
                    user_id: userId,
                    body: body.trim(),
                }),
            );

            await queryClient.invalidateQueries({ queryKey: ['reportComments', reportId] });
        },
    });
}

export function useDeleteReportComment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (comment: { id: string; reportId: string }) => {
            await requireUserId();

            unwrapOne(
                await supabase.from('report_comments').delete().eq('id', comment.id).select('id').maybeSingle(),
                'Comment could not be deleted',
            );

            await queryClient.invalidateQueries({ queryKey: ['reportComments', comment.reportId] });
        },
    });
}

/** Whether the signed-in user has marked this report as affecting them. */
export function useHasUpvoted(reportId?: string) {
    const { userId } = useAuthSession();

    return useQuery<boolean>({
        queryKey: ['reportUpvote', reportId, userId],
        enabled: Boolean(reportId && userId),
        queryFn: async () => {
            const row = unwrap(
                await supabase
                    .from('report_upvotes')
                    .select('report_id')
                    .eq('report_id', reportId!)
                    .eq('user_id', userId!)
                    .maybeSingle(),
            );

            return row !== null;
        },
    });
}

/**
 * Adds or removes the signed-in user from a report's "people affected" count.
 *
 * The count itself is a trigger-maintained column that clients cannot write, so
 * an upvote is exactly one row in `report_upvotes` — nobody can inflate a
 * report by hammering the button.
 */
export function useToggleReportUpvote() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (reportId: string) => {
            const userId = await requireUserId();

            const existing = unwrap(
                await supabase
                    .from('report_upvotes')
                    .select('report_id')
                    .eq('report_id', reportId)
                    .eq('user_id', userId)
                    .maybeSingle(),
            );

            if (existing) {
                unwrap(
                    await supabase
                        .from('report_upvotes')
                        .delete()
                        .eq('report_id', reportId)
                        .eq('user_id', userId),
                );
            } else {
                unwrap(
                    await supabase
                        .from('report_upvotes')
                        .insert({ report_id: reportId, user_id: userId }),
                );
            }

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['reports'] }),
                queryClient.invalidateQueries({ queryKey: ['report', reportId] }),
                queryClient.invalidateQueries({ queryKey: ['reportUpvote', reportId] }),
                queryClient.invalidateQueries({ queryKey: ['currentUser'] }),
                queryClient.invalidateQueries({ queryKey: ['impact'] }),
            ]);

            return !existing;
        },
    });
}
