import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconChip } from '@/components/ui/icon-chip';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { formatTimeRemaining } from '@/lib/format';
import { useAccent } from '@/hooks/use-theme';
import type { Poll } from '@/types';

export interface VoteCalloutProps {
  poll: Poll;
  onVote: (poll: Poll) => void;
}

/** An open community vote, surfaced so it is not missed before it closes. */
export function VoteCallout({ poll, onVote }: VoteCalloutProps) {
  const palette = useAccent('community');
  const remaining = formatTimeRemaining(poll.closesAt);
  const closed = remaining.short === 'Closed';

  return (
    <Card tint={palette.tint} borderColor={palette.tint} style={styles.card}>
      <View style={styles.header}>
        <IconChip name="community" accent="community" />
        <View style={styles.body}>
          <Text variant="overline" colorValue={palette.fg} uppercase>
            {poll.hasVoted ? 'You voted' : 'Voting open'}
          </Text>
          <Text variant="subheading">{poll.title}</Text>
          {/* The visible text is compact; the label spells it out for speech. */}
          <Text
            variant="caption"
            color="textSecondary"
            accessibilityLabel={`${poll.location}. ${remaining.long}`}
          >
            {poll.location} · {remaining.short}
          </Text>
        </View>
      </View>

      <Button
        label={poll.hasVoted ? 'View results' : 'Vote now'}
        accent="community"
        variant={poll.hasVoted ? 'outline' : 'solid'}
        onPress={() => onVote(poll)}
        disabled={closed && !poll.hasVoted}
        block
        accessibilityLabel={
          poll.hasVoted
            ? `View results for ${poll.title}`
            : `Vote now on ${poll.title} at ${poll.location}`
        }
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  body: {
    flex: 1,
    gap: Spacing.half,
  },
});
