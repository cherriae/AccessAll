import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Shown while a query has no data yet.
 *
 * Without it, a list or detail screen rendered its empty state ("Report not
 * found", "Nothing here") during the first fetch, which tells a screen-reader
 * user something false.
 */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const theme = useTheme();

  return (
    <View style={styles.wrapper} accessible accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={theme.brand} />
      <Text variant="callout" color="textSecondary">
        {label}
      </Text>
    </View>
  );
}

/** Shown when a query failed, with a way to try again. */
export function ErrorState({
  title = 'Could not load this',
  onRetry,
}: {
  title?: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.error}>
      <EmptyState icon="help" title={title} message="Check your connection and try again." />
      <Button label="Try again" variant="outline" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  error: {
    alignItems: 'center',
    gap: Spacing.two,
  },
});
