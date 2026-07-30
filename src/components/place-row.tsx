import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { ListRow } from '@/components/ui/list-row';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { formatQuietScore, formatRating } from '@/lib/format';
import { useAccent } from '@/hooks/use-theme';
import type { Place } from '@/types';

/** Access features shown inline before collapsing into a "+N more" badge. */
const VISIBLE_FEATURES = 3;

export interface PlaceRowProps {
  place: Place;
  onPress?: (place: Place) => void;
}

/** One place with its rating, quiet score, and access features. */
export function PlaceRow({ place, onPress }: PlaceRowProps) {
  const verified = useAccent('verified');
  const rating = formatRating(place.rating, place.reviewCount);
  const quiet = formatQuietScore(place.quietScore);

  const shown = place.features.slice(0, VISIBLE_FEATURES);
  const hidden = place.features.length - shown.length;

  return (
    <ListRow
      icon="place"
      accent="explore"
      title={place.name}
      subtitle={`${place.category} · ${quiet.short}`}
      meta={rating.short}
      onPress={onPress ? () => onPress(place) : undefined}
      accessibilityLabel={[
        place.name,
        place.category,
        place.verified ? 'Accessibility Verified' : 'Not yet verified',
        rating.long,
        quiet.long,
        `Access features: ${place.features.map((feature) => feature.label).join(', ')}`,
      ].join('. ')}
      accessibilityHint={onPress ? 'Opens the place details' : undefined}
    >
      <View style={styles.footer}>
        {place.verified ? (
          <View style={styles.verified}>
            <Icon name="verified" size={14} color={verified.fg} />
            <Text variant="caption" colorValue={verified.fg} style={styles.verifiedLabel}>
              Verified
            </Text>
          </View>
        ) : null}

        {shown.map((feature) => (
          <Badge key={feature.id} label={feature.label} icon={feature.icon} accent="explore" />
        ))}

        {hidden > 0 ? (
          <Badge
            label={`+${hidden}`}
            accent="explore"
            accessibilityLabel={`${hidden} more access features`}
          />
        ) : null}
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
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  verifiedLabel: {
    fontWeight: '700',
  },
});
