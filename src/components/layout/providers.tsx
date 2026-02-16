'use client';
import React, { useState } from 'react';
import { ActiveThemeProvider } from '../themes/active-theme';
import { SuperTokensProvider } from '../auth/supertokens-provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function Providers({
  activeThemeValue,
  children
}: {
  activeThemeValue: string;
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Don't retry on auth errors — let SuperTokens handle refresh
              if (
                error instanceof Error &&
                'status' in error &&
                (error as any).status === 401
              ) {
                return false;
              }
              return failureCount < 3;
            }
          },
          mutations: {
            onError: (error) => {
              // Show toast for mutation errors (queries handle their own)
              if (error instanceof Error) {
                toast.error(error.message || 'An error occurred');
              }
            }
          }
        }
      })
  );

  return (
    <ActiveThemeProvider initialTheme={activeThemeValue}>
      <SuperTokensProvider>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </SuperTokensProvider>
    </ActiveThemeProvider>
  );
}
