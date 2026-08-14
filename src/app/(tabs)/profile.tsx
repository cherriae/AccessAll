import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Card } from "@/components/ui/card";
import type { IconName } from "@/components/ui/icon";
import { ListRow } from "@/components/ui/list-row";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import type { AccentName } from "@/constants/theme";
import { Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/hooks/use-theme";
import { useSignOut } from "@/hooks/useAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { formatCount } from "@/lib/format";

interface SettingsItem {
  id: string;
  title: string;
  subtitle: string;
  icon: IconName;
  accent: AccentName;
}

const SETTINGS: SettingsItem[] = [
  {
    id: "access",
    title: "Accessibility preferences",
    subtitle: "Text size, motion, screen reader hints",
    icon: "accessibility",
    accent: "campus",
  },
  {
    id: "notifications",
    title: "Notifications",
    subtitle: "Report updates and open votes",
    icon: "notifications",
    accent: "community",
  },
  {
    id: "help",
    title: "Help and feedback",
    subtitle: "Get support or suggest an improvement",
    icon: "help",
    accent: "explore",
  },
];

export default function ProfileScreen() {
  const router = useRouter();
  const brand = useAccent("campus");
  const currentUser = useCurrentUser().data;
  const signOut = useSignOut();

  const initials = currentUser
    ? `${currentUser.firstName.at(0) ?? ""}${currentUser.lastName.at(0) ?? ""}`
    : "GA";
  const fullName = currentUser
    ? `${currentUser.firstName} ${currentUser.lastName}`
    : "Guest access";

  const stats = [
    { label: "Reports", value: currentUser?.stats.reports ?? 0 },
    { label: "Reviews", value: currentUser?.stats.reviews ?? 0 },
    { label: "Votes", value: currentUser?.stats.votes ?? 0 },
  ];

  return (
    <Screen>
      <Card style={styles.identity}>
        {/* Initials are decorative — the name is right beside them in text. */}
        <View style={[styles.avatar, { backgroundColor: brand.tint }]}>
          <Text
            variant="title"
            colorValue={brand.fg}
            accessibilityElementsHidden
          >
            {initials}
          </Text>
        </View>
        <View style={styles.identityBody}>
          <Text variant="heading" accessibilityRole="header">
            {fullName}
          </Text>
          <Text variant="callout" color="textSecondary">
            {currentUser?.affiliation ?? "Sign in to sync your stats"}
          </Text>
        </View>
      </Card>

      <View style={styles.stats}>
        {stats.map((stat) => (
          <Card
            key={stat.label}
            style={styles.stat}
            accessible
            accessibilityLabel={`${formatCount(stat.value)} ${stat.label.toLowerCase()}`}
          >
            <Text variant="title">{formatCount(stat.value)}</Text>
            <Text variant="caption" color="textSecondary">
              {stat.label}
            </Text>
          </Card>
        ))}
      </View>

      <Section title="Settings">
        <View style={styles.list}>
          {SETTINGS.map((item) => (
            <ListRow
              key={item.id}
              icon={item.icon}
              accent={item.accent}
              title={item.title}
              subtitle={item.subtitle}
              onPress={() => router.push('/settings' as never)}
            />
          ))}
        </View>
      </Section>

      <Section title="Account">
        {currentUser ? (
          <ListRow icon="sign-out" accent="explore" title="Sign out" onPress={() => signOut.mutate()} accessibilityHint="Signs you out of AccessAll" />
        ) : (
          <ListRow icon="profile" accent="campus" title="Sign in or create an account" onPress={() => router.push('/auth' as never)} accessibilityHint="Opens account access" />
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  identityBody: {
    flex: 1,
    gap: Spacing.half,
  },
  stats: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: Spacing.half,
  },
  list: {
    gap: Spacing.two,
  },
});
