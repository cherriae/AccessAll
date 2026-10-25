import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AdvocacyLetterCard } from '@/components/advocacy-letter-card';
import { PlaceMap } from '@/components/place-map';
import { ReportContent } from '@/components/report-content';
import { StaffControls, StaffUpdateCard } from '@/components/staff-update';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipGroup } from '@/components/ui/chip-group';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { ErrorState, LoadingState } from '@/components/ui/loading-state';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Heading, Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useIsStaff } from '@/hooks/useStaff';
import {
  useAddReportComment,
  useDeleteReport,
  useDeleteReportComment,
  useHasUpvoted,
  useReport,
  useReportComments,
  useToggleReportUpvote,
  useUpdateReportStatus,
} from '@/hooks/useReports';
import { REPORT_STATUS_DISPLAY } from '@/lib/display';
import { errorText } from '@/lib/errors';
import { formatRelativeTime } from '@/lib/format';
import { REPORT_STATUSES, type Place, type Report } from '@/types';

export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const reportQuery = useReport(id);

  if (reportQuery.isLoading) return <Screen back><LoadingState label="Loading report" /></Screen>;
  if (reportQuery.isError) return <Screen back><ErrorState title="Could not load this report" onRetry={() => reportQuery.refetch()} /></Screen>;
  if (!reportQuery.data) return <Screen back><EmptyState icon="reports" title="Report not found" message="This report may have been removed." /></Screen>;

  return <ReportDetail report={reportQuery.data} />;
}

function ReportDetail({ report }: { report: Report }) {
  const router = useRouter();
  const comments = useReportComments(report.id).data ?? [];
  const user = useCurrentUser().data;
  const hasUpvoted = useHasUpvoted(report.id).data ?? false;
  const isStaff = useIsStaff().data ?? false;
  const updateStatus = useUpdateReportStatus();
  const deleteReport = useDeleteReport();
  const toggleUpvote = useToggleReportUpvote();
  const addComment = useAddReportComment();
  const deleteComment = useDeleteReportComment();
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Destructive actions take two taps: `Alert` confirmations do nothing on web.
  const [confirming, setConfirming] = useState<string | null>(null);

  // The map takes a list of places, and a report with a confirmed location is
  // exactly one point on it. Memoised because `PlaceMap` rebuilds its markers
  // whenever this array changes identity, which a fresh literal does on every
  // keystroke in the comment box.
  const pin = useMemo<Place[]>(() => {
    if (report.latitude === null || report.longitude === null) return [];
    return [{
      id: report.id,
      name: report.location,
      category: 'Reported barrier',
      rating: null,
      reviewCount: 0,
      quietScore: null,
      latitude: report.latitude,
      longitude: report.longitude,
      features: [],
    }];
  }, [report]);

  // The pin is the report you are already reading, so selecting it does nothing.
  const ignoreSelect = useCallback(() => {}, []);

  const status = REPORT_STATUS_DISPLAY[report.status];
  const isAuthor = Boolean(user && report.createdBy === user.id);

  async function run(action: () => Promise<unknown>, failure: string) {
    if (!user) { router.push('/auth' as never); return false; }
    setError(null);
    try {
      await action();
      return true;
    } catch (caught) {
      setError(errorText(caught, failure));
      return false;
    }
  }

  function confirmFirst(key: string) {
    if (confirming === key) { setConfirming(null); return true; }
    setConfirming(key);
    return false;
  }

  async function removeReport() {
    if (!confirmFirst('report')) return;
    if (await run(() => deleteReport.mutateAsync(report.id), 'Could not delete this report. Please try again.')) {
      router.replace('/reports');
    }
  }

  return (
    <Screen back>
      <View style={styles.intro}>
        <Heading variant="display">{report.title}</Heading>
        <Text color="textSecondary">{report.location} · filed {formatRelativeTime(report.createdAt).short}</Text>
        <Badge label={status.label} accent={status.accent} icon={status.icon} />
        <ReportContent targetType="report" targetId={report.id} authorId={report.createdBy} />
      </View>
      <Notice message={error} />
      <StaffUpdateCard report={report} />
      <Section title="Location">
        {pin.length > 0 ? (
          <PlaceMap places={pin} selectedId={report.id} onSelect={ignoreSelect} />
        ) : (
          <Text color="textSecondary">
            This report was filed before locations were confirmed against the map, so
            &ldquo;{report.location}&rdquo; is unverified text and cannot be shown as a pin.
          </Text>
        )}
      </Section>
      <Card style={styles.actions}>
        <Text variant="heading">
          {report.upvotes} {report.upvotes === 1 ? 'person' : 'people'} affected
        </Text>
        <Button
          label={!user ? 'Sign in to upvote' : hasUpvoted ? 'You are affected · Undo' : 'Mark me affected'}
          icon="upvote"
          variant={hasUpvoted ? 'outline' : 'solid'}
          onPress={() => run(() => toggleUpvote.mutateAsync(report.id), 'Could not save your upvote. Please try again.')}
          disabled={toggleUpvote.isPending}
        />
      </Card>
      {report.status !== 'resolved' ? (
        <AdvocacyLetterCard report={report} user={user} commentCount={comments.length} />
      ) : null}
      <Section title="Progress">
        {/*
          The author may change the status (`reports_update_own`); school staff
          use their own controls, which also carry a note and photo.
        */}
        {isStaff ? (
          <StaffControls report={report} />
        ) : isAuthor ? (
          <ChipGroup
            label="Report status"
            options={REPORT_STATUSES.map((value) => ({ value, label: REPORT_STATUS_DISPLAY[value].label }))}
            value={report.status}
            onChange={(next) => run(() => updateStatus.mutateAsync({ id: report.id, status: next }), 'Could not update the status. Please try again.')}
          />
        ) : (
          <Text color="textSecondary">
            {`Currently ${status.label.toLowerCase()}. The person who filed this report or school staff can change its status.`}
          </Text>
        )}
      </Section>
      <Section title="Discussion">
        <Card style={styles.form}>
          <FormField label="Add a comment" value={comment} onChangeText={setComment} multiline maxLength={2000} placeholder="Share an update or useful context" />
          <Button
            label={user ? 'Post comment' : 'Sign in to comment'}
            onPress={async () => {
              if (user && !comment.trim()) { setError('Write a comment before posting.'); return; }
              if (await run(() => addComment.mutateAsync({ reportId: report.id, body: comment }), 'Could not post your comment. Please try again.')) {
                setComment('');
              }
            }}
            disabled={addComment.isPending}
          />
        </Card>
        <View style={styles.list}>
          {comments.map((item) => {
            const isOwn = item.userId === user?.id;
            return (
              <Card key={item.id} style={styles.comment}>
                <View style={styles.commentHeader}>
                  <Text variant="bodyStrong">{isOwn ? 'You' : item.authorName}</Text>
                  <Text variant="caption" color="textSecondary">{formatRelativeTime(item.createdAt).short}</Text>
                </View>
                <Text>{item.body}</Text>
                {!isOwn ? <ReportContent targetType="comment" targetId={item.id} authorId={item.userId} authorName={item.authorName} /> : null}
                {isOwn ? (
                  <View style={styles.row}>
                    <Button
                      label={confirming === item.id ? 'Tap again to delete' : 'Delete'}
                      variant="ghost"
                      icon="delete"
                      onPress={() => {
                        if (confirmFirst(item.id)) run(() => deleteComment.mutateAsync(item), 'Could not delete your comment. Please try again.');
                      }}
                      disabled={deleteComment.isPending}
                    />
                  </View>
                ) : null}
              </Card>
            );
          })}
          {comments.length === 0 ? <Text color="textSecondary">No comments yet.</Text> : null}
        </View>
      </Section>
      {isAuthor ? (
        <Button
          label={confirming === 'report' ? 'Tap again to delete this report' : 'Delete report'}
          variant="outline"
          icon="delete"
          onPress={removeReport}
          disabled={deleteReport.isPending}
          block
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { alignItems: 'flex-start', gap: Spacing.two }, actions: { gap: Spacing.three },
  form: { gap: Spacing.three }, list: { gap: Spacing.two }, comment: { gap: Spacing.two },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  row: { flexDirection: 'row' },
});
