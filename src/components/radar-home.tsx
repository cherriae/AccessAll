import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { RadarStatusCard } from '@/components/radar-status-card';
import { PromoCard } from '@/components/promo-card';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useDetourRadar } from '@/hooks/useElevatorOutages';

/**
 * Detour Radar on the home screen: disrupted stations first, so a broken
 * elevator is the first thing someone sees in the morning, not the last.
 */
export function RadarHome() {
  const router = useRouter();
  const radar = useDetourRadar();
  const open = () => router.push('/radar' as never);

  if (radar.watched.length === 0) {
    return (
      <PromoCard
        icon="radar"
        accent="explore"
        title="Detour Radar"
        body="Know before you go: get warned when an elevator at your subway station breaks, with the nearest station that works."
        action="Set up"
        onPress={open}
      />
    );
  }

  const statuses = [...(radar.statuses ?? [])].sort((a, b) => b.outages.length - a.outages.length);

  return (
    <Section title="Detour Radar" action={{ label: 'Manage', onPress: open }}>
      <View style={styles.list}>
        {statuses.slice(0, 3).map((status) => <RadarStatusCard key={status.station.id} status={status} compact />)}
        {!radar.statuses ? <Text color="textSecondary">{radar.isError ? 'Could not reach the MTA right now.' : 'Checking your stations…'}</Text> : null}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
});
