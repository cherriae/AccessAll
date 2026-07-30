/**
 * Design tokens for AccessAll.
 *
 * Everything visual should come from this file — screens and components must not
 * hardcode colors, font sizes, radii, or spacing. That keeps light/dark parity
 * automatic and makes a palette change a one-file edit.
 *
 * Contrast: every `text*` on its matching `background`/`surface`, and every
 * accent `fg` on its matching accent `tint`, meets WCAG AA (4.5:1) for body text.
 * If you add a color, check it before committing — this is an accessibility app.
 */

import '@/global.css';

import { Platform } from 'react-native';

/* -------------------------------------------------------------------------- */
/* Semantic colors                                                            */
/* -------------------------------------------------------------------------- */

export const Colors = {
  light: {
    /** Primary body and heading text. */
    text: '#0F1729',
    /** Supporting copy, subtitles, metadata. */
    textSecondary: '#4B5565',
    /** De-emphasized text: timestamps, captions. Do not use below 13pt. */
    textTertiary: '#68717F',

    /** App canvas, behind all content. */
    background: '#F6F7FB',
    /** Raised containers (cards, sheets, tab bar). */
    surface: '#FFFFFF',
    /** Inset/filled controls on a surface (chips, input backgrounds). */
    backgroundElement: '#F0F0F3',
    /** Selected state for the above. */
    backgroundSelected: '#E0E1E6',

    /** Hairline dividers and card outlines. */
    border: '#E3E6EE',
    /** Outlines that need to read as interactive. */
    borderStrong: '#C9CEDA',

    /** Primary action color. */
    brand: '#4F46E5',
    /** Text/icons on top of `brand`. */
    onBrand: '#FFFFFF',
    /** Keyboard focus indicator. */
    focus: '#4F46E5',
    /** Attention/unread dot. */
    danger: '#D92D20',
  },
  dark: {
    text: '#F4F6FA',
    textSecondary: '#A9B1BF',
    textTertiary: '#8B94A3',

    background: '#0B0D12',
    surface: '#151922',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',

    border: '#262C38',
    borderStrong: '#3A4252',

    brand: '#9B97FF',
    onBrand: '#0B0D12',
    focus: '#9B97FF',
    danger: '#FF6B60',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/* -------------------------------------------------------------------------- */
/* Accents                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * One accent family.
 *
 * - `tint`    subtle fill for cards and icon chips
 * - `fg`      icon/text color, AA on `tint` *and* on the app background
 * - `solid`   filled button background
 * - `onSolid` text/icon on `solid`
 */
export interface Accent {
  readonly tint: string;
  readonly fg: string;
  readonly solid: string;
  readonly onSolid: string;
}

/**
 * Each product area owns one accent so a color reliably means the same thing
 * everywhere. Color is never the only signal — always pair it with an icon and
 * a text label.
 */
export const Accents = {
  light: {
    campus: { tint: '#EDEFFF', fg: '#3730A3', solid: '#4F46E5', onSolid: '#FFFFFF' },
    explore: { tint: '#FFF2E4', fg: '#9A4E06', solid: '#E5811A', onSolid: '#FFFFFF' },
    quiet: { tint: '#F5EDFF', fg: '#6B21A8', solid: '#8B5CF6', onSolid: '#FFFFFF' },
    verified: { tint: '#E6F7F0', fg: '#046C51', solid: '#0E9F76', onSolid: '#FFFFFF' },
    community: { tint: '#EFEDFF', fg: '#4338CA', solid: '#6C5CE7', onSolid: '#FFFFFF' },
  },
  dark: {
    campus: { tint: '#1B1F3A', fg: '#B4B0FF', solid: '#6D64F0', onSolid: '#0B0D12' },
    explore: { tint: '#2B1F12', fg: '#F5B372', solid: '#E5811A', onSolid: '#1A0F03' },
    quiet: { tint: '#241A38', fg: '#D0AEFF', solid: '#8B5CF6', onSolid: '#120A22' },
    verified: { tint: '#0F2620', fg: '#74DDBB', solid: '#0E9F76', onSolid: '#04140F' },
    community: { tint: '#1E1B3C', fg: '#BAB2FF', solid: '#6C5CE7', onSolid: '#0B0D12' },
  },
} as const satisfies Record<'light' | 'dark', Record<string, Accent>>;

export type AccentName = keyof typeof Accents.light & keyof typeof Accents.dark;

/* -------------------------------------------------------------------------- */
/* Typography                                                                 */
/* -------------------------------------------------------------------------- */

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-sans)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/**
 * Line heights are unitless-equivalent (~1.4x) so text stays legible when the
 * OS font scale is turned up. Never set `allowFontScaling={false}`.
 */
export const Typography = {
  display: { fontSize: 30, lineHeight: 37, fontWeight: '700' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  heading: { fontSize: 19, lineHeight: 25, fontWeight: '700' },
  subheading: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  callout: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 0.6 },
} as const;

export type TypographyVariant = keyof typeof Typography;

/* -------------------------------------------------------------------------- */
/* Layout                                                                     */
/* -------------------------------------------------------------------------- */

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

/**
 * Minimum hit area for anything tappable — 44pt is the Apple HIG floor and
 * comfortably clears the WCAG 2.2 target-size minimum. Do not go below this.
 */
export const MinTouchTarget = 44;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
