import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import type { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Icons are referenced by *semantic* name, never by glyph name. Screens ask for
 * `"reports"`, not `"clipboard-outline"`.
 *
 * That keeps meaning consistent across screens and confines an icon-set swap to
 * the GLYPHS map below — nothing else in the app imports an icon library.
 */
const GLYPHS = {
  // Brand
  accessibility: 'accessibility',

  // Tab bar + product areas
  home: 'home-outline',
  'home-active': 'home',
  reports: 'clipboard-outline',
  'reports-active': 'clipboard',
  explore: 'search-outline',
  'explore-active': 'search',
  activity: 'stats-chart-outline',
  'activity-active': 'stats-chart',
  profile: 'person-outline',
  'profile-active': 'person',

  // Features
  campus: 'school',
  place: 'location',
  quiet: 'volume-low',
  verified: 'shield-checkmark',
  community: 'people',

  // Access affordances
  ramp: 'trending-up',
  elevator: 'swap-vertical',
  restroom: 'body-outline',
  parking: 'car-outline',
  vision: 'eye-outline',
  hearing: 'ear-outline',
  'service-animal': 'paw-outline',
  seating: 'cafe-outline',

  // Report status
  open: 'alert-circle-outline',
  'in-progress': 'construct-outline',
  resolved: 'checkmark-circle-outline',

  // Chrome
  notifications: 'notifications-outline',
  chevron: 'chevron-forward',
  star: 'star',
  upvote: 'arrow-up-circle-outline',
  filter: 'options-outline',
  add: 'add',
  time: 'time-outline',
  settings: 'settings-outline',
  help: 'help-circle-outline',
  'sign-out': 'log-out-outline',
  review: 'chatbubble-ellipses-outline',
} as const satisfies Record<string, ComponentProps<typeof Ionicons>['name']>;

export type IconName = keyof typeof GLYPHS;

export interface IconProps {
  name: IconName;
  size?: number;
  /**
   * A semantic token name, or any explicit color. Defaults to body text.
   * `ColorValue` is accepted so navigator callbacks (e.g. `tabBarIcon`) can pass
   * their resolved color straight through.
   */
  color?: ThemeColor | ColorValue;
}

/**
 * Always decorative: icons are hidden from assistive tech, because every icon
 * in this app sits beside a text label or inside a control that carries its own
 * `accessibilityLabel`. If you ever need a standalone meaningful icon, give the
 * *pressable wrapping it* the label rather than un-hiding this.
 */
export function Icon({ name, size = 20, color = 'text' }: IconProps) {
  const theme = useTheme();
  const resolved =
    typeof color === 'string' && color in theme ? theme[color as ThemeColor] : color;

  return (
    <Ionicons
      name={GLYPHS[name]}
      size={size}
      color={resolved}
      accessibilityElementsHidden
      importantForAccessibility="no"
      // Icon fonts must not scale with the OS text size or they break layout;
      // the labels beside them do scale, which is what carries legibility.
      allowFontScaling={false}
    />
  );
}
