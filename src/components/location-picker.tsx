import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ListRow } from '@/components/ui/list-row';
import { SearchField } from '@/components/ui/search-field';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMapSearch } from '@/hooks/useMapSearch';
import type { LocationSelection, Place } from '@/types';

/** Shorter queries match most of the planet and waste a geocoder round trip. */
const MIN_QUERY_LENGTH = 3;
/** Quiet period after the last keystroke, so typing is not one request per letter. */
const DEBOUNCE_MS = 400;
/** More than this and the list stops being scannable and starts being a wall. */
const MAX_SUGGESTIONS = 5;

export interface LocationPickerProps {
  /** Spoken and visible name for the field, e.g. "Location". */
  label: string;
  /** The confirmed place, or `null` while the person is still choosing. */
  value: LocationSelection | null;
  onChange: (value: LocationSelection | null) => void;
  placeholder?: string;
}

/**
 * Picks a location by confirming it against the geocoder instead of trusting
 * whatever someone typed.
 *
 * A free-text box cannot tell "Brooklyn Technical High School" from "asdf", and
 * it yields no coordinates, so the resulting report can never be drawn on the
 * map or recognised as being about the same doorway as another report. The
 * caller therefore receives a `LocationSelection` — a place that exists, with
 * the coordinates that anchor it — or `null`. There is deliberately no way to
 * hand back unconfirmed text.
 *
 * The suggestion list is rendered inline beneath the field rather than as a
 * floating overlay: these pickers live inside modals, where an absolutely
 * positioned menu is at the mercy of the card's clipping and stacking.
 */
export function LocationPicker({ label, value, onChange, placeholder }: LocationPickerProps) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const search = useMapSearch();
  const searchPlaces = search.mutateAsync;

  // Requests are numbered so a slow early response cannot land after — and
  // overwrite — the answer to something the person has since typed.
  const latestRequest = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    // Every change to the query invalidates whatever is in flight, including a
    // change that is too short to search: that response answers a question
    // nobody is asking any more.
    const requestId = (latestRequest.current += 1);

    if (trimmed.length < MIN_QUERY_LENGTH) return;

    const timer = setTimeout(() => {
      searchPlaces(trimmed)
        .then((results) => {
          if (requestId === latestRequest.current) {
            setSuggestions(results.slice(0, MAX_SUGGESTIONS));
          }
        })
        .catch(() => {
          if (requestId === latestRequest.current) {
            setSuggestions([]);
          }
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, searchPlaces]);

  function confirm(place: Place) {
    onChange({
      name: place.name,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
    });
    setQuery('');
    setSuggestions([]);
  }

  function reopen() {
    onChange(null);
    setQuery('');
    setSuggestions([]);
  }

  if (value) {
    return (
      <View style={styles.field}>
        <Text variant="label">{label}</Text>
        <View
          style={[
            styles.confirmed,
            { borderColor: theme.borderStrong, backgroundColor: theme.backgroundElement },
          ]}
          accessible
          accessibilityLabel={`${label}: ${[value.name, value.address].filter(Boolean).join(', ')}. Confirmed on the map.`}
        >
          <Icon name="resolved" size={20} color="text" />
          <View style={styles.confirmedBody}>
            <Text variant="bodyStrong">{value.name}</Text>
            {value.address ? (
              <Text variant="caption" color="textSecondary">
                {value.address}
              </Text>
            ) : null}
          </View>
        </View>
        <Button
          label="Change location"
          variant="ghost"
          icon="explore"
          onPress={reopen}
          accessibilityHint="Clears the confirmed place and searches again"
        />
      </View>
    );
  }

  const trimmed = query.trim();
  // Derived rather than cleared in the effect, so refining a query keeps the
  // previous matches on screen instead of blanking the list between keystrokes.
  // A query too short to search shows nothing, however stale state may be.
  const matches = trimmed.length >= MIN_QUERY_LENGTH ? suggestions : [];
  const searching = search.isPending;
  const status = searching
    ? 'Searching the map…'
    : search.isError
      ? 'Map search is unavailable right now. Check your connection and try again.'
      : trimmed.length === 0
        ? 'Search for the building, address, or park, then pick it from the list.'
        : trimmed.length < MIN_QUERY_LENGTH
          ? `Keep typing — ${MIN_QUERY_LENGTH} characters or more searches the map.`
          : matches.length === 0
            ? 'No places match. Try the building name, or the street it is on.'
            : `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}. Pick one to confirm it.`;

  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      <SearchField
        value={query}
        onChangeText={setQuery}
        label={`${label}. Type to search for a real place.`}
        placeholder={placeholder ?? 'Search for a place'}
      />

      {matches.length > 0 ? (
        <View
          style={[styles.menu, { borderColor: theme.borderStrong, backgroundColor: theme.surface }]}
        >
          {matches.map((place) => (
            <ListRow
              key={place.id}
              icon="place"
              accent="explore"
              title={place.name}
              subtitle={place.address ?? place.category}
              onPress={() => confirm(place)}
              accessibilityLabel={[place.name, place.address ?? place.category]
                .filter(Boolean)
                .join('. ')}
              accessibilityHint="Confirms this place as the location"
            />
          ))}
        </View>
      ) : null}

      <Text
        variant="caption"
        color={search.isError ? 'danger' : 'textSecondary'}
        accessibilityLiveRegion="polite"
      >
        {status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.two },
  confirmed: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  // Without this the name cannot shrink and a long one pushes the row wider
  // than the card it sits in.
  confirmedBody: { flex: 1, gap: Spacing.half },
  menu: {
    padding: Spacing.one,
    borderWidth: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
});
