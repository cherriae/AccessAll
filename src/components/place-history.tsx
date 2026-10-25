import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { Text } from '@/components/ui/text';
import { Fonts, MinTouchTarget, Spacing } from '@/constants/theme';
import { useIsStaff } from '@/hooks/useStaff';
import { usePlaceEdits, useRevertPlaceEdit } from '@/hooks/useModeration';
import { formatRelativeTime } from '@/lib/format';
import type { PlaceEdit } from '@/types';

/** "added Elevator, removed Ramp and rewrote the guide" */
export function describeEdit(edit: Pick<PlaceEdit, 'added' | 'removed' | 'guideChanged'>): string {
  const parts = [
    edit.added.length ? `added ${edit.added.join(', ')}` : null,
    edit.removed.length ? `removed ${edit.removed.join(', ')}` : null,
    edit.guideChanged ? 'rewrote the guide' : null,
  ].filter((part): part is string => Boolean(part));

  if (parts.length === 0) return 'made a change';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * Who changed this place's access details, and when.
 *
 * Collapsed by default: most visitors only need to know it exists. Staff can
 * undo a change, which matters when someone adds a feature that is not there.
 */
export function PlaceHistory({ placeId }: { placeId: string }) {
  const edits = usePlaceEdits(placeId).data ?? [];
  const isStaff = useIsStaff().data ?? false;
  const revert = useRevertPlaceEdit();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (edits.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Edit history, ${edits.length} ${edits.length === 1 ? 'change' : 'changes'}`}
        style={styles.toggle}
      >
        <Icon name="history" color="textSecondary" />
        <Text variant="label" color="textSecondary">
          Edit history · {edits.length} {edits.length === 1 ? 'change' : 'changes'}
        </Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color="textSecondary" />
      </Pressable>
      {open ? (
        <Card style={styles.list}>
          {edits.map((edit) => (
            <View key={edit.id} style={styles.row}>
              <Text variant="callout" style={edit.revertedAt ? styles.reverted : null}>
                <Text variant="callout" color="text" style={styles.name}>{edit.editorName}</Text> {describeEdit(edit)}
              </Text>
              <Text variant="caption" color="textSecondary">
                {formatRelativeTime(edit.createdAt).short}
                {edit.revertedAt ? ' · undone by staff' : ''}
              </Text>
              {isStaff && !edit.revertedAt ? (
                <Button
                  label="Undo this change"
                  variant="ghost"
                  onPress={async () => {
                    setError(null);
                    try {
                      await revert.mutateAsync({ id: edit.id, placeId });
                    } catch {
                      setError('Could not undo this change. Please try again.');
                    }
                  }}
                  disabled={revert.isPending}
                />
              ) : null}
            </View>
          ))}
          <Notice message={error} />
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.two },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: MinTouchTarget, alignSelf: 'flex-start' },
  list: { gap: Spacing.three },
  row: { gap: Spacing.half },
  name: { fontFamily: Fonts.bodyBold },
  reverted: { textDecorationLine: 'line-through' },
});
