import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { IconChip } from '@/components/ui/icon-chip';
import { Text } from '@/components/ui/text';
import { MinTouchTarget, Radius, Spacing, type AccentName } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useTheme } from '@/hooks/use-theme';

export interface ListRowProps {
  icon: IconName;
  accent: AccentName;
  title: string;
  subtitle?: string;
  /** Right-aligned metadata, e.g. a relative timestamp or rating. */
  meta?: string;
  /** Extra content under the subtitle, e.g. a row of badges. */
  children?: ReactNode;
  onPress?: () => void;
  /**
   * Full spoken description of the row. Always pass this on pressable rows —
   * the default concatenation cannot know how to phrase `meta` (see
   * `formatRelativeTime`, which returns a `long` form for exactly this).
   */
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/**
 * One entry in a vertical list: tinted icon, title, optional subtitle and
 * trailing metadata.
 *
 * The row is a single accessibility element rather than four separate ones, so
 * a screen reader announces "You reported broken elevator, Lincoln High School,
 * 2 hours ago" in one pass instead of four disconnected fragments.
 */
export function ListRow({
  icon,
  accent,
  title,
  subtitle,
  meta,
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: ListRowProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();

  const label = accessibilityLabel ?? [title, subtitle, meta].filter(Boolean).join(', ');

  const content = (
    <>
      <IconChip name={icon} accent={accent} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text variant="bodyStrong" style={styles.title}>
            {title}
          </Text>
          {meta ? (
            <Text variant="caption" color="textTertiary" style={styles.meta}>
              {meta}
            </Text>
          ) : null}
        </View>
        {subtitle ? (
          <Text variant="callout" color="textSecondary">
            {subtitle}
          </Text>
        ) : null}
        {children}
      </View>
      {onPress ? <Icon name="chevron" size={18} color="textTertiary" /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={styles.row} accessible accessibilityLabel={label}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.row,
        pressed ? { backgroundColor: theme.backgroundElement } : null,
        pressed && !reduceMotion ? styles.pressedScale : null,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    minHeight: MinTouchTarget,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.md,
  },
  body: {
    // Without this the title cannot shrink and long text pushes `meta` offscreen.
    flex: 1,
    gap: Spacing.half,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
  },
  meta: {
    flexShrink: 0,
  },
  pressedScale: {
    transform: [{ scale: 0.995 }],
  },
});
