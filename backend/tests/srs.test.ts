import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleReview, masteryLevel, endOfUtcDay, utcDay } from '../src/lib/srs';
import { words } from '../src/data/words';
const now = new Date('2026-10-02T12:34:56.000Z');

test('successful SM-2 reviews advance through one, six, then multiplied days', () => {
  const first = scheduleReview({ interval: 0, easeFactor: 2.5, repetitions: 0 }, 3, now);
  assert.equal(first.interval, 1);
  assert.equal(first.repetitions, 1);
  assert.equal(first.nextReviewDate.toISOString(), '2026-10-03T12:34:56.000Z');
  const second = scheduleReview(first, 3, now);
  assert.equal(second.interval, 6);
  const third = scheduleReview(second, 4, now);
  assert.equal(third.interval, 15);
  assert.equal(third.easeFactor, 2.6);
});

test('failed recall resets repetitions and clamps ease to 1.3', () => {
  const result = scheduleReview({ interval: 45, easeFactor: 1.4, repetitions: 7 }, 1, now);
  assert.equal(result.repetitions, 0);
  assert.equal(result.interval, 1);
  assert.equal(result.easeFactor, 1.3);
});

test('hard recall succeeds but decreases ease; input is never mutated', () => {
  const state = { interval: 6, easeFactor: 2.5, repetitions: 2 };
  const result = scheduleReview(state, 2, now);
  assert.equal(result.easeFactor, 2.36);
  assert.equal(result.repetitions, 3);
  assert.deepEqual(state, { interval: 6, easeFactor: 2.5, repetitions: 2 });
  assert.equal(now.toISOString(), '2026-10-02T12:34:56.000Z');
});

test('later intervals round upward as specified by SM-2', () => {
  const result = scheduleReview({ interval: 7, easeFactor: 2.36, repetitions: 3 }, 3, now);
  assert.equal(result.interval, 17);
});

test('invalid scheduling inputs are rejected', () => {
  assert.throws(() => scheduleReview({ interval: -1, easeFactor: 2.5, repetitions: 0 }, 3));
  assert.throws(() => scheduleReview({ interval: 0, easeFactor: NaN, repetitions: 0 }, 3));
  assert.throws(() => scheduleReview({ interval: 0, easeFactor: 2.5, repetitions: 0 }, 0 as 1));
});

test('UTC calendar helpers and mastery boundaries are consistent', () => {
  assert.equal(utcDay(now), '2026-10-02');
  assert.equal(endOfUtcDay(now).toISOString(), '2026-10-02T23:59:59.999Z');
  assert.equal(masteryLevel(1, 1), 'Learning');
  assert.equal(masteryLevel(2, 6), 'Familiar');
  assert.equal(masteryLevel(5, 21), 'Mastered');
  const leap = scheduleReview({ interval: 0, easeFactor: 2.5, repetitions: 0 }, 3, new Date('2028-02-28T09:00:00Z'));
  assert.equal(utcDay(leap.nextReviewDate), '2028-02-29');
});

test('catalog has fifty unique complete B1–C1 words with usable cloze contexts', () => {
  assert.ok(words.length >= 50);
  assert.equal(new Set(words.map(word => word.term)).size, words.length);
  for (const word of words) {
    assert.match(word.ipa, /^\/.+\/$/);
    assert.ok(word.definition.length > 10);
    assert.ok(word.context.toLowerCase().includes(word.term));
    assert.ok(word.collocations.length >= 2);
    assert.ok(['B1', 'B2', 'C1'].includes(word.level));
  }
});
