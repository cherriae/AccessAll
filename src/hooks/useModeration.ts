import type { BlockedUser, ContentReportReason, ContentTargetType, ModerationItem, PlaceEdit } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthSession } from '@/lib/auth-context';
import { toBlockedUser, toModerationItem, toPlaceEdit } from '@/lib/mappers';
import { requireUserId, supabase, unwrap } from '@/lib/supabase';

/** Every query that could be showing content from a blocked or hidden author. */
const CONTENT_KEYS = ['reports', 'report', 'reportComments', 'reviews', 'directions', 'places', 'place', 'impact'];

function invalidateContent(queryClient: ReturnType<typeof useQueryClient>) {
    return Promise.all(CONTENT_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
}

/** Flags a report, comment, review or set of directions for staff. */
export function useReportContent() {
    return useMutation({
        mutationFn: async (payload: { targetType: ContentTargetType; targetId: string; reason: ContentReportReason; details: string }) => {
            const userId = await requireUserId();
            const result = await supabase.from('content_reports').insert({
                reporter_id: userId,
                target_type: payload.targetType,
                target_id: payload.targetId,
                reason: payload.reason,
                details: payload.details.trim(),
            });

            // Reporting the same thing twice is not an error worth showing.
            if (result.error && result.error.code !== '23505') throw new Error(result.error.message);
        },
    });
}

export function useBlockUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (blockedId: string) => {
            const userId = await requireUserId();
            const result = await supabase.from('user_blocks').insert({ blocker_id: userId, blocked_id: blockedId });
            if (result.error && result.error.code !== '23505') throw new Error(result.error.message);
            await Promise.all([invalidateContent(queryClient), queryClient.invalidateQueries({ queryKey: ['blocks'] })]);
        },
    });
}

export function useUnblockUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (blockedId: string) => {
            const userId = await requireUserId();
            unwrap(await supabase.from('user_blocks').delete().eq('blocker_id', userId).eq('blocked_id', blockedId));
            await Promise.all([invalidateContent(queryClient), queryClient.invalidateQueries({ queryKey: ['blocks'] })]);
        },
    });
}

export function useBlockedUsers() {
    const { userId } = useAuthSession();

    return useQuery<BlockedUser[]>({
        queryKey: ['blocks', userId],
        enabled: Boolean(userId),
        queryFn: async () => unwrap(await supabase.from('my_blocks').select('*').order('created_at', { ascending: false })).map(toBlockedUser),
    });
}

/** Open reports, one row per reported item. Staff only (RLS returns nothing to others). */
export function useModerationQueue(enabled: boolean) {
    return useQuery<ModerationItem[]>({
        queryKey: ['moderation'],
        enabled,
        queryFn: async () =>
            unwrap(await supabase.from('moderation_queue').select('*').order('first_reported_at', { ascending: true }).limit(100)).map(toModerationItem),
    });
}

export function useModerate() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: { targetType: ContentTargetType; targetId: string; decision: 'hide' | 'dismiss' }) => {
            unwrap(await supabase.rpc('moderate_content', { kind: payload.targetType, target: payload.targetId, decision: payload.decision }));
            await Promise.all([invalidateContent(queryClient), queryClient.invalidateQueries({ queryKey: ['moderation'] })]);
        },
    });
}

/** Who changed a place's access details, newest first. */
export function usePlaceEdits(placeId?: string) {
    return useQuery<PlaceEdit[]>({
        queryKey: ['placeEdits', placeId],
        enabled: Boolean(placeId),
        queryFn: async () =>
            unwrap(
                await supabase.from('place_edit_feed').select('*').eq('place_id', placeId!).order('created_at', { ascending: false }).limit(30),
            ).map(toPlaceEdit),
    });
}

export function useRevertPlaceEdit() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (edit: { id: string; placeId: string }) => {
            unwrap(await supabase.rpc('revert_place_edit', { edit_id: edit.id }));
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['placeEdits', edit.placeId] }),
                queryClient.invalidateQueries({ queryKey: ['place', edit.placeId] }),
                queryClient.invalidateQueries({ queryKey: ['places'] }),
            ]);
        },
    });
}
