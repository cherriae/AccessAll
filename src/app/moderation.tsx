import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Appear } from '@/components/ui/appear';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState, LoadingState } from '@/components/ui/loading-state';
import { Notice } from '@/components/ui/notice';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useModerate, useModerationQueue } from '@/hooks/useModeration';
import { useIsStaff } from '@/hooks/useStaff';
import { formatRelativeTime } from '@/lib/format';
import type { ContentReportReason, ContentTargetType, ModerationItem } from '@/types';

const KIND_LABELS: Record<ContentTargetType, string> = {
  report: 'Report',
  comment: 'Comment',
  review: 'Review',
  direction: 'Directions',
};

const REASON_LABELS: Record<ContentReportReason, string> = {
  harassment: 'Harassment',
  spam: 'Spam',
  'false-info': 'False info',
  inappropriate: 'Inappropriate',
  other: 'Other',
};

/** Where staff can see the reported item in context. */
function contextRoute(item: ModerationItem) {
  return item.targetType === 'report' ? `/report/${item.targetId}` : null;
}

export default function ModerationScreen() {
  const router = useRouter();
  const staffQuery = useIsStaff();
  const isStaff = staffQuery.data ?? false;
  const queue = useModerationQueue(isStaff);
  const moderate = useModerate();
  const [error, setError] = useState<string | null>(null);

  async function decide(item: ModerationItem, decision: 'hide' | 'dismiss') {
    setError(null);
    try {
      await moderate.mutateAsync({ targetType: item.targetType, targetId: item.targetId, decision });
    } catch {
      setError('Could not save that decision. Please try again.');
    }
  }

  return (
    <Screen back>
      <PageHeader
        title="Moderation"
        subtitle="Content students have reported. Anything reported by three people is already hidden while it waits for you."
        icon="shield"
        accent="campus"
      />
      <Notice message={error} />
      {staffQuery.isLoading ? (
        <LoadingState />
      ) : !isStaff ? (
        <EmptyState icon="shield" title="Staff only" message="This page is for school staff accounts." />
      ) : queue.isLoading ? (
        <LoadingState label="Loading reports" />
      ) : queue.isError ? (
        <ErrorState title="Could not load reports" onRetry={() => queue.refetch()} />
      ) : (queue.data ?? []).length === 0 ? (
        <EmptyState icon="resolved" title="All clear" message="Nothing is waiting for review." />
      ) : (
        <View style={styles.list}>
          {queue.data!.map((item, index) => {
            const route = contextRoute(item);
            return (
              <Appear key={`${item.targetType}-${item.targetId}`} index={index}>
                <Card style={styles.card}>
                  <View style={styles.badges}>
                    <Badge label={KIND_LABELS[item.targetType]} accent="campus" />
                    <Badge label={`${item.reportCount} ${item.reportCount === 1 ? 'report' : 'reports'}`} accent="explore" />
                    {item.isHidden ? <Badge label="Hidden" accent="quiet" /> : null}
                  </View>
                  <Text>{item.content}</Text>
                  <Text variant="caption" color="textSecondary">
                    {item.reasons.map((reason) => REASON_LABELS[reason]).join(', ')} · first reported {formatRelativeTime(item.firstReportedAt).short}
                  </Text>
                  <View style={styles.actions}>
                    <Button label="Hide it" icon="shield" onPress={() => decide(item, 'hide')} disabled={moderate.isPending} />
                    <Button label={item.isHidden ? 'Restore it' : 'Keep it'} variant="outline" onPress={() => decide(item, 'dismiss')} disabled={moderate.isPending} />
                    {route ? <Button label="Open" variant="ghost" onPress={() => router.push(route as never)} /> : null}
                  </View>
                </Card>
              </Appear>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.three },
  card: { gap: Spacing.three },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
