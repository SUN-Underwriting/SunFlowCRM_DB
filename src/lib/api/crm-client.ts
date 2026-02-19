/**
 * Type-safe API client for CRM endpoints
 */

import {
  OrganizationWithRelations,
  PersonWithRelations,
  LeadWithRelations,
  DealWithRelations,
  PipelineWithRelations,
  StageWithRelations,
  ActivityWithRelations,
  EmailWithRelations,
  NoteWithRelations,
  TimelineItem,
  PipelineWithDealsResponse,
  LeadConvertResponse,
  DeleteResponse
} from './crm-types';
import type { LeadLabel, DealLabel } from '@prisma/client';

// Base API configuration
const API_BASE = '/api/crm';

/**
 * Generic API request handler
 * Exported for use in other modules (e.g., dashboard)
 * Context7: Improved error extraction with status code and field errors
 */
export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<{ data: T }> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      error: { message: `Request failed with status ${response.status}` }
    }));

    // Extract error message with fallback hierarchy
    const message =
      errorData.error?.message ||
      errorData.message ||
      `Request failed with status ${response.status}`;

    // Create error with status and field details if available
    const error = new Error(message) as Error & {
      status?: number;
      fields?: Record<string, string[]>;
    };
    error.status = response.status;

    // Attach field errors if present (validation errors)
    if (errorData.error?.fields) {
      error.fields = errorData.error.fields;
    }

    throw error;
  }

  return response.json();
}

// Organizations API
export const organizationsApi = {
  list: (params?: {
    search?: string;
    industry?: string;
    size?: string;
    skip?: number;
    take?: number;
    sortBy?: string;
    sortDesc?: boolean;
  }) => {
    const query = new URLSearchParams(
      Object.entries(params || {})
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    );
    return apiRequest<{
      organizations: OrganizationWithRelations[];
      total: number;
    }>(`/organizations?${query}`);
  },
  getById: (id: string) =>
    apiRequest<OrganizationWithRelations>(`/organizations/${id}`),
  create: (data: Partial<OrganizationWithRelations>) =>
    apiRequest<OrganizationWithRelations>('/organizations', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  update: (id: string, data: Partial<OrganizationWithRelations>) =>
    apiRequest<OrganizationWithRelations>(`/organizations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  delete: (id: string) =>
    apiRequest<{ success: boolean }>(`/organizations/${id}`, {
      method: 'DELETE'
    }),
  getTimeline: (
    id: string,
    params?: { types?: string; skip?: number; take?: number }
  ) => {
    const query = new URLSearchParams(
      Object.entries(params || {})
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    );
    return apiRequest<{ items: TimelineItem[]; total: number }>(
      `/organizations/${id}/timeline?${query}`
    );
  },
  attachPersonsByDomain: (id: string) =>
    apiRequest<{ attachedCount: number; message: string }>(
      `/organizations/${id}/attach-persons-by-domain`,
      {
        method: 'POST'
      }
    )
};

// Persons API
export const personsApi = {
  list: (params?: {
    search?: string;
    orgId?: string;
    skip?: number;
    take?: number;
  }) => {
    const query = new URLSearchParams(
      Object.entries(params || {})
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    );
    return apiRequest<{
      persons: PersonWithRelations[];
      total: number;
    }>(`/persons?${query}`);
  },
  getById: (id: string) => apiRequest<PersonWithRelations>(`/persons/${id}`),
  create: (data: Partial<PersonWithRelations>) =>
    apiRequest<PersonWithRelations>('/persons', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  update: (id: string, data: Partial<PersonWithRelations>) =>
    apiRequest<PersonWithRelations>(`/persons/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  delete: (id: string) =>
    apiRequest<{ success: boolean }>(`/persons/${id}`, {
      method: 'DELETE'
    })
};

// Leads API
export const leadsApi = {
  list: (params?: {
    status?: string;
    source?: string;
    ownerId?: string;
    search?: string;
    wasSeen?: boolean;
    skip?: number;
    take?: number;
  }) => {
    const query = new URLSearchParams(
      Object.entries(params || {})
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    );
    return apiRequest<{
      leads: LeadWithRelations[];
      total: number;
    }>(`/leads?${query}`);
  },
  getById: (id: string) => apiRequest<LeadWithRelations>(`/leads/${id}`),
  create: (data: Record<string, unknown>) =>
    apiRequest<LeadWithRelations>('/leads', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  update: (id: string, data: Record<string, unknown>) =>
    apiRequest<LeadWithRelations>(`/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  delete: (id: string) =>
    apiRequest<{ success: boolean }>(`/leads/${id}`, {
      method: 'DELETE'
    }),
  convert: (id: string, data: Record<string, unknown>) =>
    apiRequest<{ deal: DealWithRelations; lead: LeadWithRelations }>(
      `/leads/${id}/convert`,
      {
        method: 'POST',
        body: JSON.stringify(data)
      }
    ),
  archive: (id: string) =>
    apiRequest<LeadWithRelations>(`/leads/${id}/archive`, {
      method: 'POST'
    }),
  restore: (id: string) =>
    apiRequest<LeadWithRelations>(`/leads/${id}/restore`, {
      method: 'POST'
    }),
  markSeen: (id: string) =>
    apiRequest<LeadWithRelations>(`/leads/${id}/seen`, {
      method: 'POST'
    }),
  getNotes: (id: string, params?: { pinned?: boolean; skip?: number; take?: number }) => {
    const query = new URLSearchParams(
      Object.entries(params || {})
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    );
    return apiRequest<{ notes: NoteWithRelations[]; total: number }>(
      `/leads/${id}/notes?${query}`
    );
  },
  createNote: (id: string, data: { body: string; pinned?: boolean }) =>
    apiRequest<NoteWithRelations>(`/leads/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  getTimeline: (
    id: string,
    params?: { types?: string; skip?: number; take?: number }
  ) => {
    const query = new URLSearchParams(
      Object.entries(params || {})
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    );
    return apiRequest<{ items: TimelineItem[]; total: number }>(
      `/leads/${id}/timeline?${query}`
    );
  }
};

// Lead Labels API
export const leadLabelsApi = {
  list: () => apiRequest<{ labels: LeadLabel[] }>('/lead-labels'),
  create: (data: { name: string; color?: string }) =>
    apiRequest<LeadLabel>('/lead-labels', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  update: (id: string, data: { name?: string; color?: string }) =>
    apiRequest<LeadLabel>(`/lead-labels/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  delete: (id: string) =>
    apiRequest<{ success: boolean }>(`/lead-labels/${id}`, {
      method: 'DELETE'
    })
};

// Deal Labels API
export const dealLabelsApi = {
  list: () => apiRequest<{ labels: DealLabel[] }>('/deal-labels'),
  create: (data: { name: string; color?: string }) =>
    apiRequest<DealLabel>('/deal-labels', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  update: (id: string, data: { name?: string; color?: string }) =>
    apiRequest<DealLabel>(`/deal-labels/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  delete: (id: string) =>
    apiRequest<{ success: boolean }>(`/deal-labels/${id}`, {
      method: 'DELETE'
    })
};

// Notes API (for standalone CRUD)
export const notesApi = {
  update: (id: string, data: { body?: string; pinned?: boolean }) =>
    apiRequest<NoteWithRelations>(`/notes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  delete: (id: string) =>
    apiRequest<{ success: boolean }>(`/notes/${id}`, {
      method: 'DELETE'
    })
};

// Deals API
export const dealsApi = {
  list: (params?: {
    pipelineId?: string;
    stageId?: string;
    ownerId?: string;
    status?: string;
    search?: string;
    skip?: number;
    take?: number;
  }) => {
    const query = new URLSearchParams(
      Object.entries(params || {})
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    );
    return apiRequest<{
      deals: DealWithRelations[];
      total: number;
    }>(`/deals?${query}`);
  },
  getById: (id: string) => apiRequest<DealWithRelations>(`/deals/${id}`),
  getByPipeline: (pipelineId: string) =>
    apiRequest<{
      pipeline: PipelineWithRelations;
      stages: StageWithRelations[];
      deals: DealWithRelations[];
    }>(`/pipelines/${pipelineId}/deals`),
  create: (data: Partial<DealWithRelations>) =>
    apiRequest<DealWithRelations>('/deals', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  update: (id: string, data: Partial<DealWithRelations>) =>
    apiRequest<DealWithRelations>(`/deals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  delete: (id: string) =>
    apiRequest<{ success: boolean }>(`/deals/${id}`, {
      method: 'DELETE'
    }),
  moveToStage: (id: string, stageId: string) =>
    apiRequest<DealWithRelations>(`/deals/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ stageId })
    }),
  markAsWon: (id: string) =>
    apiRequest<DealWithRelations>(`/deals/${id}/won`, {
      method: 'POST'
    }),
  markAsLost: (id: string, reason?: string) =>
    apiRequest<DealWithRelations>(`/deals/${id}/lost`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    }),
  reopen: (id: string) =>
    apiRequest<DealWithRelations>(`/deals/${id}/reopen`, {
      method: 'POST'
    })
};

// Pipelines API
export const pipelinesApi = {
  list: () => apiRequest<{ pipelines: PipelineWithRelations[] }>('/pipelines'),
  getById: (id: string) =>
    apiRequest<PipelineWithRelations>(`/pipelines/${id}`),
  create: (data: Partial<PipelineWithRelations>) =>
    apiRequest<PipelineWithRelations>('/pipelines', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  update: (id: string, data: Partial<PipelineWithRelations>) =>
    apiRequest<PipelineWithRelations>(`/pipelines/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  delete: (id: string) =>
    apiRequest<{ success: boolean }>(`/pipelines/${id}`, {
      method: 'DELETE'
    }),
  getStages: (id: string) =>
    apiRequest<{ stages: StageWithRelations[] }>(`/pipelines/${id}/stages`)
};

// Activities API
export const activitiesApi = {
  list: (params?: {
    status?: 'todo' | 'done' | 'all';
    type?: string;
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
  }) => {
    const query = new URLSearchParams(
      Object.entries(params || {})
        .filter(([_, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)])
    );
    return apiRequest<{
      activities: ActivityWithRelations[];
      total: number;
    }>(`/activities?${query}`);
  },
  getById: (id: string) =>
    apiRequest<ActivityWithRelations>(`/activities/${id}`),
  create: (data: Record<string, unknown>) =>
    apiRequest<ActivityWithRelations>('/activities', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  update: (id: string, data: Record<string, unknown>) =>
    apiRequest<ActivityWithRelations>(`/activities/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  delete: (id: string) =>
    apiRequest<{ success: boolean }>(`/activities/${id}`, {
      method: 'DELETE'
    }),
  bulk: (data: {
    ids: string[];
    action: 'markDone' | 'markUndone' | 'changeOwner' | 'changeType' | 'shiftDueDate' | 'delete';
    ownerId?: string;
    type?: string;
    dueDateShiftDays?: number;
  }) =>
    apiRequest<{ success: boolean; count: number }>('/activities/bulk', {
      method: 'POST',
      body: JSON.stringify(data)
    })
};

// Stages API
export const stagesApi = {
  listByPipeline: (pipelineId: string) =>
    apiRequest<StageWithRelations[]>(`/stages?pipelineId=${pipelineId}`),
  getById: (id: string) => apiRequest<StageWithRelations>(`/stages/${id}`),
  create: (data: Partial<StageWithRelations>) =>
    apiRequest<StageWithRelations>('/stages', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  update: (id: string, data: Partial<StageWithRelations>) =>
    apiRequest<StageWithRelations>(`/stages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  delete: (id: string) =>
    apiRequest<{ success: boolean }>(`/stages/${id}`, {
      method: 'DELETE'
    })
};

// Emails API
export const emailsApi = {
  list: (params?: {
    direction?: string;
    dealId?: string;
    personId?: string;
    threadId?: string;
    search?: string;
    skip?: number;
    take?: number;
  }) => {
    const query = new URLSearchParams(
      Object.entries(params || {})
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    );
    return apiRequest<{
      emails: EmailWithRelations[];
      total: number;
    }>(`/emails?${query}`);
  },
  getById: (id: string) => apiRequest<EmailWithRelations>(`/emails/${id}`),
  create: (data: Partial<EmailWithRelations>) =>
    apiRequest<EmailWithRelations>('/emails', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  delete: (id: string) =>
    apiRequest<{ success: boolean }>(`/emails/${id}`, {
      method: 'DELETE'
    })
};

// Field Definitions API
export const fieldDefinitionsApi = {
  list: (params?: { entityType?: string }) => {
    const query = new URLSearchParams(
      Object.entries(params || {})
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    );
    return apiRequest<{ fieldDefinitions: any[] }>(
      `/field-definitions?${query}`
    );
  },
  getById: (id: string) => apiRequest<any>(`/field-definitions/${id}`),
  create: (data: any) =>
    apiRequest<any>('/field-definitions', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  update: (id: string, data: any) =>
    apiRequest<any>(`/field-definitions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  delete: (id: string) =>
    apiRequest<{ success: boolean }>(`/field-definitions/${id}`, {
      method: 'DELETE'
    })
};
