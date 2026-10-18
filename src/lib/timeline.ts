/**
 * Fix Timeline: replays the community's reports as a story. Barriers appear
 * on the map on the day they were reported and turn green on the day they
 * were fixed.
 */

import type { MapPin } from '@/types';

export interface TimelineReport {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  /** Null while unresolved. */
  resolvedAt: string | null;
}

export interface TimelineFrame {
  pins: MapPin[];
  reported: number;
  fixed: number;
}

export interface TimelineRange {
  start: number;
  end: number;
}

/** From a day before the first report (an empty map) to now. */
export function timelineRange(reports: readonly TimelineReport[], now = Date.now()): TimelineRange | null {
  if (reports.length === 0) return null;
  const first = Math.min(...reports.map((report) => Date.parse(report.createdAt)));
  return { start: first - 24 * 60 * 60 * 1000, end: Math.max(now, first) };
}

/** The map as it stood at `time` (milliseconds since the epoch). */
export function timelineFrame(reports: readonly TimelineReport[], time: number): TimelineFrame {
  const pins: MapPin[] = [];
  let fixed = 0;

  for (const report of reports) {
    if (Date.parse(report.createdAt) > time) continue;
    const isFixed = report.resolvedAt !== null && Date.parse(report.resolvedAt) <= time;
    if (isFixed) fixed += 1;
    pins.push({
      id: report.id,
      kind: isFixed ? 'fixed' : 'report',
      latitude: report.latitude,
      longitude: report.longitude,
      label: `${report.title}: ${isFixed ? 'fixed' : 'open'}`,
    });
  }

  return { pins, reported: pins.length, fixed };
}
