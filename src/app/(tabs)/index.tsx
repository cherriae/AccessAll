import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { ActivityRow } from "@/components/activity-row";
import { AppHeader } from "@/components/app-header";
import { FeatureCard } from "@/components/feature-card";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { Heading } from "@/components/ui/text";
import { VerifiedCallout } from "@/components/verified-callout";
import { VoteCallout } from "@/components/vote-callout";
import { Spacing } from "@/constants/theme";
import { useActivity } from "@/hooks/useActivity";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useFeatures } from "@/hooks/useFeatures";
import { usePolls, useVotePoll } from "@/hooks/usePolls";

/** How many recent events the home screen previews before "View all". */
const ACTIVITY_PREVIEW_COUNT = 3;

export default function HomeScreen() {
  const router = useRouter();
  const currentUser = useCurrentUser().data;
  const featuresQuery = useFeatures();
  const activityQuery = useActivity();
  const pollsQuery = usePolls();
  const votePoll = useVotePoll();

  const recent = activityQuery.data?.slice(0, ACTIVITY_PREVIEW_COUNT) ?? [];
  const openPoll =
    pollsQuery.data?.find((poll) => !poll.hasVoted) ?? pollsQuery.data?.[0];
  const notificationCount = activityQuery.data?.length ?? 0;

  return (
    <Screen
      header={
        <AppHeader
          notificationCount={notificationCount}
          // The activity feed is the notification surface for now; when a
          // dedicated notifications screen exists, point this at it.
          onPressNotifications={() => router.push("/activity")}
        />
      }
    >
      <Heading variant="display">
        Welcome back, {currentUser?.firstName ?? "friend"}!
      </Heading>

      <View style={styles.grid}>
        {(featuresQuery.data ?? []).map((feature) => (
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
        action={{ label: "View all", onPress: () => router.push("/activity") }}
      >
        <View style={styles.list}>
          {recent.map((event) => (
            <ActivityRow
              key={event.id}
              event={event}
              onPress={() => router.push("/activity")}
            />
          ))}
        </View>
      </Section>

      {openPoll ? (
        <VoteCallout
          poll={openPoll}
          onVote={(poll) => votePoll.mutate(poll.id)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.three,
  },
  list: {
    gap: Spacing.two,
  },
});
