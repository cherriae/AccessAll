import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';

export interface EmptyStateProps {
  icon: IconName;
  title: string;
  /** Say what the user can do next, not just that the list is empty. */
  message: string;
}

export function EmptyState({ icon, title, message }: EmptyStateProps) {
  return (
    <View style={styles.wrapper} accessible accessibilityLabel={`${title}. ${message}`}>
      <Icon name={icon} size={32} color="textTertiary" />
      <Text variant="subheading" align="center">
        {title}
      </Text>
      <Text variant="callout" color="textSecondary" align="center">
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.three,
  },
});
