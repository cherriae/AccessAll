import { useEffect } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useAccent, useTheme } from '@/hooks/use-theme';

export interface NoticeProps {
  /** Nothing renders when the message is empty, so callers can pass state directly. */
  message: string | null | undefined;
  tone?: 'error' | 'success';
}

/**
 * Inline feedback for a form or action.
 *
 * Use this instead of `Alert.alert`: on react-native-web that is an empty
 * function, so every message raised through it disappeared and the button
 * simply appeared to do nothing. A live region announces the message to screen
 * readers as soon as it appears (and an explicit announcement on iOS).
 */
export function Notice({ message, tone = 'error' }: NoticeProps) {
  const theme = useTheme();
  const success = useAccent('success');

  // `accessibilityLiveRegion` is Android-only and VoiceOver does not read new
  // "alert" content on its own, so announce it explicitly on iOS.
  useEffect(() => {
    if (message && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  if (!message) {
    return null;
  }

  const color = tone === 'error' ? theme.danger : success.fg;

  return (
    <View
      style={[
        styles.box,
        {
          borderColor: color,
          backgroundColor: tone === 'error' ? theme.backgroundElement : success.tint,
        },
      ]}
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
    >
      <Text variant="callout" colorValue={color}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
});
