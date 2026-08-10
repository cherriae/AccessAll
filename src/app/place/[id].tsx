import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { PlaceMap } from '@/components/place-map';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipGroup } from '@/components/ui/chip-group';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Heading, Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePlace } from '@/hooks/usePlace';
import { useAddPlace, useUpdatePlaceGuide } from '@/hooks/usePlaces';
import { useAddReview, useReviews } from '@/hooks/useReviews';
import { getPlaceDraft, removePlaceDraft } from '@/lib/place-drafts';
import { useTheme } from '@/hooks/use-theme';
import { formatRelativeTime } from '@/lib/format';
import type { AccessFeature } from '@/types';

const RATING_OPTIONS = ['1', '2', '3', '4', '5'].map((value) => ({ value, label: `${value} star${value === '1' ? '' : 's'}` }));
const ACCESS_GUIDE_FEATURES: AccessFeature[] = [
  { id: 'accessible-entrance', label: 'Accessible entrance', icon: 'ramp' },
  { id: 'elevator', label: 'Elevator', icon: 'elevator' },
  { id: 'restroom', label: 'Accessible restroom', icon: 'restroom' },
  { id: 'accessible-parking', label: 'Accessible parking', icon: 'parking' },
  { id: 'hearing-loop', label: 'Hearing loop', icon: 'hearing' },
  { id: 'assistive-listening', label: 'Assistive listening', icon: 'hearing' },
  { id: 'service-animal', label: 'Service animals welcome', icon: 'service-animal' },
  { id: 'wheelchair-seating', label: 'Wheelchair seating', icon: 'seating' },
  { id: 'sensory-support', label: 'Sensory support', icon: 'quiet' },
  { id: 'braille-signage', label: 'Braille signage', icon: 'vision' },
];

export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const databasePlace = usePlace(id).data;
  const draftPlace = getPlaceDraft(id);
  const place = databasePlace ?? draftPlace;
  const reviews = useReviews(databasePlace?.id).data ?? [];
  const user = useCurrentUser().data;
  const addPlace = useAddPlace();
  const addReview = useAddReview();
  const updateGuide = useUpdatePlaceGuide();
  const theme = useTheme();
  const [rating, setRating] = useState('5');
  const [quietScore, setQuietScore] = useState('');
  const [notes, setNotes] = useState('');
  const [guide, setGuide] = useState('');
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([]);

  if (!place) return <Screen><EmptyState icon="place" title="Place not found" message="This place may have been removed." /></Screen>;

  async function persistPlace() {
    if (databasePlace) return databasePlace;
    const saved = await addPlace.mutateAsync({
      name: place!.name,
      category: place!.category,
      rating: null,
      reviewCount: 0,
      quietScore: null,
      verified: false,
      latitude: place!.latitude,
      longitude: place!.longitude,
      address: place!.address,
      sourceLabel: place!.sourceLabel,
      sourceUrl: place!.sourceUrl,
      features: [],
    });
    removePlaceDraft(place!.id);
    router.replace(`/place/${saved.id}` as never);
    return saved;
  }

  async function submitReview() {
    if (!user) { router.push('/auth' as never); return; }
    const quiet = quietScore.trim() ? Number(quietScore) : null;
    if (!notes.trim() || (quiet !== null && (Number.isNaN(quiet) || quiet < 0 || quiet > 100))) {
      Alert.alert('Check your review', 'Add accessibility notes and use a quiet score from 0 to 100.');
      return;
    }
    try {
      const saved = await persistPlace();
      await addReview.mutateAsync({ placeId: saved.id, rating: Number(rating), quietScore: quiet, accessibilityNotes: notes });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') { router.push('/auth' as never); return; }
      Alert.alert('Could not publish review', 'Please try again.');
      return;
    }
    setNotes(''); setQuietScore('');
  }

  function toggleFeature(id: string) {
    setSelectedFeatureIds((current) => current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id]);
  }

  async function submitGuide() {
    if (!user) { router.push('/auth' as never); return; }
    if (!guide.trim() && selectedFeatureIds.length === 0) {
      Alert.alert('Add guide details', 'Select at least one feature or describe the access experience.');
      return;
    }

    const chosen = ACCESS_GUIDE_FEATURES.filter((feature) => selectedFeatureIds.includes(feature.id));
    const features = [...place!.features];
    for (const feature of chosen) {
      if (!features.some((existing) => existing.id === feature.id)) features.push(feature);
    }

    try {
      const saved = await persistPlace();
      await updateGuide.mutateAsync({ placeId: saved.id, features, communityGuide: guide });
      setSelectedFeatureIds([]);
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') { router.push('/auth' as never); return; }
      Alert.alert('Could not publish guide', 'Please try again.');
    }
  }

  return (
    <Screen>
      <View style={styles.intro}>
        <Heading variant="display">{place.name}</Heading>
        <Text color="textSecondary">{place.category} · {place.reviewCount} reviews</Text>
        {place.address ? <Text color="textSecondary">{place.address}</Text> : null}
        <View style={styles.badges}>
          {place.features.map((feature) => <Badge key={feature.id} label={feature.label} icon={feature.icon} accent="explore" />)}
        </View>
      </View>
      <PlaceMap places={[place]} selectedId={place.id} onSelect={() => {}} />
      {!databasePlace ? <Text color="textSecondary">This is a map preview. It will be saved only when you publish a review or accessibility guide.</Text> : null}
      {place.accessibilityNote || place.sourceUrl ? (
        <Section title="Source information">
          <Card style={styles.sourceCard}>
            {place.accessibilityNote ? <Text>{place.accessibilityNote}</Text> : <Text>Map data identifies this place.</Text>}
            <Text variant="caption" color="textSecondary">Source information may change. Community accessibility guidance is shown separately below.</Text>
            {place.sourceUrl ? (
              <Button
                label={place.sourceLabel ? `View source: ${place.sourceLabel}` : 'View source'}
                variant="outline"
                onPress={() => Linking.openURL(place.sourceUrl!)}
                block
              />
            ) : null}
          </Card>
        </Section>
      ) : null}
      <Section title="Community accessibility guide">
        <Card style={styles.sourceCard}>
          {place.communityGuide ? (
            <>
              <Text>{place.communityGuide}</Text>
              <Text variant="caption" color="textSecondary">
                Added by {place.guideAuthor ?? 'a community member'}{place.guideUpdatedAt ? ` · ${formatRelativeTime(place.guideUpdatedAt).short}` : ''}
              </Text>
            </>
          ) : (
            <Text color="textSecondary">No community guide yet. Add the features and practical details that would help someone plan a visit.</Text>
          )}
        </Card>
      </Section>
      <Section title="Add guide details">
        <Card style={styles.form}>
          <Text variant="bodyStrong">What access features did you find?</Text>
          <View style={styles.featureChoices} accessibilityRole="none">
            {ACCESS_GUIDE_FEATURES.map((feature) => {
              const selected = selectedFeatureIds.includes(feature.id);
              return (
                <Pressable
                  key={feature.id}
                  onPress={() => toggleFeature(feature.id)}
                  accessibilityRole="checkbox"
                  accessibilityLabel={feature.label}
                  accessibilityState={{ checked: selected }}
                  style={({ pressed }) => [
                    styles.featureChoice,
                    { backgroundColor: selected ? theme.brand : theme.backgroundElement, borderColor: selected ? theme.brand : theme.border },
                    pressed ? styles.featureChoicePressed : null,
                  ]}
                >
                  <Text variant="label" colorValue={selected ? theme.onBrand : theme.textSecondary}>{feature.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <FormField label="Community accessibility guide" value={guide} onChangeText={setGuide} multiline numberOfLines={5} placeholder="Describe entrances, routes, restrooms, seating, staff support, or sensory conditions…" />
          <Button label={user ? 'Publish accessibility guide' : 'Sign in to add a guide'} onPress={submitGuide} disabled={updateGuide.isPending || addPlace.isPending} block />
        </Card>
      </Section>
      <Section title="Share accessibility details">
        <Card style={styles.form}>
          <ChipGroup label="Overall rating" options={RATING_OPTIONS} value={rating} onChange={setRating} />
          <FormField label="Quiet score (0–100, optional)" value={quietScore} onChangeText={setQuietScore} keyboardType="number-pad" />
          <FormField label="Accessibility notes" value={notes} onChangeText={setNotes} multiline numberOfLines={4} placeholder="Entrances, restrooms, seating, sensory conditions…" />
          <Button label={user ? 'Publish review' : 'Sign in to review'} onPress={submitReview} disabled={addReview.isPending || addPlace.isPending} block />
        </Card>
      </Section>
      <Section title={`${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'}`}>
        <View style={styles.list}>
          {reviews.map((review) => {
            const time = formatRelativeTime(review.createdAt);
            return (
              <Card key={review.id} style={styles.review}>
                <View style={styles.reviewHeader}>
                  <Text variant="bodyStrong">{review.authorName}</Text>
                  <Text variant="caption" color="textTertiary">{time.short}</Text>
                </View>
                <Text>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</Text>
                <Text>{review.accessibilityNotes}</Text>
                {review.quietScore !== null ? <Text variant="caption" color="textSecondary">Quiet score: {review.quietScore}/100</Text> : null}
              </Card>
            );
          })}
        </View>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: Spacing.two }, badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  sourceCard: { gap: Spacing.three }, form: { gap: Spacing.three }, list: { gap: Spacing.two }, review: { gap: Spacing.two },
  featureChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  featureChoice: { borderWidth: 1, borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  featureChoicePressed: { opacity: 0.82 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
});
