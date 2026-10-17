import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useAccent, useTheme } from '@/hooks/use-theme';
import { averageDbfs, dbfsToQuietScore, describeQuietScore } from '@/lib/sound-level';

/** Long enough to smooth over a single door slam, short enough to stand still for. */
const MEASURE_MS = 10_000;
const SAMPLE_MS = 250;

const METERING_OPTIONS = { ...RecordingPresets.LOW_QUALITY, isMeteringEnabled: true };

/**
 * Android reports the *peak* level since the last poll, while iOS and web
 * report average (RMS) power. Speech and room noise peak roughly 10 dB above
 * their average, so without this the same room scores louder on Android.
 */
const PLATFORM_OFFSET_DB = Platform.OS === 'android' ? -10 : 0;

/** Below this a reading is "no data" (Android's first poll reports -160). */
const MIN_VALID_DBFS = -100;

function toAverageDbfs(raw: number) {
  return raw + PLATFORM_OFFSET_DB;
}

export interface SoundMeterProps {
  /** Called with a 0–100 quiet score once a measurement completes. */
  onMeasured: (quietScore: number) => void;
}

/**
 * Measures how loud a place is with the phone (or laptop) microphone.
 *
 * The recording is only used for its live level reading; the audio file is
 * thrown away and never uploaded.
 */
export function SoundMeter({ onMeasured }: SoundMeterProps) {
  const recorder = useAudioRecorder(METERING_OPTIONS);
  const state = useAudioRecorderState(recorder, SAMPLE_MS);
  const theme = useTheme();
  const quiet = useAccent('quiet');
  const samples = useRef<number[]>([]);
  // Guards set synchronously: `measuring` state lands a render later, too late
  // to stop a double tap, and the screen can close mid-measurement.
  const busy = useRef(false);
  const unmounted = useRef(false);

  useEffect(() => {
    unmounted.current = false;
    return () => { unmounted.current = true; };
  }, []);
  const [measuring, setMeasuring] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Collect readings while measuring; a ref, because each sample must not
  // re-render the screen.
  useEffect(() => {
    if (measuring && typeof state.metering === 'number' && state.metering > MIN_VALID_DBFS) {
      samples.current.push(toAverageDbfs(state.metering));
    }
  }, [measuring, state.metering]);

  async function measure() {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    setResult(null);

    let recording = false;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone access is off. Allow it in your settings to measure, or pick a level below instead.');
        return;
      }

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync(METERING_OPTIONS);
      samples.current = [];
      recorder.record();
      recording = true;
      setMeasuring(true);

      for (let left = MEASURE_MS / 1000; left > 0 && !unmounted.current; left--) {
        setSecondsLeft(left);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      if (unmounted.current) return;

      const average = averageDbfs(samples.current);
      if (average === null) {
        setError('This device did not report a sound level. Pick a level below instead.');
        return;
      }

      const score = dbfsToQuietScore(average);
      setResult(score);
      onMeasured(score);
    } catch {
      if (!unmounted.current) setError('Could not use the microphone. Pick a level below instead.');
    } finally {
      // Always release the microphone and leave record mode, or iOS keeps the
      // audio session configured for recording after the screen is gone.
      if (recording) await recorder.stop().catch(() => {});
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      busy.current = false;
      if (!unmounted.current) setMeasuring(false);
    }
  }

  // 0–1 for the live bar; louder fills more.
  const level = typeof state.metering === 'number' && measuring ? 1 - dbfsToQuietScore(toAverageDbfs(state.metering)) / 100 : 0;

  return (
    <View style={styles.wrapper}>
      <Button
        label={measuring ? `Measuring… ${secondsLeft}s` : result === null ? 'Measure noise with microphone' : 'Measure again'}
        icon="quiet"
        variant="tonal"
        accent="quiet"
        onPress={measure}
        disabled={measuring}
        accessibilityHint="Listens for 10 seconds to measure how loud it is here. Nothing is recorded or uploaded."
      />
      {measuring ? (
        <View style={[styles.track, { backgroundColor: theme.backgroundElement }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <View style={[styles.fill, { width: `${Math.round(level * 100)}%`, backgroundColor: quiet.solid }]} />
        </View>
      ) : null}
      {result !== null ? (
        <Text variant="callout" colorValue={quiet.fg} accessibilityLiveRegion="polite">
          Measured: {describeQuietScore(result)} (quiet score {result}/100). Selected below.
        </Text>
      ) : null}
      <Notice message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.two },
  track: { height: 10, borderRadius: Radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.full },
});
