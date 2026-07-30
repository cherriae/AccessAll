import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { ListRow } from '@/components/ui/list-row';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { REPORT_STATUS_DISPLAY } from '@/lib/display';
import { formatCount, formatRelativeTime } from '@/lib/format';
import type { Report } from '@/types';

export interface ReportRowProps {
  report: Report;
  onPress?: (report: Report) => void;
}

/** One reported accessibility barrier. */
export function ReportRow({ report, onPress }: ReportRowProps) {
  const status = REPORT_STATUS_DISPLAY[report.status];
  const time = formatRelativeTime(report.createdAt);

  return (
    <ListRow
      icon={status.icon}
      accent={status.accent}
      title={report.title}
      subtitle={report.location}
      meta={time.short}
      onPress={onPress ? () => onPress(report) : undefined}
      accessibilityLabel={[
        report.title,
        report.location,
        `status ${status.label}`,
        `${formatCount(report.upvotes)} people affected`,
        time.long,
      ].join('. ')}
      accessibilityHint={onPress ? 'Opens the report' : undefined}
    >
      <View style={styles.footer}>
        <Badge label={status.label} accent={status.accent} icon={status.icon} />
        <Text variant="caption" color="textTertiary">
          {formatCount(report.upvotes)} affected
        </Text>
      </View>
    </ListRow>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
});
