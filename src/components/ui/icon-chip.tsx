import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, type AccentName } from '@/constants/theme';
import { useAccents } from '@/hooks/use-theme';

export interface IconChipProps {
  name: IconName;
  accent: AccentName;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: { box: 32, glyph: 16 },
  md: { box: 40, glyph: 20 },
  lg: { box: 52, glyph: 26 },
} as const;

/** A rounded tinted square holding a single decorative icon. */
export function IconChip({ name, accent, size = 'md' }: IconChipProps) {
  const palette = useAccents()[accent];
  const { box, glyph } = SIZES[size];

  return (
    <View
      style={[
        styles.chip,
        { width: box, height: box, borderRadius: Radius.md, backgroundColor: palette.tint },
      ]}
    >
      <Icon name={name} size={glyph} color={palette.fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    // Prevents the chip from being squeezed when the label beside it wraps.
    flexShrink: 0,
  },
});
