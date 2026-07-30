import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { useAccent, useTheme } from '@/hooks/use-theme';

export interface AppHeaderProps {
  /** Unread count on the notifications bell. Hidden when 0. */
  notificationCount?: number;
  onPressNotifications?: () => void;
}

/**
 * The app's top bar: brand mark on the left, notifications on the right.
 *
 * There is no hamburger — the five-tab bar is the app's navigation, and a
 * parallel drawer would mean two competing ways to reach the same screens.
 */
export function AppHeader({ notificationCount = 0, onPressNotifications }: AppHeaderProps) {
  const theme = useTheme();
  const brand = useAccent('campus');

  const hasUnread = notificationCount > 0;

  return (
    <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
      {/* One accessible element: assistive tech reads "AccessAll" once rather
          than treating the logo and the wordmark as two separate stops. */}
      <View style={styles.brand} accessible accessibilityRole="header" accessibilityLabel="AccessAll">
        <View style={[styles.mark, { backgroundColor: brand.solid }]}>
          <Icon name="accessibility" size={22} color={brand.onSolid} />
        </View>
        <Text variant="heading" style={styles.wordmark}>
          AccessAll
        </Text>
      </View>

      <Pressable
        onPress={onPressNotifications}
        accessibilityRole="button"
        accessibilityLabel={
          hasUnread
            ? `Notifications, ${notificationCount} unread`
            : 'Notifications, none unread'
        }
        hitSlop={Spacing.two}
        style={({ pressed }) => [
          styles.bell,
          pressed ? { backgroundColor: theme.backgroundElement } : null,
        ]}
      >
        <Icon name="notifications" size={24} color="textSecondary" />
        {hasUnread ? (
          // Decorative: the count is already in the button's label above.
          <View style={[styles.dot, { backgroundColor: theme.danger, borderColor: theme.surface }]} />
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    // Lets the wordmark shrink before the bell gets pushed off screen.
    flexShrink: 1,
  },
  mark: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  wordmark: {
    flexShrink: 1,
  },
  bell: {
    width: MinTouchTarget,
    height: MinTouchTarget,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 11,
    height: 11,
    borderRadius: Radius.full,
    borderWidth: 2,
  },
});
