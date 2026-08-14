import type { AppSettings } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthSession } from '@/lib/auth-context';
import { toAppSettings } from '@/lib/mappers';
import { requireUserId, supabase, unwrap } from '@/lib/supabase';

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
