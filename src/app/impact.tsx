import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FixTimeline } from '@/components/fix-timeline';
import { PromoCard } from '@/components/promo-card';
import { ReportRow } from '@/components/report-row';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState, LoadingState } from '@/components/ui/loading-state';
import { Notice } from '@/components/ui/notice';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, type AccentName } from '@/constants/theme';
import { useAccent, useTheme } from '@/hooks/use-theme';
import { useImpactSummary, useTopOpenReports } from '@/hooks/useImpact';
import { formatCount } from '@/lib/format';
import { shareText } from '@/lib/share';
import type { ImpactSummary } from '@/types';

function Stat({ value, label, accent }: { value: string; label: string; accent: AccentName }) {
  const palette = useAccent(accent);
  return (
    <Card tint={palette.tint} borderColor={palette.tint} style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <Text variant="display" colorValue={palette.fg}>{value}</Text>
      <Text variant="callout" color="textSecondary">{label}</Text>
    </Card>
  );
}

function impactMessage(summary: ImpactSummary) {
  return [
    `AccessAll: ${formatCount(summary.reportsTotal)} accessibility barriers reported, ` +
      `${formatCount(summary.reportsResolved)} fixed, ${formatCount(summary.peopleAffected)} times students said "this affects me".`,
    `${formatCount(summary.placesReviewed)} places reviewed by ${formatCount(summary.contributors)} contributors.`,
  ].join(' ');
}

export default function ImpactScreen() {
  const router = useRouter();
  const theme = useTheme();
  const success = useAccent('success');
  const summaryQuery = useImpactSummary();
  const topQuery = useTopOpenReports();
  const summary = summaryQuery.data;
  const [copied, setCopied] = useState(false);

  if (summaryQuery.isLoading) return <Screen back><LoadingState label="Loading impact" /></Screen>;
  if (!summary) return <Screen back><ErrorState title="Could not load impact" onRetry={() => summaryQuery.refetch()} /></Screen>;

  const resolvedShare = summary.reportsTotal > 0 ? Math.round((summary.reportsResolved / summary.reportsTotal) * 100) : 0;

  return (
    <Screen back>
      <PageHeader
        title="Our impact"
        subtitle="What students have reported, who it affects, and what has been fixed so far. Updated live."
        icon="activity"
        accent="success"
      />

      <View style={styles.grid}>
        <Stat value={formatCount(summary.reportsTotal)} label="barriers reported" accent="explore" />
        <Stat value={formatCount(summary.reportsResolved)} label="barriers fixed" accent="success" />
        <Stat value={formatCount(summary.peopleAffected)} label="times someone said “this affects me”" accent="campus" />
        <Stat value={formatCount(summary.contributors)} label="contributors" accent="community" />
      </View>

      <FixTimeline />

      <Section title="Getting barriers fixed">
        <Card style={styles.card}>
          <Text variant="bodyStrong">{resolvedShare}% of reported barriers are fixed</Text>
          <View
            style={[styles.track, { backgroundColor: theme.backgroundElement }]}
            accessibilityRole="progressbar"
            accessibilityLabel={`${resolvedShare} percent of reported barriers are fixed`}
            accessibilityValue={{ min: 0, max: 100, now: resolvedShare }}
          >
            <View style={[styles.fill, { width: `${resolvedShare}%`, backgroundColor: success.solid }]} />
          </View>
          <Text color="textSecondary">
            {formatCount(summary.reportsInProgress)} in progress.{' '}
            {summary.medianDaysToResolve === null
              ? 'No barrier has been fixed yet.'
              : `Half of fixed barriers were fixed within ${summary.medianDaysToResolve} ${summary.medianDaysToResolve === 1 ? 'day' : 'days'}.`}
          </Text>
        </Card>
      </Section>

      <Section title="Places mapped">
        <Card style={styles.card}>
          <Text>
            {formatCount(summary.placesReviewed)} places reviewed in {formatCount(summary.reviewsTotal)} reviews,
            including {formatCount(summary.soundMeasurements)} noise levels measured with a microphone
            and {formatCount(summary.rampsMeasured)} ramp slopes measured with a phone&apos;s motion sensor.
          </Text>
        </Card>
      </Section>

      <PromoCard
        icon="empathy"
        accent="quiet"
        title="Why it matters"
        body="Try the Empathy Lens: two minutes with low vision, colour blindness, tremor and a screen reader."
        action="Try it"
        onPress={() => router.push('/empathy' as never)}
      />

      <Section title="Most urgent open barriers">
        {topQuery.isLoading ? (
          <LoadingState label="Loading reports" />
        ) : topQuery.isError ? (
          <ErrorState title="Could not load open barriers" onRetry={() => topQuery.refetch()} />
        ) : (topQuery.data ?? []).length > 0 ? (
          <View style={styles.list}>
            {topQuery.data!.map((report) => (
              <ReportRow key={report.id} report={report} onPress={() => router.push(`/report/${report.id}` as never)} />
            ))}
          </View>
        ) : (
          <EmptyState icon="resolved" title="Nothing open" message="Every reported barrier has been fixed." />
        )}
      </Section>

      <Button
        label="Share these numbers"
        icon="community"
        variant="outline"
        onPress={async () => setCopied((await shareText(impactMessage(summary))) === 'copied')}
        block
      />
      <Notice message={copied ? 'Copied. Paste it anywhere to share.' : null} tone="success" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  stat: { flexGrow: 1, flexBasis: '45%', gap: Spacing.one },
  card: { gap: Spacing.two },
  track: { height: 12, borderRadius: Radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.full },
  list: { gap: Spacing.two },
});
