import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ScreenProps {
  children: ReactNode;
  /** Pinned above the scroll area, e.g. `<AppHeader />`. */
  header?: ReactNode;
  /** Set false for screens that manage their own scrolling (e.g. a FlatList). */
  scrollable?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Screen shell: background, safe-area handling, and a width-capped content
 * column.
 *
 * Every tab screen should use this so insets and max width are solved once.
 * The column cap keeps line lengths readable when the app runs on a tablet or
 * in a desktop browser, where full-width body text becomes hard to track.
 */
export function Screen({ children, header, scrollable = true, contentStyle }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Landscape notches eat into the sides, so the horizontal gutter is at least
  // the inset rather than a fixed value.
  const gutter = {
    paddingLeft: Math.max(Spacing.three, insets.left),
    paddingRight: Math.max(Spacing.three, insets.right),
  };

  const body = (
    <View style={[styles.column, contentStyle]}>{children}</View>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
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
    </View>
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
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.four,
  },
});
