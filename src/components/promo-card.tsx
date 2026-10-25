import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconChip } from '@/components/ui/icon-chip';
import type { IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Spacing, type AccentName } from '@/constants/theme';

export interface PromoCardProps {
  icon: IconName;
  accent: AccentName;
  title: string;
  body: string;
  action: string;
  onPress: () => void;
}

/** An invitation to try a feature: icon, one sentence, one button. */
export function PromoCard({ icon, accent, title, body, action, onPress }: PromoCardProps) {
  return (
    <Card style={styles.card}>
      <IconChip name={icon} accent={accent} />
      <View style={styles.text}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="callout" color="textSecondary">{body}</Text>
      </View>
      <Button label={action} variant="tonal" accent={accent} onPress={onPress} accessibilityLabel={`${action}: ${title}`} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, flexWrap: 'wrap' },
  text: { flex: 1, minWidth: 180, gap: Spacing.half },
});
