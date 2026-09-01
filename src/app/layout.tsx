import type { Metadata, Viewport } from 'next';
import NextTopLoader from 'nextjs-toploader';

import { fontVariables } from '@/app/fonts';
import { QueryProvider } from '@/components/query-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { BRAND } from '@/config/brand';

import './globals.css';

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:7830');

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'Komtru Logistics Ops',
    template: '%s · Komtru Logistics Ops',
  },
  description: 'Internal logistics operations console for Komtru.',
  applicationName: 'Komtru Logistics Ops',
  manifest: '/site.webmanifest',
  // Internal tool: no public surface, so keep it out of indexes entirely.
  robots: { index: false, follow: false, nocache: true },
  icons: {
    icon: [
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
    shortcut: ['/icons/favicon.ico'],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: BRAND.cloud },
    { media: '(prefers-color-scheme: dark)', color: BRAND.navy },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontVariables} font-body antialiased`}>
        <ThemeProvider>
          <NextTopLoader showSpinner={false} color={BRAND.indigo} height={2} />
          <QueryProvider>{children}</QueryProvider>
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
