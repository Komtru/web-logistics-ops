'use client';

import { useEffect, useState } from 'react';

import { resolveDeviceTimeZone } from '@/helpers/timezones';

/**
 * Resolved on the client only — reading the zone during SSR would produce the
 * server's zone and a hydration mismatch.
 */
export function useDeviceTimeZone(): string | undefined {
  const [zone, setZone] = useState<string>();

  useEffect(() => {
    setZone(resolveDeviceTimeZone());
  }, []);

  return zone;
}
