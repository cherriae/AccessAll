import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Fonts, MinTouchTarget, Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface SearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  /**
   * Spoken name for the field. Required, because a placeholder is not a label —
   * it disappears once typing starts and is inconsistently announced.
   */
  label: string;
  placeholder?: string;
}

export function SearchField({ value, onChangeText, label, placeholder }: SearchFieldProps) {
  const theme = useTheme();

  return (
    <View style={[styles.field, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Icon name="explore" size={18} color="textSecondary" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textTertiary}
        accessibilityLabel={label}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="never"
        style={[styles.input, { color: theme.text }]}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={Spacing.two}
          style={styles.clear}
        >
          <Icon name="add" size={18} color="textSecondary" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: MinTouchTarget,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    // Matches body text so the field grows with the OS font scale.
    fontFamily: Fonts?.sans,
    fontSize: Typography.body.fontSize,
    // Vertical padding rather than a fixed height, which would clip large text.
    paddingVertical: Spacing.two,
  },
  clear: {
    // The plus glyph rotated into a close icon — avoids adding another glyph.
    transform: [{ rotate: '45deg' }],
  },
});
