'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationsApi } from '@/lib/api/crm-client';
import { toast } from 'sonner';

/**
 * Organizations Query Keys
 * Best Practice (Context7): Centralized query keys for cache management
 */
export const organizationsKeys = {
  all: ['organizations'] as const,
  lists: () => [...organizationsKeys.all, 'list'] as const,
  list: (filters: OrganizationsFilters) =>
    [...organizationsKeys.lists(), filters] as const,
  details: () => [...organizationsKeys.all, 'detail'] as const,
  detail: (id: string) => [...organizationsKeys.details(), id] as const
};

export interface OrganizationsFilters {
  industry?: string;
  search?: string;
  skip?: number;
  take?: number;
  sortBy?: string;
  sortDesc?: boolean;
}

/**
 * Hook to fetch organizations list with server-side filtering
 */
export function useOrganizations(filters: OrganizationsFilters = {}) {
  return useQuery({
    queryKey: organizationsKeys.list(filters),
    queryFn: async () => {
      const response = await organizationsApi.list(filters);
      return response.data;
    },
    staleTime: 30 * 1000 // 30 seconds
  });
}

/**
 * Hook to fetch single organization by ID
 */
export function useOrganization(id: string) {
  return useQuery({
    queryKey: organizationsKeys.detail(id),
    queryFn: async () => {
      const response = await organizationsApi.getById(id);
      return response.data;
    },
    enabled: !!id
  });
}

/**
 * Hook to create a new organization
 * Best Practice: Optimistic updates + cache invalidation
 */
export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      industry?: string;
      size?: string;
      website?: string;
      phone?: string;
      address?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customData?: any;
    }) => {
      const response = await organizationsApi.create(data);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate all organization lists
      queryClient.invalidateQueries({ queryKey: organizationsKeys.lists() });
      toast.success('Organization created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create organization');
    }
  });
}

/**
 * Hook to update an existing organization
 */
export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data
    }: {
      id: string;
      data: {
        name?: string;
        industry?: string;
        size?: string;
        website?: string;
        phone?: string;
        address?: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        customData?: any;
      };
    }) => {
      const response = await organizationsApi.update(id, data);
      return response.data;
    },
    onMutate: async ({ id }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({
        queryKey: organizationsKeys.detail(id)
      });

      // Snapshot previous value
      const previousOrganization = queryClient.getQueryData(
        organizationsKeys.detail(id)
      );
      return { previousOrganization };
    },
    onError: (error: Error, variables, context) => {
      // Rollback on error
      if (context?.previousOrganization) {
        queryClient.setQueryData(
          organizationsKeys.detail(variables.id),
          context.previousOrganization
        );
      }
      toast.error(error.message || 'Failed to update organization');
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: organizationsKeys.detail(variables.id)
      });
      queryClient.invalidateQueries({ queryKey: organizationsKeys.lists() });
      toast.success('Organization updated successfully');
    }
  });
}

/**
 * Hook to delete an organization (soft delete)
 */
export function useDeleteOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await organizationsApi.delete(id);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate all organization queries
      queryClient.invalidateQueries({ queryKey: organizationsKeys.all });
      toast.success('Organization deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete organization');
    }
  });
}
