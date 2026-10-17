/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { joinElevatorOutages, outagesInBounds } from './transit.ts';

const equipment = [
  { equipmentno: 'EL1', stationcomplexid: '10', alternativeroute: 'Take the B to Atlantic Av.' },
  { equipmentno: 'EL2', stationcomplexid: '99' },
];
const stations = [
  { complex_id: '10', stop_name: 'DeKalb Av', gtfs_latitude: '40.690635', gtfs_longitude: '-73.981824' },
  { complex_id: '10', stop_name: 'DeKalb Av (other line)', gtfs_latitude: '41', gtfs_longitude: '-74' },
];

test('joins current elevator outages to station coordinates by equipment id', () => {
  const result = joinElevatorOutages(
    [
      { station: 'DeKalb Av', trainno: 'B/Q/R', equipment: 'EL1', equipmenttype: 'EL', ADA: 'Y', isupcomingoutage: 'N', reason: 'Repair', serving: 'Street to platform', estimatedreturntoservice: '10/31/2026 06:00:00 AM' },
      { station: 'DeKalb Av', equipment: 'ES5', equipmenttype: 'ES', isupcomingoutage: 'N' },
      { station: 'DeKalb Av', equipment: 'EL1', equipmenttype: 'EL', isupcomingoutage: 'Y' },
      { station: 'Nowhere', equipment: 'EL2', equipmenttype: 'EL', isupcomingoutage: 'N' },
    ],
    equipment,
    stations,
  );

  assert.equal(result.length, 1);
  assert.deepEqual(result[0], {
    equipment: 'EL1',
    station: 'DeKalb Av',
    lines: 'B/Q/R',
    serving: 'Street to platform',
    reason: 'Repair',
    estimatedReturn: '10/31/2026 06:00:00 AM',
    ada: true,
    alternativeRoute: 'Take the B to Atlantic Av.',
    latitude: 40.690635,
    longitude: -73.981824,
  });
});

test('filters outages to the visible map area', () => {
  const [outage] = joinElevatorOutages([{ equipment: 'EL1', equipmenttype: 'EL' }], equipment, stations);
  assert.equal(outagesInBounds([outage], { minLatitude: 40.6, maxLatitude: 40.7, minLongitude: -74, maxLongitude: -73.9 }).length, 1);
  assert.equal(outagesInBounds([outage], { minLatitude: 40.7, maxLatitude: 40.8, minLongitude: -74, maxLongitude: -73.9 }).length, 0);
});
