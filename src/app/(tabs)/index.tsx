import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ActivityRow } from '@/components/activity-row';
import { AppHeader } from '@/components/app-header';
import { FeatureCard } from '@/components/feature-card';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Heading } from '@/components/ui/text';
import { VerifiedCallout } from '@/components/verified-callout';
import { VoteCallout } from '@/components/vote-callout';
import { Spacing } from '@/constants/theme';
import {
  activity,
  currentUser,
  features,
  polls,
  unreadNotificationCount,
} from '@/data/mock';

/** How many recent events the home screen previews before "View all". */
const ACTIVITY_PREVIEW_COUNT = 3;

export default function HomeScreen() {
  const router = useRouter();

  const recent = activity.slice(0, ACTIVITY_PREVIEW_COUNT);
  const openPoll = polls.find((poll) => !poll.hasVoted) ?? polls[0];

  return (
    <Screen
      header={
        <AppHeader
          notificationCount={unreadNotificationCount}
          // The activity feed is the notification surface for now; when a
          // dedicated notifications screen exists, point this at it.
          onPressNotifications={() => router.push('/activity')}
        />
      }
    >
      <Heading variant="display">Welcome back, {currentUser.firstName}!</Heading>

      <View style={styles.grid}>
        {features.map((feature) => (
          <FeatureCard
            key={feature.id}
            feature={feature}
            onPress={(selected) => router.push(selected.route)}
          />
        ))}
      </View>

      <VerifiedCallout />

      <Section
        title="Recent activity"
        action={{ label: 'View all', onPress: () => router.push('/activity') }}
      >
        <View style={styles.list}>
          {recent.map((event) => (
            <ActivityRow key={event.id} event={event} />
          ))}
        </View>
      </Section>

      {openPoll ? <VoteCallout poll={openPoll} onVote={() => router.push('/reports')} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  list: {
    gap: Spacing.two,
  },
});
