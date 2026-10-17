/**
 * Turns microphone readings into a quiet score.
 *
 * Recorders report loudness in dBFS: 0 is the loudest the microphone can
 * capture, and quieter sound is more negative. Phone microphones are not
 * calibrated, so this is a *relative* reading, not decibels a sound engineer
 * would quote — which is why the app says "measured with a phone" rather than
 * showing a dB number. It is still far more consistent than "it felt loud".
 */

/** Readings at or below this are treated as silence. */
const SILENT_DBFS = -60;
/** Readings at or above this are treated as as loud as a phone can tell. */
const LOUD_DBFS = -10;

/** Linear: -60 dBFS (silent) → 100, -10 dBFS (very loud) → 0. */
export function dbfsToQuietScore(dbfs: number): number {
  if (!Number.isFinite(dbfs)) return 100;
  const clamped = Math.min(LOUD_DBFS, Math.max(SILENT_DBFS, dbfs));
  return Math.round(((LOUD_DBFS - clamped) / (LOUD_DBFS - SILENT_DBFS)) * 100);
}

/**
 * Summarises a few seconds of samples.
 *
 * Averages in the power domain (not the mean of dB values) because decibels are
 * logarithmic: one shout in a quiet room should raise the reading more than a
 * plain average of the numbers would.
 */
export function averageDbfs(samples: readonly number[]): number | null {
  const valid = samples.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return null;
  const meanPower = valid.reduce((sum, db) => sum + 10 ** (db / 10), 0) / valid.length;
  return 10 * Math.log10(meanPower);
}

/** Snaps a measured score to the review form's quiet options (20…100). */
export function nearestQuietOption(score: number): string {
  return String(Math.min(100, Math.max(20, Math.round(score / 20) * 20)));
}

export function describeQuietScore(score: number): string {
  if (score >= 90) return 'Very quiet';
  if (score >= 70) return 'Quiet';
  if (score >= 50) return 'Moderate';
  if (score >= 30) return 'Loud';
  return 'Very loud';
}
