import { StyleSheet, View } from 'react-native';

import { ActivityRow } from '@/components/activity-row';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Heading, Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { activity } from '@/data/mock';
import type { ActivityEvent } from '@/types';

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
function groupByRecency(events: ActivityEvent[], now = Date.now()): ActivityGroup[] {
  const groups: ActivityGroup[] = [
    { title: 'Today', events: [] },
    { title: 'This week', events: [] },
    { title: 'Earlier', events: [] },
  ];

  for (const event of events) {
    const age = now - new Date(event.occurredAt).getTime();
    const bucket = age < DAY_MS ? 0 : age < 7 * DAY_MS ? 1 : 2;
    groups[bucket].events.push(event);
  }

  return groups.filter((group) => group.events.length > 0);
}

export default function ActivityScreen() {
  const groups = groupByRecency(activity);

  return (
    <Screen>
      <View style={styles.intro}>
        <Heading variant="title">Your activity</Heading>
        <Text variant="body" color="textSecondary">
          Everything you&rsquo;ve reported, reviewed, and voted on.
        </Text>
      </View>

      {groups.length > 0 ? (
        groups.map((group) => (
          <Section key={group.title} title={group.title}>
            <View style={styles.list}>
              {group.events.map((event) => (
                <ActivityRow key={event.id} event={event} />
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
  intro: {
    gap: Spacing.two,
  },
  list: {
    gap: Spacing.two,
  },
});
