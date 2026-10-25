/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { accessFit } from './access-fit.ts';

const feature = (id: string) => ({ id, label: id, icon: 'ramp' as const });

test('no needs means no score, not a meaningless 100%', () => {
  assert.equal(accessFit({ features: [feature('elevator')], quietScore: null }, []), null);
});

test('scores only the requirements of the chosen needs', () => {
  const fit = accessFit({ features: [feature('hearing-loop')], quietScore: null }, ['deaf']);
  assert.deepEqual(fit, { score: 100, confirmed: ['Hearing loop or assistive listening'], notConfirmed: [] });
});

test('counts a requirement shared by two needs once', () => {
  const fit = accessFit({ features: [feature('elevator')], quietScore: null }, ['wheelchair', 'temporary-injury'])!;
  assert.equal(fit.confirmed.filter((label) => label === 'Elevator').length, 1);
  // wheelchair: 4 requirements, temporary-injury adds "Step-free entrance" and "Seating".
  assert.equal(fit.confirmed.length + fit.notConfirmed.length, 6);
  assert.equal(fit.score, 17);
});

test('sensory needs use the quiet score threshold', () => {
  assert.deepEqual(accessFit({ features: [], quietScore: 60 }, ['sensory'])!.confirmed, ['Quiet']);
  assert.deepEqual(accessFit({ features: [], quietScore: 59 }, ['sensory'])!.notConfirmed, ['Quiet', 'Sensory support']);
  assert.deepEqual(accessFit({ features: [], quietScore: null }, ['sensory'])!.score, 0);
});
