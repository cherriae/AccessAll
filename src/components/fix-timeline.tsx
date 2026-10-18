import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PlaceMap } from '@/components/place-map';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { PIN_COLORS } from '@/constants/map';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useReportTimeline } from '@/hooks/useImpact';
import { timelineFrame, timelineRange } from '@/lib/timeline';
import type { Place } from '@/types';

/** The whole history plays in about 12 seconds, however long it spans. */
const FRAMES = 120;
const FRAME_MS = 100;
const NO_PLACES: Place[] = [];

const formatDay = (time: number) => new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * Fix Timeline: the community's reports replayed on the map. Barriers pop up
 * amber on the day they were reported and turn green the day they were fixed,
 * so "we got things fixed" becomes something you can watch happen.
 */
export function FixTimeline() {
  const theme = useTheme();
  const reports = useReportTimeline().data;
  const range = useMemo(() => (reports ? timelineRange(reports) : null), [reports]);
  const center = useMemo(() => (reports?.length ? {
    latitude: reports.reduce((sum, report) => sum + report.latitude, 0) / reports.length,
    longitude: reports.reduce((sum, report) => sum + report.longitude, 0) / reports.length,
  } : undefined), [reports]);
  // Starts at the end, so the map shows today until someone presses play.
  const [frame, setFrame] = useState(FRAMES);
  const [playing, setPlaying] = useState(false);

  // Playback stops by itself at the last frame; no effect needs to notice.
  const running = playing && frame < FRAMES;

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setFrame((current) => Math.min(FRAMES, current + 1)), FRAME_MS);
    return () => clearInterval(interval);
  }, [running]);

  if (!reports || !range) return null;

  const time = range.start + ((range.end - range.start) * frame) / FRAMES;
  const { pins, reported, fixed } = timelineFrame(reports, time);
  const progress = frame / FRAMES;

  function toggle() {
    if (running) { setPlaying(false); return; }
    if (frame >= FRAMES) setFrame(0);
    setPlaying(true);
  }

  return (
    <Section title="Fix Timeline">
      <Card style={styles.card}>
        <Text color="textSecondary">Watch every barrier the community reported appear on the map, then turn green as it gets fixed.</Text>
        <PlaceMap places={NO_PLACES} onSelect={() => {}} pins={pins} initialCenter={center} />
        <View style={styles.readout} accessible accessibilityLiveRegion={running ? 'none' : 'polite'} accessibilityLabel={`${formatDay(time)}: ${reported} barriers reported, ${fixed} fixed`}>
          <Text variant="heading">{formatDay(time)}</Text>
          <View style={styles.counts}>
            <Legend color={PIN_COLORS.report} label={`${reported - fixed} open`} />
            <Legend color={PIN_COLORS.fixed} label={`${fixed} fixed`} />
          </View>
        </View>
        <View
          style={[styles.track, { backgroundColor: theme.backgroundElement }]}
          accessibilityRole="progressbar"
          accessibilityLabel="Replay progress"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
        >
          <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: PIN_COLORS.fixed }]} />
        </View>
        <Button
          label={running ? 'Pause' : frame >= FRAMES ? 'Replay from the first report' : 'Resume'}
          icon={running ? 'pause' : 'replay'}
          variant="tonal"
          accent="success"
          onPress={toggle}
          block
        />
      </Card>
    </Section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legend}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text variant="label">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three },
  readout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.two },
  counts: { flexDirection: 'row', gap: Spacing.three },
  legend: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  swatch: { width: 12, height: 12, borderRadius: Radius.full },
  track: { height: 8, borderRadius: Radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.full },
});
