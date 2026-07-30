import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Heading, Text } from '@/components/ui/text';
import { MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface SectionProps {
  title: string;
  children: ReactNode;
  /** Optional trailing link, e.g. "View all". */
  action?: {
    label: string;
    onPress: () => void;
    /** Defaults to `"<label>, <title>"`, e.g. "View all, Recent activity". */
    accessibilityLabel?: string;
  };
}

/** A titled block of content. The title is announced as a heading. */
export function Section({ title, children, action }: SectionProps) {
  const theme = useTheme();

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Heading style={styles.title}>{title}</Heading>
        {action ? (
          <Pressable
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.accessibilityLabel ?? `${action.label}, ${title}`}
            hitSlop={Spacing.two}
            style={({ pressed }) => [
              styles.action,
              pressed ? { backgroundColor: theme.backgroundElement } : null,
            ]}
          >
            <Text variant="label" color="brand">
              {action.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    minHeight: MinTouchTarget,
  },
  title: {
    flex: 1,
  },
  action: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Radius.sm,
  },
});
