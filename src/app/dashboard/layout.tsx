import KBar from '@/components/kbar';
import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { InfoSidebar } from '@/components/layout/info-sidebar';
import { InfobarProvider } from '@/components/ui/infobar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Sun MGA — Dashboard',
  description: 'Sun MGA Insurance Platform Dashboard'
};

function DashboardLoading() {
  return (
    <div className='flex h-screen w-full items-center justify-center'>
      <p className='text-muted-foreground'>Loading...</p>
    </div>
  );
}

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true';
  return (
    <Suspense fallback={<DashboardLoading />}>
      <KBar>
        <SidebarProvider
          defaultOpen={defaultOpen}
          className='h-screen overflow-hidden'
        >
          <InfobarProvider defaultOpen={false}>
            <AppSidebar />
            <SidebarInset className='overflow-hidden'>
              <Header />
              <div className='flex min-h-0 flex-1 flex-col overflow-y-auto'>
                {children}
              </div>
            </SidebarInset>
            <InfoSidebar side='right' />
          </InfobarProvider>
        </SidebarProvider>
      </KBar>
    </Suspense>
  );
}
