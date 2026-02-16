'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { emailsApi } from '@/lib/api/crm-client';
import { toast } from 'sonner';

/**
 * Emails Query Keys
 * Best Practice (Context7): Centralized query keys for cache management
 */
export const emailsKeys = {
  all: ['emails'] as const,
  lists: () => [...emailsKeys.all, 'list'] as const,
  list: (filters: EmailsFilters) => [...emailsKeys.lists(), filters] as const,
  details: () => [...emailsKeys.all, 'detail'] as const,
  detail: (id: string) => [...emailsKeys.details(), id] as const,
  threads: () => [...emailsKeys.all, 'thread'] as const,
  thread: (threadId: string) => [...emailsKeys.threads(), threadId] as const
};

export interface EmailsFilters {
  direction?: 'INCOMING' | 'OUTGOING'; // Context7: Match Prisma enum values
  dealId?: string;
  personId?: string;
  threadId?: string;
  search?: string;
  skip?: number;
  take?: number;
}

/**
 * Hook to fetch emails list with server-side filtering
 */
export function useEmails(filters: EmailsFilters = {}) {
  return useQuery({
    queryKey: emailsKeys.list(filters),
    queryFn: async () => {
      const response = await emailsApi.list(filters);
      return response.data;
    },
    staleTime: 30 * 1000 // 30 seconds
  });
}

/**
 * Hook to fetch single email by ID
 */
export function useEmail(id: string) {
  return useQuery({
    queryKey: emailsKeys.detail(id),
    queryFn: async () => {
      const response = await emailsApi.getById(id);
      return response.data;
    },
    enabled: !!id
  });
}

/**
 * Hook to create/send a new email (mock for now)
 */
export function useCreateEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      to: string;
      subject: string;
      bodyPreview: string;
      dealId?: string;
      personId?: string;
      organizationId?: string;
    }) => {
      const response = await emailsApi.create({
        to: data.to,
        subject: data.subject,
        bodyPreview: data.bodyPreview,
        direction: 'OUTGOING', // Context7: Use Prisma enum value
        // FIXME: Get actual user email from session/auth context
        from: 'system@sunmga.com',
        sentAt: new Date(),
        dealId: data.dealId,
        personId: data.personId,
        orgId: data.organizationId // Map organizationId → orgId
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailsKeys.lists() });
      toast.success('Email sent successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send email');
    }
  });
}

/**
 * Hook to delete an email
 */
export function useDeleteEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await emailsApi.delete(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailsKeys.all });
      toast.success('Email deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete email');
    }
  });
}
