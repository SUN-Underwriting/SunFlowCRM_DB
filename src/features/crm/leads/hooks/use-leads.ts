'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '@/lib/api/crm-client';
import { toast } from 'sonner';
import type { LeadStatus } from '@prisma/client';
import { dealsKeys } from '@/features/crm/deals/hooks/use-deals';

/**
 * Leads Query Keys
 * Best Practice (Context7): Centralize query keys for consistency
 */
export const leadsKeys = {
  all: ['leads'] as const,
  lists: () => [...leadsKeys.all, 'list'] as const,
  list: (filters: LeadsFilters) => [...leadsKeys.lists(), filters] as const,
  details: () => [...leadsKeys.all, 'detail'] as const,
  detail: (id: string) => [...leadsKeys.details(), id] as const
};

export interface LeadsFilters {
  search?: string;
  status?: LeadStatus;
  source?: string;
  ownerId?: string;
  skip?: number;
  take?: number;
}

/**
 * Hook to fetch leads list with server-side pagination and filtering
 * Best Practice (Context7): Type-safe query with proper error handling
 */
export function useLeads(filters: LeadsFilters = {}) {
  return useQuery({
    queryKey: leadsKeys.list(filters),
    queryFn: async () => {
      const response = await leadsApi.list(filters);
      return response.data;
    },
    staleTime: 30 * 1000 // 30 seconds
  });
}

/**
 * Hook to fetch single lead by ID
 */
export function useLead(id: string) {
  return useQuery({
    queryKey: leadsKeys.detail(id),
    queryFn: async () => {
      const response = await leadsApi.getById(id);
      return response.data;
    },
    enabled: !!id
  });
}

/**
 * Hook to create a new lead
 * Best Practice (Context7): Optimistic updates + cache invalidation
 */
export function useCreateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      source?: string;
      personId?: string;
      orgId?: string;
    }) => {
      const response = await leadsApi.create(data);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate all lead lists to trigger refetch
      queryClient.invalidateQueries({ queryKey: leadsKeys.lists() });
      toast.success('Lead created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create lead');
    }
  });
}

/**
 * Hook to update an existing lead
 */
export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data
    }: {
      id: string;
      data: {
        title?: string;
        source?: string;
        status?: LeadStatus;
        personId?: string;
        orgId?: string;
      };
    }) => {
      const response = await leadsApi.update(id, data);
      return response.data;
    },
    onMutate: async ({ id }) => {
      // Cancel outgoing queries for this lead
      await queryClient.cancelQueries({ queryKey: leadsKeys.detail(id) });

      // Snapshot previous value for rollback
      const previousLead = queryClient.getQueryData(leadsKeys.detail(id));
      return { previousLead };
    },
    onError: (error: Error, _variables, context) => {
      // Rollback on error
      if (context?.previousLead) {
        queryClient.setQueryData(
          leadsKeys.detail(_variables.id),
          context.previousLead
        );
      }
      toast.error(error.message || 'Failed to update lead');
    },
    onSuccess: (_data, variables) => {
      // Invalidate detail and list queries
      queryClient.invalidateQueries({
        queryKey: leadsKeys.detail(variables.id)
      });
      queryClient.invalidateQueries({ queryKey: leadsKeys.lists() });
      toast.success('Lead updated successfully');
    }
  });
}

/**
 * Hook to delete a lead (soft delete)
 */
export function useDeleteLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await leadsApi.delete(id);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate all lead queries (lists and details)
      queryClient.invalidateQueries({ queryKey: leadsKeys.all });
      toast.success('Lead deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete lead');
    }
  });
}

/**
 * Hook to convert a lead to a deal
 * Best Practice: Complex mutations with multiple entity updates
 */
export function useConvertLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data
    }: {
      id: string;
      data: {
        pipelineId: string;
        stageId: string;
        dealTitle?: string;
        dealValue?: number;
        currency?: string;
        expectedCloseDate?: Date;
      };
    }) => {
      const response = await leadsApi.convert(id, data);
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate leads cache
      queryClient.invalidateQueries({ queryKey: leadsKeys.lists() });

      // Invalidate deals cache using proper query keys
      queryClient.invalidateQueries({ queryKey: dealsKeys.lists() });
      if (variables.data.pipelineId) {
        queryClient.invalidateQueries({
          queryKey: dealsKeys.byPipeline(variables.data.pipelineId)
        });
      }

      toast.success('Lead converted to deal successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to convert lead');
    }
  });
}
