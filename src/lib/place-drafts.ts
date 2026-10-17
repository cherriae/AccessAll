import type { Place } from '@/types';

/**
 * Search results are previews, not database records. Keep them in memory only
 * while someone decides whether to contribute a review or accessibility guide.
 *
 * On web the page can be reloaded or its URL reopened in the same tab, which
 * would empty the in-memory map and leave `/place/geo_…` showing "not found".
 * `sessionStorage` keeps the preview for the life of the tab and no longer.
 */
const drafts = new Map<string, Place>();
const STORAGE_PREFIX = 'place-draft:';

function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    // Access throws when site data is blocked.
    return null;
  }
}

export function savePlaceDraft(place: Place) {
  drafts.set(place.id, place);
  try {
    storage()?.setItem(STORAGE_PREFIX + place.id, JSON.stringify(place));
  } catch {
    // Quota or privacy mode: the in-memory copy still works for this session.
  }
}

export function getPlaceDraft(id?: string) {
  if (!id) return undefined;
  const cached = drafts.get(id);
  if (cached) return cached;

  try {
    const stored = storage()?.getItem(STORAGE_PREFIX + id);
    if (!stored) return undefined;
    const place = JSON.parse(stored) as Place;
    drafts.set(id, place);
    return place;
  } catch {
    return undefined;
  }
}

export function removePlaceDraft(id: string) {
  drafts.delete(id);
  try {
    storage()?.removeItem(STORAGE_PREFIX + id);
  } catch {
    // Nothing to clean up.
  }
}
