/**
 * How well a place fits one person's access needs.
 *
 * Generic accessibility maps answer "is this place accessible?" — a question
 * with no single answer, because a hearing loop matters to one visitor and
 * means nothing to the next. This scores a place against the needs someone
 * chose in their access profile instead.
 *
 * A feature counts only when the community has confirmed it. A missing feature
 * is reported as "not confirmed", never as "absent": nobody has said it is not
 * there, only that nobody has said it is.
 */

import type { AccessNeed, Place } from '@/types';

/** A place is sensory friendly at or above this quiet score (matches Explore). */
export const QUIET_THRESHOLD = 60;

interface Requirement {
  /** Shown to the user, e.g. "Elevator". */
  label: string;
  /** Satisfied when any of these community feature ids is confirmed. */
  featureIds?: readonly string[];
  /** Satisfied by a measured or reported quiet score at the threshold. */
  quiet?: boolean;
}

export const ACCESS_NEED_LABELS: Record<AccessNeed, { title: string; description: string }> = {
  wheelchair: { title: 'Wheelchair user', description: 'Step-free entrances, elevators, accessible restrooms and seating.' },
  'temporary-injury': { title: 'Temporary injury', description: 'Crutches, a cast or recovery: avoiding stairs and long standing.' },
  'low-vision': { title: 'Blind or low vision', description: 'Braille or tactile signage and service animals welcome.' },
  deaf: { title: 'Deaf or hard of hearing', description: 'Hearing loops and assistive listening.' },
  sensory: { title: 'Sensory sensitive', description: 'Quieter places and sensory support, e.g. for autistic visitors.' },
};

const REQUIREMENTS: Record<AccessNeed, readonly Requirement[]> = {
  wheelchair: [
    { label: 'Accessible entrance', featureIds: ['accessible-entrance'] },
    { label: 'Elevator', featureIds: ['elevator'] },
    { label: 'Accessible restroom', featureIds: ['restroom'] },
    { label: 'Wheelchair seating', featureIds: ['wheelchair-seating'] },
  ],
  'temporary-injury': [
    { label: 'Step-free entrance', featureIds: ['accessible-entrance'] },
    { label: 'Elevator', featureIds: ['elevator'] },
    { label: 'Seating', featureIds: ['wheelchair-seating'] },
  ],
  'low-vision': [
    { label: 'Braille signage', featureIds: ['braille-signage'] },
    { label: 'Service animals welcome', featureIds: ['service-animal'] },
  ],
  deaf: [
    { label: 'Hearing loop or assistive listening', featureIds: ['hearing-loop', 'assistive-listening'] },
  ],
  sensory: [
    { label: 'Quiet', quiet: true },
    { label: 'Sensory support', featureIds: ['sensory-support'] },
  ],
};

export interface AccessFit {
  /** 0–100: the share of the person's requirements the community has confirmed. */
  score: number;
  confirmed: string[];
  notConfirmed: string[];
}

/**
 * `null` when the person has no needs set, so callers can show nothing rather
 * than a meaningless 100%.
 */
export function accessFit(place: Pick<Place, 'features' | 'quietScore'>, needs: readonly AccessNeed[]): AccessFit | null {
  if (needs.length === 0) {
    return null;
  }

  const featureIds = new Set(place.features.map((feature) => feature.id));
  const seen = new Set<string>();
  const confirmed: string[] = [];
  const notConfirmed: string[] = [];

  for (const need of needs) {
    for (const requirement of REQUIREMENTS[need]) {
      // Two needs can share a requirement (an elevator serves both wheelchair
      // users and someone on crutches); count it once.
      if (seen.has(requirement.label)) continue;
      seen.add(requirement.label);

      const met = requirement.quiet
        ? place.quietScore !== null && place.quietScore >= QUIET_THRESHOLD
        : requirement.featureIds!.some((id) => featureIds.has(id));

      (met ? confirmed : notConfirmed).push(requirement.label);
    }
  }

  const total = confirmed.length + notConfirmed.length;
  return { score: Math.round((confirmed.length / total) * 100), confirmed, notConfirmed };
}
