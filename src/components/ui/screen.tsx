import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ScreenProps {
  children: ReactNode;
  /** Pinned above the scroll area, e.g. `<AppHeader />`. */
  header?: ReactNode;
  /** Set false for screens that manage their own scrolling (e.g. a FlatList). */
  scrollable?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /**
   * Show a Back control above the content. Set on every screen pushed over the
   * tabs: the stack header is hidden app-wide, and a swipe or hardware key is
   * not something every user can perform or discover.
   */
  back?: boolean;
}

/**
 * Goes back when there is somewhere to go, otherwise home — a screen opened
 * from a shared web link has no history to return to.
 */
function BackButton() {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={Spacing.two}
      style={styles.back}
    >
      <Icon name="back" size={22} color="brand" />
      <Text variant="label" color="brand">
        Back
      </Text>
    </Pressable>
  );
}

/**
 * Screen shell: background, safe-area handling, and a width-capped content
 * column.
 *
 * Every tab screen should use this so insets and max width are solved once.
 * The column cap keeps line lengths readable when the app runs on a tablet or
 * in a desktop browser, where full-width body text becomes hard to track.
 */
export function Screen({ children, header, scrollable = true, contentStyle, back }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Landscape notches eat into the sides, so the horizontal gutter is at least
  // the inset rather than a fixed value.
  const gutter = {
    paddingLeft: Math.max(Spacing.three, insets.left),
    paddingRight: Math.max(Spacing.three, insets.right),
  };

  const body = (
    <View style={[styles.column, contentStyle]}>
      {back ? <BackButton /> : null}
      {children}
    </View>
  );

  return (
    // Keeps the focused field and the button under it above the on-screen
    // keyboard. Android edge-to-edge no longer resizes the window for the
    // keyboard by itself, so both platforms need this.
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      enabled={Platform.OS !== 'web'}
      style={[styles.root, { backgroundColor: theme.background }]}
    >
      {header ? <View style={{ paddingTop: insets.top }}>{header}</View> : null}

      {scrollable ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            gutter,
            header ? null : { paddingTop: insets.top + Spacing.three },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          // Lets users flick back to the top of long report lists.
          scrollsToTop
        >
          {body}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.content,
            styles.scroll,
            gutter,
            header ? null : { paddingTop: insets.top + Spacing.three },
          ]}
        >
          {body}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: Spacing.three,
    // Clears the tab bar and leaves breathing room at the end of a list.
    paddingBottom: Spacing.five,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    minHeight: MinTouchTarget,
    marginBottom: -Spacing.three,
  },
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.four,
  },
});
