import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useAccents } from '@/hooks/use-theme';
import type { Feature } from '@/types';

export interface FeatureCardProps {
  feature: Feature;
  onPress: (feature: Feature) => void;
}

/**
 * A promoted product area on the home screen.
 *
 * The card itself is not pressable — only its button is. A card-sized tap target
 * that duplicates a visible button gives screen-reader users two entries for one
 * action and makes the real button ambiguous.
 */
export function FeatureCard({ feature, onPress }: FeatureCardProps) {
  const palette = useAccents()[feature.accent];

  return (
    <Card tint={palette.tint} borderColor={palette.tint} style={styles.card}>
      <View style={styles.body}>
        <Icon name={feature.icon} size={32} color={palette.fg} />
        <Text variant="subheading">{feature.title}</Text>
        <Text variant="callout" color="textSecondary">
          {feature.description}
        </Text>
      </View>

      <Button
        label={feature.action}
        accent={feature.accent}
        onPress={() => onPress(feature)}
        block
        accessibilityLabel={`${feature.action}. ${feature.title}`}
        accessibilityHint={feature.description}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    // Cards sit in a wrapping row; each takes half the width and grows to fill
    // a partial final row. `minWidth` forces a single column on narrow phones
    // and at large font scales rather than crushing the text.
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 210,
    // Buttons line up across cards even when descriptions differ in length.
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  body: {
    gap: Spacing.two,
  },
});
