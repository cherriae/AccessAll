import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useSettings } from '@/hooks/useSettings';
import { buildComplexes, radarStatuses } from '@/lib/detour';

import {
    EQUIPMENT_URL,
    OUTAGES_URL,
    STATIONS_URL,
    joinElevatorOutages,
    type ElevatorOutage,
    type RawEquipment,
    type RawOutage,
    type RawStation,
} from '@/lib/transit';

async function getJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return response.json() as Promise<T>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const OUTAGE_REFRESH_MS = 5 * 60 * 1000;

/** Equipment and station lists change rarely; fetch them at most once a day. */
function useReferenceData<T>(key: string, url: string, enabled: boolean) {
    return useQuery<T>({
        queryKey: ['transit', key],
        queryFn: () => getJson<T>(url),
        enabled,
        staleTime: DAY_MS,
        gcTime: DAY_MS,
    });
}

/**
 * NYC subway elevators out of service right now, with coordinates.
 *
 * Only fetched when `enabled` (the map is showing New York), so visitors
 * elsewhere never download three MTA feeds for nothing.
 */
export function useElevatorOutages(enabled: boolean) {
    const equipment = useReferenceData<RawEquipment[]>('equipment', EQUIPMENT_URL, enabled);
    const stations = useReferenceData<RawStation[]>('stations', STATIONS_URL, enabled);
    const ready = Boolean(equipment.data && stations.data);

    const outages = useQuery<ElevatorOutage[]>({
        queryKey: ['transit', 'outages', ready],
        enabled: enabled && ready,
        // The MTA refreshes the feed every few minutes.
        staleTime: OUTAGE_REFRESH_MS,
        refetchInterval: OUTAGE_REFRESH_MS,
        queryFn: async () => joinElevatorOutages(await getJson<RawOutage[]>(OUTAGES_URL), equipment.data!, stations.data!),
    });

    return {
        data: outages.data,
        isLoading: enabled && (equipment.isLoading || stations.isLoading || outages.isLoading),
        isError: equipment.isError || stations.isError || outages.isError,
    };
}

/** Every NYC subway station complex, keyed by complex id. Shares the cached station list. */
export function useStationComplexes(enabled = true) {
    const stations = useReferenceData<RawStation[]>('stations', STATIONS_URL, enabled);
    const complexes = useMemo(() => (stations.data ? buildComplexes(stations.data) : undefined), [stations.data]);
    return { data: complexes, isLoading: stations.isLoading, isError: stations.isError };
}

/**
 * Detour Radar for the signed-in user: live status of each watched station,
 * with step-free alternatives when one is disrupted.
 */
export function useDetourRadar() {
    const watched = useSettings().data?.watchedStations ?? NO_STATIONS;
    const enabled = watched.length > 0;
    const complexes = useStationComplexes(enabled);
    const outages = useElevatorOutages(enabled);

    const statuses = useMemo(
        () => (complexes.data && outages.data ? radarStatuses(watched, complexes.data, outages.data) : undefined),
        [watched, complexes.data, outages.data],
    );

    return {
        watched,
        statuses,
        isLoading: enabled && (complexes.isLoading || outages.isLoading),
        isError: complexes.isError || outages.isError,
    };
}

const NO_STATIONS: string[] = [];
