/**
 * Site-wide constants. Single source of truth for branding strings.
 */

export const SITE = {
  name: 'The Daily Wick',
  tagline: 'A small flame, every morning',
  description:
    'A daily byte-size newsletter for curious minds. One idea, one question, one action — every weekday morning.',
  url: 'https://rahulkarda.github.io/the-daily-wick',
  buttondownHandle: 'the-daily-wick',
  curator: 'the Editor',
  language: 'en',
  locale: 'en-US',
  twitter: '',
} as const;

export const NAV = [
  { label: 'Home', href: '/' },
  { label: 'Articles', href: '/articles' },
  { label: 'Archive', href: '/archive' },
  { label: 'About', href: '/about' },
  { label: 'Subscribe', href: '/subscribe' },
] as const;

export const FOOTER_NAV = [
  { label: 'FAQ', href: '/faq' },
  { label: 'Editorial Standards', href: '/editorial-standards' },
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
