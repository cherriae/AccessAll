/**
 * NYC subway elevator outages, placed on the map.
 *
 * A step-free trip is only step-free if the elevator at the end of it works.
 * The MTA publishes current outages, but each row names a station in free text
 * with no coordinates. This joins three public feeds (no API key needed):
 *
 *   outage.equipment → equipment.equipmentno → equipment.stationcomplexid
 *   → station.complex_id → station latitude/longitude
 *
 * Station names are deliberately not used for the join: the MTA notes they do
 * not reliably match between feeds.
 */

import type { MapBounds } from '@/types';

export const OUTAGES_URL = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fnyct_ene.json';
export const EQUIPMENT_URL = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fnyct_ene_equipments.json';
export const STATIONS_URL = 'https://data.ny.gov/resource/39hk-dx4f.json?$limit=1000&$select=complex_id,stop_name,gtfs_latitude,gtfs_longitude,ada,daytime_routes';

export interface RawOutage {
  station?: string;
  trainno?: string;
  equipment?: string;
  equipmenttype?: string;
  serving?: string;
  ADA?: string;
  outagedate?: string;
  estimatedreturntoservice?: string;
  reason?: string;
  isupcomingoutage?: string;
}

export interface RawEquipment {
  equipmentno?: string;
  stationcomplexid?: string;
  alternativeroute?: string;
}

export interface RawStation {
  complex_id?: string;
  stop_name?: string;
  gtfs_latitude?: string;
  gtfs_longitude?: string;
  /** "1" fully step-free, "2" partly (some directions only), "0" not. */
  ada?: string;
  /** Space-separated, e.g. "A C E". */
  daytime_routes?: string;
}

export interface ElevatorOutage {
  equipment: string;
  /** MTA station complex id, the key Detour Radar watches. */
  complexId: string;
  station: string;
  lines: string;
  /** Where the elevator goes, e.g. "Street to Manhattan-bound platform". */
  serving: string;
  reason: string;
  /** As published, e.g. "10/31/2026 06:00:00 AM" (New York time). */
  estimatedReturn: string;
  /** Part of the station's step-free (ADA) route. */
  ada: boolean;
  /** The MTA's suggested detour, when it publishes one. */
  alternativeRoute?: string;
  latitude: number;
  longitude: number;
}

/**
 * Current elevator outages that can be placed on a map. Escalators and
 * scheduled future outages are left out: neither changes whether someone can
 * get step-free access *now*.
 */
export function joinElevatorOutages(
  outages: readonly RawOutage[],
  equipment: readonly RawEquipment[],
  stations: readonly RawStation[],
): ElevatorOutage[] {
  const equipmentById = new Map(equipment.map((item) => [item.equipmentno, item]));
  const stationByComplex = new Map<string, { latitude: number; longitude: number }>();

  for (const station of stations) {
    const latitude = Number(station.gtfs_latitude);
    const longitude = Number(station.gtfs_longitude);
    // A complex spans several stops; any one of them places it on the map.
    if (station.complex_id && Number.isFinite(latitude) && Number.isFinite(longitude) && !stationByComplex.has(station.complex_id)) {
      stationByComplex.set(station.complex_id, { latitude, longitude });
    }
  }

  const result: ElevatorOutage[] = [];

  for (const outage of outages) {
    if (outage.equipmenttype !== 'EL' || outage.isupcomingoutage === 'Y' || !outage.equipment) continue;
    const unit = equipmentById.get(outage.equipment);
    const place = unit?.stationcomplexid ? stationByComplex.get(unit.stationcomplexid) : undefined;
    if (!place) continue;

    result.push({
      equipment: outage.equipment,
      complexId: unit!.stationcomplexid!,
      station: outage.station ?? 'Subway station',
      lines: outage.trainno ?? '',
      serving: outage.serving ?? '',
      reason: outage.reason ?? '',
      estimatedReturn: outage.estimatedreturntoservice ?? '',
      ada: outage.ADA === 'Y',
      alternativeRoute: unit?.alternativeroute || undefined,
      ...place,
    });
  }

  return result;
}

export function outagesInBounds(outages: readonly ElevatorOutage[], bounds: MapBounds): ElevatorOutage[] {
  return outages.filter((outage) =>
    outage.latitude >= bounds.minLatitude &&
    outage.latitude <= bounds.maxLatitude &&
    outage.longitude >= bounds.minLongitude &&
    outage.longitude <= bounds.maxLongitude,
  );
}
