/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { colorDistance, mixColor, parseHex, simulateColor } from './color-vision.ts';

const RED = '#DC2626';
const GREEN = '#16A34A';

test('typical vision leaves colours alone', () => {
  assert.equal(simulateColor(RED, 'typical'), RED);
});

test('red and green collapse toward each other without green or red cones', () => {
  const before = colorDistance(RED, GREEN);
  for (const vision of ['deuteranopia', 'protanopia'] as const) {
    const after = colorDistance(simulateColor(RED, vision), simulateColor(GREEN, vision));
    assert.ok(after < before / 2, `${vision}: ${after} should be far below ${before}`);
  }
});

test('greys are unaffected', () => {
  assert.equal(simulateColor('#808080', 'deuteranopia'), '#808080');
  assert.equal(simulateColor('#FFFFFF', 'protanopia'), '#FFFFFF');
});

test('hex parsing and mixing', () => {
  assert.deepEqual(parseHex('#fff'), [255, 255, 255]);
  assert.equal(mixColor('#000000', '#FFFFFF', 0.5), '#808080');
  assert.equal(mixColor('#123456', '#FFFFFF', 0), '#123456');
});
