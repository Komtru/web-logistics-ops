import { IBM_Plex_Mono, Inter, Space_Grotesk } from 'next/font/google';

/**
 * Komtru type system.
 * - `spaceGrotesk` — display/headings, carries the brand voice.
 * - `inter`        — body copy and UI chrome.
 * - `ibmPlexMono`  — trade codes, amounts, identifiers. Anything that must be
 *                    read back character-for-character over the phone.
 */
export const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
});

export const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-mono',
});

export const fonts = {
  display: spaceGrotesk,
  body: inter,
  mono: ibmPlexMono,
};

/** Convenience: all font variables, for the <html> tag. */
export const fontVariables = [spaceGrotesk.variable, inter.variable, ibmPlexMono.variable].join(
  ' ',
);
