'use client';

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import Header from '@/components/layout/header';
import { SettingsSidebar } from '@/components/layout/settings-sidebar';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import KBar from '@/components/kbar';

function SettingsContent({ children }: { children: React.ReactNode }) {
  const { authenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !authenticated) {
      router.push('/auth/sign-in');
    }
  }, [loading, authenticated, router]);

  if (loading) return null;

  return (
    <KBar>
      <SidebarProvider>
        <SettingsSidebar />
        <SidebarInset>
          <Header />
          <div className='flex flex-1 flex-col gap-4 p-4 pt-0'>{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </KBar>
  );
}

export default function SettingsLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className='flex h-screen w-full items-center justify-center'>
          <p className='text-muted-foreground'>Loading...</p>
        </div>
      }
    >
      <SettingsContent>{children}</SettingsContent>
    </Suspense>
  );
}
