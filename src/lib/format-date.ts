/**
 * Date formatting helpers — display-only.
 */

const LONG = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const SHORT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const ISO = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function formatDateLong(d: Date | string): string {
  return LONG.format(typeof d === 'string' ? new Date(d) : d);
}

export function formatDateShort(d: Date | string): string {
  return SHORT.format(typeof d === 'string' ? new Date(d) : d);
}

export function formatDateISO(d: Date | string): string {
  return ISO.format(typeof d === 'string' ? new Date(d) : d);
}

export function getYear(d: Date | string): number {
  return (typeof d === 'string' ? new Date(d) : d).getFullYear();
}

export function getMonthKey(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}
