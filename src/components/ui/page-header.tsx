import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { IconChip } from '@/components/ui/icon-chip';
import type { IconName } from '@/components/ui/icon';
import { Heading, Text } from '@/components/ui/text';
import { Radius, Spacing, type AccentName } from '@/constants/theme';
import { useAccent } from '@/hooks/use-theme';

export interface PageHeaderProps {
  title: string;
  subtitle: string;
  icon: IconName;
  /** The product area this screen belongs to; colours the banner. */
  accent: AccentName;
  /** Optional row under the text, e.g. a few headline numbers. */
  children?: ReactNode;
}

/**
 * The tinted banner at the top of a main screen.
 *
 * Each area keeps its own accent (reports indigo, explore amber, quiet violet…)
 * so the colour tells you where you are as well as the title does.
 */
export function PageHeader({ title, subtitle, icon, accent, children }: PageHeaderProps) {
  const palette = useAccent(accent);

  return (
    <View style={[styles.banner, { backgroundColor: palette.tint }]}>
      <View style={styles.row}>
        <IconChip name={icon} accent={accent} size="lg" />
        <View style={styles.text}>
          <Heading variant="title" colorValue={palette.fg}>{title}</Heading>
          <Text variant="callout" color="textSecondary">{subtitle}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

/** A single headline number inside a `PageHeader`. */
export function HeaderStat({ value, label, accent }: { value: string; label: string; accent: AccentName }) {
  const palette = useAccent(accent);
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <Text variant="heading" colorValue={palette.fg}>{value}</Text>
      <Text variant="caption" color="textSecondary">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: Radius.xl, padding: Spacing.three, gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  text: { flex: 1, gap: Spacing.half },
  stat: { flex: 1, gap: Spacing.half },
});
