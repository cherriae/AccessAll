import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useAccents } from '@/hooks/use-theme';
import type { AccentName } from '@/constants/theme';

export interface BadgeProps {
  label: string;
  accent?: AccentName;
  icon?: IconName;
  /**
   * Announced instead of `label` when the short visible text needs expanding,
   * e.g. "Accessible restroom available".
   */
  accessibilityLabel?: string;
}

/**
 * A small non-interactive pill for statuses and access features.
 *
 * Carries an icon alongside the text wherever one exists, so the meaning never
 * rests on color alone.
 */
export function Badge({ label, accent = 'community', icon, accessibilityLabel }: BadgeProps) {
  const palette = useAccents()[accent];

  return (
    <View
      style={[styles.badge, { backgroundColor: palette.tint }]}
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
    >
      {icon ? <Icon name={icon} size={13} color={palette.fg} /> : null}
      <Text variant="caption" colorValue={palette.fg} style={styles.label}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  label: {
    fontWeight: '600',
    flexShrink: 1,
  },
});
