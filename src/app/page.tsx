'use client';

import { useRouter } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import { getAuthClientAdapter } from '@/lib/auth/providers/client-factory';

function HomeRedirect() {
  const router = useRouter();
  const authAdapter = getAuthClientAdapter();
  const { user, loading } = authAdapter.useSession();

  useEffect(() => {
    if (loading) return;

    if (user) {
      router.replace('/dashboard/overview');
    } else {
      router.replace('/auth/sign-in');
    }
  }, [user, loading, router]);

  return (
    <div className='flex h-screen items-center justify-center'>
      <p className='text-muted-foreground'>Loading...</p>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className='flex h-screen items-center justify-center'>
          <p className='text-muted-foreground'>Loading...</p>
        </div>
      }
    >
      <HomeRedirect />
    </Suspense>
  );
}
