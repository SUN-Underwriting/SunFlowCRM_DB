'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dealsApi } from '@/lib/api/crm-client';
import { toast } from 'sonner';
import type { DealStatus } from '@prisma/client';
import type { DealWithRelations } from '@/lib/api/crm-types';

/**
 * Deals Query Keys
 * Best Practice (Context7): Centralize query keys for cache management
 */
export const dealsKeys = {
  all: ['deals'] as const,
  lists: () => [...dealsKeys.all, 'list'] as const,
  list: (filters: DealsFilters) => [...dealsKeys.lists(), filters] as const,
  byPipeline: (pipelineId: string) =>
    [...dealsKeys.all, 'pipeline', pipelineId] as const,
  details: () => [...dealsKeys.all, 'detail'] as const,
  detail: (id: string) => [...dealsKeys.details(), id] as const
};

export interface DealsFilters {
  pipelineId?: string;
  stageId?: string;
  status?: DealStatus;
  ownerId?: string;
  search?: string;
  skip?: number;
  take?: number;
}

/**
 * Hook to fetch deals list with server-side filtering
 */
export function useDeals(filters: DealsFilters = {}) {
  return useQuery({
    queryKey: dealsKeys.list(filters),
    queryFn: async () => {
      const response = await dealsApi.list(filters);
      return response.data;
    },
    staleTime: 30 * 1000 // 30 seconds
  });
}

/**
 * Hook to fetch deals by pipeline (for Kanban board)
 * Best Practice: Separate query for different views
 */
export function useDealsByPipeline(pipelineId: string) {
  return useQuery({
    queryKey: dealsKeys.byPipeline(pipelineId),
    queryFn: async () => {
      const response = await dealsApi.list({ pipelineId });
      return response.data;
    },
    enabled: !!pipelineId,
    staleTime: 30 * 1000
  });
}

/**
 * Hook to fetch single deal by ID
 */
export function useDeal(id: string) {
  return useQuery({
    queryKey: dealsKeys.detail(id),
    queryFn: async () => {
      const response = await dealsApi.getById(id);
      return response.data;
    },
    enabled: !!id
  });
}

/**
 * Hook to create a new deal
 * Best Practice: Optimistic updates for better UX
 */
export function useCreateDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      pipelineId: string;
      stageId: string;
      ownerId?: string;
      personId?: string;
      orgId?: string;
      value?: number;
      currency?: string;
      expectedCloseDate?: Date;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customData?: any;
    }) => {
      const response = await dealsApi.create(data);
      return response.data;
    },
    onSuccess: (newDeal) => {
      // Invalidate all deal lists and pipeline views
      queryClient.invalidateQueries({ queryKey: dealsKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: dealsKeys.byPipeline(newDeal.pipelineId)
      });
      toast.success('Deal created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create deal');
    }
  });
}

/**
 * Hook to update an existing deal
 */
export function useUpdateDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data
    }: {
      id: string;
      data: {
        title?: string;
        value?: number;
        currency?: string;
        expectedCloseDate?: Date;
        personId?: string;
        orgId?: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        customData?: any;
      };
    }) => {
      const response = await dealsApi.update(id, data);
      return response.data;
    },
    onMutate: async ({ id }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: dealsKeys.detail(id) });

      // Snapshot previous value
      const previousDeal = queryClient.getQueryData(dealsKeys.detail(id));
      return { previousDeal };
    },
    onError: (error: Error, variables, context) => {
      // Rollback on error
      if (context?.previousDeal) {
        queryClient.setQueryData(
          dealsKeys.detail(variables.id),
          context.previousDeal
        );
      }
      toast.error(error.message || 'Failed to update deal');
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: dealsKeys.detail(variables.id)
      });
      queryClient.invalidateQueries({ queryKey: dealsKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: dealsKeys.byPipeline(data.pipelineId)
      });
      toast.success('Deal updated successfully');
    }
  });
}

/**
 * Hook to move deal to different stage (drag & drop)
 * Best Practice (Context7): Optimistic updates for instant UI feedback
 */
export function useMoveDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, stageId }: { id: string; stageId: string }) => {
      const response = await dealsApi.moveToStage(id, stageId);
      return response.data;
    },
    onMutate: async ({ id, stageId }) => {
      // Cancel outgoing queries for this pipeline
      const deal = queryClient.getQueryData(dealsKeys.detail(id)) as
        | { pipelineId?: string }
        | undefined;
      if (deal?.pipelineId) {
        await queryClient.cancelQueries({
          queryKey: dealsKeys.byPipeline(deal.pipelineId)
        });
      }

      // Snapshot previous pipeline state
      const previousDeals = deal?.pipelineId
        ? queryClient.getQueryData(dealsKeys.byPipeline(deal.pipelineId))
        : undefined;

      // Optimistically update deal's stage
      if (deal?.pipelineId) {
        queryClient.setQueryData(
          dealsKeys.byPipeline(deal.pipelineId),
          (old: { deals: DealWithRelations[]; total: number } | undefined) => {
            if (!old?.deals) return old;
            return {
              ...old,
              deals: old.deals.map((d) => (d.id === id ? { ...d, stageId } : d))
            };
          }
        );
      }

      return { previousDeals, pipelineId: deal?.pipelineId };
    },
    onError: (error: Error, variables, context) => {
      // Rollback on error
      if (context?.previousDeals && context?.pipelineId) {
        queryClient.setQueryData(
          dealsKeys.byPipeline(context.pipelineId),
          context.previousDeals
        );
      }
      toast.error(error.message || 'Failed to move deal');
    },
    onSettled: (data, error, variables, context) => {
      // Always refetch to ensure consistency
      // Use pipelineId from context, or fallback to response data if available
      const pipelineId = context?.pipelineId || data?.pipelineId;

      if (pipelineId) {
        queryClient.invalidateQueries({
          queryKey: dealsKeys.byPipeline(pipelineId)
        });
      } else {
        // If no pipelineId available, invalidate all deals queries as fallback
        queryClient.invalidateQueries({ queryKey: dealsKeys.lists() });
      }
    }
  });
}

/**
 * Hook to delete a deal (soft delete)
 */
export function useDeleteDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await dealsApi.delete(id);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate all deal queries
      queryClient.invalidateQueries({ queryKey: dealsKeys.all });
      toast.success('Deal deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete deal');
    }
  });
}
