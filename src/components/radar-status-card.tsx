import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-theme';
import { formatDistance, type RadarStatus } from '@/lib/detour';

/**
 * One watched station: a calm "step-free route working" line, or the outage
 * with the best nearby detours. Icon, words and colour all change together,
 * so the state never rests on colour alone.
 */
export function RadarStatusCard({ status, compact = false }: { status: RadarStatus; compact?: boolean }) {
  const disrupted = status.outages.length > 0;
  const palette = useAccent(disrupted ? 'explore' : 'success');
  const { station } = status;

  return (
    <Card tint={palette.tint} borderColor={palette.tint} style={styles.card}>
      <View style={styles.header} accessible accessibilityLabel={`${station.name}: ${disrupted ? 'elevator out, step-free route broken' : 'step-free route working'}`}>
        <Icon name={disrupted ? 'warning' : 'resolved'} size={22} color={palette.fg} />
        <View style={styles.headerText}>
          <Text variant="bodyStrong" colorValue={palette.fg}>{station.name}</Text>
          <Text variant="caption" colorValue={palette.fg}>
            {disrupted ? 'Elevator out · step-free route broken' : 'Step-free route working'}
            {station.routes.length ? ` · ${station.routes.join(' ')}` : ''}
          </Text>
        </View>
      </View>

      {disrupted && !compact ? status.outages.map((outage) => (
        <Text key={outage.equipment} variant="callout">
          {outage.serving || 'Elevator'}{outage.estimatedReturn ? ` · back ${outage.estimatedReturn.split(' ')[0]}` : ''}
          {outage.alternativeRoute ? `\nMTA suggests: ${outage.alternativeRoute}` : ''}
        </Text>
      )) : null}

      {disrupted ? (
        status.alternatives.length > 0 ? (
          <View style={styles.alternatives}>
            <Text variant="label">Nearest working step-free stations</Text>
            {status.alternatives.slice(0, compact ? 1 : undefined).map((alternative) => (
              <View
                key={alternative.station.id}
                style={styles.alternative}
                accessible
                accessibilityLabel={`${alternative.station.name}, ${formatDistance(alternative.meters)}, about ${alternative.walkMinutes} minutes${alternative.sharedRoutes.length ? `, also on the ${alternative.sharedRoutes.join(' ')}` : ''}`}
              >
                <Icon name="train" size={18} />
                <Text variant="callout" style={styles.alternativeName}>{alternative.station.name}</Text>
                <Text variant="caption" color="textSecondary">
                  {formatDistance(alternative.meters)} · {alternative.walkMinutes} min
                  {alternative.sharedRoutes.length ? ` · ${alternative.sharedRoutes.join(' ')}` : ''}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text variant="callout">No working step-free station within 2.5 km. Plan for a bus or Access-A-Ride.</Text>
        )
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  headerText: { flex: 1 },
  alternatives: { gap: Spacing.one },
  alternative: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: Radius.sm },
  alternativeName: { flex: 1 },
});
