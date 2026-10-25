import type { AccessNeed, AppSettings } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthSession } from '@/lib/auth-context';
import { toAppSettings } from '@/lib/mappers';
import { requireUserId, supabase, unwrap, unwrapOne } from '@/lib/supabase';

/**
 * Notification preferences for the signed-in user.
 *
 * These follow the account rather than the device — the row is created by the
 * same trigger that creates the profile, and row level security makes it
 * readable only by its owner.
 */
export function useSettings() {
    const { userId, isReady } = useAuthSession();

    return useQuery<AppSettings>({
        queryKey: ['settings', userId],
        enabled: isReady,
        queryFn: async () => {
            if (!userId) {
                return toAppSettings(null);
            }

            const row = unwrap(
                await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
            );

            return toAppSettings(row);
        },
    });
}

export function useUpdateSettings() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (settings: AppSettings) => {
            const userId = await requireUserId();

            unwrap(
                await supabase.from('user_settings').upsert(
                    {
                        user_id: userId,
                        notifications_enabled: settings.notificationsEnabled,
                        report_updates_enabled: settings.reportUpdatesEnabled,
                        vote_reminders_enabled: settings.voteRemindersEnabled,
                        campus_name: settings.campusName.trim(),
                    },
                    { onConflict: 'user_id' },
                ),
            );

            await queryClient.invalidateQueries({ queryKey: ['settings'] });
        },
    });
}

/** Saves the access profile used to score places for this person. */
export function useUpdateAccessNeeds() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (needs: AccessNeed[]) => {
            const userId = await requireUserId();

            unwrapOne(
                await supabase
                    .from('user_settings')
                    .update({ access_needs: needs })
                    .eq('user_id', userId)
                    .select('user_id')
                    .maybeSingle(),
                'Access profile could not be saved',
            );

            await queryClient.invalidateQueries({ queryKey: ['settings'] });
        },
    });
}

/** Saves the stations Detour Radar watches (MTA complex ids, at most 10). */
export function useUpdateWatchedStations() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (stations: string[]) => {
            const userId = await requireUserId();

            unwrapOne(
                await supabase
                    .from('user_settings')
                    .update({ watched_stations: stations })
                    .eq('user_id', userId)
                    .select('user_id')
                    .maybeSingle(),
                'Your stations could not be saved',
            );

            await queryClient.invalidateQueries({ queryKey: ['settings'] });
        },
    });
}

/** The signed-in user's access needs; empty when signed out or not set. */
export function useAccessNeeds(): AccessNeed[] {
    return useSettings().data?.accessNeeds ?? EMPTY_NEEDS;
}

const EMPTY_NEEDS: AccessNeed[] = [];
