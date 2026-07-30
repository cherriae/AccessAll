import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { currentUser } from '@/data/mock';
import { formatCount } from '@/lib/format';
import { useAccent } from '@/hooks/use-theme';
import type { IconName } from '@/components/ui/icon';
import type { AccentName } from '@/constants/theme';

interface SettingsItem {
  id: string;
  title: string;
  subtitle: string;
  icon: IconName;
  accent: AccentName;
}

const SETTINGS: SettingsItem[] = [
  {
    id: 'access',
    title: 'Accessibility preferences',
    subtitle: 'Text size, motion, screen reader hints',
    icon: 'accessibility',
    accent: 'campus',
  },
  {
    id: 'notifications',
    title: 'Notifications',
    subtitle: 'Report updates and open votes',
    icon: 'notifications',
    accent: 'community',
  },
  {
    id: 'verified',
    title: 'Verified places',
    subtitle: 'How verification works',
    icon: 'verified',
    accent: 'verified',
  },
  {
    id: 'help',
    title: 'Help and feedback',
    subtitle: 'Get support or suggest an improvement',
    icon: 'help',
    accent: 'explore',
  },
];

export default function ProfileScreen() {
  const brand = useAccent('campus');

  const initials = `${currentUser.firstName.at(0) ?? ''}${currentUser.lastName.at(0) ?? ''}`;
  const fullName = `${currentUser.firstName} ${currentUser.lastName}`;

  const stats = [
    { label: 'Reports', value: currentUser.stats.reports },
    { label: 'Reviews', value: currentUser.stats.reviews },
    { label: 'Votes', value: currentUser.stats.votes },
  ];

  return (
    <Screen>
      <Card style={styles.identity}>
        {/* Initials are decorative — the name is right beside them in text. */}
        <View style={[styles.avatar, { backgroundColor: brand.tint }]}>
          <Text variant="title" colorValue={brand.fg} accessibilityElementsHidden>
            {initials}
          </Text>
        </View>
        <View style={styles.identityBody}>
          <Text variant="heading" accessibilityRole="header">
            {fullName}
          </Text>
          <Text variant="callout" color="textSecondary">
            {currentUser.affiliation}
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
              onPress={() => {
                // TODO: wire up once the settings screens exist.
              }}
            />
          ))}
        </View>
      </Section>

      <Section title="Account">
        <ListRow
          icon="sign-out"
          accent="explore"
          title="Sign out"
          onPress={() => {
            // TODO: clear the session once auth exists.
          }}
          accessibilityHint="Signs you out of AccessAll"
        />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  identityBody: {
    flex: 1,
    gap: Spacing.half,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
  },
  list: {
    gap: Spacing.two,
  },
});
