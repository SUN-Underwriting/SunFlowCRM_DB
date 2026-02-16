'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { activitiesApi } from '@/lib/api/crm-client';
import { toast } from 'sonner';
import type { ActivityType } from '@prisma/client';
import type { ActivityWithRelations } from '@/lib/api/crm-types';

/**
 * Activities Query Keys
 * Best Practice (Context7): Centralized query keys for cache management
 */
export const activitiesKeys = {
  all: ['activities'] as const,
  lists: () => [...activitiesKeys.all, 'list'] as const,
  list: (filters: ActivitiesFilters) =>
    [...activitiesKeys.lists(), filters] as const,
  details: () => [...activitiesKeys.all, 'detail'] as const,
  detail: (id: string) => [...activitiesKeys.details(), id] as const
};

export interface ActivitiesFilters {
  type?: ActivityType;
  ownerId?: string;
  dealId?: string;
  personId?: string;
  done?: boolean;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  skip?: number;
  take?: number;
}

/**
 * Hook to fetch activities list with server-side filtering
 */
export function useActivities(filters: ActivitiesFilters = {}) {
  return useQuery({
    queryKey: activitiesKeys.list(filters),
    queryFn: async () => {
      const response = await activitiesApi.list(filters);
      return response.data;
    },
    staleTime: 30 * 1000 // 30 seconds
  });
}

/**
 * Hook to fetch single activity by ID
 */
export function useActivity(id: string) {
  return useQuery({
    queryKey: activitiesKeys.detail(id),
    queryFn: async () => {
      const response = await activitiesApi.getById(id);
      return response.data;
    },
    enabled: !!id
  });
}

/**
 * Hook to create a new activity
 */
export function useCreateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      type: ActivityType;
      subject: string;
      dueAt?: Date;
      dealId?: string;
      personId?: string;
      organizationId?: string;
      note?: string;
    }) => {
      // Context7: Map frontend field names to API schema
      const response = await activitiesApi.create({
        type: data.type,
        subject: data.subject,
        dueAt: data.dueAt,
        dealId: data.dealId,
        personId: data.personId,
        orgId: data.organizationId, // Map organizationId → orgId
        note: data.note
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesKeys.lists() });
      toast.success('Activity created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create activity');
    }
  });
}

/**
 * Hook to update an existing activity
 */
export function useUpdateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data
    }: {
      id: string;
      data: {
        subject?: string;
        dueAt?: Date;
        done?: boolean;
        note?: string;
      };
    }) => {
      const response = await activitiesApi.update(id, data);
      return response.data;
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: activitiesKeys.detail(id) });
      const previousActivity = queryClient.getQueryData(
        activitiesKeys.detail(id)
      );
      return { previousActivity };
    },
    onError: (error: Error, variables, context) => {
      if (context?.previousActivity) {
        queryClient.setQueryData(
          activitiesKeys.detail(variables.id),
          context.previousActivity
        );
      }
      toast.error(error.message || 'Failed to update activity');
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: activitiesKeys.detail(variables.id)
      });
      queryClient.invalidateQueries({ queryKey: activitiesKeys.lists() });
      toast.success('Activity updated successfully');
    }
  });
}

/**
 * Hook to mark activity as done/undone
 * Best Practice: Dedicated mutation for common action
 */
export function useToggleActivityDone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const response = await activitiesApi.update(id, { done });
      return response.data;
    },
    onMutate: async ({ id, done }) => {
      await queryClient.cancelQueries({ queryKey: activitiesKeys.detail(id) });
      const previousActivity = queryClient.getQueryData(
        activitiesKeys.detail(id)
      );

      // Optimistic update
      queryClient.setQueryData(
        activitiesKeys.detail(id),
        (old: ActivityWithRelations | undefined) =>
          old ? { ...old, done, completedAt: done ? new Date() : null } : old
      );

      return { previousActivity };
    },
    onError: (error: Error, variables, context) => {
      if (context?.previousActivity) {
        queryClient.setQueryData(
          activitiesKeys.detail(variables.id),
          context.previousActivity
        );
      }
      toast.error('Failed to update activity');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: activitiesKeys.lists() });
    }
  });
}

/**
 * Hook to delete an activity (soft delete)
 */
export function useDeleteActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await activitiesApi.delete(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesKeys.all });
      toast.success('Activity deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete activity');
    }
  });
}
