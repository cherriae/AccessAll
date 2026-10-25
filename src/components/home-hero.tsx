import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { PIN_COLORS } from '@/constants/map';
import { Fonts, MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

/** The night-map palette from the landing page, fixed in both themes. */
const INK = '#0E1424';
const INK_LINE = 'rgba(255,255,255,0.06)';
const LIGHT = '#F5F2EC';
const MUTED = '#B3B8C8';

/** Decorative pins scattered behind the greeting, as on the landing page map. */
const DOTS = [
  { top: '18%', left: '72%', color: '#FFAD3B' },
  { top: '42%', left: '88%', color: '#C2A3FF' },
  { top: '64%', left: '64%', color: '#45D6EE' },
  { top: '26%', left: '56%', color: '#7B74FF' },
  { top: '74%', left: '84%', color: '#FFAD3B' },
] as const;

const ACTIONS: { label: string; icon: IconName; route: string; color: string }[] = [
  { label: 'Report a barrier', icon: 'add', route: '/reports', color: PIN_COLORS.report },
  { label: 'Find a place', icon: 'place', route: '/explore', color: PIN_COLORS.place },
  { label: 'See the impact', icon: 'activity', route: '/impact', color: PIN_COLORS.outage },
];

function greeting(now = new Date()) {
  const hour = now.getHours();
  return hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

/**
 * The top of the home screen: a slice of the night map with a personal
 * greeting and the three things people come here to do.
 */
export function HomeHero({ firstName }: { firstName?: string }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  return (
    <View style={styles.card}>
      <View style={styles.grid} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {[0, 1, 2, 3, 4].map((line) => (
          <View key={`h${line}`} style={[styles.hLine, { top: `${line * 25}%` }]} />
        ))}
        {[0, 1, 2, 3, 4, 5].map((line) => (
          <View key={`v${line}`} style={[styles.vLine, { left: `${line * 20}%`, transform: [{ skewX: '-18deg' }] }]} />
        ))}
        {DOTS.map((dot, index) => (
          <View key={index} style={[styles.dotWrap, { top: dot.top, left: dot.left }]}>
            <View style={[styles.halo, { backgroundColor: dot.color, opacity: reduceMotion ? 0.18 : 0.28 }]} />
            <View style={[styles.dot, { backgroundColor: dot.color }]} />
          </View>
        ))}
      </View>

      <Text variant="overline" colorValue={MUTED} uppercase>{greeting()}</Text>
      <Text style={styles.title} accessibilityRole="header">
        {firstName ? `Hi ${firstName}.\nWhat's in your way today?` : "What's in your way today?"}
      </Text>

      <View style={styles.actions}>
        {ACTIONS.map((action) => (
          <Pressable
            key={action.label}
            onPress={() => router.push(action.route as never)}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
          >
            <View style={[styles.actionIcon, { backgroundColor: action.color }]}>
              <Icon name={action.icon} size={18} color="#FFFFFF" />
            </View>
            <Text variant="label" colorValue={LIGHT} style={styles.actionLabel}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: INK,
    borderRadius: 28,
    padding: Spacing.four,
    gap: Spacing.two,
    overflow: 'hidden',
  },
  grid: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  hLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: INK_LINE },
  vLine: { position: 'absolute', top: -20, bottom: -20, width: 1, backgroundColor: INK_LINE },
  dotWrap: { position: 'absolute', width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 28, height: 28, borderRadius: Radius.full },
  dot: { width: 10, height: 10, borderRadius: Radius.full, borderWidth: 2, borderColor: INK },
  title: { fontFamily: Fonts.displayHeavy, fontSize: 30, lineHeight: 34, letterSpacing: -0.8, color: LIGHT, maxWidth: 320 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.three },
  action: {
    flexGrow: 1,
    flexBasis: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: MinTouchTarget + 8,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  actionIcon: { width: 30, height: 30, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { flexShrink: 1 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
