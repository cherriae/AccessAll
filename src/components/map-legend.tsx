import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { PIN_COLORS } from '@/constants/map';
import { MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type MapLayer = 'report' | 'outage';

const LAYERS: { kind: 'place' | MapLayer; label: string }[] = [
  { kind: 'place', label: 'Places' },
  { kind: 'report', label: 'Open barriers' },
  { kind: 'outage', label: 'Elevators out' },
];

export interface MapLegendProps {
  visible: Record<MapLayer, boolean>;
  onToggle: (layer: MapLayer) => void;
  counts: Partial<Record<'place' | MapLayer, number>>;
  /** Elevator data only exists for New York City. */
  showOutages: boolean;
}

/**
 * Key for the map, doubling as layer switches. Each entry is a checkbox, and
 * the swatch shape (round or square) carries the meaning as well as colour.
 */
export function MapLegend({ visible, onToggle, counts, showOutages }: MapLegendProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {LAYERS.filter((layer) => layer.kind !== 'outage' || showOutages).map(({ kind, label }) => {
        const toggleable = kind !== 'place';
        const on = kind === 'place' || visible[kind];
        const count = counts[kind];
        const text = count === undefined ? label : `${label} · ${count}`;

        return (
          <Pressable
            key={kind}
            disabled={!toggleable}
            onPress={() => toggleable && onToggle(kind)}
            accessibilityRole={toggleable ? 'checkbox' : 'text'}
            accessibilityState={toggleable ? { checked: on } : undefined}
            accessibilityLabel={toggleable ? `Show ${text} on the map` : text}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: on ? theme.surface : theme.backgroundElement, borderColor: on ? theme.borderStrong : theme.border },
              pressed ? styles.pressed : null,
            ]}
          >
            <View
              style={[
                styles.swatch,
                { backgroundColor: on ? PIN_COLORS[kind] : 'transparent', borderColor: PIN_COLORS[kind], borderRadius: kind === 'outage' ? 3 : Radius.full },
              ]}
            />
            <Text variant="label" color={on ? 'text' : 'textSecondary'}>{text}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: MinTouchTarget - 8,
    paddingHorizontal: Spacing.three, borderRadius: Radius.full, borderWidth: 1,
  },
  swatch: { width: 12, height: 12, borderWidth: 2 },
  pressed: { opacity: 0.8 },
});
