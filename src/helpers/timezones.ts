import { DateTime } from 'luxon';

/** The viewer's IANA zone, with a safe fallback for SSR. */
export function resolveDeviceTimeZone(): string {
  if (typeof Intl === 'undefined') return 'Africa/Lagos';
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos';
}

/** e.g. "GMT+1" — used next to timestamps so operators know the frame. */
export function timeZoneOffsetLabel(zone: string = resolveDeviceTimeZone()): string {
  return DateTime.now().setZone(zone).toFormat('ZZZZ');
}

export const COMMON_TIME_ZONES = [
  'Africa/Lagos',
  'Africa/Accra',
  'Africa/Nairobi',
  'Africa/Johannesburg',
  'Europe/London',
  'America/New_York',
  'Asia/Dubai',
] as const;
