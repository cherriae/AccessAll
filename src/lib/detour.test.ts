/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildComplexes, distanceMeters, formatDistance, radarStatuses, searchComplexes } from './detour.ts';
import type { ElevatorOutage } from './transit.ts';

const complexes = buildComplexes([
  { complex_id: '1', stop_name: '59 St-Columbus Circle', gtfs_latitude: '40.768', gtfs_longitude: '-73.982', ada: '1', daytime_routes: 'A C' },
  { complex_id: '1', stop_name: '59 St-Columbus Circle', gtfs_latitude: '40.768', gtfs_longitude: '-73.982', ada: '0', daytime_routes: '1' },
  { complex_id: '2', stop_name: '72 St', gtfs_latitude: '40.778', gtfs_longitude: '-73.982', ada: '1', daytime_routes: '1 2 3' },
  { complex_id: '3', stop_name: '57 St', gtfs_latitude: '40.764', gtfs_longitude: '-73.977', ada: '1', daytime_routes: 'F' },
  { complex_id: '4', stop_name: '66 St-Lincoln Center', gtfs_latitude: '40.774', gtfs_longitude: '-73.982', ada: '0', daytime_routes: '1' },
  { complex_id: '5', stop_name: 'Far Rockaway', gtfs_latitude: '40.6', gtfs_longitude: '-73.75', ada: '1', daytime_routes: 'A' },
]);

function outage(complexId: string, ada = true): ElevatorOutage {
  return { equipment: `EL${complexId}`, complexId, station: '', lines: '', serving: '', reason: 'Repair', estimatedReturn: '', ada, latitude: 0, longitude: 0 };
}

test('merges stops into one complex with every route and its best access', () => {
  const columbus = complexes.get('1')!;
  assert.deepEqual(columbus.routes, ['1', 'A', 'C']);
  assert.equal(columbus.stepFree, 'full');
});

test('a watched station is clear when no step-free elevator is out', () => {
  const [status] = radarStatuses(['1'], complexes, [outage('1', false)]);
  assert.equal(status.outages.length, 0);
  assert.equal(status.alternatives.length, 0);
});

test('an outage suggests nearby step-free stations, preferring shared trains', () => {
  const [status] = radarStatuses(['1'], complexes, [outage('1')]);
  assert.equal(status.outages.length, 1);
  const names = status.alternatives.map((alternative) => alternative.station.name);
  // 72 St shares the 1 train, so it ranks above the closer 57 St.
  assert.deepEqual(names, ['72 St', '57 St']);
  assert.deepEqual(status.alternatives[0].sharedRoutes, ['1']);
  // Not step-free, and too far away, respectively.
  assert.ok(!names.includes('66 St-Lincoln Center'));
  assert.ok(!names.includes('Far Rockaway'));
});

test('alternatives with their own outage are skipped', () => {
  const [status] = radarStatuses(['1'], complexes, [outage('1'), outage('2')]);
  assert.deepEqual(status.alternatives.map((alternative) => alternative.station.name), ['57 St']);
});

test('unknown watched ids are ignored', () => {
  assert.deepEqual(radarStatuses(['999'], complexes, []), []);
});

test('search matches words in any order, ignoring punctuation', () => {
  assert.deepEqual(searchComplexes(complexes, 'columbus 59').map((station) => station.id), ['1']);
  assert.deepEqual(searchComplexes(complexes, '  '), []);
});

test('distance and its display', () => {
  const d = distanceMeters({ latitude: 40.768, longitude: -73.982 }, { latitude: 40.778, longitude: -73.982 });
  assert.ok(d > 1100 && d < 1120);
  assert.equal(formatDistance(432), '430 m');
  assert.equal(formatDistance(1112), '1.1 km');
});
