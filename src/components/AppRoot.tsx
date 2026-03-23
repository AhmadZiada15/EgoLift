'use client';

import { useSearchParams } from 'next/navigation';
import { AuthProvider } from '@/lib/auth';
import { AppProvider } from '@/lib/context';
import { AppShell, type Tab } from '@/components/AppShell';
type AppRootProps = {
  initialTab?: Tab;
};

export function AppRoot({ initialTab = 'today' }: AppRootProps) {
  return (
    <AuthProvider>
      <AppProvider>
        <AppShell initialTab={initialTab} />
      </AppProvider>
    </AuthProvider>
  );
}

const VALID_TABS = new Set<Tab>(['overview', 'today', 'calendar', 'settings']);

function getInitialTab(tabParam: string | null): Tab {
  const remappedTab = tabParam === 'program'
    ? 'overview'
    : (tabParam === 'history' || tabParam === 'progress' || tabParam === 'friends')
      ? 'calendar'
      : tabParam;

  if (remappedTab && VALID_TABS.has(remappedTab as Tab)) {
    return remappedTab as Tab;
  }

  return 'today';
}

export function AppRouteContent() {
  const searchParams = useSearchParams();

  return <AppRoot initialTab={getInitialTab(searchParams.get('tab'))} />;
}
