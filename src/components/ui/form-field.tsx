import { useState, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface FormFieldProps extends TextInputProps {
  label: string;
  /** Short guidance under the field, e.g. password rules. Read with the label. */
  hint?: string;
  /** Lets a form move focus to this field (e.g. "next" on the keyboard). */
  ref?: Ref<TextInput>;
}

export function FormField({ label, hint, style, onFocus, onBlur, ref, ...props }: FormFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={theme.textTertiary}
        onFocus={(event) => { setFocused(true); onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); onBlur?.(event); }}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.surface,
            // A visible focus state, not only the caret: low-vision and
            // keyboard users need to see which field is active.
            borderColor: focused ? theme.focus : theme.borderStrong,
            borderWidth: focused ? 2 : 1,
            paddingHorizontal: focused ? Spacing.three - 1 : Spacing.three,
          },
          style,
        ]}
        {...props}
      />
      {hint ? (
        <Text variant="caption" color="textSecondary" importantForAccessibility="no" accessibilityElementsHidden>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.one },
  input: {
    minHeight: 48, borderRadius: Radius.md,
    paddingVertical: Spacing.two,
  },
});
