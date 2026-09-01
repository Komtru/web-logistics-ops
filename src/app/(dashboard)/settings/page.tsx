import type { Metadata } from 'next';

import { SettingsView } from '@/app/(dashboard)/settings/SettingsView';

export const metadata: Metadata = {
  title: 'Settings',
};

export default function SettingsPage() {
  return <SettingsView />;
}
