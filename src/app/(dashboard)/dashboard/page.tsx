import type { Metadata } from 'next';
import { LayoutDashboard } from 'lucide-react';

import { ModulePlaceholder } from '@/components/general/module-placeholder';

export const metadata: Metadata = {
  title: 'Command Center',
};

export default function DashboardPage() {
  return (
    <ModulePlaceholder
      title="Command center"
      description="The default landing page for the console. Its real screens arrive with the first module."
      icon={LayoutDashboard}
    />
  );
}
