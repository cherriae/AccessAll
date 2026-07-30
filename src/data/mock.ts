/**
 * Placeholder content for building and reviewing the UI.
 *
 * This is the app's only data source right now. When the API arrives, replace
 * these exports with fetching hooks that return the same types from
 * `src/types` — screens should not need to change.
 *
 * Keep the fixtures realistic: long place names, missing ratings, and unrated
 * entries all exist here on purpose, because those are the cases that break
 * layouts.
 */

import type {
  AccessFeature,
  ActivityEvent,
  Feature,
  Place,
  Poll,
  Report,
  User,
} from '@/types';

/* -------------------------------------------------------------------------- */
/* Relative timestamps                                                        */
/* -------------------------------------------------------------------------- */

// Anchored once at module load so the fixture feed always looks freshly used
// rather than drifting to "37w ago" as the project ages.
const NOW = Date.now();

const minutesAgo = (n: number) => new Date(NOW - n * 60_000).toISOString();
const hoursAgo = (n: number) => minutesAgo(n * 60);
const daysAgo = (n: number) => hoursAgo(n * 24);
const daysFromNow = (n: number) => new Date(NOW + n * 24 * 60 * 60_000).toISOString();

/* -------------------------------------------------------------------------- */
/* User                                                                       */
/* -------------------------------------------------------------------------- */

export const currentUser: User = {
  id: 'u_1',
  firstName: 'Alex',
  lastName: 'Rivera',
  affiliation: 'Lincoln High School',
  stats: { reports: 12, reviews: 34, votes: 8 },
};

export const unreadNotificationCount = 3;

/* -------------------------------------------------------------------------- */
/* Home features                                                              */
/* -------------------------------------------------------------------------- */

export const features: Feature[] = [
  {
    id: 'campus',
    title: 'Access Campus',
    description: 'Report accessibility issues at your school and vote on changes.',
    action: 'Go to campus',
    route: '/reports',
    icon: 'campus',
    accent: 'campus',
  },
  {
    id: 'access-check',
    title: 'AccessCheck',
    description: 'Find and review places with real accessibility information.',
    action: 'Explore places',
    route: '/explore',
    icon: 'place',
    accent: 'explore',
  },
  {
    id: 'quiet-score',
    title: 'QuietScore',
    description: 'Discover sensory-friendly places and share your experience.',
    action: 'Check scores',
    route: '/explore',
    icon: 'quiet',
    accent: 'quiet',
  },
];

/* -------------------------------------------------------------------------- */
/* Reports                                                                    */
/* -------------------------------------------------------------------------- */

export const reports: Report[] = [
  {
    id: 'r_1',
    title: 'Broken elevator in the science wing',
    location: 'Lincoln High School',
    status: 'in-progress',
    createdAt: hoursAgo(2),
    upvotes: 27,
  },
  {
    id: 'r_2',
    title: 'No curb cut at the east parking entrance',
    location: 'Lincoln High School',
    status: 'open',
    createdAt: daysAgo(1),
    upvotes: 14,
  },
  {
    id: 'r_3',
    title: 'Auditorium captions not working',
    location: 'Lincoln High School',
    status: 'open',
    createdAt: daysAgo(3),
    upvotes: 41,
  },
  {
    id: 'r_4',
    title: 'Library door pull is too heavy to open',
    location: 'Central Library',
    status: 'resolved',
    createdAt: daysAgo(9),
    upvotes: 63,
  },
  {
    id: 'r_5',
    title: 'Tactile paving missing at the crosswalk',
    location: 'Maple St & 4th Ave',
    status: 'resolved',
    createdAt: daysAgo(21),
    upvotes: 8,
  },
];

export const polls: Poll[] = [
  {
    id: 'p_1',
    title: 'Add a permanent ramp at the north entrance',
    location: 'Lincoln High School',
    closesAt: daysFromNow(4),
    hasVoted: false,
  },
];

/* -------------------------------------------------------------------------- */
/* Places                                                                     */
/* -------------------------------------------------------------------------- */

const ACCESS_FEATURES = {
  ramp: { id: 'ramp', label: 'Step-free entry', icon: 'ramp' },
  elevator: { id: 'elevator', label: 'Elevator', icon: 'elevator' },
  restroom: { id: 'restroom', label: 'Accessible restroom', icon: 'restroom' },
  parking: { id: 'parking', label: 'Accessible parking', icon: 'parking' },
  braille: { id: 'braille', label: 'Braille signage', icon: 'vision' },
  hearingLoop: { id: 'hearing-loop', label: 'Hearing loop', icon: 'hearing' },
  serviceAnimal: { id: 'service-animal', label: 'Service animals welcome', icon: 'service-animal' },
  quietSeating: { id: 'quiet-seating', label: 'Quiet seating area', icon: 'seating' },
} as const satisfies Record<string, AccessFeature>;

export const places: Place[] = [
  {
    id: 'pl_1',
    name: 'Central Library',
    category: 'Library',
    rating: 4.5,
    reviewCount: 128,
    quietScore: 86,
    verified: true,
    features: [
      ACCESS_FEATURES.ramp,
      ACCESS_FEATURES.elevator,
      ACCESS_FEATURES.restroom,
      ACCESS_FEATURES.quietSeating,
    ],
  },
  {
    id: 'pl_2',
    name: 'Riverside Community Recreation Center',
    category: 'Recreation',
    rating: 4.1,
    reviewCount: 62,
    quietScore: 54,
    verified: true,
    features: [ACCESS_FEATURES.ramp, ACCESS_FEATURES.parking, ACCESS_FEATURES.restroom],
  },
  {
    id: 'pl_3',
    name: 'Maple Street Cafe',
    category: 'Cafe',
    rating: 3.8,
    reviewCount: 45,
    quietScore: 38,
    verified: false,
    features: [ACCESS_FEATURES.serviceAnimal, ACCESS_FEATURES.ramp],
  },
  {
    id: 'pl_4',
    name: 'Grandview Cinema',
    category: 'Entertainment',
    rating: 4.7,
    reviewCount: 210,
    quietScore: 72,
    verified: true,
    features: [
      ACCESS_FEATURES.hearingLoop,
      ACCESS_FEATURES.elevator,
      ACCESS_FEATURES.restroom,
      ACCESS_FEATURES.braille,
    ],
  },
  {
    id: 'pl_5',
    name: 'Northside Transit Hub',
    category: 'Transit',
    // Unrated on purpose — exercises the empty rating path.
    rating: null,
    reviewCount: 0,
    quietScore: null,
    verified: false,
    features: [ACCESS_FEATURES.elevator, ACCESS_FEATURES.braille],
  },
];

/* -------------------------------------------------------------------------- */
/* Activity                                                                   */
/* -------------------------------------------------------------------------- */

export const activity: ActivityEvent[] = [
  {
    id: 'a_1',
    kind: 'report',
    title: 'You reported "Broken elevator"',
    subtitle: 'Lincoln High School',
    occurredAt: hoursAgo(2),
  },
  {
    id: 'a_2',
    kind: 'vote',
    title: 'You voted on the north entrance ramp',
    subtitle: 'Lincoln High School',
    occurredAt: hoursAgo(20),
  },
  {
    id: 'a_3',
    kind: 'review',
    title: 'You reviewed "Central Library"',
    subtitle: 'Rated 4.5 · Quiet · Accessible restroom',
    occurredAt: daysAgo(2),
  },
  {
    id: 'a_4',
    kind: 'verification',
    title: 'Grandview Cinema became Accessibility Verified',
    subtitle: 'A place you reviewed met the standard',
    occurredAt: daysAgo(5),
  },
  {
    id: 'a_5',
    kind: 'report',
    title: 'Your report "Library door pull" was resolved',
    subtitle: 'Central Library',
    occurredAt: daysAgo(9),
  },
];
