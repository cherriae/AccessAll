/**
 * Domain models for AccessAll.
 *
 * These are the shapes the UI renders. They are deliberately independent of any
 * API: when a backend lands, map its responses into these types at the data
 * layer rather than reshaping the components.
 */

import type { AccentName } from '@/constants/theme';
import type { IconName } from '@/components/ui/icon';

/** ISO-8601 timestamp, e.g. `2026-07-30T14:24:00.000Z`. */
export type Timestamp = string;

/**
 * Every route in the app. Kept as a literal union so `router.push()` stays
 * type-checked — expo-router's `typedRoutes` experiment will reject a typo here
 * rather than failing silently at runtime.
 */
export type AppRoute = '/' | '/reports' | '/explore' | '/activity' | '/profile';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  /** Shown under the name on the profile screen. */
  affiliation: string;
  /** Counts surfaced as profile stats. */
  stats: {
    reports: number;
    reviews: number;
    votes: number;
  };
}

/* -------------------------------------------------------------------------- */
/* Home                                                                      */
/* -------------------------------------------------------------------------- */

/** One of the product areas promoted on the home screen. */
export interface Feature {
  id: string;
  title: string;
  description: string;
  /** Label for the card's action button. */
  action: string;
  /** Route the card navigates to. */
  route: AppRoute;
  icon: IconName;
  accent: AccentName;
}

/* -------------------------------------------------------------------------- */
/* Reports                                                                    */
/* -------------------------------------------------------------------------- */

export const REPORT_STATUSES = ['open', 'in-progress', 'resolved'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** An accessibility barrier someone has reported at a location. */
export interface Report {
  id: string;
  title: string;
  /** Human-readable place name, e.g. "Lincoln High School". */
  location: string;
  status: ReportStatus;
  createdAt: Timestamp;
  /** Community upvotes indicating how many people are affected. */
  upvotes: number;
  /**
   * Who filed it, or `null` if that account has since been deleted.
   *
   * Only the author may change a report's status — the database enforces this,
   * so screens must check it before offering the control rather than letting
   * the update silently affect no rows.
   */
  createdBy: string | null;
}

/** An open community decision, e.g. approving a new ramp. */
export interface Poll {
  id: string;
  title: string;
  location: string;
  closesAt: Timestamp;
  /** Whether the signed-in user has already voted. */
  hasVoted: boolean;
}

/* -------------------------------------------------------------------------- */
/* Explore                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The geographic rectangle currently visible on the map.
 *
 * Drives `places_in_bounds`, so only the places someone can actually see are
 * fetched rather than every place in the database.
 */
export interface MapBounds {
  minLatitude: number;
  minLongitude: number;
  maxLatitude: number;
  maxLongitude: number;
}

/** A specific accessibility affordance a place offers. */
export interface AccessFeature {
  id: string;
  label: string;
  icon: IconName;
}

export interface Place {
  id: string;
  name: string;
  category: string;
  /** Mean of community ratings, 0–5. `null` when nobody has rated it yet. */
  rating: number | null;
  reviewCount: number;
  /**
   * Sensory-load score, 0–100, where higher is quieter and calmer.
   * `null` when there is not enough data.
   */
  quietScore: number | null;
  latitude: number;
  longitude: number;
  features: AccessFeature[];
  /** Street address or area description shown on the detail screen. */
  address?: string;
  /** Sourced context, including limitations that positive feature badges cannot express. */
  accessibilityNote?: string;
  /** Page used to substantiate the imported venue and accessibility information. */
  sourceUrl?: string;
  sourceLabel?: string;
  /** Community-authored guide shown separately from external source information. */
  communityGuide?: string;
  guideAuthor?: string;
  guideUpdatedAt?: Timestamp;
}

export interface Review {
  id: string;
  placeId: string;
  authorName: string;
  rating: number;
  quietScore: number | null;
  accessibilityNotes: string;
  createdAt: Timestamp;
}

/* -------------------------------------------------------------------------- */
/* Activity                                                                   */
/* -------------------------------------------------------------------------- */

export type ActivityKind = 'report' | 'review' | 'vote';

/** A single entry in the user's activity feed. */
export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  title: string;
  subtitle: string;
  occurredAt: Timestamp;
}

export interface ReportComment {
  id: string;
  reportId: string;
  authorName: string;
  body: string;
  createdAt: Timestamp;
}

export interface AppSettings {
  notificationsEnabled: boolean;
  reportUpdatesEnabled: boolean;
  voteRemindersEnabled: boolean;
  campusName: string;
}
