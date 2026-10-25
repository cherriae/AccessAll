import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Heading, Text } from '@/components/ui/text';
import { MinTouchTarget, Radius, Spacing, type AccentName } from '@/constants/theme';
import { useAccent, useTheme } from '@/hooks/use-theme';
import { markOnboardingDone } from '@/lib/onboarding';

interface Slide {
  title: string;
  body: string;
  icon: IconName;
  accent: AccentName;
}

const SLIDES: Slide[] = [
  {
    title: 'Spot a barrier?\nSay so.',
    body: 'Report a blocked ramp, a broken elevator or a hallway that is too loud. Classmates who hit it too can back you up.',
    icon: 'campus',
    accent: 'campus',
  },
  {
    title: 'Places scored\nfor you.',
    body: 'Tell AccessAll what you need once. Every place then shows how well it fits you, not a generic checklist.',
    icon: 'accessibility',
    accent: 'explore',
  },
  {
    title: 'Find your\nquiet.',
    body: 'Measure how loud a place is with your phone, and find calm spaces when you need one.',
    icon: 'quiet',
    accent: 'quiet',
  },
  {
    title: 'Watch it\nget fixed.',
    body: 'Turn a report into a formal letter to your school in one tap, and get notified when staff respond.',
    icon: 'resolved',
    accent: 'success',
  },
];

/**
 * First-launch walkthrough on phones. (Web visitors get the landing page.)
 *
 * Four short cards, each in the colour of the part of the app it describes, so
 * the colours already mean something by the time the user reaches the tabs.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const palette = useAccent(slide.accent);
  const last = index === SLIDES.length - 1;

  async function finish(to: '/auth?mode=signup' | '/auth' | '/') {
    await markOnboardingDone();
    router.replace(to as never);
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.three }]}>
      <View style={styles.top}>
        <View style={styles.dots} accessible accessibilityLabel={`Step ${index + 1} of ${SLIDES.length}`}>
          {SLIDES.map((item, position) => (
            <View
              key={item.title}
              style={[styles.dot, { backgroundColor: position === index ? palette.solid : theme.borderStrong, width: position === index ? 22 : 8 }]}
            />
          ))}
        </View>
        {!last ? (
          <Pressable onPress={() => finish('/')} accessibilityRole="button" hitSlop={Spacing.two} style={styles.skip}>
            <Text variant="label" color="textSecondary">Skip</Text>
          </Pressable>
        ) : null}
      </View>

      <Animated.View
        key={index}
        entering={FadeInRight.duration(380).reduceMotion(ReduceMotion.System)}
        exiting={FadeOutLeft.duration(200).reduceMotion(ReduceMotion.System)}
        style={styles.slide}
      >
        <View style={[styles.art, { backgroundColor: palette.tint }]}>
          <View style={[styles.ring, { borderColor: palette.fg, opacity: 0.18, transform: [{ scale: 1.45 }] }]} />
          <View style={[styles.ring, { borderColor: palette.fg, opacity: 0.32, transform: [{ scale: 1.15 }] }]} />
          <View style={[styles.badge, { backgroundColor: palette.solid }]}>
            <Icon name={slide.icon} size={56} color={palette.onSolid} />
          </View>
        </View>
        <Heading variant="display" style={styles.title}>{slide.title}</Heading>
        <Text color="textSecondary" style={styles.body}>{slide.body}</Text>
      </Animated.View>

      <View style={styles.actions}>
        {last ? (
          <>
            <Button label="Create my account" size="lg" onPress={() => finish('/auth?mode=signup')} block />
            <Button label="I already have an account" variant="outline" onPress={() => finish('/auth')} block />
            <Button label="Look around first" variant="ghost" onPress={() => finish('/')} block />
          </>
        ) : (
          <Button label="Next" size="lg" icon="chevron" iconPosition="trailing" onPress={() => setIndex(index + 1)} block />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: Spacing.four, gap: Spacing.four },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: MinTouchTarget },
  dots: { flexDirection: 'row', gap: Spacing.one, alignItems: 'center' },
  dot: { height: 8, borderRadius: Radius.full },
  skip: { minHeight: MinTouchTarget, justifyContent: 'center' },
  slide: { flex: 1, justifyContent: 'center', gap: Spacing.three },
  art: { height: 240, borderRadius: 32, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: Spacing.three },
  ring: { position: 'absolute', width: 140, height: 140, borderRadius: Radius.full, borderWidth: 2 },
  badge: { width: 112, height: 112, borderRadius: 36, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] },
  title: { fontSize: 40, lineHeight: 44 },
  body: { fontSize: 18, lineHeight: 27 },
  actions: { gap: Spacing.two },
});
