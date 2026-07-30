import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { MinTouchTarget, Radius, Spacing, type AccentName } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useAccents, useTheme } from '@/hooks/use-theme';

export type ButtonVariant = 'solid' | 'tonal' | 'outline' | 'ghost';
export type ButtonSize = 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: ButtonVariant;
  /** Which accent family to use. Omit for the app's primary brand color. */
  accent?: AccentName;
  size?: ButtonSize;
  icon?: IconName;
  iconPosition?: 'leading' | 'trailing';
  /** Stretch to the container width — used inside cards. */
  block?: boolean;
  /**
   * Extra context for assistive tech, e.g. which school a report is filed
   * against. Prefer this over lengthening the visible label.
   */
  accessibilityLabel?: string;
  /** What happens on activation, e.g. "Opens the campus reporting form". */
  accessibilityHint?: string;
}

export function Button({
  label,
  variant = 'solid',
  accent,
  size = 'md',
  icon,
  iconPosition = 'leading',
  block,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const accents = useAccents();
  const reduceMotion = useReducedMotion();

  // An accent-less button falls back to the brand color, expressed in the same
  // shape as an accent so the variant logic below stays uniform.
  const palette = accent
    ? accents[accent]
    : { solid: theme.brand, onSolid: theme.onBrand, tint: theme.backgroundElement, fg: theme.brand };

  const background =
    variant === 'solid' ? palette.solid : variant === 'tonal' ? palette.tint : 'transparent';
  const foreground = variant === 'solid' ? palette.onSolid : palette.fg;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      // Guarantees the 44pt target even when the visual box is smaller.
      hitSlop={Spacing.two}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        { backgroundColor: background },
        variant === 'outline' ? { borderWidth: 1, borderColor: theme.borderStrong } : null,
        block ? styles.block : null,
        disabled ? styles.disabled : null,
        pressed ? styles.pressed : null,
        pressed && !reduceMotion ? styles.pressedScale : null,
      ]}
      {...rest}
    >
      <View style={styles.content}>
        {icon && iconPosition === 'leading' ? (
          <Icon name={icon} size={18} color={foreground} />
        ) : null}
        <Text variant="label" colorValue={foreground} style={styles.label}>
          {label}
        </Text>
        {icon && iconPosition === 'trailing' ? (
          <Icon name={icon} size={18} color={foreground} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MinTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
  },
  md: {
    paddingVertical: Spacing.two,
  },
  lg: {
    paddingVertical: Spacing.three,
    borderRadius: Radius.lg,
  },
  block: {
    alignSelf: 'stretch',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  label: {
    // Lets the label wrap instead of overflowing at large font scales.
    flexShrink: 1,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
  },
  pressedScale: {
    transform: [{ scale: 0.98 }],
  },
});
