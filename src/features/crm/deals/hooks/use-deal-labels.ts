'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dealLabelsApi } from '@/lib/api/crm-client';
import { toast } from 'sonner';
import type { DealLabel } from '@prisma/client';

/**
 * Deal Labels Query Keys
 */
export const dealLabelsKeys = {
  all: ['deal-labels'] as const,
  lists: () => [...dealLabelsKeys.all, 'list'] as const
};

/**
 * Hook to fetch all deal labels
 */
export function useDealLabels() {
  return useQuery({
    queryKey: dealLabelsKeys.lists(),
    queryFn: async () => {
      const response = await dealLabelsApi.list();
      return response.data.labels;
    },
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
}

/**
 * Hook to create a new deal label
 */
export function useCreateDealLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; color?: string }) => {
      const response = await dealLabelsApi.create(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dealLabelsKeys.all });
      toast.success('Label created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create label');
    }
  });
}

/**
 * Hook to update a deal label
 */
export function useUpdateDealLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data
    }: {
      id: string;
      data: { name?: string; color?: string };
    }) => {
      const response = await dealLabelsApi.update(id, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dealLabelsKeys.all });
      toast.success('Label updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update label');
    }
  });
}

/**
 * Hook to delete a deal label
 */
export function useDeleteDealLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await dealLabelsApi.delete(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dealLabelsKeys.all });
      toast.success('Label deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete label');
    }
  });
}
