import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-theme';

/**
 * Explains the Accessibility Verified badge.
 *
 * Informational only — no action, no press target. It exists so the badge on a
 * place row means something the first time a user sees it.
 */
export function VerifiedCallout() {
  const palette = useAccent('verified');

  return (
    <Card tint={palette.tint} borderColor={palette.tint} style={styles.card}>
      <Icon name="verified" size={30} color={palette.fg} />
      <View style={styles.body}>
        <Text variant="subheading">Accessibility Verified</Text>
        <Text variant="callout" color="textSecondary">
          Look for this badge on places that meet accessibility standards.
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  body: {
    flex: 1,
    gap: Spacing.half,
  },
});
