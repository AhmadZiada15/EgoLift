import { Suspense } from 'react';
import { AppRoot, AppRouteContent } from '@/components/AppRoot';

export default function AppPage() {
  return (
    <Suspense fallback={<AppRoot />}>
      <AppRouteContent />
    </Suspense>
  );
}
