/**
 * The only place raw hex is allowed to live.
 *
 * Components style with token classes (`bg-komtru-navy`). A couple of consumers
 * — `next/metadata` themeColor, `nextjs-toploader`'s `color` prop — take a
 * colour string rather than a class, and read it from here so the palette still
 * has one source of truth.
 */
export const BRAND = {
  navy: '#0d1420',
  charcoal: '#1a2333',
  indigo: '#4552d6',
  emerald: '#159768',
  gold: '#b9791f',
  risk: '#c0392e',
  cloud: '#f5f7fa',
} as const;
