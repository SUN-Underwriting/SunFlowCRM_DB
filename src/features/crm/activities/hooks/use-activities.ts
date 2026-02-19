'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { activitiesApi } from '@/lib/api/crm-client';
import { toast } from 'sonner';
import type { ActivityType, BusyFlag } from '@prisma/client';
import type { ActivityWithRelations } from '@/lib/api/crm-types';

export const activitiesKeys = {
  all: ['activities'] as const,
  lists: () => [...activitiesKeys.all, 'list'] as const,
  list: (filters: ActivitiesFilters) => [...activitiesKeys.lists(), filters] as const,
  details: () => [...activitiesKeys.all, 'detail'] as const,
  detail: (id: string) => [...activitiesKeys.details(), id] as const
};

export interface ActivitiesFilters {
  status?: 'todo' | 'done' | 'all';
  type?: ActivityType;
  owner?: string;
  dealId?: string;
  leadId?: string;
  personId?: string;
  orgId?: string;
  due?: 'overdue' | 'today' | 'week' | 'range';
  from?: string;
  to?: string;
  q?: string;
  sortBy?: string;
  sortDesc?: boolean;
  skip?: number;
  take?: number;
}

export function useActivities(filters: ActivitiesFilters = {}) {
  return useQuery({
    queryKey: activitiesKeys.list(filters),
    queryFn: async () => {
      const response = await activitiesApi.list(filters);
      return response.data;
    },
    staleTime: 30 * 1000
  });
}

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

export function useCreateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      type: ActivityType;
      subject: string;
      dueAt?: Date;
      hasTime?: boolean;
      durationMin?: number;
      busyFlag?: BusyFlag;
      dealId?: string;
      leadId?: string;
      personId?: string;
      orgId?: string;
      note?: string;
    }) => {
      const response = await activitiesApi.create({
        ...data,
        dueAt: data.dueAt?.toISOString()
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesKeys.lists() });
      toast.success('Activity created');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create activity');
    }
  });
}

export function useUpdateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data
    }: {
      id: string;
      data: {
        type?: ActivityType;
        subject?: string;
        dueAt?: Date | null;
        hasTime?: boolean;
        durationMin?: number | null;
        busyFlag?: BusyFlag;
        done?: boolean;
        ownerId?: string;
        dealId?: string | null;
        leadId?: string | null;
        personId?: string | null;
        orgId?: string | null;
        note?: string;
      };
    }) => {
      const response = await activitiesApi.update(id, {
        ...data,
        dueAt: data.dueAt === null ? null : data.dueAt?.toISOString()
      });
      return response.data;
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: activitiesKeys.detail(id) });
      const previous = queryClient.getQueryData(activitiesKeys.detail(id));
      return { previous };
    },
    onError: (error: Error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(activitiesKeys.detail(variables.id), context.previous);
      }
      toast.error(error.message || 'Failed to update activity');
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: activitiesKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: activitiesKeys.lists() });
      toast.success('Activity updated');
    }
  });
}

export function useToggleActivityDone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const response = await activitiesApi.update(id, { done });
      return response.data;
    },
    onMutate: async ({ id, done }) => {
      await queryClient.cancelQueries({ queryKey: activitiesKeys.detail(id) });
      const previous = queryClient.getQueryData(activitiesKeys.detail(id));
      queryClient.setQueryData(
        activitiesKeys.detail(id),
        (old: ActivityWithRelations | undefined) =>
          old ? { ...old, done, completedAt: done ? new Date() : null } : old
      );
      return { previous };
    },
    onError: (error: Error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(activitiesKeys.detail(variables.id), context.previous);
      }
      toast.error('Failed to update activity');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: activitiesKeys.lists() });
    }
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await activitiesApi.delete(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesKeys.all });
      toast.success('Activity deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete activity');
    }
  });
}

export function useBulkActivities() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Parameters<typeof activitiesApi.bulk>[0]) => {
      const response = await activitiesApi.bulk(data);
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: activitiesKeys.lists() });
      const labels: Record<string, string> = {
        markDone: 'marked as done',
        markUndone: 'reopened',
        changeOwner: 'reassigned',
        changeType: 'type changed',
        shiftDueDate: 'due date updated',
        delete: 'deleted'
      };
      toast.success(`${data.count} activities ${labels[variables.action] || 'updated'}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Bulk action failed');
    }
  });
}
