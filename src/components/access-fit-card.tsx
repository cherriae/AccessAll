import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Spacing, type AccentName } from '@/constants/theme';
import { useAccent } from '@/hooks/use-theme';
import { useAccessNeeds } from '@/hooks/useSettings';
import { accessFit, type AccessFit } from '@/lib/access-fit';
import type { Place } from '@/types';

/** Colour bands for a fit score. Always shown with the number and words too. */
export function fitAccent(score: number): AccentName {
  return score >= 75 ? 'success' : score >= 40 ? 'explore' : 'campus';
}

export function fitSummary(fit: AccessFit): string {
  return `${fit.score}% fit for you · ${fit.confirmed.length} of ${fit.confirmed.length + fit.notConfirmed.length} needs confirmed`;
}

/** "How well does this place fit me?" on the place detail screen. */
export function AccessFitCard({ place }: { place: Pick<Place, 'features' | 'quietScore'> }) {
  const router = useRouter();
  const needs = useAccessNeeds();
  const fit = accessFit(place, needs);
  const palette = useAccent(fit ? fitAccent(fit.score) : 'campus');

  if (!fit) {
    return (
      <Card style={styles.card}>
        <Text variant="bodyStrong">How well does this place fit you?</Text>
        <Text color="textSecondary">Set up your access profile and every place shows what it offers for your needs.</Text>
        <Button label="Set up my access profile" variant="outline" icon="accessibility" onPress={() => router.push('/access-profile')} />
      </Card>
    );
  }

  return (
    <Card tint={palette.tint} borderColor={palette.tint} style={styles.card}>
      <Text variant="heading" colorValue={palette.fg}>{fitSummary(fit)}</Text>
      {fit.confirmed.map((label) => (
        <View key={label} style={styles.row} accessible accessibilityLabel={`${label}: confirmed`}>
          <Icon name="resolved" color={palette.fg} />
          <Text>{label}</Text>
        </View>
      ))}
      {fit.notConfirmed.map((label) => (
        <View key={label} style={styles.row} accessible accessibilityLabel={`${label}: not confirmed yet`}>
          <Icon name="help" color="textSecondary" />
          <Text color="textSecondary">{label}: not confirmed yet</Text>
        </View>
      ))}
      <Text variant="caption" color="textSecondary">
        Based on what the community has confirmed. If you visit, add what you find below.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
