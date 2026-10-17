import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { ActivityRow } from "@/components/activity-row";
import { AppHeader } from "@/components/app-header";
import { FeatureCard } from "@/components/feature-card";
import { HomeHero } from "@/components/home-hero";
import { Appear } from "@/components/ui/appear";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import { VoteCallout } from "@/components/vote-callout";
import { Spacing } from "@/constants/theme";
import { useActivity, useUnreadActivityCount } from "@/hooks/useActivity";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useFeatures } from "@/hooks/useFeatures";
import { usePolls } from "@/hooks/usePolls";

/** How many recent events the home screen previews before "View all". */
const ACTIVITY_PREVIEW_COUNT = 3;

export default function HomeScreen() {
  const router = useRouter();
  const currentUser = useCurrentUser().data;
  const featuresQuery = useFeatures();
  const activityQuery = useActivity();
  const pollsQuery = usePolls();

  const recent = activityQuery.data?.slice(0, ACTIVITY_PREVIEW_COUNT) ?? [];
  // Only polls still open come back; prefer one the user has not voted on.
  const openPoll =
    pollsQuery.data?.find((poll) => !poll.hasVoted) ?? pollsQuery.data?.[0];
  const notificationCount = useUnreadActivityCount();

  return (
    <Screen
      header={
        <AppHeader
          notificationCount={notificationCount}
          // Comments and status changes on your reports land in the activity
          // feed, which is where the unread count is cleared.
          onPressNotifications={() => router.push("/activity")}
        />
      }
    >
      <Appear>
        <HomeHero firstName={currentUser?.firstName} />
      </Appear>

      <View style={styles.grid}>
        {(featuresQuery.data ?? []).map((feature) => (
          <FeatureCard
            key={feature.id}
            feature={feature}
            onPress={(selected) => router.push(selected.route)}
          />
        ))}
      </View>

      <Section
        title="Recent activity"
        action={{ label: "View all", onPress: () => router.push("/activity") }}
      >
        <View style={styles.list}>
          {recent.map((event) => (
            <ActivityRow
              key={event.id}
              event={event}
              onPress={(item) =>
                router.push(
                  (item.reportId ? `/report/${item.reportId}` : "/activity") as never,
                )
              }
            />
          ))}
          {recent.length === 0 && !activityQuery.isLoading ? (
            <Text color="textSecondary">
              {currentUser
                ? "Nothing yet. Report a barrier or review a place to get started."
                : "Sign in to see your reports, reviews and replies here."}
            </Text>
          ) : null}
        </View>
      </Section>

      {openPoll ? (
        <VoteCallout poll={openPoll} />
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
