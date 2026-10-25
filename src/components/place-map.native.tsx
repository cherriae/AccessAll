import { isRunningInExpoGo } from 'expo';
import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PlaceMapProps } from './place-map.maplibre';

export type { PlaceMapProps };

/**
 * Expo Go does not contain MapLibre's native code, and merely importing it
 * there crashes the whole app on launch ("MLRNCamera could not be found").
 * So the map is only loaded in a development or store build; in Expo Go the
 * rest of the app works and the map says why it is missing.
 */
export const PlaceMap: ComponentType<PlaceMapProps> = isRunningInExpoGo()
  ? MapUnavailable
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  : require('./place-map.maplibre').PlaceMap;

function MapUnavailable() {
  const theme = useTheme();
  return (
    <View style={[styles.frame, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Icon name="map" size={28} color="textSecondary" />
      <Text variant="callout" color="textSecondary" style={styles.text}>
        Maps need the AccessAll development build. Expo Go cannot show them, but everything else works.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { minHeight: 140, borderRadius: Radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
  text: { textAlign: 'center' },
});
