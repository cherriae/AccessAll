import type { Report, ReportComment } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { toReport, toReportComment } from '@/lib/mappers';
import { requireUserId, supabase, unwrap, unwrapOne } from '@/lib/supabase';

export function useSchoolReport() {
    return useQuery<Report[]>({
        queryKey: ['reports'],
        queryFn: async () => {
            const rows = unwrap(
                await supabase.from('reports').select('*').order('created_at', { ascending: false }),
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
                await supabase.from('reports').select('*').eq('id', id!).maybeSingle(),
            );

            return row ? toReport(row) : null;
        },
    });
}

export function useSchoolReportAdd() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: { title: string; location: string }) => {
            const userId = await requireUserId();

            const inserted = await supabase
                .from('reports')
                .insert({
                    title: payload.title.trim(),
                    location: payload.location.trim(),
                    status: 'open',
                    created_by: userId,
                })
                .select('id')
                .single();

            const row = unwrapOne(inserted);

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['reports'] }),
                queryClient.invalidateQueries({ queryKey: ['currentUser'] }),
                queryClient.invalidateQueries({ queryKey: ['activity'] }),
            ]);

            return row.id;
        },
    });
}

export function useSchoolReportUpdate() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: {
            id: string;
            title: string;
            location: string;
            status: Report['status'];
        }) => {
            unwrap(
                await supabase
                    .from('reports')
                    .update({
                        title: payload.title.trim(),
                        location: payload.location.trim(),
                        status: payload.status,
                    })
                    .eq('id', payload.id),
            );

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['reports'] }),
                queryClient.invalidateQueries({ queryKey: ['report', payload.id] }),
            ]);

            return payload.id;
        },
    });
}

export function useSchoolReportDelete() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            unwrap(await supabase.from('reports').delete().eq('id', id));

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['reports'] }),
                queryClient.invalidateQueries({ queryKey: ['currentUser'] }),
            ]);

            return id;
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
                    .order('created_at', { ascending: true }),
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
                queryClient.invalidateQueries({ queryKey: ['currentUser'] }),
            ]);

            return !existing;
        },
    });
}
