/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { advocacyMailto, buildAdvocacyLetter } from './advocacy-letter.ts';

const report = { title: 'Side ramp is blocked', location: 'Brooklyn Tech, Fort Greene Pl', createdAt: '2026-10-01T12:00:00Z', upvotes: 12, status: 'open' as const };

test('states the evidence and asks for a dated reply', () => {
  const letter = buildAdvocacyLetter({ report, senderName: 'Sam Lee', commentCount: 3, today: new Date('2026-10-17T12:00:00Z') });

  assert.equal(letter.subject, 'Accessibility barrier: Side ramp is blocked (Brooklyn Tech, Fort Greene Pl)');
  assert.match(letter.body, /12 people have confirmed/);
  assert.match(letter.body, /16 days ago/);
  assert.match(letter.body, /3 comments/);
  assert.match(letter.body, /Section 504/);
  assert.match(letter.body, /by October 27, 2026/);
  assert.match(letter.body, /Sincerely,\nSam Lee$/);
});

test('leaves a placeholder when the sender is unknown and omits empty evidence', () => {
  const letter = buildAdvocacyLetter({ report: { ...report, upvotes: 1 }, commentCount: 0, today: new Date('2026-10-02T12:00:00Z') });
  assert.match(letter.body, /1 person has confirmed/);
  assert.doesNotMatch(letter.body, /comment/);
  assert.match(letter.body, /\[Your name\]$/);
});

test('mailto encodes subject and body', () => {
  const url = advocacyMailto({ subject: 'A & B', body: 'line 1\nline 2' }, ' office@school.edu ');
  assert.equal(url, 'mailto:office%40school.edu?subject=A%20%26%20B&body=line%201%0Aline%202');
});
