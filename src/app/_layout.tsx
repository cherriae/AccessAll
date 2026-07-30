import Ionicons from '@expo/vector-icons/Ionicons';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useScheme } from '@/hooks/use-theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useScheme();
  const colors = Colors[scheme];
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

  /**
   * The icon set is a font, so glyphs are blank until it downloads. Waiting for
   * it here means the first frame of UI already has its icons, instead of text
   * painting first and icons popping in a beat later.
   */
  const [fontsLoaded] = useFonts(Ionicons.font);

  /**
   * False during the web prerender pass and on the very first client render.
   *
   * `web.output` is `static`, so the HTML is generated at build time when the
   * visitor's color scheme is unknowable — anything rendered into it is
   * necessarily light-themed, and a dark-mode visitor sees it flash. Holding
   * back until the client has mounted keeps the generated HTML free of themed
   * markup; the correct page background comes from `src/app/+html.tsx`, which
   * paints before the bundle even loads.
   *
   * `useFonts` alone is not enough here: it reports loaded during the prerender.
   */
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isReady = isMounted && fontsLoaded;

  useEffect(() => {
    if (!isReady) {
      return;
    }
    SplashScreen.hideAsync().catch(() => {
      // Already hidden (e.g. after a fast refresh) — not an error worth surfacing.
    });
  }, [isReady]);

  if (!isReady) {
    // Native holds the splash screen. Web shows the `+html.tsx` background,
    // which is already the right scheme — so the user gets one correctly themed
    // paint instead of a light-to-dark flip.
    return null;
  }

  /**
   * React Navigation keeps its own palette for the surfaces it draws itself
   * (screen backgrounds, transition overlays). Feeding it our tokens stops
   * white flashes between screens in dark mode.
   */
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.brand,
      notification: colors.danger,
    },
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider value={navigationTheme}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              // Screens draw their own headers via `<Screen header={...}>`.
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
