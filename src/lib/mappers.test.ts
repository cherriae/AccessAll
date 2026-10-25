/// <reference types="node" />
/**
 * Run with `npm test` (Node's built-in test runner; no bundler involved).
 *
 * The mappers are the boundary where community-written rows become the shapes
 * every screen renders, so malformed data has to stop here.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { PlaceFeedRow, ReviewFeedRow } from './database.types';
import { toPlace, toPlaceEdit, toReview } from './mappers.ts';

function placeRow(overrides: Partial<Record<keyof PlaceFeedRow, unknown>> = {}): PlaceFeedRow {
  return {
    id: 'p1',
    name: 'Library',
    category: 'library',
    address: '',
    accessibility_note: '',
    source_label: '',
    source_url: '',
    community_guide: '',
    guide_author: '',
    guide_updated_at: null,
    latitude: 40.69,
    longitude: -73.98,
    features: [],
    rating: null,
    review_count: 0,
    quiet_score: null,
    created_at: '2026-10-01T00:00:00Z',
    ...overrides,
  } as PlaceFeedRow;
}

test('drops feature entries missing the fields the UI renders', () => {
  const place = toPlace(placeRow({
    features: [
      { id: 'ramp', label: 'Ramp', icon: 'ramp' },
      { id: 'no-label', icon: 'ramp' },
      'not an object',
      null,
      { id: 'lift', label: 42, icon: 'elevator' },
    ],
  }));

  assert.deepEqual(place.features, [{ id: 'ramp', label: 'Ramp', icon: 'ramp' }]);
});

test('treats a non-array features value as no features', () => {
  assert.deepEqual(toPlace(placeRow({ features: { id: 'x' } })).features, []);
});

test('only keeps http(s) source links', () => {
  assert.equal(toPlace(placeRow({ source_url: 'https://example.org/a' })).sourceUrl, 'https://example.org/a');
  assert.equal(toPlace(placeRow({ source_url: 'HTTP://example.org' })).sourceUrl, 'HTTP://example.org');
  assert.equal(toPlace(placeRow({ source_url: 'javascript:alert(1)' })).sourceUrl, undefined);
  assert.equal(toPlace(placeRow({ source_url: '' })).sourceUrl, undefined);
});

test('parses numeric ratings that arrive as strings', () => {
  assert.equal(toPlace(placeRow({ rating: '4.50' })).rating, 4.5);
  assert.equal(toPlace(placeRow({ rating: 'not a number' })).rating, null);
});

test('turns empty prose into undefined', () => {
  const place = toPlace(placeRow({ community_guide: '', guide_author: '' }));
  assert.equal(place.communityGuide, undefined);
  assert.equal(place.guideAuthor, undefined);
});

test('keeps the review author id so screens can find your own review', () => {
  const row: ReviewFeedRow = {
    id: 'r1',
    place_id: 'p1',
    user_id: 'u1',
    rating: 4,
    quiet_score: null,
    accessibility_notes: 'Step-free',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    author_name: 'Alice',
    quiet_measured: false,
  };

  assert.equal(toReview(row).userId, 'u1');
});

test('summarises a place edit as added and removed features', () => {
  const edit = toPlaceEdit({
    id: 'e1',
    place_id: 'p1',
    old_features: [{ id: 'ramp', label: 'Ramp', icon: 'ramp' }, { id: 'loop', label: 'Hearing loop', icon: 'hearing' }],
    new_features: [{ id: 'ramp', label: 'Ramp', icon: 'ramp' }, { id: 'elevator', label: 'Elevator', icon: 'elevator' }],
    old_guide: 'Side door',
    new_guide: 'Side door',
    created_at: '2026-10-01T00:00:00Z',
    reverted_at: null,
    editor_name: 'Sam L.',
  });

  assert.deepEqual(edit.added, ['Elevator']);
  assert.deepEqual(edit.removed, ['Hearing loop']);
  assert.equal(edit.guideChanged, false);
});
