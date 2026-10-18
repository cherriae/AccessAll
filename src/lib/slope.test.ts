/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { degreesToPercent, medianSlope, slopeRatio, slopeVerdict, steadyTilt, tiltDegrees } from './slope.ts';

const close = (actual: number | null, expected: number, epsilon = 0.01) =>
  assert.ok(actual !== null && Math.abs(actual - expected) < epsilon, `${actual} ≉ ${expected}`);

test('a phone lying flat reads zero tilt', () => {
  close(tiltDegrees({ x: 0, y: 0, z: -1 }), 0);
  close(tiltDegrees({ x: 0, y: 0, z: 9.81 }), 0);
});

test('tilt is independent of units and which way the phone is turned', () => {
  const angle = (Math.PI / 180) * 4.76;
  close(tiltDegrees({ x: 0, y: Math.sin(angle), z: Math.cos(angle) }), 4.76);
  close(tiltDegrees({ x: 9.81 * Math.sin(angle), y: 0, z: -9.81 * Math.cos(angle) }), 4.76);
});

test('a reading with no gravity is rejected', () => {
  assert.equal(tiltDegrees({ x: 0, y: 0, z: 0 }), null);
});

test('the ADA 1:12 limit is 4.76 degrees, or 8.33%', () => {
  close(degreesToPercent(4.764), 8.33);
  assert.equal(slopeRatio(8.33), '1:12');
  assert.equal(slopeRatio(5), '1:20');
  assert.equal(slopeRatio(0), 'flat');
});

test('verdicts follow the ADA thresholds with a little measuring grace', () => {
  assert.equal(slopeVerdict(4), 'walkway');
  assert.equal(slopeVerdict(8.33), 'meets');
  assert.equal(slopeVerdict(8.7), 'meets');
  assert.equal(slopeVerdict(9.5), 'close');
  assert.equal(slopeVerdict(14), 'too-steep');
});

test('waits until the phone is held still', () => {
  assert.equal(steadyTilt([1, 2, 3]), null);
  assert.equal(steadyTilt([1, 5, 2, 6, 1, 5, 2, 6]), null);
  close(steadyTilt([9, 9, 4.7, 4.8, 4.7, 4.8, 4.7, 4.8, 4.7, 4.8]), 4.75);
});

test('median resists one bad measurement', () => {
  assert.equal(medianSlope([]), null);
  assert.equal(medianSlope([7, 8, 40]), 8);
  assert.equal(medianSlope([6, 8]), 7);
});
