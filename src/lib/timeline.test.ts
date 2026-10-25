/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { timelineFrame, timelineRange, type TimelineReport } from './timeline.ts';

const reports: TimelineReport[] = [
  { id: 'a', title: 'Broken lift', latitude: 1, longitude: 1, createdAt: '2026-09-01T00:00:00Z', resolvedAt: '2026-09-10T00:00:00Z' },
  { id: 'b', title: 'Blocked ramp', latitude: 2, longitude: 2, createdAt: '2026-09-05T00:00:00Z', resolvedAt: null },
];

test('range starts a day before the first report and ends now', () => {
  assert.equal(timelineRange([]), null);
  const range = timelineRange(reports, Date.parse('2026-10-01T00:00:00Z'))!;
  assert.equal(new Date(range.start).toISOString(), '2026-08-31T00:00:00.000Z');
  assert.equal(new Date(range.end).toISOString(), '2026-10-01T00:00:00.000Z');
});

test('reports appear when filed and turn fixed when resolved', () => {
  assert.equal(timelineFrame(reports, Date.parse('2026-08-31T00:00:00Z')).reported, 0);

  const early = timelineFrame(reports, Date.parse('2026-09-06T00:00:00Z'));
  assert.deepEqual([early.reported, early.fixed], [2, 0]);
  assert.deepEqual(early.pins.map((pin) => pin.kind), ['report', 'report']);

  const later = timelineFrame(reports, Date.parse('2026-09-20T00:00:00Z'));
  assert.deepEqual([later.reported, later.fixed], [2, 1]);
  assert.equal(later.pins[0].kind, 'fixed');
  assert.equal(later.pins[0].label, 'Broken lift: fixed');
});
