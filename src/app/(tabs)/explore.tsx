import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { PlaceRow } from "@/components/place-row";
import { ChipGroup, type ChipOption } from "@/components/ui/chip-group";
import { EmptyState } from "@/components/ui/empty-state";
import { Screen } from "@/components/ui/screen";
import { SearchField } from "@/components/ui/search-field";
import { Section } from "@/components/ui/section";
import { Heading, Text } from "@/components/ui/text";
import { Spacing } from "@/constants/theme";
import { usePlaces } from "@/hooks/usePlaces";
import type { Place } from "@/types";

type Filter = "all" | "verified" | "quiet";

const FILTERS: ChipOption<Filter>[] = [
  { value: "all", label: "All places" },
  { value: "verified", label: "Verified" },
  { value: "quiet", label: "Sensory friendly" },
];

/** A place needs at least this quiet score to count as sensory friendly. */
const QUIET_THRESHOLD = 60;

function matchesFilter(place: Place, filter: Filter): boolean {
  switch (filter) {
    case "verified":
      return place.verified;
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
    place.features.some((feature) =>
      feature.label.toLowerCase().includes(needle),
    )
  );
}

export default function ExploreScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const placesQuery = usePlaces();

  const visible = (placesQuery.data ?? []).filter(
    (place) => matchesFilter(place, filter) && matchesQuery(place, query),
  );

  return (
    <Screen>
      <View style={styles.intro}>
        <Heading variant="title">Explore places</Heading>
        <Text variant="body" color="textSecondary">
          Real accessibility details, reported by people who were there.
        </Text>
      </View>

      <View style={styles.controls}>
        <SearchField
          value={query}
          onChangeText={setQuery}
          label="Search places by name, category, or access feature"
          placeholder="Search places"
        />
        <ChipGroup
          label="Filter places"
          options={FILTERS}
          value={filter}
          onChange={setFilter}
        />
      </View>

      <Section
        title={`${visible.length} ${visible.length === 1 ? "place" : "places"}`}
      >
        {visible.length > 0 ? (
          <View style={styles.list}>
            {visible.map((place) => (
              <PlaceRow
                key={place.id}
                place={place}
                onPress={(selected) => {
                  Alert.alert(
                    selected.name,
                    `${selected.category}\n${selected.features.length} access features`,
                  );
                }}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            icon="place"
            title="No places found"
            message="Try a different search, or be the first to review a place you know."
          />
        )}
      </Section>
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
