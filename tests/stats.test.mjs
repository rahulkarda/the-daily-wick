/**
 * Streak math tests — locks in Mon-Fri publish-day semantics so the
 * Sunday-counts-as-publish-day regression doesn't sneak back in.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStreak, isNextPublishDay } from '../src/lib/streak.mjs';

function fakePost(dateIso) {
  return {
    slug: `p-${dateIso}`,
    body: 'one two three',
    data: {
      pubDate: new Date(`${dateIso}T12:00:00Z`),
    },
  };
}

test('isNextPublishDay: Fri→Mon true (diff=3)', () => {
  // 2026-06-05 = Fri, 2026-06-08 = Mon
  assert.equal(
    isNextPublishDay(new Date('2026-06-05T12:00:00Z'), new Date('2026-06-08T12:00:00Z')),
    true,
  );
});

test('isNextPublishDay: Sun→Mon false', () => {
  // 2026-06-07 = Sun, 2026-06-08 = Mon
  assert.equal(
    isNextPublishDay(new Date('2026-06-07T12:00:00Z'), new Date('2026-06-08T12:00:00Z')),
    false,
  );
});

test('isNextPublishDay: Sat→Mon false', () => {
  assert.equal(
    isNextPublishDay(new Date('2026-06-06T12:00:00Z'), new Date('2026-06-08T12:00:00Z')),
    false,
  );
});

test('isNextPublishDay: Mon→Tue true', () => {
  assert.equal(
    isNextPublishDay(new Date('2026-06-01T12:00:00Z'), new Date('2026-06-02T12:00:00Z')),
    true,
  );
});

test('isNextPublishDay: Mon→Wed false (gap)', () => {
  assert.equal(
    isNextPublishDay(new Date('2026-06-01T12:00:00Z'), new Date('2026-06-03T12:00:00Z')),
    false,
  );
});

test('streak: clean Mon-Fri week is length 5', () => {
  const posts = [
    fakePost('2026-06-01'),
    fakePost('2026-06-02'),
    fakePost('2026-06-03'),
    fakePost('2026-06-04'),
    fakePost('2026-06-05'),
  ];
  assert.equal(computeStreak(posts).length, 5);
});

test('streak: Fri→Mon continues across the weekend', () => {
  const posts = [
    fakePost('2026-06-04'), // Thu
    fakePost('2026-06-05'), // Fri
    fakePost('2026-06-08'), // Mon
  ];
  assert.equal(computeStreak(posts).length, 3);
});

test('streak: a Sunday post does NOT extend a Mon streak', () => {
  // Regression: Sun(diff=1)→Mon must NOT chain.
  const posts = [
    fakePost('2026-06-07'), // Sun
    fakePost('2026-06-08'), // Mon
    fakePost('2026-06-09'), // Tue
  ];
  // Mon→Tue is 2; Sun→Mon must NOT chain into 3
  assert.equal(computeStreak(posts).length, 2);
});

test('streak: missed Wed breaks the streak', () => {
  const posts = [
    fakePost('2026-06-01'), // Mon
    fakePost('2026-06-02'), // Tue
    // Wed missing
    fakePost('2026-06-04'), // Thu
    fakePost('2026-06-05'), // Fri
  ];
  assert.equal(computeStreak(posts).length, 2);
});

test('streak: empty posts → null', () => {
  assert.equal(computeStreak([]), null);
});
