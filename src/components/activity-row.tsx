import { ListRow } from '@/components/ui/list-row';
import { ACTIVITY_DISPLAY } from '@/lib/display';
import { formatRelativeTime } from '@/lib/format';
import type { ActivityEvent } from '@/types';

export interface ActivityRowProps {
  event: ActivityEvent;
  onPress?: (event: ActivityEvent) => void;
}

/** One entry in the activity feed. */
export function ActivityRow({ event, onPress }: ActivityRowProps) {
  const { icon, accent } = ACTIVITY_DISPLAY[event.kind];
  const time = formatRelativeTime(event.occurredAt);

  return (
    <ListRow
      icon={icon}
      accent={accent}
      title={event.title}
      subtitle={event.subtitle}
      meta={time.short}
      onPress={onPress ? () => onPress(event) : undefined}
      // "2h ago" would be read out as "two h ago" — use the spelled-out form.
      accessibilityLabel={`${event.title}. ${event.subtitle}. ${time.long}`}
      accessibilityHint={onPress ? 'Opens the full details' : undefined}
    />
  );
}
