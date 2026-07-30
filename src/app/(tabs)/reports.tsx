import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ReportRow } from '@/components/report-row';
import { Button } from '@/components/ui/button';
import { ChipGroup, type ChipOption } from '@/components/ui/chip-group';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Heading, Text } from '@/components/ui/text';
import { VoteCallout } from '@/components/vote-callout';
import { Spacing } from '@/constants/theme';
import { polls, reports } from '@/data/mock';
import { REPORT_STATUS_DISPLAY } from '@/lib/display';
import type { ReportStatus } from '@/types';
import { REPORT_STATUSES } from '@/types';

type Filter = 'all' | ReportStatus;

const FILTERS: ChipOption<Filter>[] = [
  { value: 'all', label: 'All' },
  ...REPORT_STATUSES.map((status) => ({
    value: status,
    label: REPORT_STATUS_DISPLAY[status].label,
  })),
];

export default function ReportsScreen() {
  const [filter, setFilter] = useState<Filter>('all');

  const visible = filter === 'all' ? reports : reports.filter((r) => r.status === filter);
  const openVotes = polls.filter((poll) => !poll.hasVoted);

  return (
    <Screen>
      <View style={styles.intro}>
        <Heading variant="title">Campus reports</Heading>
        <Text variant="body" color="textSecondary">
          Barriers reported at your school and nearby places.
        </Text>
      </View>

      <Button
        label="Report an issue"
        icon="add"
        size="lg"
        block
        onPress={() => {
          // TODO: navigate to the report composer once that screen exists.
        }}
        accessibilityHint="Opens a form to describe an accessibility barrier"
      />

      {openVotes.length > 0 ? (
        <Section title="Open votes">
          <View style={styles.list}>
            {openVotes.map((poll) => (
              <VoteCallout key={poll.id} poll={poll} onVote={() => undefined} />
            ))}
          </View>
        </Section>
      ) : null}

      <Section title={`${visible.length} ${visible.length === 1 ? 'report' : 'reports'}`}>
        <ChipGroup
          label="Filter reports by status"
          options={FILTERS}
          value={filter}
          onChange={setFilter}
        />

        {visible.length > 0 ? (
          <View style={styles.list}>
            {visible.map((report) => (
              <ReportRow key={report.id} report={report} />
            ))}
          </View>
        ) : (
          <EmptyState
            icon="resolved"
            title="Nothing here"
            message="No reports match this filter. Try selecting All."
          />
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    gap: Spacing.two,
  },
  list: {
    gap: Spacing.two,
  },
});
