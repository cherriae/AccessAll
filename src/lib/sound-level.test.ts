/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { averageDbfs, dbfsToQuietScore, nearestQuietOption } from './sound-level.ts';

test('maps the dBFS range onto 0–100, clamping the ends', () => {
  assert.equal(dbfsToQuietScore(-60), 100);
  assert.equal(dbfsToQuietScore(-90), 100);
  assert.equal(dbfsToQuietScore(-35), 50);
  assert.equal(dbfsToQuietScore(-10), 0);
  assert.equal(dbfsToQuietScore(0), 0);
  assert.equal(dbfsToQuietScore(Number.NEGATIVE_INFINITY), 100);
});

test('averages loudness in the power domain', () => {
  assert.equal(averageDbfs([]), null);
  assert.ok(Math.abs(averageDbfs([-40, -40])! + 40) < 1e-9);
  // One loud sample dominates: the result sits near the loud end, not the midpoint.
  assert.ok(averageDbfs([-60, -20])! > -24);
});

test('snaps to the review form options', () => {
  assert.equal(nearestQuietOption(0), '20');
  assert.equal(nearestQuietOption(69), '60');
  assert.equal(nearestQuietOption(71), '80');
  assert.equal(nearestQuietOption(100), '100');
});
