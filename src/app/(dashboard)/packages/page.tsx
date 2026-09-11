import type { Metadata } from 'next';

import { PackagesView } from '@/app/(dashboard)/packages/PackagesView';

export const metadata: Metadata = {
  title: 'Packages',
};

export default function PackagesPage() {
  return <PackagesView />;
}
