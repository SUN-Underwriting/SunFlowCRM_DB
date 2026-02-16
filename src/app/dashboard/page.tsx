'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSessionContext } from 'supertokens-auth-react/recipe/session';

export default function Dashboard() {
  const router = useRouter();
  const session = useSessionContext();

  useEffect(() => {
    if (session.loading) return;

    if (session.doesSessionExist) {
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
