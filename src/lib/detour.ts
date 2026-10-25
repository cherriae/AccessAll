/**
 * Detour Radar: is the step-free way into *my* station working today, and if
 * not, where is the nearest one that is?
 *
 * Elevator outages are a map of the whole city; nobody checks 100 pins every
 * morning. Radar watches the few stations a person actually uses and, when an
 * elevator on the step-free route is out, ranks working accessible stations
 * nearby — preferring ones served by the same trains.
 */

import type { ElevatorOutage, RawStation } from '@/lib/transit';

export type StepFree = 'full' | 'partial' | 'none';

/** A station complex: several stops (one per line) under one roof. */
export interface StationComplex {
  id: string;
  name: string;
  routes: string[];
  latitude: number;
  longitude: number;
  stepFree: StepFree;
}

export interface Alternative {
  station: StationComplex;
  meters: number;
  walkMinutes: number;
  /** Trains this station shares with the watched one. */
  sharedRoutes: string[];
}

export interface RadarStatus {
  station: StationComplex;
  /** Elevators out on the step-free route; empty when all is well. */
  outages: ElevatorOutage[];
  alternatives: Alternative[];
}

/** Typical wheelchair and walking pace, about 4.8 km/h. */
const METERS_PER_MINUTE = 80;
const MAX_DETOUR_METERS = 2500;
const MAX_ALTERNATIVES = 3;

export function buildComplexes(stations: readonly RawStation[]): Map<string, StationComplex> {
  const complexes = new Map<string, StationComplex>();

  for (const stop of stations) {
    const latitude = Number(stop.gtfs_latitude);
    const longitude = Number(stop.gtfs_longitude);
    if (!stop.complex_id || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    const routes = (stop.daytime_routes ?? '').split(/\s+/).filter(Boolean);
    const stepFree: StepFree = stop.ada === '1' ? 'full' : stop.ada === '2' ? 'partial' : 'none';
    const existing = complexes.get(stop.complex_id);

    if (!existing) {
      complexes.set(stop.complex_id, { id: stop.complex_id, name: stop.stop_name ?? 'Subway station', routes, latitude, longitude, stepFree });
      continue;
    }

    existing.routes = [...new Set([...existing.routes, ...routes])].sort();
    // The complex is as accessible as its best stop: one step-free entrance gets you in.
    if (rank(stepFree) > rank(existing.stepFree)) existing.stepFree = stepFree;
  }

  return complexes;
}

function rank(stepFree: StepFree) {
  return stepFree === 'full' ? 2 : stepFree === 'partial' ? 1 : 0;
}

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** Outages that break step-free access: elevators on the station's ADA route. */
function blockingOutages(outages: readonly ElevatorOutage[], complexId: string) {
  return outages.filter((outage) => outage.complexId === complexId && outage.ada);
}

export function findAlternatives(
  from: StationComplex,
  complexes: ReadonlyMap<string, StationComplex>,
  outages: readonly ElevatorOutage[],
): Alternative[] {
  const candidates: Alternative[] = [];

  for (const station of complexes.values()) {
    if (station.id === from.id || station.stepFree !== 'full') continue;
    if (blockingOutages(outages, station.id).length > 0) continue;

    const meters = distanceMeters(from, station);
    if (meters > MAX_DETOUR_METERS) continue;

    candidates.push({
      station,
      meters,
      walkMinutes: Math.max(1, Math.round(meters / METERS_PER_MINUTE)),
      sharedRoutes: station.routes.filter((route) => from.routes.includes(route)),
    });
  }

  // A station on your own line beats a slightly closer one you'd have to
  // transfer from, so shared trains count as 500 m of walking saved.
  const cost = (alternative: Alternative) => alternative.meters - (alternative.sharedRoutes.length > 0 ? 500 : 0);
  return candidates.sort((a, b) => cost(a) - cost(b)).slice(0, MAX_ALTERNATIVES);
}

export function radarStatuses(
  watched: readonly string[],
  complexes: ReadonlyMap<string, StationComplex>,
  outages: readonly ElevatorOutage[],
): RadarStatus[] {
  return watched.flatMap((id) => {
    const station = complexes.get(id);
    if (!station) return [];
    const blocking = blockingOutages(outages, id);
    return [{
      station,
      outages: blocking,
      alternatives: blocking.length > 0 ? findAlternatives(station, complexes, outages) : [],
    }];
  });
}

/** Name search, ignoring case and punctuation ("59 st columbus" finds "59 St-Columbus Circle"). */
export function searchComplexes(complexes: ReadonlyMap<string, StationComplex>, query: string, limit = 8): StationComplex[] {
  const words = normalize(query).split(' ').filter(Boolean);
  if (words.length === 0) return [];

  return [...complexes.values()]
    .filter((station) => {
      const haystack = normalize(`${station.name} ${station.routes.join(' ')}`);
      return words.every((word) => haystack.includes(word));
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);
}

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`;
}
