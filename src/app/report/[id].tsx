import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipGroup } from '@/components/ui/chip-group';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Heading, Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAddReportComment, useReport, useReportComments, useSchoolReportUpdate, useToggleReportUpvote } from '@/hooks/useSchoolReport';
import { REPORT_STATUS_DISPLAY } from '@/lib/display';
import { formatRelativeTime } from '@/lib/format';
import { REPORT_STATUSES } from '@/types';

export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const report = useReport(id).data;
  const comments = useReportComments(id).data ?? [];
  const user = useCurrentUser().data;
  const update = useSchoolReportUpdate();
  const toggleUpvote = useToggleReportUpvote();
  const addComment = useAddReportComment();
  const [comment, setComment] = useState('');

  if (!report) return <Screen><EmptyState icon="reports" title="Report not found" message="This report may have been removed." /></Screen>;
  const status = REPORT_STATUS_DISPLAY[report.status];
  const isAuthor = Boolean(user && report.createdBy === user.id);

  async function requireUser(action: () => Promise<unknown>) {
    if (!user) { router.push('/auth' as never); return; }
    try { await action(); } catch { Alert.alert('Could not save', 'Please try again.'); }
  }

  return (
    <Screen>
      <View style={styles.intro}>
        <Heading variant="display">{report.title}</Heading>
        <Text color="textSecondary">{report.location}</Text>
        <Badge label={status.label} accent={status.accent} icon={status.icon} />
      </View>
      <Card style={styles.actions}>
        <Text variant="heading">{report.upvotes} people affected</Text>
        <Button label={user ? 'Mark me affected' : 'Sign in to upvote'} icon="upvote" onPress={() => requireUser(() => toggleUpvote.mutateAsync(report.id))} />
      </Card>
      <Section title="Progress">
        {/*
          Only the author may change the status — `reports_update_own` enforces
          it in the database. Showing the control to everyone meant a non-author
          could tap it, have the update match zero rows, and watch the value
          silently snap back with no explanation.
        */}
        {isAuthor ? (
          <ChipGroup
            label="Report status"
            options={REPORT_STATUSES.map((value) => ({ value, label: REPORT_STATUS_DISPLAY[value].label }))}
            value={report.status}
            onChange={(next) => requireUser(() => update.mutateAsync({ id: report.id, title: report.title, location: report.location, status: next }))}
          />
        ) : (
          <Text color="textSecondary">
            {`Currently ${status.label.toLowerCase()}. Only the person who filed this report can change its status.`}
          </Text>
        )}
      </Section>
      <Section title="Discussion">
        <Card style={styles.form}>
          <FormField label="Add a comment" value={comment} onChangeText={setComment} multiline placeholder="Share an update or useful context" />
          <Button
            label={user ? 'Post comment' : 'Sign in to comment'}
            onPress={() => requireUser(async () => {
              if (!comment.trim()) return;
              await addComment.mutateAsync({ reportId: report.id, body: comment });
              setComment('');
            })}
            disabled={addComment.isPending}
          />
        </Card>
        <View style={styles.list}>
          {comments.map((item) => (
            <Card key={item.id} style={styles.comment}>
              <View style={styles.commentHeader}>
                <Text variant="bodyStrong">{item.authorName}</Text>
                <Text variant="caption" color="textTertiary">{formatRelativeTime(item.createdAt).short}</Text>
              </View>
              <Text>{item.body}</Text>
            </Card>
          ))}
          {comments.length === 0 ? <Text color="textSecondary">No comments yet.</Text> : null}
        </View>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { alignItems: 'flex-start', gap: Spacing.two }, actions: { gap: Spacing.three },
  form: { gap: Spacing.three }, list: { gap: Spacing.two }, comment: { gap: Spacing.two },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
});
