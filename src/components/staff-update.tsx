import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { PhotoPicker, StoredPhoto } from '@/components/photo-picker';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipGroup } from '@/components/ui/chip-group';
import { FormField } from '@/components/ui/form-field';
import { Notice } from '@/components/ui/notice';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-theme';
import { useStaffUpdateReport } from '@/hooks/useStaff';
import { REPORT_STATUS_DISPLAY } from '@/lib/display';
import { formatRelativeTime } from '@/lib/format';
import { REPORT_STATUSES, type Report, type ReportStatus } from '@/types';

/** The school's latest word on a report, with photo proof when there is one. */
export function StaffUpdateCard({ report }: { report: Report }) {
  const palette = useAccent('success');
  const update = report.staffUpdate;
  if (!update) return null;

  return (
    <Card tint={palette.tint} borderColor={palette.tint} style={styles.card}>
      <Text variant="overline" colorValue={palette.fg} uppercase>
        Update from school staff · {formatRelativeTime(update.updatedAt).short}
      </Text>
      {update.note ? <Text>{update.note}</Text> : null}
      {update.photoPath ? <StoredPhoto path={update.photoPath} label="Photo from school staff showing the update" /> : null}
    </Card>
  );
}

/**
 * Controls for school staff: move any report forward and attach a note and
 * photo. The server re-checks staff membership; this only decides visibility.
 */
export function StaffControls({ report }: { report: Report }) {
  const staffUpdate = useStaffUpdateReport();
  const [status, setStatus] = useState<ReportStatus>(report.status);
  const [note, setNote] = useState(report.staffUpdate?.note ?? '');
  const [photoPath, setPhotoPath] = useState<string | undefined>(report.staffUpdate?.photoPath);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);

  async function submit() {
    if (status === 'resolved' && !note.trim() && !photoPath) {
      setMessage({ text: 'Say what was fixed, or add a photo, so students can see the barrier is gone.', tone: 'error' });
      return;
    }
    setMessage(null);
    try {
      await staffUpdate.mutateAsync({ reportId: report.id, status, note, photoPath });
      setMessage({ text: 'Update posted. The reporter and everyone affected will be notified.', tone: 'success' });
    } catch {
      setMessage({ text: 'Could not post the update. Please try again.', tone: 'error' });
    }
  }

  return (
    <Card style={styles.card}>
      <Text variant="bodyStrong">Staff update</Text>
      <ChipGroup
        label="Status"
        options={REPORT_STATUSES.map((value) => ({ value, label: REPORT_STATUS_DISPLAY[value].label }))}
        value={status}
        onChange={setStatus}
      />
      <FormField label="Note to students" value={note} onChangeText={setNote} multiline maxLength={2000} placeholder="e.g. The ramp was cleared and a no-parking sign added." />
      <PhotoPicker label="Photo of the fix" value={photoPath} onChange={setPhotoPath} />
      <Notice message={message?.text} tone={message?.tone} />
      <Button label="Post update" onPress={submit} disabled={staffUpdate.isPending} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three },
});
