'use client';

import { AuthProvider } from '@/lib/auth';
import { AppProvider } from '@/lib/context';
import { AppShell } from '@/components/AppShell';

export default function Home() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppShell />
      </AppProvider>
    </AuthProvider>
  );
}
