/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Accents, Colors } from '@/constants/theme';
import type { Accent, AccentName } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type ResolvedScheme = 'light' | 'dark';

/**
 * The active scheme, with the "no preference" case resolved to light so callers
 * never have to handle `null`.
 */
export function useScheme(): ResolvedScheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

export function useIsDark(): boolean {
  return useScheme() === 'dark';
}

/** Semantic colors for the active scheme. */
export function useTheme() {
  return Colors[useScheme()];
}

/** All accent families for the active scheme. */
export function useAccents() {
  return Accents[useScheme()];
}

/** A single accent family for the active scheme. */
export function useAccent(name: AccentName): Accent {
  return Accents[useScheme()][name];
}
