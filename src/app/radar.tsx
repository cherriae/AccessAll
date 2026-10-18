import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { RadarStatusCard } from '@/components/radar-status-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Notice } from '@/components/ui/notice';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { SearchField } from '@/components/ui/search-field';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useDetourRadar, useStationComplexes } from '@/hooks/useElevatorOutages';
import { useUpdateWatchedStations } from '@/hooks/useSettings';
import { useAuthSession } from '@/lib/auth-context';
import { searchComplexes, type StationComplex } from '@/lib/detour';
import { errorText } from '@/lib/errors';

const MAX_WATCHED = 10;
const STEP_FREE_LABEL = { full: 'Step-free', partial: 'Partly step-free', none: 'Stairs only' } as const;

export default function RadarScreen() {
  const router = useRouter();
  const { userId, isReady } = useAuthSession();

  return (
    <Screen back>
      <PageHeader
        title="Detour Radar"
        subtitle="Watch the subway stations you use. If an elevator on the step-free route breaks, AccessAll tells you before you get there and finds the nearest station that works."
        icon="radar"
        accent="explore"
      />
      {isReady && !userId ? (
        <>
          <EmptyState icon="radar" title="Sign in to watch your stations" message="Your stations are saved to your account, so the radar follows you to every device." />
          <Button label="Sign in" onPress={() => router.push('/auth')} block />
        </>
      ) : (
        <RadarManager />
      )}
    </Screen>
  );
}

function RadarManager() {
  const radar = useDetourRadar();
  const complexes = useStationComplexes(true);
  const update = useUpdateWatchedStations();
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  async function save(next: string[]) {
    setMessage(null);
    try {
      await update.mutateAsync(next);
    } catch (error) {
      setMessage(errorText(error, 'Could not save your stations. Please try again.'));
    }
  }

  const add = (station: StationComplex) => {
    setQuery('');
    if (radar.watched.includes(station.id)) return;
    if (radar.watched.length >= MAX_WATCHED) { setMessage(`You can watch up to ${MAX_WATCHED} stations.`); return; }
    save([...radar.watched, station.id]);
  };
  const remove = (id: string) => save(radar.watched.filter((watched) => watched !== id));

  const results = complexes.data ? searchComplexes(complexes.data, query) : [];
  const disrupted = radar.statuses?.filter((status) => status.outages.length > 0).length ?? 0;

  return (
    <View style={styles.stack}>
      <Section title="Add a station">
        <SearchField value={query} onChangeText={setQuery} label="Search subway stations" placeholder="Station name or train, e.g. Jay St A" />
        {complexes.isError ? <Notice message="Could not load the station list. Check your connection." /> : null}
        <View style={styles.list}>
          {results.map((station) => {
            const watching = radar.watched.includes(station.id);
            return (
              <Card key={station.id} style={styles.result}>
                <View style={styles.resultText}>
                  <Text variant="bodyStrong">{station.name}</Text>
                  <Text variant="caption" color="textSecondary">{station.routes.join(' ')}</Text>
                </View>
                <Badge label={STEP_FREE_LABEL[station.stepFree]} icon={station.stepFree === 'none' ? 'warning' : 'elevator'} accent={station.stepFree === 'full' ? 'success' : 'explore'} />
                <Button
                  label={watching ? 'Watching' : 'Watch'}
                  variant={watching ? 'ghost' : 'tonal'}
                  accent="explore"
                  onPress={() => add(station)}
                  disabled={watching || update.isPending}
                  accessibilityLabel={watching ? `Already watching ${station.name}` : `Watch ${station.name}`}
                />
              </Card>
            );
          })}
        </View>
        <Notice message={message} />
      </Section>

      <Section title={radar.watched.length ? `Your stations${disrupted ? ` · ${disrupted} disrupted` : ' · all clear'}` : 'Your stations'}>
        {radar.watched.length === 0 ? (
          <Text color="textSecondary">Nothing watched yet. Add the stations you use to get to school, work or home.</Text>
        ) : radar.isError ? (
          <Notice message="Could not reach the MTA elevator feed. Check your connection." />
        ) : !radar.statuses ? (
          <LoadingState label="Checking elevators" />
        ) : (
          <View style={styles.list}>
            {radar.statuses.map((status) => (
              <View key={status.station.id} style={styles.watched}>
                <RadarStatusCard status={status} />
                <Button label={`Stop watching ${status.station.name}`} variant="ghost" icon="delete" onPress={() => remove(status.station.id)} disabled={update.isPending} />
              </View>
            ))}
          </View>
        )}
        <Text variant="caption" color="textSecondary">Live from the MTA, refreshed every 5 minutes while the app is open.</Text>
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.four },
  list: { gap: Spacing.two },
  result: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  resultText: { flex: 1, minWidth: 140 },
  watched: { gap: Spacing.one },
});
