/**
 * Design tokens for AccessAll.
 *
 * Everything visual should come from this file — screens and components must not
 * hardcode colors, font sizes, radii, or spacing. That keeps light/dark parity
 * automatic and makes a palette change a one-file edit.
 *
 * Contrast: every `text*` on its matching `background`/`surface`, and every
 * accent `fg` on its matching accent `tint`, and every accent `onSolid` on its
 * `solid`, meets WCAG AA (4.5:1) for body text.
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
    text: '#121528',
    /** Supporting copy, subtitles, metadata. */
    textSecondary: '#4A4F5E',
    /** De-emphasized text: timestamps, captions. Do not use below 13pt. */
    textTertiary: '#5C6170',

    /** App canvas, behind all content. */
    background: '#F6F3EC',
    /** Raised containers (cards, sheets, tab bar). */
    surface: '#FFFFFF',
    /** Inset/filled controls on a surface (chips, input backgrounds). */
    backgroundElement: '#EFEBE2',
    /** Selected state for the above. */
    backgroundSelected: '#E3DED3',

    /** Hairline dividers and card outlines. */
    border: '#E6E1D6',
    /** Outlines that need to read as interactive. */
    borderStrong: '#CBC5B8',

    /** Primary action color. */
    brand: '#4F46E5',
    /** Text/icons on top of `brand`. */
    onBrand: '#FFFFFF',
    /** Keyboard focus indicator. */
    focus: '#4F46E5',
    /** Attention/unread dot. */
    danger: '#B42318',
  },
  dark: {
    text: '#F4F6FA',
    textSecondary: '#A9B1BF',
    textTertiary: '#8B94A3',

    background: '#0A0E1A',
    surface: '#131829',
    backgroundElement: '#1E2436',
    backgroundSelected: '#2A3147',

    border: '#232A3D',
    borderStrong: '#39425A',

    brand: '#9B97FF',
    onBrand: '#0A0E1A',
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
    explore: { tint: '#FFF2E4', fg: '#9A4E06', solid: '#B45309', onSolid: '#FFFFFF' },
    quiet: { tint: '#F5EDFF', fg: '#6B21A8', solid: '#7C3AED', onSolid: '#FFFFFF' },
    success: { tint: '#E6F7F0', fg: '#046C51', solid: '#047857', onSolid: '#FFFFFF' },
    community: { tint: '#EFEDFF', fg: '#4338CA', solid: '#6C5CE7', onSolid: '#FFFFFF' },
  },
  dark: {
    campus: { tint: '#1B1F3A', fg: '#B4B0FF', solid: '#7F78F5', onSolid: '#0B0D12' },
    explore: { tint: '#2B1F12', fg: '#F5B372', solid: '#E5811A', onSolid: '#1A0F03' },
    quiet: { tint: '#241A38', fg: '#D0AEFF', solid: '#8B5CF6', onSolid: '#120A22' },
    success: { tint: '#0F2620', fg: '#74DDBB', solid: '#0E9F76', onSolid: '#04140F' },
    community: { tint: '#1E1B3C', fg: '#BAB2FF', solid: '#8B7FF0', onSolid: '#0B0D12' },
  },
} as const satisfies Record<'light' | 'dark', Record<string, Accent>>;

export type AccentName = keyof typeof Accents.light & keyof typeof Accents.dark;

/* -------------------------------------------------------------------------- */
/* Typography                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Two families, loaded in `_layout` with expo-font on every platform:
 *
 * - **Atkinson Hyperlegible** for reading. Designed by the Braille Institute so
 *   letters that are easy to confuse (I l 1, O 0, rn m) stay distinct for
 *   low-vision readers — the body face of an accessibility app should be one.
 * - **Bricolage Grotesque** for headings: warm, slightly irregular, confident.
 *
 * Custom fonts ignore `fontWeight` on Android, so each weight is its own family
 * and the variants below pick the family instead of setting a weight.
 */
export const Fonts = {
  body: 'AtkinsonHyperlegible_400Regular',
  bodyBold: 'AtkinsonHyperlegible_700Bold',
  display: 'BricolageGrotesque_700Bold',
  displayHeavy: 'BricolageGrotesque_800ExtraBold',
  displayMedium: 'BricolageGrotesque_600SemiBold',
} as const;

/**
 * Line heights are unitless-equivalent (~1.4x) so text stays legible when the
 * OS font scale is turned up. Never set `allowFontScaling={false}`.
 */
export const Typography = {
  display: { fontSize: 32, lineHeight: 38, fontFamily: Fonts.displayHeavy, letterSpacing: -0.6 },
  title: { fontSize: 25, lineHeight: 31, fontFamily: Fonts.display, letterSpacing: -0.4 },
  heading: { fontSize: 19, lineHeight: 25, fontFamily: Fonts.display, letterSpacing: -0.2 },
  subheading: { fontSize: 16, lineHeight: 22, fontFamily: Fonts.displayMedium },
  body: { fontSize: 16, lineHeight: 24, fontFamily: Fonts.body },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontFamily: Fonts.bodyBold },
  callout: { fontSize: 15, lineHeight: 22, fontFamily: Fonts.body },
  label: { fontSize: 14, lineHeight: 19, fontFamily: Fonts.bodyBold },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: Fonts.body },
  overline: { fontSize: 11, lineHeight: 14, fontFamily: Fonts.bodyBold, letterSpacing: 0.8 },
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
