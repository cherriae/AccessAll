/**
 * Domain models for AccessAll.
 *
 * These are the shapes the UI renders. They are deliberately independent of the
 * database: `src/lib/mappers.ts` turns Supabase rows into these types, so
 * components never reshape around a schema change.
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
export type AppRoute = '/' | '/reports' | '/explore' | '/activity' | '/profile' | '/impact';

export interface User {
  id: string;
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

/**
 * A place confirmed against the geocoder rather than typed freehand.
 *
 * Reports and polls carry one of these so a barrier is anchored to a real
 * coordinate: without it "main entrance" and "Main St entrance" are two
 * unrelated strings, and neither can be drawn on the map.
 */
export interface LocationSelection {
  /** Display name, e.g. "Brooklyn Technical High School". */
  name: string;
  /** Street address or area, when the geocoder knows one. */
  address?: string;
  latitude: number;
  longitude: number;
}

/** An accessibility barrier someone has reported at a location. */
export interface Report {
  id: string;
  title: string;
  /** Human-readable place name, e.g. "Lincoln High School". */
  location: string;
  /**
   * Coordinates of the confirmed place. `null` on reports filed before the
   * location picker existed, whose `location` is unverified free text — those
   * cannot be placed on a map and must not be guessed at.
   */
  latitude: number | null;
  longitude: number | null;
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
  /** When the report was last marked resolved; null while it is not. */
  resolvedAt: Timestamp | null;
  /** The latest note from school staff, if any has been posted. */
  staffUpdate: StaffUpdate | null;
}

export interface StaffUpdate {
  note: string;
  /** Storage path in the `photos` bucket; turn into a URL with `photoUrl()`. */
  photoPath?: string;
  updatedAt: Timestamp;
}

/** An open community decision, e.g. approving a new ramp. */
export interface Poll {
  id: string;
  title: string;
  location: string;
  /** As on `Report`: `null` for proposals that predate the location picker. */
  latitude: number | null;
  longitude: number | null;
  closesAt: Timestamp;
  /** People who have backed the proposal so far. */
  voteCount: number;
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

/**
 * Something other than a place drawn on the map: an open barrier report, or a
 * subway elevator that is out of service.
 */
export interface MapPin {
  id: string;
  kind: 'report' | 'outage';
  latitude: number;
  longitude: number;
  /** Read by screen readers and shown on hover. */
  label: string;
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
  /** Lets a screen recognise the signed-in user's own review. */
  userId: string;
  authorName: string;
  rating: number;
  quietScore: number | null;
  accessibilityNotes: string;
  createdAt: Timestamp;
  /** The quiet score was measured with the phone microphone. */
  quietMeasured: boolean;
}

/* -------------------------------------------------------------------------- */
/* Activity                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * `comment` and `status` are notifications about someone else's action on a
 * report you filed or are affected by; the rest record your own actions.
 */
export type ActivityKind = 'report' | 'review' | 'vote' | 'comment' | 'status';

/** A single entry in the user's activity feed. */
export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  title: string;
  subtitle: string;
  occurredAt: Timestamp;
  reportId: string | null;
}

export interface ReportComment {
  id: string;
  reportId: string;
  userId: string;
  authorName: string;
  body: string;
  createdAt: Timestamp;
}

export interface AppSettings {
  notificationsEnabled: boolean;
  reportUpdatesEnabled: boolean;
  voteRemindersEnabled: boolean;
  campusName: string;
  activitySeenAt: Timestamp | null;
  accessNeeds: AccessNeed[];
}

/* -------------------------------------------------------------------------- */
/* Access profile                                                             */
/* -------------------------------------------------------------------------- */

/** Matches the check constraint on `user_settings.access_needs`. */
export const ACCESS_NEEDS = ['wheelchair', 'temporary-injury', 'low-vision', 'deaf', 'sensory'] as const;
export type AccessNeed = (typeof ACCESS_NEEDS)[number];

/* -------------------------------------------------------------------------- */
/* Step-free directions                                                       */
/* -------------------------------------------------------------------------- */

export interface DirectionStep {
  text: string;
  /** Storage path in the `photos` bucket. */
  photoPath?: string;
}

export interface PlaceDirection {
  id: string;
  placeId: string;
  userId: string;
  title: string;
  steps: DirectionStep[];
  authorName: string;
  updatedAt: Timestamp;
}

/* -------------------------------------------------------------------------- */
/* Impact                                                                     */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* Moderation                                                                 */
/* -------------------------------------------------------------------------- */

export type ContentTargetType = 'report' | 'comment' | 'review' | 'direction';
export type ContentReportReason = 'harassment' | 'spam' | 'false-info' | 'inappropriate' | 'other';

export interface ModerationItem {
  targetType: ContentTargetType;
  targetId: string;
  reportCount: number;
  reasons: ContentReportReason[];
  firstReportedAt: Timestamp;
  content: string;
  /** Already hidden, e.g. automatically after three reports. */
  isHidden: boolean;
}

export interface BlockedUser {
  userId: string;
  name: string;
  blockedAt: Timestamp;
}

/** One change to a place's access features or community guide. */
export interface PlaceEdit {
  id: string;
  placeId: string;
  editorName: string;
  added: string[];
  removed: string[];
  guideChanged: boolean;
  createdAt: Timestamp;
  revertedAt: Timestamp | null;
}

export interface ImpactSummary {
  reportsTotal: number;
  reportsResolved: number;
  reportsInProgress: number;
  peopleAffected: number;
  /** Null until at least one report has been resolved. */
  medianDaysToResolve: number | null;
  placesReviewed: number;
  reviewsTotal: number;
  soundMeasurements: number;
  contributors: number;
}
