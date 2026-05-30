/**
 * Schema sanity tests — pure validation, no Astro runtime needed.
 * Imports the validateDraft() from gemini.mjs and exercises happy + unhappy
 * paths for both formats.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDraft } from '../scripts/lib/gemini.mjs';

// Build a body that hits the per-format word range. We pad with a long
// distinct sentence repeated, since "aaaa..." counts as one word.
const PAD = 'this is a deliberate filler sentence used to reach the word count needed for the format. ';

function microBody({ extra = 0, sectionToOmit = null } = {}) {
  const sections = {
    '## The Idea': PAD.repeat(20),
    '## One Question': 'Where in your day is your attention pulled in two directions?',
    "## Today's Action": '1. Block 30 minutes for one task.\n2. Phone in another room.',
    '## Go Deeper': 'The trade is always worth it.',
  };
  if (sectionToOmit) delete sections[sectionToOmit];
  let body = Object.entries(sections)
    .map(([h, b]) => `${h}\n\n${b}`)
    .join('\n\n');
  if (extra > 0) body += '\n\n' + PAD.repeat(extra);
  return body;
}

function essayBody() {
  // ~1100 words target — PAD has ~16 words, so 70 reps = 1120
  const sections = {
    '## The Question': PAD.repeat(15),
    '## The Argument': PAD.repeat(25),
    '## The Counterpoint': PAD.repeat(20),
    '## What To Do With It': PAD.repeat(10),
  };
  return Object.entries(sections)
    .map(([h, b]) => `${h}\n\n${b}`)
    .join('\n\n');
}

const validMicro = {
  title: 'The cost of half-attention',
  subtitle: 'Why doing two things at once usually means doing both badly.',
  slug: 'the-cost-of-half-attention',
  tags: ['attention', 'focus'],
  epigraph: { text: 'Focus is the gateway to thinking.', attribution: 'Edward de Bono' },
  bodyMdx: microBody(),
  imageQueries: ['single candle flame', 'worn stone path', 'morning fog forest'],
  themeAlignmentNote: 'Attention is the theme; this is a direct on-theme post.',
};

test('validateDraft accepts a well-formed micro draft', () => {
  assert.deepEqual(validateDraft(validMicro, 'micro'), { ok: true });
});

test('validateDraft accepts a well-formed essay draft', () => {
  const validEssay = { ...validMicro, bodyMdx: essayBody(), slug: 'on-friction' };
  assert.deepEqual(validateDraft(validEssay, 'essay'), { ok: true });
});

test('validateDraft rejects micro body that uses essay sections', () => {
  const bad = { ...validMicro, bodyMdx: essayBody() };
  const r = validateDraft(bad, 'micro');
  assert.equal(r.ok, false);
});

test('validateDraft rejects essay body that uses micro sections', () => {
  const bad = { ...validMicro, slug: 'oops', bodyMdx: microBody() };
  const r = validateDraft(bad, 'essay');
  assert.equal(r.ok, false);
});

test('validateDraft rejects missing title', () => {
  const bad = { ...validMicro };
  delete bad.title;
  assert.equal(validateDraft(bad, 'micro').ok, false);
});

test('validateDraft rejects banned phrase', () => {
  const bad = {
    ...validMicro,
    bodyMdx: validMicro.bodyMdx.replace(PAD.repeat(20), 'in conclusion ' + PAD.repeat(20)),
  };
  assert.equal(validateDraft(bad, 'micro').ok, false);
});

test('validateDraft rejects bad slug', () => {
  const bad = { ...validMicro, slug: 'Has Spaces' };
  assert.equal(validateDraft(bad, 'micro').ok, false);
});

test('validateDraft rejects missing section header', () => {
  const bad = { ...validMicro, bodyMdx: microBody({ sectionToOmit: '## Go Deeper' }) };
  assert.equal(validateDraft(bad, 'micro').ok, false);
});

test('validateDraft rejects emoji', () => {
  const bad = { ...validMicro, title: 'A flame 🔥 idea today' };
  assert.equal(validateDraft(bad, 'micro').ok, false);
});

test('validateDraft rejects too-many tags', () => {
  const bad = { ...validMicro, tags: ['a', 'b', 'c', 'd', 'e', 'f'] };
  assert.equal(validateDraft(bad, 'micro').ok, false);
});

test('validateDraft rejects imageQueries not 3', () => {
  const bad = { ...validMicro, imageQueries: ['only one'] };
  assert.equal(validateDraft(bad, 'micro').ok, false);
});

test('validateDraft rejects duplicate imageQueries', () => {
  const bad = { ...validMicro, imageQueries: ['candle', 'candle', 'candle'] };
  assert.equal(validateDraft(bad, 'micro').ok, false);
});

test('validateDraft accepts furtherReading shape', () => {
  const ok = {
    ...validMicro,
    furtherReading: [
      { label: 'Cal Newport — Deep Work', url: 'https://www.calnewport.com/', kind: 'book', note: 'Foundational.' },
    ],
  };
  assert.deepEqual(validateDraft(ok, 'micro'), { ok: true });
});

test('validateDraft rejects furtherReading with non-http url', () => {
  const bad = {
    ...validMicro,
    furtherReading: [{ label: 'Bad', url: 'javascript:alert(1)', kind: 'site' }],
  };
  assert.equal(validateDraft(bad, 'micro').ok, false);
});

test('validateDraft rejects furtherReading url with quote (XSS injection)', () => {
  const bad = {
    ...validMicro,
    furtherReading: [{ label: 'Bad', url: 'https://example.com" onload="alert(1)', kind: 'site' }],
  };
  assert.equal(validateDraft(bad, 'micro').ok, false);
});

test('validateDraft rejects furtherReading url with whitespace', () => {
  const bad = {
    ...validMicro,
    furtherReading: [{ label: 'Bad', url: 'https://example.com /evil', kind: 'site' }],
  };
  assert.equal(validateDraft(bad, 'micro').ok, false);
});

test('validateDraft rejects micro body that is too long', () => {
  // Push it to ~600 words by adding lots of extra padding
  const bad = { ...validMicro, bodyMdx: microBody({ extra: 30 }) };
  const r = validateDraft(bad, 'micro');
  assert.equal(r.ok, false);
});
