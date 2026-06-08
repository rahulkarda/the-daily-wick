/**
 * Site-wide constants. Single source of truth for branding strings.
 */

export const SITE = {
  name: 'The Daily Wick',
  tagline: 'A small flame, every morning',
  description:
    'A daily byte-size newsletter for curious minds. One idea, one question, one action — every weekday morning.',
  url: 'https://rahulkarda.github.io/the-daily-wick',
  buttondownHandle: 'rahulkarda',
  curator: 'Rahul Karda',
  language: 'en',
  locale: 'en-US',
  twitter: '',
} as const;

export const NAV = [
  { label: 'Home', href: '/' },
  { label: 'Start here', href: '/start-here' },
  { label: 'Articles', href: '/articles' },
  { label: 'Themes', href: '/themes' },
  { label: 'Archive', href: '/archive' },
  { label: 'About', href: '/about' },
  { label: 'Subscribe', href: '/subscribe' },
] as const;

export const FOOTER_NAV = [
  { label: 'FAQ', href: '/faq' },
  { label: 'Series', href: '/series' },
  { label: 'Stats', href: '/stats' },
  { label: 'Editorial Standards', href: '/editorial-standards' },
  { label: 'Random', href: '/random' },
  { label: 'RSS', href: '/rss.xml' },
] as const;

export const SUBSCRIBE_COPY = {
  hero: 'A small flame, every morning.',
  subhero:
    'One idea, one question, one action — delivered to your inbox every weekday before breakfast.',
  buttonLabel: 'Light the wick',
  inlinePromptHeading: 'Worth your minute?',
  inlinePromptBody:
    'Get tomorrow’s issue and never miss a flame. Free, weekday mornings.',
  fineprint: 'No spam. One email each weekday. Unsubscribe anytime.',
} as const;

/**
 * Format definitions — display values for UI.
 * The actual validation thresholds live in scripts/lib/gemini.mjs#FORMAT_WORDS
 * (source of truth, since it's what enforces the spec). These display ranges
 * match the *target* range; the validator enforces a slightly wider band to
 * tolerate Gemini under/over by one paragraph.
 */
export const FORMATS = {
  micro: {
    label: 'Micro',
    blurb: 'A 2-minute read. One idea, one question, one action.',
    minWords: 200,
    maxWords: 350,
  },
  essay: {
    label: 'Essay',
    blurb: 'A 6-8-minute deep dive. Argument, counterpoint, payoff.',
    minWords: 900,
    maxWords: 1500,
  },
} as const;

export type FormatKey = keyof typeof FORMATS;
