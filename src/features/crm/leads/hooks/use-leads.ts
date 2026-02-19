'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi, leadLabelsApi } from '@/lib/api/crm-client';
import { toast } from 'sonner';
import type { LeadStatus } from '@prisma/client';
import { dealsKeys } from '@/features/crm/deals/hooks/use-deals';

/**
 * Leads Query Keys
 */
export const leadsKeys = {
  all: ['leads'] as const,
  lists: () => [...leadsKeys.all, 'list'] as const,
  list: (filters: LeadsFilters) => [...leadsKeys.lists(), filters] as const,
  details: () => [...leadsKeys.all, 'detail'] as const,
  detail: (id: string) => [...leadsKeys.details(), id] as const,
  notes: (id: string) => [...leadsKeys.all, 'notes', id] as const,
  timeline: (id: string, types?: string) =>
    [...leadsKeys.all, 'timeline', id, types] as const,
  labels: () => ['lead-labels'] as const
};

export interface LeadsFilters {
  search?: string;
  status?: LeadStatus;
  source?: string;
  ownerId?: string;
  wasSeen?: boolean;
  skip?: number;
  take?: number;
}

/**
 * Hook to fetch leads list with server-side pagination and filtering
 */
export function useLeads(filters: LeadsFilters = {}) {
  return useQuery({
    queryKey: leadsKeys.list(filters),
    queryFn: async () => {
      const response = await leadsApi.list(filters);
      return response.data;
    },
    staleTime: 30 * 1000
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
 */
export function useCreateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      source?: string;
      origin?: string;
      inboxChannel?: string;
      externalSourceId?: string;
      valueAmount?: number;
      valueCurrency?: string;
      expectedCloseDate?: Date;
      personId?: string;
      orgId?: string;
      labelIds?: string[];
      customData?: Record<string, unknown>;
    }) => {
      const response = await leadsApi.create(data);
      return response.data;
    },
    onSuccess: () => {
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
      data: Record<string, unknown>;
    }) => {
      const response = await leadsApi.update(id, data);
      return response.data;
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: leadsKeys.detail(id) });
      const previousLead = queryClient.getQueryData(leadsKeys.detail(id));
      return { previousLead };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousLead) {
        queryClient.setQueryData(
          leadsKeys.detail(_variables.id),
          context.previousLead
        );
      }
      toast.error(error.message || 'Failed to update lead');
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: leadsKeys.detail(variables.id)
      });
      queryClient.invalidateQueries({ queryKey: leadsKeys.lists() });
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
      queryClient.invalidateQueries({ queryKey: leadsKeys.all });
      toast.success('Lead deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete lead');
    }
  });
}

/**
 * Hook to archive a lead
 */
export function useArchiveLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await leadsApi.archive(id);
      return response.data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: leadsKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: leadsKeys.lists() });
      toast.success('Lead archived');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to archive lead');
    }
  });
}

/**
 * Hook to restore a lead from archived
 */
export function useRestoreLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await leadsApi.restore(id);
      return response.data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: leadsKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: leadsKeys.lists() });
      toast.success('Lead restored');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to restore lead');
    }
  });
}

/**
 * Hook to mark lead as seen
 */
export function useMarkLeadSeen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await leadsApi.markSeen(id);
      return response.data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: leadsKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: leadsKeys.lists() });
    }
  });
}

/**
 * Hook to convert a lead to a deal
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
      queryClient.invalidateQueries({ queryKey: leadsKeys.lists() });
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

/**
 * Hook to fetch lead notes
 */
export function useLeadNotes(leadId: string) {
  return useQuery({
    queryKey: leadsKeys.notes(leadId),
    queryFn: async () => {
      const response = await leadsApi.getNotes(leadId);
      return response.data;
    },
    enabled: !!leadId
  });
}

/**
 * Hook to create a note on a lead
 */
export function useCreateLeadNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      leadId,
      data
    }: {
      leadId: string;
      data: { body: string; pinned?: boolean };
    }) => {
      const response = await leadsApi.createNote(leadId, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: leadsKeys.notes(variables.leadId)
      });
      queryClient.invalidateQueries({
        queryKey: leadsKeys.timeline(variables.leadId)
      });
      toast.success('Note added');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add note');
    }
  });
}

/**
 * Hook to fetch lead timeline
 */
export function useLeadTimeline(leadId: string, types?: string) {
  return useQuery({
    queryKey: leadsKeys.timeline(leadId, types),
    queryFn: async () => {
      const response = await leadsApi.getTimeline(leadId, { types });
      return response.data;
    },
    enabled: !!leadId
  });
}

/**
 * Hook to fetch lead labels
 */
export function useLeadLabels() {
  return useQuery({
    queryKey: leadsKeys.labels(),
    queryFn: async () => {
      const response = await leadLabelsApi.list();
      return response.data.labels;
    },
    staleTime: 5 * 60 * 1000
  });
}
