/**
 * Display formatters.
 *
 * Each returns both a compact `short` string for the UI and a spelled-out
 * `long` string for `accessibilityLabel` — screen readers announce "2h" as
 * "two h", which is why the two differ.
 */

import type { Timestamp } from '@/types';

export interface FormattedValue {
  /** Compact form for visual display, e.g. `2h ago`. */
  short: string;
  /** Spoken form for assistive tech, e.g. `2 hours ago`. */
  long: string;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}

/**
 * Formats a past timestamp as an elapsed duration.
 *
 * Future timestamps and unparseable input both collapse to "just now" rather
 * than throwing — a malformed date should never blank out a list row.
 */
export function formatRelativeTime(
  timestamp: Timestamp,
  now: Date = new Date(),
): FormattedValue {
  const elapsed = now.getTime() - new Date(timestamp).getTime();

  if (!Number.isFinite(elapsed) || elapsed < MINUTE) {
    return { short: 'now', long: 'just now' };
  }
  if (elapsed < HOUR) {
    const minutes = Math.floor(elapsed / MINUTE);
    return { short: `${minutes}m ago`, long: `${plural(minutes, 'minute')} ago` };
  }
  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    return { short: `${hours}h ago`, long: `${plural(hours, 'hour')} ago` };
  }
  if (elapsed < WEEK) {
    const days = Math.floor(elapsed / DAY);
    return { short: `${days}d ago`, long: `${plural(days, 'day')} ago` };
  }
  const weeks = Math.floor(elapsed / WEEK);
  return { short: `${weeks}w ago`, long: `${plural(weeks, 'week')} ago` };
}

/**
 * Formats how long until a deadline, e.g. a poll closing.
 * Past deadlines report as closed.
 */
export function formatTimeRemaining(
  timestamp: Timestamp,
  now: Date = new Date(),
): FormattedValue {
  const remaining = new Date(timestamp).getTime() - now.getTime();

  if (!Number.isFinite(remaining) || remaining <= 0) {
    return { short: 'Closed', long: 'Voting has closed' };
  }
  if (remaining < HOUR) {
    const minutes = Math.max(1, Math.floor(remaining / MINUTE));
    return { short: `${minutes}m left`, long: `${plural(minutes, 'minute')} left to vote` };
  }
  if (remaining < DAY) {
    const hours = Math.floor(remaining / HOUR);
    return { short: `${hours}h left`, long: `${plural(hours, 'hour')} left to vote` };
  }
  const days = Math.floor(remaining / DAY);
  return { short: `${days}d left`, long: `${plural(days, 'day')} left to vote` };
}

/** Formats a 0–5 rating, or an explicit empty state when unrated. */
export function formatRating(rating: number | null, reviewCount = 0): FormattedValue {
  if (rating === null) {
    return { short: 'Not rated', long: 'Not yet rated' };
  }
  const value = rating.toFixed(1);
  return {
    short: value,
    long: `Rated ${value} out of 5 from ${plural(reviewCount, 'review')}`,
  };
}

/**
 * Buckets a 0–100 quiet score into a word, because the number alone does not
 * tell a first-time user whether high is good.
 */
export function formatQuietScore(score: number | null): FormattedValue {
  if (score === null) {
    return { short: 'No data', long: 'Not enough sensory data yet' };
  }
  const descriptor = score >= 80 ? 'Very quiet' : score >= 60 ? 'Quiet' : score >= 40 ? 'Moderate' : 'Loud';
  return {
    short: `${score} · ${descriptor}`,
    long: `Quiet score ${score} out of 100, ${descriptor.toLowerCase()}`,
  };
}

/** `1,204` — thousands separators without pulling in Intl. */
export function formatCount(count: number): string {
  return count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
