import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { Text } from '@/components/ui/text';
import { MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

export interface ChipGroupProps<T extends string> {
  /** Names what is being filtered, e.g. "Filter reports by status". */
  label: string;
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * Single-select filter chips.
 *
 * Exposed as a radio group rather than a row of buttons, so assistive tech
 * announces "2 of 4, selected" instead of four unrelated buttons — the user can
 * tell it is one choice among a set.
 *
 * Scrolls horizontally so chips never truncate at large font scales.
 */
export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: ChipGroupProps<T>) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, checked: selected }}
            hitSlop={Spacing.one}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: selected ? theme.brand : theme.backgroundElement,
                borderColor: selected ? theme.brand : theme.border,
              },
              pressed && !selected ? { backgroundColor: theme.backgroundSelected } : null,
            ]}
          >
            <Text variant="label" colorValue={selected ? theme.onBrand : theme.textSecondary}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    // Keeps the first and last chip clear of the screen gutter while scrolling.
    paddingRight: Spacing.three,
  },
  chip: {
    minHeight: MinTouchTarget - Spacing.two,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
});
