import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { AccessFitCard } from '@/components/access-fit-card';
import { PlaceDirections } from '@/components/place-directions';
import { PlaceHistory } from '@/components/place-history';
import { ReportContent } from '@/components/report-content';
import { PlaceMap } from '@/components/place-map';
import { SoundMeter } from '@/components/sound-meter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipGroup } from '@/components/ui/chip-group';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { ErrorState, LoadingState } from '@/components/ui/loading-state';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Heading, Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePlace } from '@/hooks/usePlace';
import { useAddPlace, useUpdatePlaceGuide } from '@/hooks/usePlaces';
import { useAddReview, useDeleteReview, useReviews } from '@/hooks/useReviews';
import { getPlaceDraft, removePlaceDraft } from '@/lib/place-drafts';
import { useTheme } from '@/hooks/use-theme';
import { errorText } from '@/lib/errors';
import { formatRelativeTime } from '@/lib/format';
import { nearestQuietOption } from '@/lib/sound-level';
import type { AccessFeature, Place, Review } from '@/types';

const RATING_OPTIONS = ['1', '2', '3', '4', '5'].map((value) => ({ value, label: `${value} star${value === '1' ? '' : 's'}` }));
/**
 * Picking a described level is easier than typing a number, and the steps are
 * coarse on purpose: nobody can tell a 63 from a 67 by ear.
 */
const QUIET_OPTIONS = [
  { value: '', label: 'Skip' },
  { value: '20', label: 'Very loud' },
  { value: '40', label: 'Loud' },
  { value: '60', label: 'Moderate' },
  { value: '80', label: 'Quiet' },
  { value: '100', label: 'Very quiet' },
];
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
  const placeQuery = usePlace(id);
  const draftPlace = getPlaceDraft(id);

  if (placeQuery.isLoading) return <Screen back><LoadingState label="Loading place" /></Screen>;
  if (placeQuery.isError) return <Screen back><ErrorState title="Could not load this place" onRetry={() => placeQuery.refetch()} /></Screen>;

  const place = placeQuery.data ?? draftPlace;
  if (!place) {
    return (
      <Screen back>
        <EmptyState
          icon="place"
          title="Place not found"
          message={id?.startsWith('geo_')
            ? 'This map preview is no longer available. Search for the place again in Explore.'
            : 'This place may have been removed.'}
        />
      </Screen>
    );
  }

  // Keyed so that publishing a draft (which swaps in a real id) starts the
  // forms fresh instead of carrying a half-typed review across.
  return <PlaceDetail key={place.id} place={place} isSaved={Boolean(placeQuery.data)} />;
}

function PlaceDetail({ place, isSaved }: { place: Place; isSaved: boolean }) {
  const router = useRouter();
  const reviews = useReviews(isSaved ? place.id : undefined).data ?? [];
  const user = useCurrentUser().data;
  const addPlace = useAddPlace();
  const addReview = useAddReview();
  const deleteReview = useDeleteReview();
  const updateGuide = useUpdatePlaceGuide();
  const theme = useTheme();
  const ownReview = user ? reviews.find((review) => review.userId === user.id) : undefined;
  const [rating, setRating] = useState('5');
  const [quietScore, setQuietScore] = useState('');
  // The exact measured score, kept until the user overrides it by hand.
  const [measuredQuiet, setMeasuredQuiet] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [guide, setGuide] = useState('');
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([]);
  const [reviewMessage, setReviewMessage] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);
  // Delete takes two taps: `Alert` confirmations do nothing on web.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [guideMessage, setGuideMessage] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);

  async function persistPlace() {
    if (isSaved) return place;
    return addPlace.mutateAsync({
      name: place.name,
      category: place.category,
      rating: null,
      reviewCount: 0,
      quietScore: null,
      latitude: place.latitude,
      longitude: place.longitude,
      address: place.address,
      sourceLabel: place.sourceLabel,
      sourceUrl: place.sourceUrl,
      features: [],
    });
  }

  /**
   * A draft becomes a real place only once the contribution is saved, then the
   * screen moves to the real URL. Navigating earlier unmounted this form while
   * the review was still in flight.
   */
  function finishDraft(saved: Place) {
    if (isSaved) return;
    removePlaceDraft(place.id);
    router.replace(`/place/${saved.id}` as never);
  }

  function editOwnReview(review: Review) {
    setRating(String(review.rating));
    setQuietScore(review.quietScore === null ? '' : nearestQuietOption(review.quietScore));
    setMeasuredQuiet(review.quietMeasured ? review.quietScore : null);
    setNotes(review.accessibilityNotes);
    setReviewMessage(null);
  }

  async function submitReview() {
    if (!user) { router.push('/auth' as never); return; }
    if (!notes.trim()) {
      setReviewMessage({ text: 'Add accessibility notes so others know what to expect.', tone: 'error' });
      return;
    }
    setReviewMessage(null);
    try {
      const saved = await persistPlace();
      await addReview.mutateAsync({
        placeId: saved.id,
        rating: Number(rating),
        quietScore: measuredQuiet ?? (quietScore ? Number(quietScore) : null),
        quietMeasured: measuredQuiet !== null,
        accessibilityNotes: notes,
      });
      setNotes(''); setQuietScore(''); setMeasuredQuiet(null); setRating('5');
      setReviewMessage({ text: 'Review published. Thank you!', tone: 'success' });
      finishDraft(saved);
    } catch (error) {
      setReviewMessage({ text: errorText(error, 'Could not publish your review. Please try again.'), tone: 'error' });
    }
  }

  async function removeOwnReview(review: Review) {
    if (!confirmingDelete) { setConfirmingDelete(true); return; }
    setConfirmingDelete(false);
    setReviewMessage(null);
    try {
      await deleteReview.mutateAsync({ id: review.id, placeId: place.id });
      setReviewMessage({ text: 'Your review was deleted.', tone: 'success' });
    } catch (error) {
      setReviewMessage({ text: errorText(error, 'Could not delete your review. Please try again.'), tone: 'error' });
    }
  }

  function toggleFeature(featureId: string) {
    setSelectedFeatureIds((current) => current.includes(featureId)
      ? current.filter((value) => value !== featureId)
      : [...current, featureId]);
  }

  async function submitGuide() {
    if (!user) { router.push('/auth' as never); return; }
    if (!guide.trim() && selectedFeatureIds.length === 0) {
      setGuideMessage({ text: 'Select at least one feature or describe the access experience.', tone: 'error' });
      return;
    }

    const chosen = ACCESS_GUIDE_FEATURES.filter((feature) => selectedFeatureIds.includes(feature.id));
    const features = [...place.features];
    for (const feature of chosen) {
      if (!features.some((existing) => existing.id === feature.id)) features.push(feature);
    }

    setGuideMessage(null);
    try {
      const saved = await persistPlace();
      await updateGuide.mutateAsync({ placeId: saved.id, features, communityGuide: guide });
      setSelectedFeatureIds([]);
      setGuide('');
      setGuideMessage({ text: 'Guide published. Thank you!', tone: 'success' });
      finishDraft(saved);
    } catch (error) {
      setGuideMessage({ text: errorText(error, 'Could not publish the guide. Please try again.'), tone: 'error' });
    }
  }

  return (
    <Screen back>
      <View style={styles.intro}>
        <Heading variant="display">{place.name}</Heading>
        <Text color="textSecondary">{place.category} · {place.reviewCount} {place.reviewCount === 1 ? 'review' : 'reviews'}</Text>
        {place.address ? <Text color="textSecondary">{place.address}</Text> : null}
        <View style={styles.badges}>
          {place.features.map((feature) => <Badge key={feature.id} label={feature.label} icon={feature.icon} accent="explore" />)}
        </View>
      </View>
      <AccessFitCard place={place} />
      <PlaceMap places={[place]} selectedId={place.id} onSelect={() => {}} />
      {!isSaved ? <Text color="textSecondary">This is a map preview. It will be saved only when you publish a review or accessibility guide.</Text> : null}
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
                accessibilityHint="Opens the source website"
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
        {isSaved ? <PlaceHistory placeId={place.id} /> : null}
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
          <FormField
            label={place.communityGuide ? 'Rewrite the community guide (optional)' : 'Community accessibility guide'}
            value={guide}
            onChangeText={setGuide}
            multiline
            numberOfLines={5}
            maxLength={5000}
            placeholder="Describe entrances, routes, restrooms, seating, staff support, or sensory conditions…"
          />
          <Notice message={guideMessage?.text} tone={guideMessage?.tone} />
          <Button label={user ? 'Publish accessibility guide' : 'Sign in to add a guide'} onPress={submitGuide} disabled={updateGuide.isPending || addPlace.isPending} block />
        </Card>
      </Section>
      <PlaceDirections
        placeId={isSaved ? place.id : undefined}
        userId={user?.id}
        ensurePlace={persistPlace}
        onSaved={finishDraft}
        onSignIn={() => router.push('/auth' as never)}
      />
      <Section title={ownReview ? 'Update your review' : 'Share accessibility details'}>
        <Card style={styles.form}>
          <ChipGroup label="Overall rating" options={RATING_OPTIONS} value={rating} onChange={setRating} />
          <SoundMeter onMeasured={(score) => { setMeasuredQuiet(score); setQuietScore(nearestQuietOption(score)); }} />
          <ChipGroup
            label="How quiet was it? (optional)"
            options={QUIET_OPTIONS}
            value={quietScore}
            onChange={(value) => { setQuietScore(value); setMeasuredQuiet(null); }}
          />
          <FormField label="Accessibility notes" value={notes} onChangeText={setNotes} multiline numberOfLines={4} maxLength={2000} placeholder="Entrances, restrooms, seating, sensory conditions…" />
          <Notice message={reviewMessage?.text} tone={reviewMessage?.tone} />
          <Button
            label={!user ? 'Sign in to review' : ownReview ? 'Replace my review' : 'Publish review'}
            onPress={submitReview}
            disabled={addReview.isPending || addPlace.isPending}
            block
          />
        </Card>
      </Section>
      <Section title={`${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'}`}>
        <View style={styles.list}>
          {reviews.map((review) => {
            const time = formatRelativeTime(review.createdAt);
            const isOwn = review.id === ownReview?.id;
            return (
              <Card key={review.id} style={styles.review}>
                <View style={styles.reviewHeader}>
                  <Text variant="bodyStrong">{isOwn ? 'You' : review.authorName}</Text>
                  <Text variant="caption" color="textSecondary">{time.short}</Text>
                </View>
                <Text accessibilityLabel={`Rated ${review.rating} out of 5 stars`}>
                  {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                </Text>
                <Text>{review.accessibilityNotes}</Text>
                {review.quietScore !== null ? (
                  <Text variant="caption" color="textSecondary">
                    Quiet score: {review.quietScore}/100{review.quietMeasured ? ' · measured with a microphone' : ''}
                  </Text>
                ) : null}
                {!isOwn ? <ReportContent targetType="review" targetId={review.id} authorId={review.userId} authorName={review.authorName} /> : null}
                {isOwn ? (
                  <View style={styles.reviewActions}>
                    <Button label="Edit" variant="outline" onPress={() => editOwnReview(review)} accessibilityHint="Fills the review form with your review" />
                    <Button label={confirmingDelete ? 'Tap again to delete' : 'Delete'} variant="ghost" icon="delete" onPress={() => removeOwnReview(review)} disabled={deleteReview.isPending} />
                  </View>
                ) : null}
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
  reviewActions: { flexDirection: 'row', gap: Spacing.two },
});
