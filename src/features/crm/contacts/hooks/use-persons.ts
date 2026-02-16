'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { personsApi } from '@/lib/api/crm-client';
import { toast } from 'sonner';

/**
 * Persons Query Keys
 * Best Practice (Context7): Centralized query keys for cache management
 */
export const personsKeys = {
  all: ['persons'] as const,
  lists: () => [...personsKeys.all, 'list'] as const,
  list: (filters: PersonsFilters) => [...personsKeys.lists(), filters] as const,
  details: () => [...personsKeys.all, 'detail'] as const,
  detail: (id: string) => [...personsKeys.details(), id] as const
};

export interface PersonsFilters {
  orgId?: string;
  search?: string;
  skip?: number;
  take?: number;
}

/**
 * Hook to fetch persons list with server-side filtering
 */
export function usePersons(filters: PersonsFilters = {}) {
  return useQuery({
    queryKey: personsKeys.list(filters),
    queryFn: async () => {
      const response = await personsApi.list(filters);
      return response.data;
    },
    staleTime: 30 * 1000 // 30 seconds
  });
}

/**
 * Hook to fetch single person by ID
 */
export function usePerson(id: string) {
  return useQuery({
    queryKey: personsKeys.detail(id),
    queryFn: async () => {
      const response = await personsApi.getById(id);
      return response.data;
    },
    enabled: !!id
  });
}

/**
 * Hook to create a new person
 * Best Practice: Optimistic updates + cache invalidation
 */
export function useCreatePerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      firstName: string;
      lastName: string;
      email?: string;
      phone?: string;
      jobTitle?: string;
      organizationId?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customData?: any;
    }) => {
      // Map frontend field names to API schema
      const response = await personsApi.create({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        jobTitle: data.jobTitle,
        orgId: data.organizationId, // Map organizationId → orgId
        customData: data.customData
      });
      return response.data;
    },
    onSuccess: () => {
      // Invalidate all person lists
      queryClient.invalidateQueries({ queryKey: personsKeys.lists() });
      toast.success('Contact created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create contact');
    }
  });
}

/**
 * Hook to update an existing person
 */
export function useUpdatePerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data
    }: {
      id: string;
      data: {
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
        jobTitle?: string;
        organizationId?: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        customData?: any;
      };
    }) => {
      // Map frontend field names to API schema
      const response = await personsApi.update(id, {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        jobTitle: data.jobTitle,
        orgId: data.organizationId, // Map organizationId → orgId
        customData: data.customData
      });
      return response.data;
    },
    onMutate: async ({ id }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: personsKeys.detail(id) });

      // Snapshot previous value
      const previousPerson = queryClient.getQueryData(personsKeys.detail(id));
      return { previousPerson };
    },
    onError: (error: Error, variables, context) => {
      // Rollback on error
      if (context?.previousPerson) {
        queryClient.setQueryData(
          personsKeys.detail(variables.id),
          context.previousPerson
        );
      }
      toast.error(error.message || 'Failed to update contact');
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: personsKeys.detail(variables.id)
      });
      queryClient.invalidateQueries({ queryKey: personsKeys.lists() });
      toast.success('Contact updated successfully');
    }
  });
}

/**
 * Hook to delete a person (soft delete)
 */
export function useDeletePerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await personsApi.delete(id);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate all person queries
      queryClient.invalidateQueries({ queryKey: personsKeys.all });
      toast.success('Contact deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete contact');
    }
  });
}
