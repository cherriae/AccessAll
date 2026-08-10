import type { AppSettings } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../../db';

type SettingsRow = {
  notificationsEnabled: number;
  reportUpdatesEnabled: number;
  voteRemindersEnabled: number;
  campusName: string;
};

export function useSettings() {
  return useQuery<AppSettings>({
    queryKey: ['settings'],
    queryFn: async () => {
      const row = await db.getFirstAsync<SettingsRow>('SELECT notificationsEnabled, reportUpdatesEnabled, voteRemindersEnabled, campusName FROM app_settings WHERE singleton = 1');
      return {
        notificationsEnabled: row?.notificationsEnabled === 1,
        reportUpdatesEnabled: row?.reportUpdatesEnabled === 1,
        voteRemindersEnabled: row?.voteRemindersEnabled === 1,
        campusName: row?.campusName ?? '',
      };
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: AppSettings) => {
      await db.runAsync(
        'UPDATE app_settings SET notificationsEnabled = ?, reportUpdatesEnabled = ?, voteRemindersEnabled = ?, campusName = ? WHERE singleton = 1',
        [settings.notificationsEnabled ? 1 : 0, settings.reportUpdatesEnabled ? 1 : 0, settings.voteRemindersEnabled ? 1 : 0, settings.campusName.trim()],
      );
      qc.setQueryData(['settings'], settings);
    },
  });
}
