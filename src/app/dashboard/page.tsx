'use client';

import { useRouter } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import { getAuthClientAdapter } from '@/lib/auth/providers/client-factory';

function DashboardRedirect() {
  const router = useRouter();
  const adapter = getAuthClientAdapter();
  const session = adapter.useSession();

  useEffect(() => {
    if (session.loading) return;

    if (session.authenticated) {
      router.replace('/dashboard/overview');
    } else {
      router.replace('/auth/sign-in');
    }
  }, [session, router]);

  return (
    <div className='flex h-screen items-center justify-center'>
      <p className='text-muted-foreground'>Loading...</p>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense
      fallback={
        <div className='flex h-screen items-center justify-center'>
          <p className='text-muted-foreground'>Loading...</p>
        </div>
      }
    >
      <DashboardRedirect />
    </Suspense>
  );
}
