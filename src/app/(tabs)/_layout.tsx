import { Redirect, Tabs, useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Landing } from '@/components/landing/landing';

import { Icon, type IconName } from '@/components/ui/icon';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuthSession } from '@/lib/auth-context';
import { useOnboardingDone } from '@/lib/onboarding';

const LANDING_KEY = 'landing:entered';

/** Whether this browser tab has already gone from the landing page into the app. */
function hasEnteredApp() {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(LANDING_KEY) === '1';
  } catch {
    return false;
  }
}

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
  const router = useRouter();
  const { session, isReady } = useAuthSession();
  const onboarded = useOnboardingDone();
  const [entered, setEntered] = useState(hasEnteredApp);

  // Phones: the first launch starts with the walkthrough.
  if (Platform.OS !== 'web' && onboarded === false) return <Redirect href="/onboarding" />;

  // Web: visitors who are not signed in meet the landing page first. Once they
  // step into the app it stays out of the way for the rest of the visit.
  if (Platform.OS === 'web' && isReady && !session && !entered) {
    return (
      <Landing
        onEnter={(path) => {
          try { sessionStorage.setItem(LANDING_KEY, '1'); } catch { /* private mode */ }
          setEntered(true);
          router.push(path as never);
        }}
      />
    );
  }

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
          fontFamily: Fonts.bodyBold,
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
