import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { PlaceMap } from "@/components/place-map";
import { PlaceRow } from "@/components/place-row";
import { Button } from "@/components/ui/button";
import { ChipGroup, type ChipOption } from "@/components/ui/chip-group";
import { EmptyState } from "@/components/ui/empty-state";
import { Screen } from "@/components/ui/screen";
import { SearchField } from "@/components/ui/search-field";
import { Section } from "@/components/ui/section";
import { Heading, Text } from "@/components/ui/text";
import { Spacing } from "@/constants/theme";
import { usePlacesInBounds } from "@/hooks/usePlaces";
import { useMapSearch } from "@/hooks/useMapSearch";
import { savePlaceDraft } from "@/lib/place-drafts";
import type { MapBounds, Place } from "@/types";

type Filter = "all" | "quiet";

const FILTERS: ChipOption<Filter>[] = [
  { value: "all", label: "All places" },
  { value: "quiet", label: "Sensory friendly" },
];

/** A place needs at least this quiet score to count as sensory friendly. */
const QUIET_THRESHOLD = 60;
const SEARCH_RESULT_LIMIT = 20;

function matchesFilter(place: Place, filter: Filter): boolean {
  switch (filter) {
    case "quiet":
      return place.quietScore !== null && place.quietScore >= QUIET_THRESHOLD;
    case "all":
      return true;
  }
}

function matchesQuery(place: Place, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return true;
  }
  return (
    place.name.toLowerCase().includes(needle) ||
    place.category.toLowerCase().includes(needle) ||
    place.address?.toLowerCase().includes(needle) ||
    place.accessibilityNote?.toLowerCase().includes(needle) ||
    place.features.some((feature) =>
      feature.label.toLowerCase().includes(needle),
    )
  );
}

export default function ExploreScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string>();
  // Only the visible rectangle is fetched, via the GiST-indexed
  // `places_in_bounds`. Places outside it are still reachable through the
  // worldwide map search below.
  const [bounds, setBounds] = useState<MapBounds>();
  const placesQuery = usePlacesInBounds(bounds);
  const mapSearch = useMapSearch();
  const searchWorldwide = mapSearch.mutateAsync;
  const [mapResults, setMapResults] = useState<Place[]>([]);

  const visible = (placesQuery.data ?? []).filter(
    (place) => matchesFilter(place, filter) && matchesQuery(place, query),
  );
  const displayed = mapResults.length > 0 ? mapResults : visible;
  const searchResults = displayed.slice(0, SEARCH_RESULT_LIMIT);
  const hasSearch = query.trim().length > 0;

  useEffect(() => {
    if (query.trim().length < 3 || visible.length > 0) return;
    let active = true;
    const timer = setTimeout(() => {
      searchWorldwide(query).then((results) => {
        if (!active) return;
        setMapResults(results);
        setSelectedId(results[0]?.id);
      }).catch(() => {
        if (active) setMapResults([]);
      });
    }, 700);
    return () => { active = false; clearTimeout(timer); };
  }, [query, searchWorldwide, visible.length]);

  async function searchMap() {
    if (!query.trim()) { setMapResults([]); return; }
    try {
      const results = await searchWorldwide(query);
      setMapResults(results);
      setSelectedId(results[0]?.id);
    } catch {
      setMapResults([]);
    }
  }

  function openPlace(place: Place) {
    if (place.id.startsWith('geo_')) savePlaceDraft(place);
    router.push(`/place/${place.id}` as never);
  }

  return (
    <Screen>
      <View style={styles.intro}>
        <Heading variant="title">Explore places</Heading>
        <Text variant="body" color="textSecondary">
          Places and accessibility details are added by the community.
        </Text>
      </View>

      <PlaceMap
        places={displayed}
        selectedId={selectedId}
        onSelect={openPlace}
        onBoundsChange={setBounds}
      />

      <View style={styles.controls}>
        <SearchField
          value={query}
          onChangeText={(value) => { setQuery(value); setMapResults([]); }}
          label="Search places by name, category, or access feature"
          placeholder="Search places"
        />
        <Button label="Search map" icon="explore" variant="outline" onPress={searchMap} disabled={mapSearch.isPending || !query.trim()} />
        <ChipGroup
          label="Filter places"
          options={FILTERS}
          value={filter}
          onChange={setFilter}
        />
      </View>

      {mapSearch.isError ? <Text color="danger">Map search is temporarily unavailable. Local AccessAll places are still searchable.</Text> : null}

      {hasSearch ? (
        <Section
          title={`${searchResults.length}${displayed.length > searchResults.length ? ` of ${displayed.length}` : ''} ${displayed.length === 1 ? "place" : "places"}${mapResults.length ? " found on the map" : ""}`}
        >
          {searchResults.length > 0 ? (
          <View style={styles.list}>
            {searchResults.map((place) => <PlaceRow key={place.id} place={place} onPress={openPlace} />)}
          </View>
          ) : (
          <EmptyState
            icon="place"
            title="No places found"
            message="Try a different search, or be the first to review a place you know."
          />
          )}
        </Section>
      ) : (
        <Text color="textSecondary">Search for a place to see a compact result list. Use the map markers to open saved places directly.</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    gap: Spacing.two,
  },
  controls: {
    gap: Spacing.three,
  },
  list: {
    gap: Spacing.two,
  },
});
