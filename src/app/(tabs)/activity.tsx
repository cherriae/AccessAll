import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";

import { ActivityRow } from "@/components/activity-row";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, LoadingState } from "@/components/ui/loading-state";
import { Screen } from "@/components/ui/screen";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Spacing } from "@/constants/theme";
import { useActivity, useMarkActivitySeen } from "@/hooks/useActivity";
import { useAuthSession } from "@/lib/auth-context";
import type { ActivityEvent } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;

interface ActivityGroup {
  title: string;
  events: ActivityEvent[];
}

/**
 * Buckets events into Today / This week / Earlier.
 *
 * Assumes `events` is already newest-first, which is the order the feed is
 * served in; groups keep that relative order.
 */
function groupByRecency(
  events: ActivityEvent[],
  now = Date.now(),
): ActivityGroup[] {
  const groups: ActivityGroup[] = [
    { title: "Today", events: [] },
    { title: "This week", events: [] },
    { title: "Earlier", events: [] },
  ];

  for (const event of events) {
    const age = now - new Date(event.occurredAt).getTime();
    const bucket = age < DAY_MS ? 0 : age < 7 * DAY_MS ? 1 : 2;
    groups[bucket].events.push(event);
  }

  return groups.filter((group) => group.events.length > 0);
}

export default function ActivityScreen() {
  const router = useRouter();
  const { userId, isReady } = useAuthSession();
  const activityQuery = useActivity();
  const markSeen = useMarkActivitySeen();
  const groups = groupByRecency(activityQuery.data ?? []);

  // Opening the feed is what "reading" a notification means, so clear the
  // unread badge each time this tab comes into focus.
  const { mutate: markSeenNow } = markSeen;
  const { refetch } = activityQuery;
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      refetch();
      markSeenNow();
    }, [userId, markSeenNow, refetch]),
  );

  return (
    <Screen>
      <PageHeader
        title="Your activity"
        subtitle="What you've reported, reviewed and voted on, plus replies and progress on reports you follow."
        icon="activity"
        accent="community"
      />

      {isReady && !userId ? (
        <>
          <EmptyState
            icon="profile"
            title="Sign in to see your activity"
            message="Your reports, reviews, votes and replies to them appear here."
          />
          <Button label="Sign in" onPress={() => router.push("/auth" as never)} block />
        </>
      ) : activityQuery.isLoading || !isReady ? (
        <LoadingState label="Loading activity" />
      ) : activityQuery.isError ? (
        <ErrorState title="Could not load your activity" onRetry={() => activityQuery.refetch()} />
      ) : groups.length > 0 ? (
        groups.map((group) => (
          <Section key={group.title} title={group.title}>
            <View style={styles.list}>
              {group.events.map((event) => (
                <ActivityRow
                  key={event.id}
                  event={event}
                  onPress={
                    event.reportId
                      ? () => router.push(`/report/${event.reportId}` as never)
                      : undefined
                  }
                />
              ))}
            </View>
          </Section>
        ))
      ) : (
        <EmptyState
          icon="activity"
          title="No activity yet"
          message="Report a barrier or review a place, and it will show up here."
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
});
