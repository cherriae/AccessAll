import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ChipGroup } from '@/components/ui/chip-group';
import { FormField } from '@/components/ui/form-field';
import { Icon } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { Heading, Text } from '@/components/ui/text';
import { MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useBlockUser, useReportContent } from '@/hooks/useModeration';
import { useAuthSession } from '@/lib/auth-context';
import { errorText } from '@/lib/errors';
import type { ContentReportReason, ContentTargetType } from '@/types';

const REASONS: { value: ContentReportReason; label: string }[] = [
  { value: 'harassment', label: 'Bullying or harassment' },
  { value: 'inappropriate', label: 'Inappropriate' },
  { value: 'false-info', label: 'False or unsafe info' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Something else' },
];

const NOUNS: Record<ContentTargetType, string> = {
  report: 'report',
  comment: 'comment',
  review: 'review',
  direction: 'directions',
};

export interface ReportContentProps {
  targetType: ContentTargetType;
  targetId: string;
  /** Lets the reporter block the author in the same step. */
  authorId?: string | null;
  authorName?: string;
}

/**
 * The small "Report" link under someone else's content, and the sheet it opens.
 *
 * Reporting reaches school staff; three separate reports hide the content at
 * once (0011). Blocking is offered alongside, because someone being harassed
 * usually wants it to stop, not just to be reviewed later.
 */
export function ReportContent({ targetType, targetId, authorId, authorName }: ReportContentProps) {
  const router = useRouter();
  const theme = useTheme();
  const { userId } = useAuthSession();
  const report = useReportContent();
  const block = useBlockUser();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ContentReportReason>('harassment');
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const noun = NOUNS[targetType];

  // Nothing to report about your own content.
  if (authorId && authorId === userId) return null;

  function openSheet() {
    if (!userId) { router.push('/auth'); return; }
    setError(null);
    setDone(false);
    setOpen(true);
  }

  async function submit() {
    setError(null);
    try {
      await report.mutateAsync({ targetType, targetId, reason, details });
      if (alsoBlock && authorId) await block.mutateAsync(authorId);
      setDone(true);
    } catch (caught) {
      setError(errorText(caught, 'Could not send your report. Please try again.'));
    }
  }

  return (
    <>
      <Pressable
        onPress={openSheet}
        accessibilityRole="button"
        accessibilityLabel={`Report this ${noun}`}
        hitSlop={Spacing.two}
        style={styles.trigger}
      >
        <Icon name="flag" size={14} color="textSecondary" />
        <Text variant="caption" color="textSecondary">Report</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          enabled={Platform.OS !== 'web'}
          style={styles.backdrop}
        >
          <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              {done ? (
                <>
                  <Heading variant="title">Thanks for telling us</Heading>
                  <Text color="textSecondary">
                    School staff will review this {noun}. If several people report it, it is hidden right away.
                    {alsoBlock && authorName ? ` You will no longer see anything from ${authorName}.` : ''}
                  </Text>
                  <Button label="Done" onPress={() => setOpen(false)} block />
                </>
              ) : (
                <>
                  <Heading variant="title">Report this {noun}</Heading>
                  <Text color="textSecondary">Only school staff see who reported it.</Text>
                  <ChipGroup label="What is wrong?" options={REASONS} value={reason} onChange={setReason} />
                  <FormField
                    label="Anything else staff should know? (optional)"
                    value={details}
                    onChangeText={setDetails}
                    multiline
                    maxLength={500}
                  />
                  {authorId ? (
                    <View style={styles.blockRow}>
                      <View style={styles.blockText}>
                        <Text variant="bodyStrong">Also block {authorName ?? 'this person'}</Text>
                        <Text variant="caption" color="textSecondary">Hide everything they post and stop their replies notifying you.</Text>
                      </View>
                      <Switch value={alsoBlock} onValueChange={setAlsoBlock} accessibilityLabel={`Also block ${authorName ?? 'this person'}`} />
                    </View>
                  ) : null}
                  <Notice message={error} />
                  <View style={styles.actions}>
                    <Button label="Cancel" variant="ghost" onPress={() => setOpen(false)} />
                    <Button label="Send report" onPress={submit} disabled={report.isPending || block.isPending} />
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, alignSelf: 'flex-start', minHeight: MinTouchTarget - 12 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, overflow: 'hidden' },
  content: { gap: Spacing.three, padding: Spacing.four, paddingBottom: Spacing.five },
  blockRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  blockText: { flex: 1, gap: Spacing.half },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
});
