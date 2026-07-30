import { StyleSheet, View, type ViewProps } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface CardProps extends ViewProps {
  /** Background fill. `tint` takes an accent tint for emphasis blocks. */
  tint?: string;
  /** Border color override, normally paired with `tint`. */
  borderColor?: string;
  /** Set false when children manage their own padding (e.g. full-bleed lists). */
  padded?: boolean;
}

/**
 * Standard raised container: 1px outline, no drop shadow.
 *
 * Outlines rather than shadows, deliberately — they survive dark mode without
 * turning to mud, hold up in Windows high-contrast mode, and keep the UI
 * reading crisp at any elevation.
 */
export function Card({ tint, borderColor, padded = true, style, ...rest }: CardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tint ?? theme.surface,
          borderColor: borderColor ?? theme.border,
        },
        padded ? styles.padded : null,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  padded: {
    padding: Spacing.three,
  },
});
