import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { Fonts, Typography, type ThemeColor, type TypographyVariant } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: ThemeColor;
  /** Escape hatch for accent colors, which live outside the semantic palette. */
  colorValue?: string;
  align?: 'auto' | 'left' | 'right' | 'center';
  uppercase?: boolean;
}

/**
 * The only text primitive in the app — import this, not `Text` from
 * react-native, so size, weight, and color always come from tokens.
 *
 * Font scaling is intentionally left enabled. If a layout breaks at large text
 * sizes, fix the layout (let it wrap or scroll); do not cap the scale.
 */
export function Text({
  variant = 'body',
  color = 'text',
  colorValue,
  align,
  uppercase,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();

  return (
    <RNText
      style={[
        styles.base,
        Typography[variant],
        { color: colorValue ?? theme[color] },
        align ? { textAlign: align } : null,
        uppercase ? styles.uppercase : null,
        style,
      ]}
      {...rest}
    />
  );
}

/**
 * A section or screen title. Identical to `Text` visually, but announced as a
 * heading so screen-reader users can jump between sections.
 */
export function Heading({ variant = 'heading', ...rest }: TextProps) {
  return <Text variant={variant} accessibilityRole="header" {...rest} />;
}

const styles = StyleSheet.create({
  base: {
    fontFamily: Fonts?.sans,
  },
  uppercase: {
    textTransform: 'uppercase',
  },
});
