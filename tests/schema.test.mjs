/**
 * Schema sanity tests — pure validation, no Astro runtime needed.
 * Imports the validateDraft() from gemini.mjs and exercises both happy
 * and unhappy paths.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDraft } from '../scripts/lib/gemini.mjs';

const valid = {
  title: 'The cost of half-attention',
  subtitle: 'Why doing two things at once usually means doing both badly.',
  slug: 'the-cost-of-half-attention',
  tags: ['attention', 'focus'],
  epigraph: { text: 'Focus is the gateway to thinking.', attribution: 'Edward de Bono' },
  bodyMdx: [
    '## The Idea',
    'a'.repeat(800),
    '',
    '## One Question',
    'Where in your day are you trying to do two things at once?',
    '',
    "## Today's Action",
    '1. Block 30 minutes for one task.',
    '',
    '## Go Deeper',
    'The trade is always worth it.',
  ].join('\n'),
  imageQuery: 'single candle flame',
  themeAlignmentNote: 'Attention is the theme; this is a direct on-theme post.',
};

test('validateDraft accepts a well-formed draft', () => {
  assert.deepEqual(validateDraft(valid), { ok: true });
});

test('validateDraft rejects missing title', () => {
  const bad = { ...valid };
  delete bad.title;
  assert.equal(validateDraft(bad).ok, false);
});

test('validateDraft rejects banned phrase', () => {
  const bad = { ...valid, bodyMdx: valid.bodyMdx.replace('a'.repeat(800), 'in conclusion ' + 'a'.repeat(800)) };
  assert.equal(validateDraft(bad).ok, false);
});

test('validateDraft rejects bad slug', () => {
  const bad = { ...valid, slug: 'Has Spaces' };
  assert.equal(validateDraft(bad).ok, false);
});

test('validateDraft rejects missing section header', () => {
  const bad = { ...valid, bodyMdx: '## The Idea\n\n' + 'a'.repeat(800) };
  assert.equal(validateDraft(bad).ok, false);
});

test('validateDraft rejects emoji', () => {
  const bad = { ...valid, title: 'A flame 🔥 idea today' };
  assert.equal(validateDraft(bad).ok, false);
});

test('validateDraft rejects too-many tags', () => {
  const bad = { ...valid, tags: ['a', 'b', 'c', 'd', 'e', 'f'] };
  assert.equal(validateDraft(bad).ok, false);
});
