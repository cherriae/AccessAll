import type { Place } from '@/types';

/**
 * Search results are previews, not database records. Keep them in memory only
 * while someone decides whether to contribute a review or accessibility guide.
 */
const drafts = new Map<string, Place>();

export function savePlaceDraft(place: Place) {
  drafts.set(place.id, place);
}

export function getPlaceDraft(id?: string) {
  return id ? drafts.get(id) : undefined;
}

export function removePlaceDraft(id: string) {
  drafts.delete(id);
}
