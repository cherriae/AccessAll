/**
 * Turns accelerometer readings into a ramp slope.
 *
 * A phone at rest feels only gravity. Lying flat on a ramp, the phone's own
 * z-axis tilts away from straight down by exactly the ramp's angle, so
 *
 *   angle = acos(|z| / |g|)
 *
 * where `g` is the whole reading. Dividing by |g| makes the result independent
 * of units (iOS and Android report in g, some browsers in m/s²) and of small
 * calibration errors in the sensor's scale.
 *
 * Ramps are judged by rise over run, not degrees: the ADA allows at most 1:12
 * (8.33%) for a ramp, and anything 1:20 (5%) or gentler is not a ramp at all.
 */

export interface Acceleration {
  x: number;
  y: number;
  z: number;
}

/** ADA 2010 Standards §405.2: maximum running slope of a ramp, 1:12. */
export const ADA_MAX_SLOPE_PERCENT = 100 / 12;
/** ADA §402.2: a walking surface up to 1:20 is not a ramp. */
export const WALKWAY_MAX_SLOPE_PERCENT = 5;

/** Readings whose spread exceeds this many degrees mean the phone is moving. */
const STEADY_SPREAD_DEGREES = 0.6;

export function tiltDegrees({ x, y, z }: Acceleration): number | null {
  const magnitude = Math.hypot(x, y, z);
  if (!Number.isFinite(magnitude) || magnitude === 0) return null;
  const cosine = Math.min(1, Math.abs(z) / magnitude);
  return (Math.acos(cosine) * 180) / Math.PI;
}

export function degreesToPercent(degrees: number): number {
  return Math.tan((degrees * Math.PI) / 180) * 100;
}

/** "1:12" style ratio, the form building codes and contractors use. */
export function slopeRatio(percent: number): string {
  if (percent <= 0) return 'flat';
  return `1:${Math.max(1, Math.round(100 / percent))}`;
}

/**
 * The steady tilt over a window of readings, or null while the phone is still
 * being moved (the spread of the window is too wide to trust).
 */
export function steadyTilt(samples: readonly number[], minSamples = 8): number | null {
  if (samples.length < minSamples) return null;
  const window = samples.slice(-minSamples);
  const spread = Math.max(...window) - Math.min(...window);
  if (spread > STEADY_SPREAD_DEGREES) return null;
  return window.reduce((sum, value) => sum + value, 0) / window.length;
}

export type SlopeVerdict = 'walkway' | 'meets' | 'close' | 'too-steep';

export function slopeVerdict(percent: number): SlopeVerdict {
  if (percent <= WALKWAY_MAX_SLOPE_PERCENT) return 'walkway';
  // Half a percent of grace: a phone and a ramp surface are not lab equipment.
  if (percent <= ADA_MAX_SLOPE_PERCENT + 0.5) return 'meets';
  if (percent <= 10) return 'close';
  return 'too-steep';
}

export function describeSlope(percent: number): string {
  switch (slopeVerdict(percent)) {
    case 'walkway': return 'Gentle: easy for wheelchairs and walkers';
    case 'meets': return 'Within the ADA ramp limit of 1:12';
    case 'close': return 'Slightly steeper than the ADA limit of 1:12';
    case 'too-steep': return 'Too steep: many wheelchair users cannot climb this alone';
  }
}

/** Median, so one wrong measurement cannot move the community figure much. */
export function medianSlope(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Rounds to the 0.1% the database stores. */
export function roundSlope(percent: number): number {
  return Math.round(percent * 10) / 10;
}
