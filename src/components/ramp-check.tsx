import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useAccent, useTheme } from '@/hooks/use-theme';
import { useRampSummary, useSaveRampMeasurement } from '@/hooks/useRamps';
import { errorText } from '@/lib/errors';
import { isMotionAvailable, requestMotionPermission, watchAcceleration } from '@/lib/motion';
import {
  ADA_MAX_SLOPE_PERCENT,
  degreesToPercent,
  describeSlope,
  slopeRatio,
  slopeVerdict,
  steadyTilt,
  tiltDegrees,
  type SlopeVerdict,
} from '@/lib/slope';
import type { Place } from '@/types';

const SAMPLE_MS = 100;
/** About 1.5 s of steady readings before a measurement locks in. */
const STEADY_SAMPLES = 15;
const GIVE_UP_MS = 20_000;
/** Desktop browsers have the motion API but no sensor behind it: nothing ever arrives. */
const NO_SENSOR_MS = 2_000;
/** Ramps are shallow; the drawing exaggerates angles so 1:12 and 1:8 look different. */
const DRAWING_SCALE = 3;

const VERDICT_ACCENT: Record<SlopeVerdict, 'success' | 'explore'> = {
  walkway: 'success',
  meets: 'success',
  close: 'explore',
  'too-steep': 'explore',
};

export interface RampCheckProps {
  /** The saved place, or undefined while it is still a map preview. */
  placeId?: string;
  userId?: string;
  ensurePlace: () => Promise<Place>;
  onSaved: (place: Place) => void;
  onSignIn: () => void;
}

/**
 * Ramp slope meter: lay the phone on a ramp and the accelerometer reads its
 * angle, judged against the ADA's 1:12 limit.
 *
 * "There is a ramp" is not the same as "a wheelchair user can get up it".
 * A measured slope turns that into evidence a school or landlord cannot wave
 * away, and the community figure is a median across everyone who measured.
 */
export function RampCheck({ placeId, userId, ensurePlace, onSaved, onSignIn }: RampCheckProps) {
  const summary = useRampSummary(placeId, userId).data;
  const save = useSaveRampMeasurement();
  const [measuring, setMeasuring] = useState(false);
  const [liveDegrees, setLiveDegrees] = useState<number | null>(null);
  const [result, setResult] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);
  const samples = useRef<number[]>([]);

  useEffect(() => {
    if (!measuring) return;
    samples.current = [];

    const stop = watchAcceleration((reading) => {
      const degrees = tiltDegrees(reading);
      if (degrees === null) return;
      samples.current.push(degrees);
      setLiveDegrees(degrees);

      const steady = steadyTilt(samples.current, STEADY_SAMPLES);
      if (steady !== null) {
        setResult(degreesToPercent(steady));
        setMeasuring(false);
      }
    }, SAMPLE_MS);
    const noSensor = setTimeout(() => {
      if (samples.current.length > 0) return;
      setMeasuring(false);
      setMessage({ text: 'No motion sensor is reporting on this device. Open AccessAll on your phone to measure a ramp.', tone: 'error' });
    }, NO_SENSOR_MS);
    const timeout = setTimeout(() => {
      setMeasuring(false);
      setMessage({ text: 'The phone did not stay still long enough. Lay it flat on the ramp and try again.', tone: 'error' });
    }, GIVE_UP_MS);

    return () => {
      stop();
      clearTimeout(noSensor);
      clearTimeout(timeout);
    };
  }, [measuring]);

  async function start() {
    setMessage(null);
    setResult(null);
    setLiveDegrees(null);
    try {
      // Permission first: iOS Safari only asks while still inside the tap.
      if (!(await requestMotionPermission())) {
        setMessage({ text: 'Motion access is off. Allow it in your settings to measure.', tone: 'error' });
        return;
      }
      if (!(await isMotionAvailable())) {
        setMessage({ text: 'This device has no motion sensor. Open AccessAll on your phone to measure a ramp.', tone: 'error' });
        return;
      }
      setMeasuring(true);
    } catch {
      setMessage({ text: 'Could not read the motion sensor on this device.', tone: 'error' });
    }
  }

  async function submit() {
    if (result === null) return;
    if (!userId) { onSignIn(); return; }
    setMessage(null);
    try {
      const place = await ensurePlace();
      await save.mutateAsync({ placeId: place.id, percent: result });
      setMessage({ text: 'Measurement saved. Thank you!', tone: 'success' });
      setResult(null);
      onSaved(place);
    } catch (error) {
      setMessage({ text: errorText(error, 'Could not save the measurement. Please try again.'), tone: 'error' });
    }
  }

  const livePercent = liveDegrees === null ? null : degreesToPercent(liveDegrees);

  return (
    <Section title="Ramp check">
      <Card style={styles.card}>
        {summary?.medianPercent != null ? (
          <SlopeResult
            percent={summary.medianPercent}
            caption={`Community measurement · ${summary.count} ${summary.count === 1 ? 'phone' : 'phones'}${summary.ownPercent !== null ? ` · yours ${summary.ownPercent.toFixed(1)}%` : ''}`}
          />
        ) : (
          <Text color="textSecondary">
            Nobody has measured a ramp here yet. Lay your phone flat on the ramp, pointing uphill, and AccessAll reads its slope.
          </Text>
        )}

        {measuring ? (
          <View style={styles.live} accessibilityLiveRegion="polite">
            <Text variant="bodyStrong">Hold still…</Text>
            <Text variant="display">{livePercent === null ? '–' : `${livePercent.toFixed(1)}%`}</Text>
            <Text variant="caption" color="textSecondary">Keep the phone flat on the ramp until the reading locks.</Text>
          </View>
        ) : null}

        {result !== null && !measuring ? (
          <>
            <SlopeResult percent={result} caption="Your measurement" />
            <Button
              label={userId ? 'Save measurement' : 'Sign in to save'}
              icon="ramp"
              onPress={submit}
              disabled={save.isPending}
              block
            />
          </>
        ) : null}

        <Notice message={message?.text} tone={message?.tone} />

        <Button
          label={measuring ? 'Cancel' : result === null ? 'Measure ramp slope' : 'Measure again'}
          icon="ramp"
          variant={measuring ? 'ghost' : 'tonal'}
          accent="explore"
          onPress={measuring ? () => setMeasuring(false) : start}
          accessibilityHint="Uses the phone's motion sensor. Lay the phone flat on the ramp, pointing uphill."
          block
        />
      </Card>
    </Section>
  );
}

function SlopeResult({ percent, caption }: { percent: number; caption: string }) {
  const verdict = slopeVerdict(percent);
  const palette = useAccent(VERDICT_ACCENT[verdict]);
  const theme = useTheme();
  const description = describeSlope(percent);

  return (
    <View
      style={[styles.result, { backgroundColor: palette.tint }]}
      accessible
      accessibilityLabel={`${caption}: ${percent.toFixed(1)} percent, ${slopeRatio(percent)}. ${description}.`}
    >
      <View style={styles.resultText}>
        <Text variant="overline" colorValue={palette.fg}>{caption.toUpperCase()}</Text>
        <Text variant="title" colorValue={palette.fg}>{percent.toFixed(1)}% · {slopeRatio(percent)}</Text>
        <Text variant="callout" colorValue={palette.fg}>{description}</Text>
      </View>
      {/* Side view: the measured ramp against the ADA limit (dashed). */}
      <View style={styles.drawing} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={[styles.line, styles.limit, { borderColor: theme.textSecondary, transform: [{ rotate: `${-angleFor(ADA_MAX_SLOPE_PERCENT)}deg` }] }]} />
        <View style={[styles.line, { backgroundColor: palette.solid, transform: [{ rotate: `${-angleFor(percent)}deg` }] }]} />
        <View style={[styles.ground, { backgroundColor: theme.border }]} />
      </View>
    </View>
  );
}

function angleFor(percent: number) {
  return Math.min(60, (Math.atan(percent / 100) * 180 * DRAWING_SCALE) / Math.PI);
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three },
  live: { alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.two },
  result: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderRadius: Radius.md, padding: Spacing.three },
  resultText: { flex: 1, gap: Spacing.one },
  drawing: { width: 96, height: 64, justifyContent: 'flex-end' },
  // Lines pivot on their left end, so they rise from the same ground point.
  line: { position: 'absolute', left: 0, bottom: 2, width: 96, height: 4, borderRadius: 2, transformOrigin: 'left center' },
  limit: { height: 0, borderTopWidth: 2, borderStyle: 'dashed' },
  ground: { height: 2, borderRadius: 1 },
});
