import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconChip } from '@/components/ui/icon-chip';
import { Notice } from '@/components/ui/notice';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTogglePollVote } from '@/hooks/usePolls';
import { formatTimeRemaining } from '@/lib/format';
import { useAccent } from '@/hooks/use-theme';
import type { Poll } from '@/types';

export interface VoteCalloutProps {
  poll: Poll;
}

/**
 * An open community vote, surfaced so it is not missed before it closes.
 *
 * Owns its own vote action so every screen that shows a poll handles signing
 * in and failures the same way, rather than each one dropping errors.
 */
export function VoteCallout({ poll }: VoteCalloutProps) {
  const router = useRouter();
  const palette = useAccent('community');
  const toggleVote = useTogglePollVote();
  const [error, setError] = useState<string | null>(null);
  const remaining = formatTimeRemaining(poll.closesAt);
  const closed = remaining.short === 'Closed';
  const supporters = `${poll.voteCount} ${poll.voteCount === 1 ? 'supporter' : 'supporters'}`;

  async function vote() {
    setError(null);
    try {
      await toggleVote.mutateAsync(poll);
    } catch (caught) {
      if (caught instanceof Error && caught.message === 'AUTH_REQUIRED') {
        router.push('/auth' as never);
        return;
      }
      setError(closed ? 'This vote has closed.' : 'Could not save your vote. Please try again.');
    }
  }

  return (
    <Card tint={palette.tint} borderColor={palette.tint} style={styles.card}>
      <View style={styles.header}>
        <IconChip name="community" accent="community" />
        <View style={styles.body}>
          <Text variant="overline" colorValue={palette.fg} uppercase>
            {poll.hasVoted ? 'You support this' : 'Voting open'}
          </Text>
          <Text variant="subheading">{poll.title}</Text>
          {/* The visible text is compact; the label spells it out for speech. */}
          <Text
            variant="caption"
            color="textSecondary"
            accessibilityLabel={`${poll.location}. ${remaining.long}. ${supporters}.`}
          >
            {poll.location} · {remaining.short} · {supporters}
          </Text>
        </View>
      </View>

      <Notice message={error} />

      <Button
        label={poll.hasVoted ? 'Withdraw my vote' : 'Support this change'}
        accent="community"
        variant={poll.hasVoted ? 'outline' : 'solid'}
        onPress={vote}
        disabled={closed || toggleVote.isPending}
        block
        accessibilityLabel={
          poll.hasVoted
            ? `Withdraw your vote on ${poll.title}`
            : `Support ${poll.title} at ${poll.location}`
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
