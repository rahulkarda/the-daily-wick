/**
 * Email render snapshot — verifies the email-renderer produces clean HTML
 * with the expected structural elements. Not a pixel-perfect snapshot;
 * we check for the load-bearing pieces.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderEmail } from '../scripts/lib/email-renderer.mjs';

const fixture = {
  title: 'On the discipline of stillness',
  subtitle: 'Why the practice of doing nothing is the hardest practice of all.',
  bodyMdx: [
    '## The Idea',
    'There is a particular kind of restlessness that no amount of action will satisfy.',
    '',
    '## One Question',
    'What is the smallest pocket of silence you could keep today?',
    '',
    "## Today's Action",
    '1. Pick one transition in your day.',
    "2. Don't reach for the phone.",
    '',
    '## Go Deeper',
    'Stillness is the soil the work grows in.',
  ].join('\n'),
  epigraph: { text: 'All of humanity\'s problems stem from inability to sit quietly alone.', attribution: 'Pascal' },
  monthlyTheme: 'Stillness',
  curator: 'the Editor',
  postSlug: 'on-the-discipline-of-stillness',
  pubDate: '2026-05-28',
  siteUrl: 'https://the-daily-wick.pages.dev',
  buttondownHandle: 'the-daily-wick',
};

test('renderEmail returns subject + html + preheader', () => {
  const r = renderEmail(fixture);
  assert.equal(r.subject, fixture.title);
  assert.ok(r.html.length > 1000, 'HTML should not be empty');
  assert.ok(r.preheader.length > 0);
});

test('renderEmail HTML is fully inline-styled (no <style> blocks)', () => {
  const { html } = renderEmail(fixture);
  assert.ok(!/<style[^>]*>/.test(html), 'must not contain <style> blocks');
});

test('renderEmail HTML contains all four section markers', () => {
  const { html } = renderEmail(fixture);
  assert.match(html, /The Idea/);
  assert.match(html, /One Question/);
  assert.match(html, /Today's Action|Today&#39;s Action/);
  assert.match(html, /Go Deeper/);
});

test('renderEmail HTML includes web-version + standards links', () => {
  const { html } = renderEmail(fixture);
  assert.match(html, /the-daily-wick\.pages\.dev\/articles\/on-the-discipline-of-stillness/);
  assert.match(html, /editorial-standards/);
});

test('renderEmail HTML includes curator name + AI disclosure', () => {
  const { html } = renderEmail(fixture);
  assert.match(html, /Drafted with AI/);
  assert.match(html, /the Editor/);
});

test('renderEmail HTML respects 600px container', () => {
  const { html } = renderEmail(fixture);
  assert.match(html, /max-width:600px/);
});
