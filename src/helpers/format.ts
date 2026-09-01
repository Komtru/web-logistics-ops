import { DateTime } from 'luxon';

/**
 * Money always arrives in minor units (kobo for NGN) and is formatted here.
 * Nothing in the UI should divide by 100 inline.
 */
export function formatMoney(minorUnits: number, currency = 'NGN'): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(minorUnits / 100);
}

export function formatMoneyCompact(minorUnits: number, currency = 'NGN'): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(minorUnits / 100);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-NG').format(value);
}

export function formatPercent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatDate(iso: string, zone?: string): string {
  return DateTime.fromISO(iso, { zone }).toFormat('d LLL yyyy');
}

export function formatDateTime(iso: string, zone?: string): string {
  return DateTime.fromISO(iso, { zone }).toFormat('d LLL yyyy, HH:mm');
}

export function formatRelative(iso: string): string {
  return DateTime.fromISO(iso).toRelative() ?? '';
}

/** `CONTACT_VERIFIED` -> `Contact Verified`. For enum-shaped API values with no display label of their own. */
export function formatEnum(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Initials for avatar fallbacks. Handles single-word names. */
export function initialsOf(...parts: Array<string | undefined | null>): string {
  const letters = parts
    .filter((part): part is string => Boolean(part?.trim()))
    .map((part) => part.trim()[0]!.toUpperCase());

  return letters.slice(0, 2).join('') || '—';
}

/** Truncate on a word boundary where possible. */
export function truncate(value: string, max = 64): string {
  if (value.length <= max) return value;
  const slice = value.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return `${lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice}…`;
}
