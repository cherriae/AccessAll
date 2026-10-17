import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { MapLegend, type MapLayer } from "@/components/map-legend";
import { PlaceMap } from "@/components/place-map";
import { PlaceRow } from "@/components/place-row";
import { Appear } from "@/components/ui/appear";
import { Button } from "@/components/ui/button";
import { ChipGroup, type ChipOption } from "@/components/ui/chip-group";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Screen } from "@/components/ui/screen";
import { SearchField } from "@/components/ui/search-field";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import { Spacing } from "@/constants/theme";
import { usePlacesInBounds } from "@/hooks/usePlaces";
import { useReports } from "@/hooks/useReports";
import { useMapSearch } from "@/hooks/useMapSearch";
import { savePlaceDraft } from "@/lib/place-drafts";
import { useAccessNeeds } from "@/hooks/useSettings";
import { useElevatorOutages } from "@/hooks/useElevatorOutages";
import { accessFit, QUIET_THRESHOLD } from "@/lib/access-fit";
import { outagesInBounds } from "@/lib/transit";
import type { AccessNeed, MapBounds, MapPin, Place } from "@/types";

type Filter = "all" | "quiet" | "fits";

const BASE_FILTERS: ChipOption<Filter>[] = [
  { value: "all", label: "All places" },
  { value: "quiet", label: "Sensory friendly" },
];
const FITS_FILTER: ChipOption<Filter> = { value: "fits", label: "Fits my needs" };

/** A place "fits" when the community has confirmed at least this share of your needs. */
const GOOD_FIT = 75;
const SEARCH_RESULT_LIMIT = 20;

/** Roughly the five boroughs: where MTA elevator data applies. */
const NYC_BOUNDS: MapBounds = { minLatitude: 40.49, minLongitude: -74.27, maxLatitude: 40.92, maxLongitude: -73.68 };

function overlaps(a: MapBounds, b: MapBounds) {
  return a.minLatitude <= b.maxLatitude && a.maxLatitude >= b.minLatitude &&
    a.minLongitude <= b.maxLongitude && a.maxLongitude >= b.minLongitude;
}

function matchesFilter(place: Place, filter: Filter, needs: AccessNeed[]): boolean {
  switch (filter) {
    case "quiet":
      return place.quietScore !== null && place.quietScore >= QUIET_THRESHOLD;
    case "fits":
      return (accessFit(place, needs)?.score ?? 0) >= GOOD_FIT;
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
  const needs = useAccessNeeds();
  const filters = needs.length > 0 ? [...BASE_FILTERS, FITS_FILTER] : BASE_FILTERS;
  // "Fits my needs" disappears when the profile is cleared; fall back to All
  // rather than filtering by a chip nobody can see.
  const activeFilter: Filter = filter === "fits" && needs.length === 0 ? "all" : filter;
  const showTransit = Boolean(bounds && overlaps(bounds, NYC_BOUNDS));
  const outagesQuery = useElevatorOutages(showTransit);
  const outages = useMemo(
    () => (bounds && outagesQuery.data ? outagesInBounds(outagesQuery.data, bounds) : []),
    [bounds, outagesQuery.data],
  );
  const reportsQuery = useReports();
  const [layers, setLayers] = useState<Record<MapLayer, boolean>>({ report: true, outage: true });
  const toggleLayer = useCallback(
    (layer: MapLayer) => setLayers((current) => ({ ...current, [layer]: !current[layer] })),
    [],
  );

  // Open barriers and broken elevators share the map with places, so someone
  // planning a trip sees all three before they set off.
  const openReports = useMemo(
    () =>
      (reportsQuery.data ?? []).filter(
        (report): report is typeof report & { latitude: number; longitude: number } =>
          report.status !== "resolved" &&
          report.latitude !== null &&
          report.longitude !== null &&
          Boolean(bounds) &&
          report.latitude >= bounds!.minLatitude &&
          report.latitude <= bounds!.maxLatitude &&
          report.longitude >= bounds!.minLongitude &&
          report.longitude <= bounds!.maxLongitude,
      ),
    [reportsQuery.data, bounds],
  );
  const pins = useMemo<MapPin[]>(
    () => [
      ...(layers.report
        ? openReports.map((report) => ({
            id: report.id,
            kind: "report" as const,
            latitude: report.latitude,
            longitude: report.longitude,
            label: `Barrier: ${report.title}, ${report.location}`,
          }))
        : []),
      ...(layers.outage
        ? outages.map((outage) => ({
            id: outage.equipment,
            kind: "outage" as const,
            latitude: outage.latitude,
            longitude: outage.longitude,
            label: `Elevator out at ${outage.station}: ${outage.serving}`,
          }))
        : []),
    ],
    [layers, openReports, outages],
  );
  const onPinPress = useCallback(
    (pin: MapPin) => {
      if (pin.kind === "report") router.push(`/report/${pin.id}` as never);
    },
    [router],
  );

  const visible = (placesQuery.data ?? [])
    .filter((place) => matchesFilter(place, activeFilter, needs) && matchesQuery(place, query))
    // With an access profile, the best fit for this person comes first.
    .map((place) => ({ place, score: accessFit(place, needs)?.score ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .map(({ place }) => place);
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
      <PageHeader
        title="Explore places"
        subtitle={
          needs.length > 0
            ? "Places near you, best fit for your access needs first."
            : "Accessibility details and quiet scores from the community."
        }
        icon="place"
        accent="explore"
      />

      <PlaceMap
        places={displayed}
        selectedId={selectedId}
        onSelect={openPlace}
        onBoundsChange={setBounds}
        pins={pins}
        onPinPress={onPinPress}
      />

      <MapLegend
        visible={layers}
        onToggle={toggleLayer}
        showOutages={showTransit}
        counts={{ place: displayed.length, report: openReports.length, outage: outages.length }}
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
          options={filters}
          value={activeFilter}
          onChange={setFilter}
        />
      </View>

      {mapSearch.isError ? <Text color="danger">Map search is temporarily unavailable. Local AccessAll places are still searchable.</Text> : null}

      {/*
        Always listed, not only after a search: the map is not usable with a
        screen reader or switch control, so the places in view must also be
        reachable as an ordinary list.
      */}
      <Section
        title={
          hasSearch
            ? `${searchResults.length}${displayed.length > searchResults.length ? ` of ${displayed.length}` : ""} ${displayed.length === 1 ? "place" : "places"}${mapResults.length ? " found on the map" : ""}`
            : `${displayed.length} ${displayed.length === 1 ? "place" : "places"} in this map area`
        }
      >
        {placesQuery.isLoading && !hasSearch ? (
          <LoadingState label="Loading places" />
        ) : searchResults.length > 0 ? (
          <View style={styles.list}>
            {searchResults.map((place, index) => (
              <Appear key={place.id} index={index}>
                <PlaceRow place={place} onPress={openPlace} />
              </Appear>
            ))}
          </View>
        ) : (
          <EmptyState
            icon="place"
            title="No places found"
            message={
              hasSearch
                ? "Try a different search, or be the first to review a place you know."
                : "Move the map or search for a place to add the first review here."
            }
          />
        )}
      </Section>
      {showTransit ? (
        <Section title="Subway elevators out of service here">
          {outagesQuery.isLoading ? (
            <LoadingState label="Checking MTA elevator status" />
          ) : outagesQuery.isError ? (
            <Text color="textSecondary">MTA elevator status is unavailable right now.</Text>
          ) : outages.length > 0 ? (
            <View style={styles.list}>
              {outages.map((outage) => (
                <Card key={outage.equipment} style={styles.outage}>
                  <Text variant="bodyStrong">{outage.station}{outage.lines ? ` (${outage.lines})` : ""}</Text>
                  <Text>{outage.serving}</Text>
                  <Text variant="caption" color="textSecondary">
                    {outage.reason || "Out of service"}{outage.estimatedReturn ? ` · expected back ${outage.estimatedReturn}` : ""}
                  </Text>
                  {outage.alternativeRoute ? <Text variant="callout" color="textSecondary">Alternative: {outage.alternativeRoute}</Text> : null}
                </Card>
              ))}
            </View>
          ) : (
            <Text color="textSecondary">All subway elevators in this map area are working.</Text>
          )}
          <Text variant="caption" color="textSecondary">Live from the MTA. Confirm at mta.info before you travel.</Text>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: {
    gap: Spacing.three,
  },
  list: {
    gap: Spacing.two,
  },
  outage: {
    gap: Spacing.one,
  },
});
