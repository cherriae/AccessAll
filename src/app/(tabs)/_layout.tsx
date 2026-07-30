import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Tab bar sizing.
 *
 * The bar gives the icon its natural size and hands the *remaining* vertical
 * space to the label, whose container clips with `overflow: hidden`. On web the
 * navigator pins the bar to ~49px and ignores `height` here, so the icon and
 * label must fit inside that on their own — a 24px icon left the label 11px,
 * which cuts the descenders off an 11px font.
 *
 * Hence: a smaller icon, and an explicit `lineHeight` so the label reserves a
 * full line box instead of a tight one. `TAB_BAR_HEIGHT` still applies on native,
 * where `height` *is* honoured.
 */
const TAB_BAR_HEIGHT = 64;

const ICON_SIZE = 20;

const LABEL_FONT_SIZE = 11;

/** Must exceed the font size, or the glyphs are clipped vertically. */
const LABEL_LINE_HEIGHT = 14;

interface TabDefinition {
  /** Must match the route filename in this directory. */
  name: string;
  title: string;
  icon: IconName;
  activeIcon: IconName;
}

const TABS: TabDefinition[] = [
  { name: 'index', title: 'Home', icon: 'home', activeIcon: 'home-active' },
  { name: 'reports', title: 'Reports', icon: 'reports', activeIcon: 'reports-active' },
  { name: 'explore', title: 'Explore', icon: 'explore', activeIcon: 'explore-active' },
  { name: 'activity', title: 'Activity', icon: 'activity', activeIcon: 'activity-active' },
  { name: 'profile', title: 'Profile', icon: 'profile', activeIcon: 'profile-active' },
];

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.brand,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          height: TAB_BAR_HEIGHT + insets.bottom,
          // No top padding: on web it comes straight out of the label's budget.
          // Keeps the labels clear of the home indicator on gesture devices,
          // and off the screen edge on devices without one.
          paddingBottom: insets.bottom + Spacing.one,
        },
        tabBarLabelStyle: {
          fontSize: LABEL_FONT_SIZE,
          lineHeight: LABEL_LINE_HEIGHT,
          fontWeight: '600',
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            // Filled when active, outlined when not — so the selected tab is
            // distinguishable by shape and not by color alone.
            tabBarIcon: ({ focused, color }) => (
              <Icon name={focused ? tab.activeIcon : tab.icon} size={ICON_SIZE} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
