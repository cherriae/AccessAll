import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PhotoPicker, StoredPhoto } from '@/components/photo-picker';
import { ReportContent } from '@/components/report-content';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Notice } from '@/components/ui/notice';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useDeleteDirection, useDirections, useSaveDirection } from '@/hooks/useDirections';
import { errorText } from '@/lib/errors';
import { formatRelativeTime } from '@/lib/format';
import type { DirectionStep, Place, PlaceDirection } from '@/types';

const MAX_STEPS = 30;

/** A step being edited. `key` keeps React state and in-flight uploads attached to the right step when one is removed. */
type DraftStep = DirectionStep & { key: string };

let nextStepKey = 0;
function draftStep(step: DirectionStep = { text: '' }): DraftStep {
  nextStepKey += 1;
  return { ...step, key: `step-${nextStepKey}` };
}

export interface PlaceDirectionsProps {
  /** The saved place, or undefined while it is still a map preview. */
  placeId?: string;
  userId?: string;
  /** Saves a map preview as a real place before the first route is added. */
  ensurePlace: () => Promise<Place>;
  /** Called after a save, with the place it was saved against. */
  onSaved: (place: Place) => void;
  onSignIn: () => void;
}

/**
 * Step-free directions: how to actually get in and around a place without
 * stairs, written as numbered steps a person can follow on arrival.
 *
 * A feature badge says a place *has* an elevator; it does not say the elevator
 * is behind the cafeteria and needs a staff key. That is what these are for.
 */
export function PlaceDirections({ placeId, userId, ensurePlace, onSaved, onSignIn }: PlaceDirectionsProps) {
  const directions = useDirections(placeId).data ?? [];
  const [editing, setEditing] = useState<PlaceDirection | 'new' | null>(null);

  return (
    <Section title="Step-free directions">
      <View style={styles.list}>
        {directions.map((direction) => (
          <DirectionCard
            key={direction.id}
            direction={direction}
            isOwn={direction.userId === userId}
            onEdit={() => setEditing(direction)}
          />
        ))}
        {directions.length === 0 && editing === null ? (
          <Text color="textSecondary">
            No step-free route yet. If you know how to get in and around without stairs, write it
            down step by step for the next person.
          </Text>
        ) : null}
        {editing !== null ? (
          <DirectionEditor
            key={editing === 'new' ? 'new' : editing.id}
            direction={editing === 'new' ? undefined : editing}
            ensurePlace={ensurePlace}
            onCancel={() => setEditing(null)}
            onSaved={(place) => { setEditing(null); onSaved(place); }}
          />
        ) : (
          <Button
            label={userId ? 'Add step-free directions' : 'Sign in to add directions'}
            icon="add"
            variant="outline"
            onPress={() => (userId ? setEditing('new') : onSignIn())}
            block
          />
        )}
      </View>
    </Section>
  );
}

function DirectionCard({ direction, isOwn, onEdit }: { direction: PlaceDirection; isOwn: boolean; onEdit: () => void }) {
  const remove = useDeleteDirection();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (!confirming) { setConfirming(true); return; }
    setConfirming(false);
    try {
      await remove.mutateAsync(direction);
    } catch {
      setError('Could not delete these directions. Please try again.');
    }
  }

  return (
    <Card style={styles.card}>
      <Text variant="bodyStrong">{direction.title}</Text>
      <Text variant="caption" color="textSecondary">
        By {isOwn ? 'you' : direction.authorName} · updated {formatRelativeTime(direction.updatedAt).short}
      </Text>
      {direction.steps.map((step, index) => (
        <View key={index} style={styles.step}>
          <Text accessibilityLabel={`Step ${index + 1} of ${direction.steps.length}: ${step.text}`}>
            <Text variant="bodyStrong">{index + 1}. </Text>
            {step.text}
          </Text>
          {step.photoPath ? <StoredPhoto path={step.photoPath} label={`Photo for step ${index + 1}`} /> : null}
        </View>
      ))}
      <Notice message={error} />
      {!isOwn ? <ReportContent targetType="direction" targetId={direction.id} authorId={direction.userId} authorName={direction.authorName} /> : null}
      {isOwn ? (
        <View style={styles.row}>
          <Button label="Edit" variant="outline" onPress={onEdit} />
          <Button label={confirming ? 'Tap again to delete' : 'Delete'} variant="ghost" icon="delete" onPress={onDelete} disabled={remove.isPending} />
        </View>
      ) : null}
    </Card>
  );
}

function DirectionEditor({ direction, ensurePlace, onCancel, onSaved }: {
  direction?: PlaceDirection;
  ensurePlace: () => Promise<Place>;
  onCancel: () => void;
  onSaved: (place: Place) => void;
}) {
  const save = useSaveDirection();
  const [title, setTitle] = useState(direction?.title ?? '');
  const [steps, setSteps] = useState<DraftStep[]>(() => (direction?.steps ?? [{ text: '' }, { text: '' }]).map(draftStep));
  const [uploads, setUploads] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function updateStep(key: string, change: Partial<DirectionStep>) {
    setSteps((current) => current.map((step) => (step.key === key ? { ...step, ...change } : step)));
  }

  async function submit() {
    if (!title.trim()) { setError('Say where the route goes, e.g. "Street to the library".'); return; }
    if (!steps.some((step) => step.text.trim())) { setError('Add at least one step.'); return; }
    setError(null);
    try {
      const place = await ensurePlace();
      await save.mutateAsync({ id: direction?.id, placeId: place.id, title, steps: steps.map(({ key: _key, ...step }) => step) });
      onSaved(place);
    } catch (caught) {
      setError(errorText(caught, 'Could not save these directions. Please try again.'));
    }
  }

  return (
    <Card style={styles.card}>
      <FormField label="Where does this route go?" value={title} onChangeText={setTitle} maxLength={120} placeholder="e.g. Street to the 3rd floor library" />
      {steps.map((step, index) => (
        <View key={step.key} style={styles.step}>
          <FormField
            label={`Step ${index + 1}`}
            value={step.text}
            onChangeText={(text) => updateStep(step.key, { text })}
            multiline
            maxLength={500}
            placeholder={index === 0 ? 'e.g. Use the side entrance on Fort Greene Pl; it has a ramp' : 'What to do next'}
          />
          <PhotoPicker
            label={`Photo for step ${index + 1}`}
            value={step.photoPath}
            onChange={(photoPath) => updateStep(step.key, { photoPath })}
            onUploadingChange={(uploading) => setUploads((count) => count + (uploading ? 1 : -1))}
          />
          {steps.length > 1 ? (
            <Button label={`Remove step ${index + 1}`} variant="ghost" onPress={() => setSteps((current) => current.filter((item) => item.key !== step.key))} />
          ) : null}
        </View>
      ))}
      {steps.length < MAX_STEPS ? (
        <Button label="Add another step" icon="add" variant="outline" onPress={() => setSteps((current) => [...current, draftStep()])} />
      ) : null}
      <Notice message={error} />
      <View style={styles.row}>
        <Button label={uploads > 0 ? 'Uploading photo…' : 'Save directions'} onPress={submit} disabled={save.isPending || uploads > 0} />
        <Button label="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  card: { gap: Spacing.three },
  step: { gap: Spacing.two },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
