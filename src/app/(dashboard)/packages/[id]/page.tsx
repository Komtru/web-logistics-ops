import type { Metadata } from 'next';

import { PackageDetailView } from '@/app/(dashboard)/packages/[id]/PackageDetailView';

export const metadata: Metadata = {
  title: 'Package',
};

export default async function PackageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PackageDetailView packageId={id} />;
}
