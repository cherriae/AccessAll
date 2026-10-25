import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipGroup } from '@/components/ui/chip-group';
import { Icon, type IconName } from '@/components/ui/icon';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { Heading, Text } from '@/components/ui/text';
import { MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useAccent, useTheme } from '@/hooks/use-theme';
import { mixColor, simulateColor, type ColorVision } from '@/lib/color-vision';

/**
 * Empathy Lens: four short "walk in my shoes" simulations, each followed by
 * the design choice AccessAll makes because of it.
 *
 * Simulations are an imperfect stand-in for lived experience, and the screen
 * says so. Their job is to make an abstract word like "accessibility" concrete
 * for someone who has never had to think about it.
 */
export default function EmpathyScreen() {
  const router = useRouter();

  return (
    <Screen back>
      <PageHeader
        title="Empathy Lens"
        subtitle="Two minutes in someone else's shoes. Each lens simulates a barrier, then shows how AccessAll is built around it."
        icon="empathy"
        accent="quiet"
      />
      <LowVisionLens />
      <ColorLens />
      <TremorLens />
      <ScreenReaderLens />
      <Card style={styles.closing}>
        <Heading>Up to 1 in 4 adults in the U.S. has a disability.</Heading>
        <Text color="textSecondary">
          Source: CDC. A simulation lasts a minute; a broken elevator or an unlabelled button is every day. If you noticed a barrier at your school, put it on the map.
        </Text>
        <Button label="Report a barrier" icon="add" onPress={() => router.push('/reports' as never)} block />
      </Card>
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */

function LensCard({ step, title, icon, how, children }: { step: number; title: string; icon: IconName; how: string; children: React.ReactNode }) {
  const quiet = useAccent('quiet');
  return (
    <Card style={styles.lens}>
      <View style={styles.lensHeader}>
        <View style={[styles.stepBadge, { backgroundColor: quiet.solid }]}>
          <Text variant="label" colorValue={quiet.onSolid}>{step}</Text>
        </View>
        <Heading style={styles.flex}>{title}</Heading>
        <Icon name={icon} size={22} color={quiet.fg} />
      </View>
      {children}
      <View style={[styles.how, { backgroundColor: quiet.tint }]}>
        <Text variant="overline" colorValue={quiet.fg} uppercase>How AccessAll handles it</Text>
        <Text variant="callout" colorValue={quiet.fg}>{how}</Text>
      </View>
    </Card>
  );
}

function LensToggle({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <Button
      label={on ? 'Take the lens off' : label}
      icon="empathy"
      variant={on ? 'outline' : 'tonal'}
      accent="quiet"
      onPress={() => onChange(!on)}
      accessibilityHint="Turns the simulation on or off"
      block
    />
  );
}

/* 1. Low vision ------------------------------------------------------------- */

const SIGN_BG = '#1D3B2A';
const SIGN_FG = '#F4F1E8';

function LowVisionLens() {
  const [on, setOn] = useState(false);
  const foreground = on ? mixColor(SIGN_FG, SIGN_BG, 0.55) : SIGN_FG;

  return (
    <LensCard
      step={1}
      title="Low vision"
      icon="vision"
      how="Body text uses Atkinson Hyperlegible, a font from the Braille Institute that keeps similar letters distinct. Every screen follows your phone's text size and bold text settings."
    >
      <Text color="textSecondary">Find the room next to the elevator. Then put the lens on: blurred, low-contrast, tunnel vision, as with glaucoma.</Text>
      <View style={[styles.sign, { backgroundColor: SIGN_BG }]} accessible accessibilityLabel="Hallway sign: Elevator, next to room 214. Gym closed, use the east entrance.">
        <View style={on && Platform.OS === 'web' ? styles.blur : null}>
          <Text style={[styles.signTitle, styles.center]} colorValue={foreground}>↑ ELEVATOR · RM 214</Text>
          <Text variant="callout" colorValue={foreground} style={styles.center}>Rooms 201–213 ← · Gym CLOSED, use east entrance →</Text>
        </View>
        {on ? <View style={styles.tunnel} pointerEvents="none" /> : null}
      </View>
      <LensToggle on={on} onChange={setOn} label="Put on the low-vision lens" />
    </LensCard>
  );
}

/* 2. Colour blindness ------------------------------------------------------ */

const STATUS_RED = '#DC2626';
const STATUS_GREEN = '#16A34A';
const ELEVATORS = [
  { name: 'Main lobby', working: true },
  { name: 'Library wing', working: false },
  { name: 'Gym', working: true },
  { name: 'Cafeteria', working: false },
];
const VISION_OPTIONS = [
  { value: 'typical', label: 'Typical' },
  { value: 'deuteranopia', label: 'Deuteranopia' },
  { value: 'protanopia', label: 'Protanopia' },
];

function ColorLens() {
  const [vision, setVision] = useState<ColorVision>('typical');
  const [accessible, setAccessible] = useState(false);
  const theme = useTheme();

  return (
    <LensCard
      step={2}
      title="Colour blindness"
      icon="vision"
      how="Colour is never the only signal. Every status pairs colour with an icon and words, and map pins differ in shape too: outages are square, barriers round."
    >
      <Text color="textSecondary">Which elevators are broken? Easy. Now switch how you see colour.</Text>
      <ChipGroup label="Colour vision" options={VISION_OPTIONS} value={vision} onChange={(value) => setVision(value as ColorVision)} />
      <View style={styles.board}>
        {ELEVATORS.map((elevator) => {
          const color = simulateColor(elevator.working ? STATUS_GREEN : STATUS_RED, vision);
          return (
            <View
              key={elevator.name}
              style={[styles.boardRow, { borderColor: theme.border }]}
              accessible
              accessibilityLabel={accessible ? `${elevator.name}: ${elevator.working ? 'working' : 'out of service'}` : `${elevator.name}: status shown by colour only`}
            >
              <View style={[styles.statusDot, { backgroundColor: color }]}>
                {accessible ? <Icon name={elevator.working ? 'resolved' : 'warning'} size={16} color="#FFFFFF" /> : null}
              </View>
              <Text style={styles.flex}>{elevator.name}</Text>
              {accessible ? <Text variant="label" colorValue={color}>{elevator.working ? 'Working' : 'Out of service'}</Text> : null}
            </View>
          );
        })}
      </View>
      <Button
        label={accessible ? 'Show colour-only version' : 'Show the AccessAll version'}
        variant="tonal"
        accent="quiet"
        onPress={() => setAccessible(!accessible)}
        block
      />
    </LensCard>
  );
}

/* 3. Tremor ---------------------------------------------------------------- */

const TARGET_HITS = 3;

function TremorLens() {
  const reduceMotion = useReducedMotion();
  const [on, setOn] = useState(false);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const shake = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { translateY: y.get() }] }));
  const quiet = useAccent('quiet');
  const theme = useTheme();

  useEffect(() => {
    if (!on || reduceMotion) { x.set(0); y.set(0); return; }
    const interval = setInterval(() => {
      x.set(withTiming((Math.random() - 0.5) * 70, { duration: 110 }));
      y.set(withTiming((Math.random() - 0.5) * 40, { duration: 110 }));
    }, 120);
    return () => clearInterval(interval);
  }, [on, reduceMotion, x, y]);

  function reset(next: boolean) {
    setOn(next);
    setHits(0);
    setMisses(0);
  }

  const done = hits >= TARGET_HITS;

  return (
    <LensCard
      step={3}
      title="Hand tremor"
      icon="accessibility"
      how={`Every button in AccessAll is at least ${MinTouchTarget} points tall, the size Apple and Google recommend, and nothing important needs a double tap, a long press or a precise drag.`}
    >
      <Text color="textSecondary">
        {on
          ? reduceMotion
            ? 'Reduce Motion is on, so the target holds still. Imagine it shaking as you try.'
            : `Tap the tiny "Send" button ${TARGET_HITS} times. Your hand is shaking.`
          : 'With the lens on, your taps shake like a tremor from Parkinson\'s or cerebral palsy.'}
      </Text>
      {on ? (
        <Pressable
          onPress={() => !done && setMisses((count) => count + 1)}
          style={[styles.tremorArea, { backgroundColor: theme.backgroundElement }]}
          accessibilityLabel="Tremor practice area"
        >
          <Animated.View style={shake}>
            <Pressable
              onPress={() => setHits((count) => count + 1)}
              disabled={done}
              style={[styles.tinyTarget, { backgroundColor: quiet.solid }]}
              accessibilityRole="button"
              accessibilityLabel="Send"
            >
              <Text style={styles.tinyLabel} colorValue={quiet.onSolid}>Send</Text>
            </Pressable>
          </Animated.View>
          <Text variant="caption" color="textSecondary" style={styles.tremorScore} accessibilityLiveRegion="polite">
            {done ? `Done: ${misses} missed ${misses === 1 ? 'tap' : 'taps'} on the way.` : `Hits ${hits}/${TARGET_HITS} · misses ${misses}`}
          </Text>
        </Pressable>
      ) : null}
      <LensToggle on={on} onChange={reset} label="Put on the tremor lens" />
    </LensCard>
  );
}

/* 4. Screen reader ----------------------------------------------------------- */

const UNLABELLED = 'Button. Button. Image. Unlabelled button. Link.';
const LABELLED = 'Report a barrier, button. Opens the campus reporting form. Elevator at Main lobby, out of service. Back, button.';

function ScreenReaderLens() {
  const [speaking, setSpeaking] = useState<'bad' | 'good' | null>(null);

  useEffect(() => () => { Speech.stop(); }, []);

  function play(version: 'bad' | 'good') {
    Speech.stop();
    setSpeaking(version);
    Speech.speak(version === 'bad' ? UNLABELLED : LABELLED, {
      rate: 1.05,
      onDone: () => setSpeaking(null),
      onStopped: () => setSpeaking(null),
      onError: () => setSpeaking(null),
    });
  }

  return (
    <LensCard
      step={4}
      title="Blind, using a screen reader"
      icon="hearing"
      how="Every button, pin and chart in AccessAll has a spoken label and hint, decorative icons are hidden from screen readers, and live readings like the sound meter announce themselves."
    >
      <Text color="textSecondary">People who are blind hear apps instead of seeing them. Listen to the same screen built two ways.</Text>
      <View style={styles.listenRow}>
        <Button label={speaking === 'bad' ? 'Playing…' : 'Typical app'} icon="hearing" variant="outline" accent="quiet" onPress={() => play('bad')} />
        <Button label={speaking === 'good' ? 'Playing…' : 'AccessAll'} icon="hearing" variant="tonal" accent="quiet" onPress={() => play('good')} />
      </View>
      {speaking ? (
        <Text variant="callout" style={styles.transcript} accessibilityLiveRegion="polite">
          “{speaking === 'bad' ? UNLABELLED : LABELLED}”
        </Text>
      ) : null}
    </LensCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  lens: { gap: Spacing.three },
  lensHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepBadge: { width: 28, height: 28, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  how: { borderRadius: Radius.md, padding: Spacing.three, gap: Spacing.one },
  sign: { borderRadius: Radius.md, padding: Spacing.four, gap: Spacing.two, overflow: 'hidden', minHeight: 160, justifyContent: 'center', alignItems: 'center' },
  signTitle: { fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: 1 },
  blur: { filter: 'blur(3px)' } as object,
  // A huge ring with a clear hole: everything outside the hole goes dark.
  tunnel: {
    position: 'absolute', width: 1000, height: 1000, borderRadius: 500, borderWidth: 370,
    borderColor: 'rgba(5,8,14,0.93)', top: '50%', left: '50%', marginTop: -500, marginLeft: -500,
  },
  board: { gap: Spacing.two },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.three },
  statusDot: { width: 24, height: 24, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  tremorArea: { height: 160, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  tinyTarget: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tinyLabel: { fontSize: 10, lineHeight: 14 },
  tremorScore: { position: 'absolute', bottom: Spacing.two },
  listenRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  transcript: { fontStyle: 'italic' },
  closing: { gap: Spacing.three },
});
